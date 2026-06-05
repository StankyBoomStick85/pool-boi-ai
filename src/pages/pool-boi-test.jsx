import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ─── Pool Constants ───────────────────────────────────────────────────────────

const PARAMS = {
  fc:       { label: 'Free Chlorine',    short: 'FC',  unit: 'ppm', low: 1.0,  high: 3.0,  target: 2.0,  step: 0.1 },
  tc:       { label: 'Total Chlorine',   short: 'TC',  unit: 'ppm', low: 1.0,  high: 3.0,  target: 2.0,  step: 0.1 },
  ph:       { label: 'pH',              short: 'pH',  unit: '',    low: 7.4,  high: 7.6,  target: 7.5,  step: 0.1 },
  ta:       { label: 'Total Alkalinity', short: 'TA',  unit: 'ppm', low: 80,   high: 120,  target: 100,  step: 1   },
  ch:       { label: 'Calcium Hardness', short: 'CH',  unit: 'ppm', low: 200,  high: 400,  target: 300,  step: 5   },
  cya:      { label: 'Cyanuric Acid',    short: 'CYA', unit: 'ppm', low: 30,   high: 50,   target: 40,   step: 1   },
  hardness: { label: 'Total Hardness',   short: 'TH',  unit: 'ppm', low: 200,  high: 400,  target: 300,  step: 5   },
}

