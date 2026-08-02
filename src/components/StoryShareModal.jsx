import React, { useEffect, useMemo, useRef, useState } from 'react'

const TEMPLATES = [
  { id: 'classic', label: 'Classic' },
  { id: 'interval', label: 'Intervall' },
  { id: 'minimal', label: 'Minimal' },
]

const classifyPhase = (name = '') => {
  const normalized = String(name).toLowerCase()

  if (
    normalized.includes('intervall') ||
    normalized.includes('tempo') ||
    normalized.includes('schnell')
  ) {
    return {
      key: 'interval',
      icon: '🔥',
      color: '#E56B6F',
      background: '#FFF3F2',
    }
  }

  if (
    normalized.includes('locker') ||
    normalized.includes('pause') ||
    normalized.includes('erholung')
  ) {
    return {
      key: 'recovery',
      icon: '🌿',
      color: '#E3B341',
      background: '#FFF9E8',
    }
  }

  if (normalized.includes('einlaufen') || normalized.includes('warm')) {
    return {
      key: 'warmup',
      icon: '🟢',
      color: '#5BA88A',
      background: '#F2FBF6',
    }
  }

  if (normalized.includes('auslaufen') || normalized.includes('cool')) {
    return {
      key: 'cooldown',
      icon: '🏁',
      color: '#5BA88A',
      background: '#F2FBF6',
    }
  }

  return {
    key: 'other',
    icon: '🏃',
    color: '#A78BCA',
    background: '#F7F2FF',
  }
}

const shortPhaseLabel = (phase) => {
  if (phase?.plannedDistanceMeters != null) {
    const value = Number(phase.plannedDistanceMeters)
    return value >= 1000
      ? `${(value / 1000).toFixed(1)} km`
      : `${Math.round(value)} m`
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

  const average = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  )

  return `${Math.floor(average / 60)}:${String(average % 60).padStart(2, '0')}/km`
}

const waitForPaint = () =>
  new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })

