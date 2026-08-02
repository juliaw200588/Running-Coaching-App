import React, { useRef, useState } from 'react'

const classifyPhase = (name = '') => {
  const normalized = String(name).toLowerCase()
  if (normalized.includes('intervall') || normalized.includes('tempo') || normalized.includes('schnell')) {
    return { icon: '🔥', color: '#E56B6F', background: '#FFF3F2' }
  }
  if (normalized.includes('locker') || normalized.includes('pause') || normalized.includes('erholung')) {
    return { icon: '🌿', color: '#E3B341', background: '#FFF9E8' }
  }
  if (normalized.includes('einlaufen') || normalized.includes('warm')) {
    return { icon: '🟢', color: '#5BA88A', background: '#F2FBF6' }
  }
  if (normalized.includes('auslaufen') || normalized.includes('cool')) {
    return { icon: '🏁', color: '#5BA88A', background: '#F2FBF6' }
  }
  return { icon: '🏃', color: '#A78BCA', background: '#F7F2FF' }
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

export default function StoryShareModal({
  open,
  onClose,
  title,
  date,
  routeMapUrl,
  distance,
  pace,
  heartRate,
  phases = [],
}) {
  const cardRef = useRef(null)
  const [creating, setCreating] = useState(false)

  if (!open) return null

  const createImage = async () => {
    if (!cardRef.current || creating) return
    setCreating(true)

    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFF8F0',
        logging: false,
      })

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1))
      if (!blob) throw new Error('Bild konnte nicht erstellt werden.')

      const file = new File([blob], 'flora-lauf.png', { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title || 'Mein Lauf',
        })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'flora-lauf.png'
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(50,30,20,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div style={{ width: '100%', maxWidth: 580, maxHeight: '96vh', overflowY: 'auto' }}>
        <div
          ref={cardRef}
          style={{
            width: 540,
            maxWidth: '100%',
            aspectRatio: '9 / 16',
            margin: '0 auto',
            boxSizing: 'border-box',
            background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 52%, #FFF0F5 100%)',
            padding: 28,
            color: '#3D2B1F',
            fontFamily: "'Georgia', 'Times New Roman', serif",
            overflow: 'hidden',
          }}
        >
          <div style={{ fontSize: 13, color: '#B08C72', fontFamily: 'sans-serif', marginBottom: 5 }}>
            {date || 'Laufeinheit'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 18 }}>
            {title || 'Mein Lauf'}
          </div>

          {routeMapUrl && (
            <img
              src={routeMapUrl}
              alt="Laufstrecke"
              crossOrigin="anonymous"
              style={{ width: '100%', height: 250, objectFit: 'cover', borderRadius: 20, border: '1px solid #E9DED4', display: 'block', marginBottom: 18 }}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              ['📍', 'Distanz', distance],
              ['⏱', 'Pace', pace],
              ['❤️', 'Ø HF', heartRate],
            ].map(([icon, label, value]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.82)', border: '1px solid #EFE4DB', borderRadius: 16, padding: '13px 10px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                <div style={{ fontSize: 11, color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.7 }}>{icon} {label}</div>
                <div style={{ marginTop: 5, fontSize: 18, fontWeight: 'bold' }}>{value || '–'}</div>
              </div>
            ))}
          </div>

          {Array.isArray(phases) && phases.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid #EFE4DB', borderRadius: 20, padding: 16 }}>
              <div style={{ fontSize: 12, fontFamily: 'sans-serif', fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
                Phasenübersicht
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))`, gap: 4 }}>
                {phases.map((phase, index) => {
                  const meta = classifyPhase(phase?.name)
                  const phasePace = phase?.pace ? phase.pace.replace(' min/km', '') : '–'

                  return (
                    <div key={`${phase?.index || index}-${phase?.name || 'phase'}`} style={{ minWidth: 0, background: meta.background, border: `1px solid ${meta.color}55`, borderTop: `5px solid ${meta.color}`, borderRadius: 9, padding: '7px 2px', textAlign: 'center', fontFamily: 'sans-serif' }}>
                      <div style={{ fontSize: phases.length > 9 ? 12 : 15 }}>{meta.icon}</div>
                      <div style={{ fontSize: phases.length > 9 ? 7 : 9, fontWeight: 'bold', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {shortPhaseLabel(phase)}
                      </div>
                      <div style={{ fontSize: phases.length > 9 ? 7 : 9, color: '#8B6B5A', marginTop: 2, whiteSpace: 'nowrap' }}>
                        {phasePace}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 22, textAlign: 'center', fontFamily: 'sans-serif', fontSize: 12, color: '#B08C72', letterSpacing: 1 }}>
            FLORA RUNNING COACH
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 15, border: '1px solid #E8D9CF', background: 'white', color: '#8B6B5A', fontWeight: 'bold', cursor: 'pointer' }}>
            Schließen
          </button>
          <button onClick={createImage} disabled={creating} style={{ flex: 2, padding: 13, borderRadius: 15, border: 'none', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: 'white', fontWeight: 'bold', cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1 }}>
            {creating ? '⏳ Bild wird erstellt…' : '📸 Bild erstellen & teilen'}
          </button>
        </div>
      </div>
    </div>
  )
}
