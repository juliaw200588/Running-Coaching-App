import React from 'react'

const parsePaceToSeconds = (pace) => {
  if (!pace || typeof pace !== 'string') return null
  const match = pace.match(/(\d+):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

const formatAveragePace = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}/km`
}

const classifyPhase = (name = '') => {
  const normalized = String(name).toLowerCase()

  if (
    normalized.includes('intervall') ||
    normalized.includes('tempo') ||
    normalized.includes('schnell')
  ) {
    return { key: 'interval', icon: '🔥', color: '#E56B6F', background: '#FFF3F2' }
  }

  if (
    normalized.includes('locker') ||
    normalized.includes('pause') ||
    normalized.includes('erholung')
  ) {
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

const getWeight = (phase) => {
  const duration = Number(phase?.actualDurationSeconds)
  if (Number.isFinite(duration) && duration > 0) return duration

  const distance = Number(phase?.actualDistanceMeters)
  if (Number.isFinite(distance) && distance > 0) return distance

  return 1
}

const getPrimaryLabel = (phase) => {
  if (phase?.plannedDistanceMeters != null) {
    const value = Number(phase.plannedDistanceMeters)
    return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`
  }

  if (phase?.plannedDurationSeconds != null) {
    return `${Math.round(Number(phase.plannedDurationSeconds) / 60)} min`
  }

  if (phase?.actualDistanceMeters != null) {
    const value = Number(phase.actualDistanceMeters)
    return value >= 1000 ? `${(value / 1000).toFixed(2)} km` : `${Math.round(value)} m`
  }

  return '–'
}

export default function PhaseTimeline({ phases = [] }) {
  if (!Array.isArray(phases) || phases.length === 0) return null

  const compact = phases.length >= 8
  const veryCompact = phases.length >= 12

  const intervalPaces = phases
    .filter(phase => classifyPhase(phase?.name).key === 'interval')
    .map(phase => parsePaceToSeconds(phase?.pace))
    .filter(value => value != null)

  const recoveryPaces = phases
    .filter(phase => classifyPhase(phase?.name).key === 'recovery')
    .map(phase => parsePaceToSeconds(phase?.pace))
    .filter(value => value != null)

  const avgIntervalPace = intervalPaces.length
    ? formatAveragePace(intervalPaces.reduce((sum, value) => sum + value, 0) / intervalPaces.length)
    : null

  const avgRecoveryPace = recoveryPaces.length
    ? formatAveragePace(recoveryPaces.reduce((sum, value) => sum + value, 0) / recoveryPaces.length)
    : null

  return (
    <div
      style={{
        marginBottom: 18,
        background: 'white',
        border: '1px solid #F0E8E0',
        borderRadius: 16,
        padding: compact ? '13px 10px 12px' : '14px',
        boxShadow: '0 4px 16px rgba(92,61,46,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'sans-serif' }}>
          Phasenübersicht
        </div>
        <div style={{ fontSize: 10, color: '#C4A882', fontFamily: 'sans-serif' }}>
          {phases.length} Phasen
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: compact ? 3 : 5,
          width: '100%',
          minWidth: 0,
          marginBottom: 10,
        }}
      >
        {phases.map((phase, index) => {
          const meta = classifyPhase(phase?.name)
          const pace = phase?.pace ? phase.pace.replace(' min/km', '') : '–'
          const weight = getWeight(phase)

          return (
            <div
              key={`${phase?.index || index}-${phase?.name || 'phase'}`}
              title={`${phase?.name || 'Phase'} · ${getPrimaryLabel(phase)} · ${pace}/km`}
              style={{
                flexGrow: weight,
                flexBasis: 0,
                minWidth: 0,
                overflow: 'hidden',
                background: meta.background,
                border: `1px solid ${meta.color}55`,
                borderTop: `${compact ? 4 : 5}px solid ${meta.color}`,
                borderRadius: compact ? 8 : 10,
                padding: compact ? '6px 1px 5px' : '7px 4px 6px',
                textAlign: 'center',
                fontFamily: 'sans-serif',
              }}
            >
              <div style={{ fontSize: veryCompact ? 10 : compact ? 12 : 14, lineHeight: 1.1 }}>
                {meta.icon}
              </div>

              <div
                style={{
                  fontSize: veryCompact ? 6.3 : compact ? 7.4 : 9,
                  color: '#3D2B1F',
                  fontWeight: 'bold',
                  lineHeight: 1.15,
                  marginTop: 3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {getPrimaryLabel(phase)}
              </div>

              <div
                style={{
                  fontSize: veryCompact ? 6.3 : compact ? 7.4 : 9,
                  color: '#8B6B5A',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {pace}
              </div>
            </div>
          )
        })}
      </div>

      {(avgIntervalPace || avgRecoveryPace) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: 'sans-serif' }}>
          {avgIntervalPace && (
            <div style={{ background: '#FFF3F2', border: '1px solid #F5C4CC', color: '#B85464', padding: '6px 9px', borderRadius: 99, fontSize: 10, fontWeight: 'bold' }}>
              🔥 Intervalle Ø {avgIntervalPace}
            </div>
          )}
          {avgRecoveryPace && (
            <div style={{ background: '#FFF9E8', border: '1px solid #FFE8A0', color: '#A07830', padding: '6px 9px', borderRadius: 99, fontSize: 10, fontWeight: 'bold' }}>
              🌿 Erholung Ø {avgRecoveryPace}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