function StoryTimeline({ phases }) {
  if (!Array.isArray(phases) || phases.length === 0) return null

  const compact = phases.length > 9

  return (
    <div style={{ display: 'flex', gap: 4, width: '100%' }}>
      {phases.map((phase, index) => {
        const meta = classifyPhase(phase?.name)
        const phasePace = phase?.pace
          ? phase.pace.replace(' min/km', '')
          : '–'

        const weight =
          Number(phase?.actualDurationSeconds) ||
          Number(phase?.actualDistanceMeters) ||
          1

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

            <div
              style={{
                fontSize: compact ? 6.8 : 9,
                fontWeight: 'bold',
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {shortPhaseLabel(phase)}
            </div>

            <div
              style={{
                fontSize: compact ? 6.8 : 9,
                color: '#8B6B5A',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
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
  calories,
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
  const [exportWithoutMap, setExportWithoutMap] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [infoMessage, setInfoMessage] = useState(null)

  const intervalAverage = useMemo(
    () => averagePace(phases, 'interval'),
    [phases]
  )

  const recoveryAverage = useMemo(
    () => averagePace(phases, 'recovery'),
    [phases]
  )

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setErrorMessage(null)
      setInfoMessage(null)
      setExportWithoutMap(false)
    }
  }, [open])

  if (!open) return null

  const renderCanvas = async () => {
    if (!cardRef.current) {
      throw new Error('Die Story-Vorschau ist noch nicht bereit.')
    }

    const { default: html2canvas } = await import('html2canvas')

    return html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#FFF8F0',
      logging: false,
      imageTimeout: 12000,
      removeContainer: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: cardRef.current.scrollWidth,
      windowHeight: cardRef.current.scrollHeight,
    })
  }

  const createBlob = async (canvas) => {
    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/png', 0.95)
    )

    if (!blob) {
      throw new Error('Safari konnte die Bilddatei nicht erzeugen.')
    }

    return blob
  }

  const shareOrDownload = async (blob) => {
    const file = new File([blob], 'sport-story.png', {
      type: 'image/png',
    })

    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: title || 'Meine Aktivität',
        })
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
        console.warn('Teilen nicht möglich, Download wird verwendet:', error)
      }
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sport-story.png'
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()

    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const createImage = async () => {
    if (creating) return

    setCreating(true)
    setErrorMessage(null)
    setInfoMessage(null)

    try {
      let canvas

      try {
        canvas = await renderCanvas()
      } catch (firstError) {
        const mapWasVisible =
          showMap &&
          !exportWithoutMap &&
          Boolean(routeMapUrl) &&
          template !== 'minimal'

        if (!mapWasVisible) throw firstError

        console.warn(
          'Export mit Karte fehlgeschlagen. Zweiter Versuch ohne Karte:',
          firstError
        )

        setExportWithoutMap(true)
        setInfoMessage(
          'Die Karte konnte technisch nicht exportiert werden. Das Bild wird ohne Karte erstellt.'
        )

        await waitForPaint()
        canvas = await renderCanvas()
      }

      const blob = await createBlob(canvas)
      await shareOrDownload(blob)
    } catch (error) {
      console.error('Story-Bild konnte nicht erstellt werden:', error)

      const detail =
        error?.message ||
        error?.name ||
        'Unbekannter Fehler beim Erstellen des Bildes.'

      setErrorMessage(
        `Das Bild konnte nicht erstellt werden: ${detail}`
      )
    } finally {
      setCreating(false)
      setExportWithoutMap(false)
    }
  }

  const closeModal = () => {
    if (creating) return
    setErrorMessage(null)
    setInfoMessage(null)
    setExportWithoutMap(false)
    onClose()
  }

  const isMinimal = template === 'minimal'
  const isInterval = template === 'interval'

  const mapVisibleInPreview =
    !isMinimal &&
    showMap &&
    routeMapUrl &&
    !exportWithoutMap

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Story-Bild erstellen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(50,30,20,0.76)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding:
          'max(12px, env(safe-area-inset-top)) 12px max(18px, env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
        scrollPaddingTop: 140,
        scrollPaddingBottom: 110,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 3,
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 18,
            padding: 12,
            marginBottom: 10,
            boxShadow: '0 6px 22px rgba(61,43,31,0.16)',
          }}
        >
          <div
            style={{
              fontFamily: 'sans-serif',
              fontSize: 11,
              color: '#B8A090',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 8,
            }}
          >
            Vorlage auswählen
          </div>

          <div style={{ display: 'flex', gap: 7, marginBottom: 11 }}>
            {TEMPLATES.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTemplate(item.id)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '10px 6px',
                  borderRadius: 12,
                  border:
                    template === item.id
                      ? '2px solid #FF8C69'
                      : '1px solid #F0E8E0',
                  background:
                    template === item.id ? '#FFF5EE' : 'white',
                  color:
                    template === item.id ? '#C16045' : '#8B6B5A',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
              gap: 8,
              fontFamily: 'sans-serif',
              fontSize: 12,
              color: '#8B6B5A',
            }}
          >
            {[
              ['Karte', showMap, setShowMap],
              ['Phasen', showTimeline, setShowTimeline],
              ['Herzfrequenz', showHeartRate, setShowHeartRate],
              ['Running Index', showRunningIndex, setShowRunningIndex],
            ].map(([label, checked, setter]) => (
              <label
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  background: '#FFF8F5',
                  border: '1px solid #F0E8E0',
                  borderRadius: 11,
                  padding: '8px 9px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={event => setter(event.target.checked)}
                  style={{ width: 17, height: 17 }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {infoMessage && (
          <div
            style={{
              marginBottom: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: '#FFF9E8',
              border: '1px solid #FFE8A0',
              color: '#8B6B2E',
              fontFamily: 'sans-serif',
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            ℹ️ {infoMessage}
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              marginBottom: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: '#FDECEA',
              border: '1px solid #F5C4CC',
              color: '#B85464',
              fontFamily: 'sans-serif',
              fontSize: 12,
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

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
            padding: isMinimal ? '38px 34px 96px' : isInterval ? '30px 28px 104px' : '30px 28px 96px',
            color: '#3D2B1F',
            fontFamily: "'Georgia', 'Times New Roman', serif",
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: isMinimal ? 34 : 16,
            }}
          >
            <img
              src={logoSrc}
              alt=""
              style={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                objectFit: 'cover',
                boxShadow: '0 8px 20px rgba(255,140,105,0.18)',
                border: '1px solid rgba(255,255,255,0.9)',
              }}
            />

            <div>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'sans-serif',
                  color: '#B08C72',
                  letterSpacing: 1,
                }}
              >
                DEIN TRAININGSWEG
              </div>

              <div
                style={{
                  fontSize: 11,
                  fontFamily: 'sans-serif',
                  color: '#C4A882',
                  marginTop: 2,
                }}
              >
                {date || 'Aktivität'}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: isMinimal ? 34 : 27,
              fontWeight: 'bold',
              marginBottom: isMinimal ? 30 : 16,
            }}
          >
            {title || 'Meine Aktivität'}
          </div>

          {mapVisibleInPreview && (
            <img
              data-story-map="true"
              src={routeMapUrl}
              alt="Strecke"
              crossOrigin="anonymous"
              style={{
                width: '100%',
                height: isInterval ? 198 : 238,
                objectFit: 'cover',
                borderRadius: 20,
                border: '1px solid #E9DED4',
                display: 'block',
                marginBottom: 17,
              }}
            />
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMinimal
                ? '1fr'
                : 'repeat(3, 1fr)',
              gap: 10,
              marginBottom: 18,
            }}
          >
            {[
              ['📍', 'Distanz', distance],
              ['⏱', 'Pace', pace],
              ...(showHeartRate
                ? [['❤️', 'Ø HF', heartRate]]
                : []),
              ...(isMinimal && calories
                ? [['🔥', 'Kalorien', calories]]
                : []),
            ].map(([icon, label, value]) => (
              <div
                key={label}
                style={{
                  background: 'rgba(255,255,255,0.84)',
                  border: '1px solid #EFE4DB',
                  borderRadius: 16,
                  padding: isMinimal ? '19px 14px' : '13px 10px',
                  textAlign: 'center',
                  fontFamily: 'sans-serif',
                }}
              >
                <div
                  style={{
                    fontSize: isMinimal ? 12 : 10,
                    color: '#B8A090',
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                  }}
                >
                  {icon} {label}
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: isMinimal ? 30 : 18,
                    fontWeight: 'bold',
                  }}
                >
                  {value || '–'}
                </div>
              </div>
            ))}
          </div>

          {!isMinimal &&
            showTimeline &&
            Array.isArray(phases) &&
            phases.length > 0 && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.86)',
                  border: '1px solid #EFE4DB',
                  borderRadius: 20,
                  padding: isInterval ? 18 : 15,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: 'sans-serif',
                    fontWeight: 'bold',
                    color: '#B8A090',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    marginBottom: 11,
                  }}
                >
                  Phasenübersicht
                </div>

                <StoryTimeline phases={phases} />

                {isInterval &&
                  (intervalAverage || recoveryAverage) && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 12,
                        fontFamily: 'sans-serif',
                      }}
                    >
                      {intervalAverage && (
                        <div
                          style={{
                            flex: 1,
                            background: '#FFF3F2',
                            color: '#B85464',
                            borderRadius: 12,
                            padding: 9,
                            textAlign: 'center',
                            fontSize: 11,
                            fontWeight: 'bold',
                          }}
                        >
                          🔥 Ø {intervalAverage}
                        </div>
                      )}

                      {recoveryAverage && (
                        <div
                          style={{
                            flex: 1,
                            background: '#FFF9E8',
                            color: '#A07830',
                            borderRadius: 12,
                            padding: 9,
                            textAlign: 'center',
                            fontSize: 11,
                            fontWeight: 'bold',
                          }}
                        >
                          🌿 Ø {recoveryAverage}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}

          {!isMinimal && (showRunningIndex || elevation) && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 12,
                fontFamily: 'sans-serif',
              }}
            >
              {showRunningIndex && runningIndex && (
                <div
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.76)',
                    borderRadius: 12,
                    padding: 9,
                    fontSize: 11,
                    textAlign: 'center',
                  }}
                >
                  🏃 RI <strong>{runningIndex}</strong>
                </div>
              )}

              {elevation && (
                <div
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.76)',
                    borderRadius: 12,
                    padding: 9,
                    fontSize: 11,
                    textAlign: 'center',
                  }}
                >
                  ⛰️ <strong>{elevation}</strong>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: 'auto',
              paddingTop: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontFamily: 'sans-serif',
              fontSize: 11,
              color: '#B08C72',
              letterSpacing: 0.8,
            }}
          >
            <img
              src={logoSrc}
              alt=""
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
              }}
            />
            DEIN WEG. DEIN FORTSCHRITT.
          </div>
        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 4,
            display: 'flex',
            gap: 10,
            marginTop: 12,
            paddingTop: 14,
            paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom) + 8px))',
            background:
              'linear-gradient(to bottom, rgba(50,30,20,0), rgba(50,30,20,0.94) 22%)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <button
            type="button"
            onClick={closeModal}
            disabled={creating}
            style={{
              flex: 1,
              padding: '15px 13px',
              borderRadius: 15,
              border: '1px solid #E8D9CF',
              background: 'white',
              color: '#8B6B5A',
              fontWeight: 'bold',
              cursor: creating ? 'default' : 'pointer',
              opacity: creating ? 0.7 : 1,
            }}
          >
            Schließen
          </button>

          <button
            type="button"
            onClick={createImage}
            disabled={creating}
            style={{
              flex: 2,
              padding: '15px 13px',
              borderRadius: 15,
              border: 'none',
              background:
                'linear-gradient(135deg,#FF8C69,#FF6B9D)',
              color: 'white',
              fontWeight: 'bold',
              cursor: creating ? 'default' : 'pointer',
              opacity: creating ? 0.72 : 1,
            }}
          >
            {creating
              ? '⏳ Bild wird erstellt…'
              : '📸 Erstellen & teilen'}
          </button>
        </div>
      </div>
    </div>
  )
}
