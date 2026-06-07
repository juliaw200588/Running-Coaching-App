import { useState, useEffect, useRef } from 'react'

const dayKey = (phaseId, weekN, dayIdx) => `${phaseId}_w${weekN}_d${dayIdx}`

const typeStyle = (einheit, optional, isDone) => {
  if (isDone) return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', dot: '#16a34a' }
  if (optional) return { bg: '#f8fafc', text: '#94a3b8', border: '#e2e8f0', dot: '#cbd5e1' }
  if (einheit.includes('RENNTAG')) return { bg: '#faf5ff', text: '#7c3aed', border: '#ddd6fe', dot: '#7c3aed' }
  if (einheit.includes('HM-Pace')) return { bg: '#fff1f2', text: '#be123c', border: '#fecdd3', dot: '#f43f5e' }
  if (einheit.includes('Tempo') || einheit.includes('Lauf mit HM')) return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316' }
  if (einheit.includes('Intervall') || einheit.includes('Fahrtspiel')) return { bg: '#fefce8', text: '#92400e', border: '#fde68a', dot: '#eab308' }
  if (einheit.includes('Langer')) return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' }
  return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', dot: '#94a3b8' }
}

const compressImage = (dataUrl) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => {
    const maxW = 800
    const scale = img.width > maxW ? maxW / img.width : 1
    const canvas = document.createElement('canvas')
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    resolve(canvas.toDataURL('image/jpeg', 0.7))
  }
  img.src = dataUrl
})

