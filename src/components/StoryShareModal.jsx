import React, { useMemo, useRef, useState } from 'react'

const TEMPLATES = [
  { id: 'classic', label: 'Classic' },
  { id: 'interval', label: 'Intervall' },
  { id: 'minimal', label: 'Minimal' },
]

const classifyPhase = (name = '') => {
  const normalized = String(name).toLowerCase()

  if (normalized.includes('intervall') || normalized.includes('tempo') || normalized.includes('schnell')) {
    return { key: 'interval', icon: '🔥', color: '#E56B6F', background: '#FFF3F2' }
  }

  if (normalized.includes('locker') || normalized.includes('pause') || normalized.includes('erholung')) {
    return { key: 'recovery', icon: '🌿', color: '#E3B341', background: '#FFF9E8' }
  }

  if (normalized.includes('einlaufen') || normalized.includes('warm')) {
    return { key: 'warmup', icon: '🟢', color: '#5BA88A', background: '#F2FBF6' }
  }

  if (normalized.includes('auslaufen') || normalized.includes('cool')) {
    return { key: 'cooldown', icon: '🏁', color: '#5BA88A', background: '#F2FBF6' }
  }

  return { key: 'other', icon: '🏃', color: '#A78BCA', background: '#F7F2FF' }
}

const shortPhaseLabel = (phase) => {
  if (phase?.plannedDistanceMeters != null) {
    const value = Number(phase.plannedDistanceMeters)
    return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`
  }

  if (phase?.plannedDurationSeconds != null) {
    return `${Math.round(Number(phase.plannedDurationSeconds) / 60)} min`
  }

  return '–'
}

const paceToSeconds = (pace) => {
  const match = String(pace || '').match(/(\d+):(\d{2})/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const averagePace = (phases, type) => {
  const values = phases
    .filter(phase => classifyPhase(phase?.name).key === type)
    .map(phase => paceToSeconds(phase?.pace))
    .filter(value => value != null)

  if (!values.length) return null

  const avg = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  return `${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, '0')}/km`
}

function StoryTimeline({ phases }) {
  if (!Array.isArray(phases) || phases.length === 0) return null

  const compact = phases.length > 9

  return (
    <div style={{ display: 'flex', gap: 4, width: '100%' }}>
      {phases.map((phase, index) => {
        const meta = classifyPhase(phase?.name)
        const phasePace = phase?.pace ? phase.pace.replace(' min/km', '') : '–'
        const weight = Number(phase?.actualDurationSeconds) || Number(phase?.actualDistanceMeters) || 1

        return (
          <div
            key={`${phase?.index || index}-${phase?.name || 'phase'}`}
            style={{
              flexGrow: weight,
              flexBasis: 0,
              minWidth: 0,
              background: meta.background,
              border: `1px solid ${meta.color}55`,
              borderTop: `5px solid ${meta.color}`,
              borderRadius: 9,
              padding: compact ? '7px 1px' : '8px 3px',
              textAlign: 'center',
              fontFamily: 'sans-serif',
              overflow: 'hidden',
            }}
          >
            <div style={{ fontSize: compact ? 11 : 15 }}>{meta.icon}</div>
            <div style={{ fontSize: compact ? 6.8 : 9, fontWeight: 'bold', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {shortPhaseLabel(phase)}
            </div>
            <div style={{ fontSize: compact ? 6.8 : 9, color: '#8B6B5A', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {phasePace}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function StoryShareModal({
  open,
  onClose,
  title,
  date,
  routeMapUrl,
  distance,
  pace,
  heartRate,
  runningIndex,
  elevation,
  phases = [],
  logoSrc = '/route-icon.png',
}) {
  const cardRef = useRef(null)
  const [creating, setCreating] = useState(false)
  const [template, setTemplate] = useState('classic')
  const [showMap, setShowMap] = useState(true)
  const [showTimeline, setShowTimeline] = useState(true)
  const [showHeartRate, setShowHeartRate] = useState(true)
  const [showRunningIndex, setShowRunningIndex] = useState(true)

  const intervalAverage = useMemo(() => averagePace(phases, 'interval'), [phases])
  const recoveryAverage = useMemo(() => averagePace(phases, 'recovery'), [phases])

  if (!open) return null

  const createImage = async () => {
    if (!cardRef.current || creating) return
    setCreating(true)

    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#FFF8F0',
        logging: false,
      })

      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = 1080
      exportCanvas.height = 1920
      const context = exportCanvas.getContext('2d')
      context.drawImage(canvas, 0, 0, 1080, 1920)

      const blob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/png', 1))
      if (!blob) throw new Error('Bild konnte nicht erstellt werden.')

      const file = new File([blob], 'sport-story.png', { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: title || 'Meine Aktivität' })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'sport-story.png'
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (error) {
      console.error('Story-Bild konnte nicht erstellt werden:', error)
      alert('Das Bild konnte leider nicht erstellt werden.')
    } finally {
      setCreating(false)
    }
  }

  const isMinimal = template === 'minimal'
  const isInterval = template === 'interval'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(50,30,20,0.76)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ width: '100%', maxWidth: 620, maxHeight: '96vh', overflowY: 'auto' }}>
        <div style={{ background: 'white', borderRadius: 18, padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
            {TEMPLATES.map(item => (
              <button
                key={item.id}
                onClick={() => setTemplate(item.id)}
                style={{
                  flex: 1,
                  padding: '9px 8px',
                  borderRadius: 12,
                  border: template === item.id ? '2px solid #FF8C69' : '1px solid #F0E8E0',
                  background: template === item.id ? '#FFF5EE' : 'white',
                  color: template === item.id ? '#C16045' : '#8B6B5A',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: 'sans-serif', fontSize: 11, color: '#8B6B5A' }}>
            <label><input type="checkbox" checked={showMap} onChange={event => setShowMap(event.target.checked)} /> Karte</label>
            <label><input type="checkbox" checked={showTimeline} onChange={event => setShowTimeline(event.target.checked)} /> Phasen</label>
            <label><input type="checkbox" checked={showHeartRate} onChange={event => setShowHeartRate(event.target.checked)} /> Herzfrequenz</label>
            <label><input type="checkbox" checked={showRunningIndex} onChange={event => setShowRunningIndex(event.target.checked)} /> Running Index</label>
          </div>
        </div>

        <div
          ref={cardRef}
          style={{
            width: 540,
            maxWidth: '100%',
            aspectRatio: '9 / 16',
            margin: '0 auto',
            boxSizing: 'border-box',
            background: isInterval
              ? 'linear-gradient(165deg, #FFF8F0 0%, #FFF0F2 48%, #F0FAF4 100%)'
              : 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 52%, #FFF0F5 100%)',
            padding: isMinimal ? 34 : 28,
            color: '#3D2B1F',
            fontFamily: "'Georgia', 'Times New Roman', serif",
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isMinimal ? 34 : 16 }}>
            <img src={logoSrc} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: 12, fontFamily: 'sans-serif', color: '#B08C72', letterSpacing: 1 }}>DEIN TRAININGSWEG</div>
              <div style={{ fontSize: 11, fontFamily: 'sans-serif', color: '#C4A882', marginTop: 2 }}>{date || 'Aktivität'}</div>
            </div>
          </div>

          <div style={{ fontSize: isMinimal ? 34 : 27, fontWeight: 'bold', marginBottom: isMinimal ? 30 : 16 }}>
            {title || 'Meine Aktivität'}
          </div>

          {!isMinimal && showMap && routeMapUrl && (
            <img
              src={routeMapUrl}
              alt="Strecke"
              crossOrigin="anonymous"
              style={{ width: '100%', height: isInterval ? 210 : 245, objectFit: 'cover', borderRadius: 20, border: '1px solid #E9DED4', display: 'block', marginBottom: 17 }}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isMinimal ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
            {[
              ['📍', 'Distanz', distance],
              ['⏱', 'Pace', pace],
              ...(showHeartRate ? [['❤️', 'Ø HF', heartRate]] : []),
            ].map(([icon, label, value]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.84)', border: '1px solid #EFE4DB', borderRadius: 16, padding: isMinimal ? '19px 14px' : '13px 10px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <div style={{ fontSize: isMinimal ? 12 : 10, color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.7 }}>{icon} {label}</div>
                <div style={{ marginTop: 5, fontSize: isMinimal ? 30 : 18, fontWeight: 'bold' }}>{value || '–'}</div>
              </div>
            ))}
          </div>

          {!isMinimal && showTimeline && Array.isArray(phases) && phases.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.86)', border: '1px solid #EFE4DB', borderRadius: 20, padding: 15 }}>
              <div style={{ fontSize: 11, fontFamily: 'sans-serif', fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 11 }}>
                Phasenübersicht
              </div>

              <StoryTimeline phases={phases} />

              {isInterval && (intervalAverage || recoveryAverage) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, fontFamily: 'sans-serif' }}>
                  {intervalAverage && <div style={{ flex: 1, background: '#FFF3F2', color: '#B85464', borderRadius: 12, padding: 9, textAlign: 'center', fontSize: 11, fontWeight: 'bold' }}>🔥 Ø {intervalAverage}</div>}
                  {recoveryAverage && <div style={{ flex: 1, background: '#FFF9E8', color: '#A07830', borderRadius: 12, padding: 9, textAlign: 'center', fontSize: 11, fontWeight: 'bold' }}>🌿 Ø {recoveryAverage}</div>}
                </div>
              )}
            </div>
          )}

          {!isMinimal && (showRunningIndex || elevation) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, fontFamily: 'sans-serif' }}>
              {showRunningIndex && runningIndex && <div style={{ flex: 1, background: 'rgba(255,255,255,0.76)', borderRadius: 12, padding: 9, fontSize: 11, textAlign: 'center' }}>🏃 RI <strong>{runningIndex}</strong></div>}
              {elevation && <div style={{ flex: 1, background: 'rgba(255,255,255,0.76)', borderRadius: 12, padding: 9, fontSize: 11, textAlign: 'center' }}>⛰️ <strong>{elevation}</strong></div>}
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'sans-serif', fontSize: 11, color: '#B08C72', letterSpacing: 0.8 }}>
            <img src={logoSrc} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
            DEIN WEG. DEIN FORTSCHRITT.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 15, border: '1px solid #E8D9CF', background: 'white', color: '#8B6B5A', fontWeight: 'bold', cursor: 'pointer' }}>
            Schließen
          </button>
          <button onClick={createImage} disabled={creating} style={{ flex: 2, padding: 13, borderRadius: 15, border: 'none', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: 'white', fontWeight: 'bold', cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1 }}>
            {creating ? '⏳ Bild wird erstellt…' : '📸 Erstellen & teilen'}
          </button>
        </div>
      </div>
    </div>
  )
}
