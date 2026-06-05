import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ─── Constants ───────────────────────────────────────────────────────────────

const FUNCTION_TAGS = [
  'pH_Decrease',
  'pH_Increase',
  'Sanitizer',
  'Alkalinity_Increase',
  'Calcium_Increase',
  'Stabilizer_Increase'
]

const UNIT_TYPES = ['Ounces', 'Pounds']

const BLANK_FORM = {
  brand: '',
  product_name: '',
  primary_chemical: '',
  concentration: '',
  function_tag: 'Sanitizer',
  unit_type: 'Pounds',
  total_volume_capacity: '',
  current_volume_level: '',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PoolBoiInventory() {
  const navigate = useNavigate()

  const [phase, setPhase] = useState('list') // 'list', 'camera', 'form'
  const [loading, setLoading] = useState(true)
  const [inventory, setInventory] = useState([])
  const [camReady, setCamReady] = useState(false)
  const [camError, setCamError] = useState(null)
  const [capturedImg, setCapturedImg] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  
  const [formData, setFormData] = useState(BLANK_FORM)
  const [saveLoading, setSaveLoading] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    fetchInventory()
  }, [])

  async function fetchInventory() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pool_boi_inventory')
        .select(`
          *,
          catalog:pool_boi_chemical_catalog (*)
        `)
        .order('last_updated', { ascending: false })
      
      if (error) throw error
      setInventory(data || [])
    } catch (err) {
      console.error('Fetch inventory error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Camera logic ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'camera') return

    let cancelled = false
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setCamReady(true)
        }
      } catch (err) {
        setCamError('Could not access camera')
      }
    }
    startCamera()
    return () => { cancelled = true; stopStream() }
  }, [phase])

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCamReady(false)
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedImg(base64)
    stopStream()
    analyzeImage(base64)
  }

  async function analyzeImage(imgData) {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/identify-chemical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imgData.split(',')[1], mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setFormData({
        ...BLANK_FORM,
        brand: data.brand || '',
        product_name: data.product_name || '',
        primary_chemical: data.primary_chemical || '',
        concentration: data.concentration || '',
        function_tag: data.function_tag || 'Sanitizer',
        unit_type: data.unit_type || 'Pounds',
        total_volume_capacity: data.total_volume_capacity || '',
        current_volume_level: data.total_volume_capacity || '', // Default to full
      })
      setPhase('form')
    } catch (err) {
      alert('AI scan failed: ' + err.message)
      setPhase('camera')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Form Handlers ──────────────────────────────────────────────────────────

  async function handleSave() {
    setSaveLoading(true)
    try {
      // 1. Check/Insert into catalog
      let { data: catData, error: catError } = await supabase
        .from('pool_boi_chemical_catalog')
        .select('id')
        .eq('brand', formData.brand)
        .eq('product_name', formData.product_name)
        .single()
      
      let catalogId
      if (catData) {
        catalogId = catData.id
      } else {
        const { data: newCat, error: newCatErr } = await supabase
          .from('pool_boi_chemical_catalog')
          .insert([{
            brand: formData.brand,
            product_name: formData.product_name,
            primary_chemical: formData.primary_chemical,
            function_tag: formData.function_tag,
            unit_type: formData.unit_type
          }])
          .select()
          .single()
        if (newCatErr) throw newCatErr
        catalogId = newCat.id
      }

      // 2. Insert into inventory
      const { error: invError } = await supabase
        .from('pool_boi_inventory')
        .insert([{
          catalog_id: catalogId,
          total_volume_capacity: formData.total_volume_capacity,
          current_volume_level: formData.current_volume_level,
        }])
      
      if (invError) throw invError
      
      await fetchInventory()
      setPhase('list')
      setFormData(BLANK_FORM)
    } catch (err) {
      alert('Save failed: ' + err.message)
    } finally {
      setSaveLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'camera') {
    return (
      <div className="pb-test-page">
        <header className="pb-test-header">
          <button className="pb-back-btn" onClick={() => setPhase('list')}>‹</button>
          <h1>Scan Bottle Label</h1>
        </header>
        <div className="pb-camera-area">
          <video ref={videoRef} className="pb-video" autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {analyzing && (
            <div className="pb-analyzing-overlay">
              <div className="pb-spinner pb-spinner-lg" />
              <p>Analyzing label…</p>
            </div>
          )}
          <div className="pb-cam-overlay">
             <div className="pb-overlay-instr pb-overlay-instr-top" style={{ gridColumn: '1 / -1' }}>
                Point at the front of the bottle
              </div>
          </div>
        </div>
        <div className="pb-cam-controls">
          <button className="pb-capture-btn" onClick={capture} disabled={!camReady || analyzing}>
            Capture
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'form') {
    return (
      <div className="pb-test-scroll">
        <header className="pb-test-header">
          <button className="pb-back-btn" onClick={() => setPhase('list')}>‹</button>
          <h1>{capturedImg ? 'Confirm Product' : 'Add Manually'}</h1>
        </header>
        <div className="pb-results-body">
          <div className="pb-overrides">
            <div className="pb-input-row">
              <label className="pb-input-label">Brand</label>
              <input 
                className="pb-number-input" style={{ width: '100%' }}
                value={formData.brand} 
                onChange={e => setFormData({...formData, brand: e.target.value})}
              />
            </div>
            <div className="pb-input-row">
              <label className="pb-input-label">Product Name</label>
              <input 
                className="pb-number-input" style={{ width: '100%' }}
                value={formData.product_name} 
                onChange={e => setFormData({...formData, product_name: e.target.value})}
              />
            </div>
            <div className="pb-input-row">
              <label className="pb-input-label">Function</label>
              <select 
                className="pb-number-input" style={{ width: '100%' }}
                value={formData.function_tag}
                onChange={e => setFormData({...formData, function_tag: e.target.value})}
              >
                {FUNCTION_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="pb-input-row">
              <label className="pb-input-label">Total Size</label>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <input 
                  type="number" className="pb-number-input" style={{ flex: 1 }}
                  value={formData.total_volume_capacity}
                  onChange={e => setFormData({...formData, total_volume_capacity: e.target.value})}
                />
                <select 
                  className="pb-number-input"
                  value={formData.unit_type}
                  onChange={e => setFormData({...formData, unit_type: e.target.value})}
                >
                  {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="pb-input-row">
              <label className="pb-input-label">Current Level ({formData.unit_type})</label>
              <input 
                type="number" className="pb-number-input" style={{ width: '100%' }}
                value={formData.current_volume_level}
                placeholder="How much is left?"
                onChange={e => setFormData({...formData, current_volume_level: e.target.value})}
              />
            </div>
          </div>
          <button className="pb-confirm-btn" onClick={handleSave} disabled={saveLoading}>
            {saveLoading ? 'Saving...' : 'Add to Shelf'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-test-scroll">
      <header className="pb-test-header">
        <button className="pb-back-btn" onClick={() => navigate('/')}>‹</button>
        <h1>My Chemical Shelf</h1>
      </header>

      <div className="pb-results-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <button className="pb-capture-btn" style={{ fontSize: '14px' }} onClick={() => setPhase('camera')}>
            Scan Label
          </button>
          <button className="pb-retake-btn" style={{ height: '52px' }} onClick={() => setPhase('form')}>
            Add Manually
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="pb-spinner" />
          </div>
        ) : inventory.length === 0 ? (
          <div className="pb-balanced">
             <p>Your shelf is empty. Add your first chemical.</p>
          </div>
        ) : (
          <div className="pb-treatment-body">
            {inventory.map(item => {
              const pct = (item.current_volume_level / item.total_volume_capacity) * 100
              const isLow = pct < 20
              return (
                <div key={item.id} className="pb-step-card" style={{ opacity: 1 }}>
                  <div className="pb-step-header">
                    <span className="pb-step-chem">
                      <strong>{item.catalog.brand}</strong> {item.catalog.product_name}
                    </span>
                  </div>
                  <div className={`pb-confidence-badge pb-confidence-medium`} style={{ marginTop: '4px' }}>
                    {item.catalog.function_tag}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span>{item.current_volume_level} {item.catalog.unit_type} remaining</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--pb-border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${pct}%`, 
                        height: '100%', 
                        background: isLow ? '#f87171' : 'var(--pb-accent)',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                  {isLow && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#f87171', fontSize: '12px', fontWeight: '700' }}>⚠ LOW STOCK</span>
                      {item.catalog.affiliate_url && (
                        <a 
                          href={item.catalog.affiliate_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="pb-cart-link"
                          style={{ padding: '0 12px', height: '32px' }}
                        >
                          Reorder
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