export default function TrainingPlan({ plan, onReset }) {
  const [activePhase, setActivePhase] = useState(0)
  const [openWeeks, setOpenWeeks] = useState({ 0: true })
  const [done, setDone] = useState({})
  const [logs, setLogs] = useState({})
  const [screenshots, setScreenshots] = useState({})
  const [logModal, setLogModal] = useState(null)
  const [logInput, setLogInput] = useState({ pace: '', km: '', bpm: '', note: '' })
  const [modalScreenshot, setModalScreenshot] = useState(null)
  const [modalPreview, setModalPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const fileRef = useRef()

  const phases = plan.phases || []

  useEffect(() => {
    const load = async () => {
      try { const d = await window.storage.get('laufplan_done'); if (d) setDone(JSON.parse(d.value)) } catch {}
      try { const l = await window.storage.get('laufplan_logs'); if (l) setLogs(JSON.parse(l.value)) } catch {}
      try {
        const skResult = await window.storage.get('laufplan_screenshot_keys')
        if (skResult) {
          const keys = JSON.parse(skResult.value)
          const loaded = {}
          for (const k of keys) {
            try { const r = await window.storage.get(`screenshot_${k}`); if (r) loaded[k] = r.value } catch {}
          }
          setScreenshots(loaded)
        }
      } catch {}
    }
    load()
  }, [])

  const persistDone = async (nd) => {
    setDone(nd)
    try { await window.storage.set('laufplan_done', JSON.stringify(nd)) } catch {}
  }

  const persistLogs = async (nl) => {
    setLogs(nl)
    try { await window.storage.set('laufplan_logs', JSON.stringify(nl)) } catch {}
  }

  const persistScreenshot = async (key, base64OrNull, currentScreenshots) => {
    const next = { ...currentScreenshots }
    if (base64OrNull) {
      next[key] = base64OrNull
      try { await window.storage.set(`screenshot_${key}`, base64OrNull) } catch {}
    } else {
      delete next[key]
      try { await window.storage.delete(`screenshot_${key}`) } catch {}
    }
    setScreenshots(next)
    try { await window.storage.set('laufplan_screenshot_keys', JSON.stringify(Object.keys(next))) } catch {}
    return next
  }

  const toggleDone = (key) => persistDone({ ...done, [key]: !done[key] })

  const openLog = (key, tag, einheit) => {
    const ex = logs[key] || {}
    setLogInput({ pace: ex.pace || '', km: ex.km || '', bpm: ex.bpm || '', note: ex.note || '' })
    setModalScreenshot(screenshots[key] || null)
    setModalPreview(screenshots[key] || null)
    setLogModal({ key, tag, einheit })
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result)
      setModalPreview(compressed)
      setModalScreenshot(compressed)
    }
    reader.readAsDataURL(file)
  }

  const analyzeScreenshot = async () => {
    if (!modalScreenshot) return
    setAnalyzing(true)
    try {
      const base64Data = modalScreenshot.split(',')[1]
      const mediaType = modalScreenshot.split(';')[0].split(':')[1]
      const response = await fetch('/api/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mediaType })
      })
      const data = await response.json()
      if (data.result) {
        setLogInput(prev => ({
          pace: data.result.pace || prev.pace,
          km: data.result.km || prev.km,
          bpm: data.result.bpm || prev.bpm,
          note: data.result.note || prev.note,
        }))
      }
    } catch (err) {
      console.error('Analyse fehlgeschlagen', err)
    }
    setAnalyzing(false)
  }

  const saveLog = async () => {
    const key = logModal.key
    const nl = { ...logs, [key]: { ...logInput } }
    await persistLogs(nl)
    await persistScreenshot(key, modalScreenshot, screenshots)
    await persistDone({ ...done, [key]: true })
    setLogModal(null)
    setModalScreenshot(null)
    setModalPreview(null)
  }

  const deleteLog = async (key) => {
    const nl = { ...logs }; delete nl[key]
    await persistLogs(nl)
    await persistScreenshot(key, null, screenshots)
    await persistDone({ ...done, [key]: false })
    setLogModal(null)
    setModalScreenshot(null)
    setModalPreview(null)
  }

  const phase = phases[activePhase] || {}
  const totalDays = phases.flatMap(p => (p.weeks || []).flatMap(w => w.days.filter(d => !d.optional))).length
  const doneDays = Object.values(done).filter(Boolean).length
  const progress = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: 'linear-gradient(160deg,#f0f9ff 0%,#faf5ff 50%,#fff7ed 100%)', minHeight: '100vh', paddingBottom: 60 }}>

      {/* Log Modal */}
      {logModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '24px 24px 0 0', padding: '20px 20px 40px', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{logModal.tag}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>{logModal.einheit}</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Screenshot</label>
              {modalPreview ? (
                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
                  <img src={modalPreview} alt="Screenshot" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                    <button onClick={analyzeScreenshot} disabled={analyzing} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: analyzing ? '#e2e8f0' : '#059669', color: analyzing ? '#94a3b8' : 'white', fontSize: 12, fontWeight: 700, cursor: analyzing ? 'default' : 'pointer' }}>
                      {analyzing ? '⏳ Analysiere…' : '✨ Auto-ausfüllen'}
                    </button>
                    <button onClick={() => { setModalScreenshot(null); setModalPreview(null) }} style={{ padding: '6px 10px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.9)', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileRef.current.click()} style={{ width: '100%', padding: '18px', borderRadius: 14, border: '2px dashed #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 26 }}>📸</span>
                  <span>Screenshot hochladen</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Polar · Garmin · Strava · Adidas Running</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {[{ key: 'pace', label: 'Ø Pace', placeholder: '6:19 min/km' }, { key: 'km', label: 'Distanz', placeholder: '14,2 km' }].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input value={logInput[f.key]} onChange={e => setLogInput(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box', background: '#f8fafc' }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>Ø Herzfrequenz</label>
              <input value={logInput.bpm} onChange={e => setLogInput(p => ({ ...p, bpm: e.target.value }))} placeholder="158 bpm"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box', background: '#f8fafc' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>Notiz</label>
              <textarea value={logInput.note} onChange={e => setLogInput(p => ({ ...p, note: e.target.value }))} placeholder="Wie hat es sich angefühlt?" rows={2}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, color: '#1e293b', resize: 'none', outline: 'none', boxSizing: 'border-box', background: '#f8fafc' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setLogModal(null); setModalScreenshot(null); setModalPreview(null) }} style={{ flex: 1, padding: 13, borderRadius: 14, border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Abbrechen</button>
              {logs[logModal.key] && (
                <button onClick={() => deleteLog(logModal.key)} style={{ padding: '13px 16px', borderRadius: 14, border: '1.5px solid #fecdd3', background: '#fff1f2', color: '#be123c', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>🗑</button>
              )}
              <button onClick={saveLog} style={{ flex: 2, padding: 13, borderRadius: 14, border: 'none', background: '#059669', color: 'white', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                Speichern ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #f1f5f9', boxShadow: '0 2px 16px rgba(99,102,241,0.07)', padding: '22px 18px 0' }}>
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: 3, color: '#a78bfa', margin: '0 0 3px', textTransform: 'uppercase', fontWeight: 700 }}>
                Halbmarathon · Ziel {plan.goal}
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 2px', letterSpacing: -0.5 }}>
                {plan.title || `${plan.phases?.length > 0 ? plan.phases.reduce((s,p) => s + p.weeks.length, 0) : '?'}-Wochen Trainingsplan`}
              </h1>
              {plan.name && <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Für {plan.name} · ab {plan.startDate || 'heute'}</p>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{progress}%</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{doneDays}/{totalDays} Läufe</div>
            </div>
          </div>

          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#059669,#0d9488,#7c3aed)', borderRadius: 99, transition: 'width 0.4s ease' }} />
          </div>

          <div style={{ display: 'flex' }}>
            {phases.map((p, i) => (
              <button key={p.id} onClick={() => { setActivePhase(i); setOpenWeeks({ 0: true }) }}
                style={{ flex: '1 0 auto', background: 'transparent', border: 'none', borderBottom: activePhase === i ? `3px solid ${p.accent}` : '3px solid transparent', padding: '8px 4px 10px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                <div style={{ fontSize: 18 }}>{p.icon}</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: activePhase === i ? p.accent : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{p.label}</div>
                <div style={{ fontSize: 9, color: activePhase === i ? p.mid : '#e2e8f0', marginTop: 1 }}>{p.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '16px 14px 0' }}>
        <div style={{ background: `linear-gradient(135deg,${phase.light},${phase.soft})`, border: `1.5px solid ${phase.mid}`, borderRadius: 16, padding: '16px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'white', border: `2px solid ${phase.mid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{phase.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: phase.accent }}>{phase.label}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{phase.dateRange}</div>
            <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 3 }}>{phase.description}</div>
          </div>
        </div>

        {(phase.weeks || []).map((week, wi) => {
          const weekDone = week.days.filter((d, di) => !d.optional && done[dayKey(phase.id, week.n, di)]).length
          const weekTotal = week.days.filter(d => !d.optional).length
          const allDone = weekDone === weekTotal && weekTotal > 0
          return (
            <div key={week.n} style={{ background: 'white', border: '1.5px solid #f1f5f9', borderRadius: 16, marginBottom: 10, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <button onClick={() => setOpenWeeks(p => ({ ...p, [wi]: !p[wi] }))}
                style={{ width: '100%', background: week.race ? '#faf5ff' : week.regen ? '#f8fafc' : 'white', border: 'none', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: allDone ? '#059669' : week.race ? '#7c3aed' : week.regen ? '#94a3b8' : phase.accent, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: allDone ? 14 : 13, fontWeight: 800 }}>
                    {allDone ? '✓' : week.n}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Woche {week.n}</span>
                      {week.regen && <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>Regeneration</span>}
                      {week.race && <span style={{ fontSize: 10, color: '#7c3aed', background: '#f5f3ff', padding: '2px 7px', borderRadius: 99, fontWeight: 600 }}>Rennwoche 🏁</span>}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{week.dateRange} · {weekDone}/{weekTotal} erledigt</div>
                  </div>
                </div>
                <span style={{ color: phase.accent, fontSize: 10, display: 'inline-block', transform: openWeeks[wi] ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
              </button>

              {openWeeks[wi] && (
                <div style={{ padding: '2px 12px 12px' }}>
                  {week.days.map((day, di) => {
                    const key = dayKey(phase.id, week.n, di)
                    const isDone = !!done[key]
                    const hasLog = !!logs[key]
                    const hasShot = !!screenshots[key]
                    const s = typeStyle(day.einheit, day.optional, isDone)
                    return (
                      <div key={di} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, marginBottom: 7, background: s.bg, border: `1.5px solid ${s.border}`, opacity: day.optional ? 0.72 : 1 }}>
                        {!day.optional ? (
                          <button onClick={() => toggleDone(key)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isDone ? '#059669' : s.border}`, background: isDone ? '#059669' : 'white', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                            {isDone && <span style={{ color: 'white', fontSize: 12, fontWeight: 800 }}>✓</span>}
                          </button>
                        ) : <div style={{ width: 22, flexShrink: 0 }} />}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: s.dot, minWidth: 24 }}>{day.tag}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: isDone ? '#059669' : s.text, textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.8 : 1 }}>
                              {day.optional ? 'Optional · ' : ''}{day.einheit}
                            </span>
                            {hasLog && <span style={{ fontSize: 9, background: '#ecfdf5', color: '#059669', padding: '2px 7px', borderRadius: 99, fontWeight: 700, border: '1px solid #bbf7d0' }}>📊 Geloggt</span>}
                          </div>
                          <div style={{ fontSize: 11, color: isDone ? '#6ee7b7' : day.optional ? '#cbd5e1' : '#64748b', marginTop: 3, lineHeight: 1.5 }}>{day.details}</div>

                          {hasLog && (
                            <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              {hasShot && <img src={screenshots[key]} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #e2e8f0', flexShrink: 0 }} />}
                              {logs[key].pace && <span style={{ fontSize: 10, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>⏱ {logs[key].pace}</span>}
                              {logs[key].km && <span style={{ fontSize: 10, background: '#fff7ed', color: '#c2410c', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>📍 {logs[key].km}</span>}
                              {logs[key].bpm && <span style={{ fontSize: 10, background: '#fff1f2', color: '#be123c', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>❤️ {logs[key].bpm}</span>}
                              {logs[key].note && <span style={{ fontSize: 10, background: '#f8fafc', color: '#475569', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>💬 {logs[key].note.slice(0, 30)}{logs[key].note.length > 30 ? '…' : ''}</span>}
                            </div>
                          )}
                        </div>

                        {!day.optional && (
                          <button onClick={() => openLog(key, day.tag, day.einheit)} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 8, border: `1.5px solid ${hasLog ? '#bbf7d0' : '#e2e8f0'}`, background: hasLog ? '#ecfdf5' : '#f8fafc', color: hasLog ? '#059669' : '#94a3b8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            {hasLog ? '✏️' : '+ Log'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <button onClick={onReset} style={{ width: '100%', marginTop: 8, padding: '13px 16px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 14, fontSize: 14, color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}>
          ← Neuen Plan erstellen
        </button>
      </div>
    </div>
  )
}