const BLANK = { fc: '', tc: '', ph: '', ta: '', ch: '', cya: '', hardness: '' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatus(key, val) {
  if (val === '' || val === null || val === undefined || isNaN(Number(val))) return 'unknown'
  const n = Number(val)
  const p = PARAMS[key]
  if (n < p.low) return 'low'
  if (n > p.high) return 'high'
  return 'ok'
}

function statusLabel(status) {
  if (status === 'ok')   return '✓ OK'
  if (status === 'low')  return '↓ Low'
  if (status === 'high') return '↑ High'
  return '—'
}

function asNum(vals, key) {
  const v = vals[key]
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return null
  return Number(v)
}

function calcTreatmentSteps(vals) {
  const steps = []
  const fc  = asNum(vals, 'fc')
  const tc  = asNum(vals, 'tc')
  const ph  = asNum(vals, 'ph')
  const ta  = asNum(vals, 'ta')
  const ch  = asNum(vals, 'ch')
  const cya = asNum(vals, 'cya')

  // Shock alert — always shown first if TC - FC > 1.0
  if (fc !== null && tc !== null && tc - fc > 1.0) {
    steps.push({
      id: 'shock',
      isAlert: true,
      chemical: 'Shock Treatment Needed',
      detail: `Chloramine level: ${(tc - fc).toFixed(1)} ppm (TC ${tc} − FC ${fc}). Chloramines cause eye irritation and strong chlorine odor.`,
      amount: null,
      unit: null,
      instructions: 'Add a shock product per its label directions. Run pump continuously for 24 hours. Do not swim until FC drops below 5 ppm.',
      waitMinutes: 0,
    })
  }

  // 1. Alkalinity first
  if (ta !== null && ta < PARAMS.ta.low) {
    const lbs = ((PARAMS.ta.target - ta) / 10) * 2.5
    steps.push({
      id: 'ta',
      isAlert: false,
      chemical: 'HTH Alkalinity Up',
      detail: `TA is ${ta} ppm — target is 80–120 ppm.`,
      amount: lbs.toFixed(1),
      unit: 'lbs',
      instructions: 'Pre-dissolve in a bucket of pool water. Pour slowly around the perimeter with pump running.',
      waitMinutes: 0,
    })
  }

  // Calcium Hardness
  if (ch !== null && ch < PARAMS.ch.low) {
    const lbs = ((PARAMS.ch.target - ch) / 10) * 2.25
    steps.push({
      id: 'ch',
      isAlert: false,
      chemical: 'HTH Calcium Hardness Up',
      detail: `CH is ${ch} ppm — target is 200–400 ppm.`,
      amount: lbs.toFixed(1),
      unit: 'lbs',
      instructions: 'Pre-dissolve in a bucket of warm water. Add slowly around the perimeter with pump running.',
      waitMinutes: 0,
    })
  }

  // CYA (Stabilizer)
  if (cya !== null && cya < PARAMS.cya.low) {
    const lbs = ((PARAMS.cya.target - cya) / 10) * 1.5
    steps.push({
      id: 'cya',
      isAlert: false,
      chemical: 'HTH Stabilizer',
      detail: `CYA is ${cya} ppm — target is 30–50 ppm.`,
      amount: lbs.toFixed(1),
      unit: 'lbs',
      instructions: 'Add directly to the skimmer basket with pump running. Do not pre-dissolve.',
      waitMinutes: 0,
    })
  }

  // 2. pH second
  if (ph !== null && ph > PARAMS.ph.high) {
    const oz = (ph - PARAMS.ph.target) * 72
    steps.push({
      id: 'ph-down',
      isAlert: false,
      chemical: 'Champion Muriatic Acid 31.45%',
      detail: `pH is ${ph} — target is 7.4–7.6.`,
      amount: oz.toFixed(0),
      unit: 'fl oz',
      instructions: 'Dilute in a bucket of pool water first. Pour slowly around the deep end. Wear gloves and eye protection.',
      waitMinutes: 120,
    })
  } else if (ph !== null && ph < PARAMS.ph.low) {
    const lbs = (PARAMS.ph.target - ph) * 72
    steps.push({
      id: 'ph-up',
      isAlert: false,
      chemical: 'HTH pH Up',
      detail: `pH is ${ph} — target is 7.4–7.6.`,
      amount: lbs.toFixed(1),
      unit: 'lbs',
      instructions: 'Broadcast around the perimeter with pump running.',
      waitMinutes: 0,
    })
  }

  // 3. Chlorine last
  if (fc !== null && fc < PARAMS.fc.low) {
    const oz = (PARAMS.fc.target - fc) * 21
    steps.push({
      id: 'chlorine',
      isAlert: false,
      chemical: 'Champion Liquid Chlorine 12.5%',
      detail: `FC is ${fc} ppm — target is 1–3 ppm.`,
      amount: oz.toFixed(0),
      unit: 'fl oz',
      instructions: 'Pour slowly into the deep end with pump running.',
      waitMinutes: 0,
    })
  }

  return steps
}

function readyAtLabel(completedAt, waitMinutes) {
  const t = new Date(completedAt.getTime() + waitMinutes * 60000)
  return t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PoolBoiTest() {
  const navigate = useNavigate()

  const [phase, setPhase]             = useState('camera')
  const [camReady, setCamReady]       = useState(false)
  const [camError, setCamError]       = useState(null)
  const [capturedImg, setCapturedImg] = useState(null)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [aiConfidence, setAiConfidence] = useState(null)
  const [aiNotes, setAiNotes]         = useState('')
  const [readings, setReadings]       = useState(BLANK)
  const [catalog, setCatalog]         = useState({})
  const [treatmentSteps, setTreatmentSteps] = useState([])
  const [activeStep, setActiveStep]   = useState(0)
  const [completedAt, setCompletedAt] = useState({})

  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  // ── Camera lifecycle ──────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'camera') return

    let cancelled = false
    setCamReady(false)
    setCamError(null)

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        if (cancelled) return
        setCamError(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access in your browser settings and try again.'
            : 'Could not access camera. Make sure no other app is using it.'
        )
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

  // ── Capture ───────────────────────────────────────────────────────────────

  function capture() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    canvas.width  = w
    canvas.height = h
    canvas.getContext('2d').drawImage(video, 0, 0, w, h)
    setCapturedImg(canvas.toDataURL('image/jpeg', 0.85))
    stopStream()
    setPhase('preview')
  }

  function retake() {
    setCapturedImg(null)
    setAnalyzeError(null)
    setPhase('camera')
  }

  // ── Analyze ───────────────────────────────────────────────────────────────

  async function analyze() {
    setAnalyzeError(null)
    setPhase('analyzing')
    const base64 = capturedImg.split(',')[1]

    try {
      const res  = await fetch('/api/analyze-strip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Analysis failed (${res.status})`)

      setAiConfidence(data.confidence ?? null)
      setAiNotes(data.notes ?? '')
      setReadings({
        fc:       data.fc       ?? '',
        tc:       data.tc       ?? '',
        ph:       data.ph       ?? '',
        ta:       data.ta       ?? '',
        ch:       data.ch       ?? '',
        cya:      data.cya      ?? '',
        hardness: data.hardness ?? '',
      })
      loadCatalog()
      setPhase('results')
    } catch (err) {
      setAnalyzeError(err.message || 'Analysis failed. Try retaking the photo.')
      setPhase('preview')
    }
  }

  async function loadCatalog() {
    try {
      const { data } = await supabase
        .from('pool_boi_chemical_catalog')
        .select('name, affiliate_url')
      if (data) {
        const map = {}
        data.forEach(r => { map[r.name] = { affiliateUrl: r.affiliate_url } })
        setCatalog(map)
      }
    } catch { /* catalog table not set up yet — silently skip */ }
  }

  // ── Confirm → Treatment ───────────────────────────────────────────────────

  function confirmReadings() {
    const steps = calcTreatmentSteps(readings)
    setTreatmentSteps(steps)
    setActiveStep(0)
    setCompletedAt({})
    setPhase('treatment')
  }

  function markDone(idx) {
    setCompletedAt(prev => ({ ...prev, [idx]: new Date() }))
    setActiveStep(idx + 1)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Camera
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'camera') {
    return (
      <div className="pb-test-page">
        <header className="pb-test-header">
          <button className="pb-back-btn" onClick={() => navigate('/')}>‹</button>
          <h1>Test My Water</h1>
        </header>

        {camError ? (
          <div className="pb-cam-error">
            <div className="pb-cam-error-icon">⚠</div>
            <p>{camError}</p>
            <button onClick={() => { setCamError(null); setPhase('camera') }}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="pb-camera-area">
              <video
                ref={videoRef}
                className="pb-video"
                autoPlay
                playsInline
                muted
                onCanPlay={() => setCamReady(true)}
              />
              <canvas ref={canvasRef} className="pb-canvas-hidden" />

              {!camReady && (
                <div className="pb-cam-starting">
                  <div className="pb-spinner" />
                  <span>Starting camera…</span>
                </div>
              )}

              {camReady && (
                <div className="pb-cam-overlay">
                  <div className="pb-guide-row">
                    <div className="pb-guide-slot"><span>Test strip</span></div>
                    <div className="pb-guide-slot"><span>Color chart</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="pb-cam-controls">
              <p className="pb-cam-hint">
                Hold steady in good light. Align the used strip and its color chart in the guides.
              </p>
              <button
                className="pb-capture-btn"
                onClick={capture}
                disabled={!camReady}
              >
                Capture
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Preview
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'preview') {
    return (
      <div className="pb-test-page">
        <header className="pb-test-header">
          <button className="pb-back-btn" onClick={retake}>‹</button>
          <h1>Preview</h1>
        </header>
        <div className="pb-preview-area">
          <img src={capturedImg} alt="Captured test strip" className="pb-preview-img" />
          {analyzeError && <div className="pb-analyze-error">{analyzeError}</div>}
        </div>
        <div className="pb-cam-controls">
          <button className="pb-analyze-btn" onClick={analyze}>
            Looks Good — Analyze
          </button>
          <button className="pb-retake-btn" onClick={retake}>
            Retake Photo
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Analyzing
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'analyzing') {
    return (
      <div className="pb-test-page">
        <header className="pb-test-header">
          <h1>Analyzing…</h1>
        </header>
        <div className="pb-preview-area">
          <img src={capturedImg} alt="Analyzing" className="pb-preview-img pb-preview-dim" />
          <div className="pb-analyzing-overlay">
            <div className="pb-spinner pb-spinner-lg" />
            <p>Reading your water chemistry…</p>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Results + Manual Override
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'results') {
    return (
      <div className="pb-test-scroll">
        <header className="pb-test-header">
          <button className="pb-back-btn" onClick={() => setPhase('preview')}>‹</button>
          <h1>Water Results</h1>
        </header>

        <div className="pb-results-body">

          {aiConfidence && (
            <span className={`pb-confidence-badge pb-confidence-${aiConfidence}`}>
              AI Confidence: {aiConfidence.charAt(0).toUpperCase() + aiConfidence.slice(1)}
            </span>
          )}
          {aiNotes ? <p className="pb-ai-notes">{aiNotes}</p> : null}

          <h2 className="pb-section-title">AI Readings</h2>
          <div className="pb-readings-grid">
            {Object.entries(PARAMS).map(([key, param]) => {
              const status = getStatus(key, readings[key])
              const val    = readings[key]
              return (
                <div key={key} className={`pb-reading-row pb-reading-${status}`}>
                  <span className="pb-reading-label">{param.short}</span>
                  <span className="pb-reading-value">
                    {val !== '' && val !== null ? `${val}${param.unit ? ' ' + param.unit : ''}` : '—'}
                  </span>
                  <span className="pb-reading-status">{statusLabel(status)}</span>
                </div>
              )
            })}
          </div>

          <h2 className="pb-section-title">Adjust if Needed</h2>
          <div className="pb-overrides">
            {Object.entries(PARAMS).map(([key, param]) => (
              <div key={key} className="pb-input-row">
                <label className="pb-input-label" htmlFor={`inp-${key}`}>
                  <span>{param.label}</span>
                  <span className="pb-input-range">
                    {param.low}–{param.high}{param.unit ? ' ' + param.unit : ''}
                  </span>
                </label>
                <input
                  id={`inp-${key}`}
                  type="number"
                  className="pb-number-input"
                  value={readings[key] ?? ''}
                  step={param.step}
                  min={0}
                  onChange={e => setReadings(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <button className="pb-confirm-btn" onClick={confirmReadings}>
            These Look Right — Get Treatment Plan
          </button>

        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Treatment Plan
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'treatment') {
    const allDone = treatmentSteps.length > 0 && activeStep >= treatmentSteps.length

    return (
      <div className="pb-test-scroll">
        <header className="pb-test-header">
          <button className="pb-back-btn" onClick={() => setPhase('results')}>‹</button>
          <h1>Treatment Plan</h1>
        </header>

        <div className="pb-treatment-body">
          {treatmentSteps.length === 0 ? (
            <div className="pb-balanced">
              <div className="pb-balanced-icon">✓</div>
              <h2>Water Looks Great!</h2>
              <p>All levels are in range. No treatment needed.</p>
              <button className="pb-test-again-btn" onClick={() => setPhase('camera')}>
                Test Again
              </button>
            </div>
          ) : (
            <>
              {treatmentSteps.map((step, idx) => {
                const isDone         = completedAt[idx] !== undefined
                const isActive       = idx === activeStep
                const prevStep       = treatmentSteps[idx - 1]
                const prevDoneAt     = completedAt[idx - 1]
                const showWaitBadge  = !isDone && prevStep?.waitMinutes > 0 && prevDoneAt

                return (
                  <div
                    key={step.id}
                    className={`pb-step-card${isDone ? ' pb-step-done' : ''}${step.isAlert ? ' pb-step-alert' : ''}`}
                  >
                    <div className="pb-step-header">
                      <span className={`pb-step-num${isDone ? ' pb-step-num-done' : ''}`}>
                        {isDone ? '✓' : idx + 1}
                      </span>
                      <span className="pb-step-chem">{step.chemical}</span>
                    </div>

                    {step.amount && (
                      <div className="pb-step-amount">
                        {step.amount} <span className="pb-step-unit">{step.unit}</span>
                      </div>
                    )}

                    <p className="pb-step-detail">{step.detail}</p>
                    <p className="pb-step-instructions">{step.instructions}</p>

                    {step.waitMinutes > 0 && isActive && !isDone && (
                      <p className="pb-step-wait-note">
                        Wait 2 hours after adding before the next step.
                      </p>
                    )}

                    {showWaitBadge && (
                      <div className="pb-wait-badge">
                        Ready at {readyAtLabel(prevDoneAt, prevStep.waitMinutes)}
                      </div>
                    )}

                    {!isDone && (
                      step.isAlert ? (
                        <button
                          className="pb-step-done-btn pb-step-done-btn-alert"
                          onClick={() => markDone(idx)}
                        >
                          Acknowledged
                        </button>
                      ) : (
                        <button
                          className="pb-step-done-btn"
                          onClick={() => markDone(idx)}
                          disabled={!isActive}
                        >
                          Done — Next Step
                        </button>
                      )
                    )}

                    {catalog[step.chemical]?.affiliateUrl && !isDone && (
                      <a
                        href={catalog[step.chemical].affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pb-cart-link"
                      >
                        Add to Cart
                      </a>
                    )}
                  </div>
                )
              })}

              {allDone && (
                <div className="pb-balanced">
                  <div className="pb-balanced-icon">✓</div>
                  <p>Treatment complete! Retest in 24–48 hours.</p>
                  <button className="pb-test-again-btn" onClick={() => setPhase('camera')}>
                    Test Again
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}
