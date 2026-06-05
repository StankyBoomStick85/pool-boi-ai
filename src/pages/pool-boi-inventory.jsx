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
  const [debugInfo, setDebugInfo] = useState('')

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

  async function runTestQuery() {
    try {
      const { data, error } = await supabase
        .from('pool_boi_chemical_catalog')
        .select('*')
        .limit(1)
      
      if (error) {
        alert(`ERROR: ${error.message} (Code: ${error.code})`)
      } else {
        alert(`CONNECTION OK: ${JSON.stringify(data[0] || 'No rows found')}`)
      }
    } catch (err) {
      alert(`FETCH EXCEPTION: ${err.message}`)
    }
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
    console.log('--- START SAVE TRACE (RAW FETCH) ---');
    setDebugInfo('Step 0: STARTING SAVE...')
    setSaveLoading(true)

    const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`
    };

    try {
      setDebugInfo('Step 1: Preparing catalog lookup...')
      const brandEnc = encodeURIComponent(formData.brand);
      const nameEnc = encodeURIComponent(formData.product_name);
      
      // 1. Check if product already exists in catalog
      const lookupUrl = `${SUPA_URL}/rest/v1/pool_boi_chemical_catalog?brand=eq.${brandEnc}&product_name=eq.${nameEnc}&select=id`;
      
      console.log('Step 2: Catalog lookup fetch', lookupUrl);
      const lookupRes = await fetch(lookupUrl, { headers });
      if (!lookupRes.ok) throw new Error(`Lookup failed: ${lookupRes.status}`);
      
      const catRows = await lookupRes.json();
      console.log('Step 3: Catalog lookup result', catRows);

      let catalogId;
      if (catRows && catRows.length > 0) {
        setDebugInfo('Step 4: Product found in catalog')
        catalogId = catRows[0].id;
      } else {
        setDebugInfo('Step 5: Adding new product to catalog...')
        // Insert into catalog
        const insertCatUrl = `${SUPA_URL}/rest/v1/pool_boi_chemical_catalog`;
        const catBody = {
          brand: formData.brand,
          product_name: formData.product_name,
          primary_chemical: formData.primary_chemical,
          function_tag: formData.function_tag,
          unit_type: formData.unit_type
        };
        
        console.log('Step 6: Catalog insert POST', insertCatUrl, catBody);
        const catInsRes = await fetch(insertCatUrl, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify(catBody)
        });
        
        if (!catInsRes.ok) {
          const errText = await catInsRes.text();
          throw new Error(`Catalog insert failed: ${catInsRes.status} ${errText}`);
        }
        
        const newCatRows = await catInsRes.json();
        console.log('Step 7: Catalog insert result', newCatRows);
        catalogId = newCatRows[0].id;
      }

      // 2. Insert into inventory
      setDebugInfo('Step 8: Adding to your shelf...')
      const insertInvUrl = `${SUPA_URL}/rest/v1/pool_boi_inventory`;
      const invBody = {
        catalog_id: catalogId,
        total_volume_capacity: Number(formData.total_volume_capacity),
        current_volume_level: Number(formData.current_volume_level)
      };

      console.log('Step 9: Inventory insert POST', insertInvUrl, invBody);
      const invInsRes = await fetch(insertInvUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(invBody)
      });

      if (!invInsRes.ok) {
        const errText = await invInsRes.text();
        throw new Error(`Inventory insert failed: ${invInsRes.status} ${errText}`);
      }
      
      console.log('Step 10: Inventory insert successful');
      setDebugInfo('Step 11: Refreshing shelf...')
      await fetchInventory();
      
      setDebugInfo('Step 12: SUCCESS!')
      setPhase('list');
      setFormData(BLANK_FORM);
      setTimeout(() => setDebugInfo(''), 3000)
    } catch (err) {
      console.error('--- RAW FETCH FAILED ---', err);
      const failMsg = `FAILED: ${err.name} - ${err.message}`
      setDebugInfo(failMsg)
      alert('Save failed: ' + err.message)
    } finally {
      setSaveLoading(false)
      console.log('--- END SAVE TRACE ---');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'camera') {
    return (
      <div className="pb-test-page">
        {debugInfo && (
          <div style={{background:'red', color:'white', padding:'10px', fontSize:'14px', position: 'sticky', top: 0, zIndex: 100}}>
            {debugInfo}
          </div>
        )}
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
        {debugInfo && (
          <div style={{background:'red', color:'white', padding:'10px', fontSize:'14px', position: 'sticky', top: 0, zIndex: 100}}>
            {debugInfo}
          </div>
        )}
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
      {debugInfo && (
        <div style={{background:'red', color:'white', padding:'10px', fontSize:'14px', position: 'sticky', top: 0, zIndex: 100}}>
          {debugInfo}
        </div>
      )}
      <header className="pb-test-header">
        <button className="pb-back-btn" onClick={() => navigate('/')}>‹</button>
        <h1>My Chemical Shelf</h1>
      </header>

      <div className="pb-results-body">
        <button 
          onClick={runTestQuery}
          style={{ width: '100%', padding: '10px', background: '#334155', color: 'white', borderRadius: '8px', border: 'none', marginBottom: '16px', fontWeight: 'bold' }}
        >
          Test Supabase Connection
        </button>
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
