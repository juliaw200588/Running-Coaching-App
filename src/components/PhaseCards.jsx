import React from 'react'

const classifyPhase = (name = '') => {
  const normalized = String(name).toLowerCase()

  if (
    normalized.includes('intervall') ||
    normalized.includes('tempo') ||
    normalized.includes('schnell')
  ) {
    return {
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
      icon: '🌿',
      color: '#E3B341',
      background: '#FFF9E8',
    }
  }

  if (
    normalized.includes('einlaufen') ||
    normalized.includes('warm')
  ) {
    return {
      icon: '🟢',
      color: '#5BA88A',
      background: '#F2FBF6',
    }
  }

  if (
    normalized.includes('auslaufen') ||
    normalized.includes('cool')
  ) {
    return {
      icon: '🏁',
      color: '#5BA88A',
      background: '#F2FBF6',
    }
  }

  return {
    icon: '🏃',
    color: '#A78BCA',
    background: '#F7F2FF',
  }
}

const formatDuration = (seconds) => {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value < 0) return null

  const minutes = Math.floor(value / 60)
  const secs = Math.round(value % 60)

  return `${minutes}:${String(secs).padStart(2, '0')} min`
}

const formatDistance = (meters) => {
  const value = Number(meters)
  if (!Number.isFinite(value) || value < 0) return null

  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`
  return `${Math.round(value)} m`
}

const getPlannedLabel = (segment) => {
  if (segment?.plannedDistanceMeters != null) {
    return formatDistance(segment.plannedDistanceMeters)
  }

  if (segment?.plannedDurationSeconds != null) {
    const minutes = Math.round(Number(segment.plannedDurationSeconds) / 60)
    return `${minutes} min`
  }

  return null
}

function DataChip({ icon, label, value }) {
  if (value == null || value === '') return null

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.78)',
        border: '1px solid rgba(240,232,224,0.9)',
        borderRadius: 99,
        padding: '6px 9px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'sans-serif',
        fontSize: 10,
        color: '#3D2B1F',
        fontWeight: 'bold',
        lineHeight: 1,
      }}
    >
      <span>{icon}</span>
      <span style={{ color: '#A58B7A', fontWeight: 'normal' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function PhaseCards({ phases = [] }) {
  if (!Array.isArray(phases) || phases.length === 0) return null

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 'bold',
          color: '#B8A090',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 8,
          fontFamily: 'sans-serif',
        }}
      >
        Trainingsphasen
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {phases.map((segment, index) => {
          const meta = classifyPhase(segment?.name)
          const name = segment?.name || `Phase ${index + 1}`
          const planned = getPlannedLabel(segment)
          const actualDistance = formatDistance(segment?.actualDistanceMeters)
          const actualDuration = formatDuration(segment?.actualDurationSeconds)

          return (
            <div
              key={`${segment?.index || index}-${name}`}
              style={{
                background: meta.background,
                border: '1px solid #F0E8E0',
                borderLeft: `5px solid ${meta.color}`,
                borderRadius: 14,
                padding: '11px 12px',
                boxShadow: '0 3px 10px rgba(92,61,46,0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  alignItems: 'flex-start',
                  marginBottom: 9,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 17 }}>{meta.icon}</span>

                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: '#3D2B1F',
                        fontWeight: 'bold',
                        fontFamily: 'sans-serif',
                      }}
                    >
                      {segment?.index || index + 1}. {name}
                    </div>

                    {planned && (
                      <div
                        style={{
                          fontSize: 10,
                          color: '#A58B7A',
                          fontFamily: 'sans-serif',
                          marginTop: 2,
                        }}
                      >
                        Geplant: {planned}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: 'right',
                    fontFamily: 'sans-serif',
                    color: '#3D2B1F',
                    fontSize: 11,
                    fontWeight: 'bold',
                    lineHeight: 1.35,
                  }}
                >
                  {[actualDistance, actualDuration].filter(Boolean).join(' · ') || '–'}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 7,
                }}
              >
                <DataChip
                  icon="⏱"
                  label="Pace"
                  value={segment?.pace}
                />

                <DataChip
                  icon="❤️"
                  label="Ø HF"
                  value={
                    segment?.avgHeartRate != null
                      ? `${Math.round(segment.avgHeartRate)} bpm`
                      : null
                  }
                />

                <DataChip
                  icon="💓"
                  label="Max"
                  value={
                    segment?.maxHeartRate != null
                      ? `${Math.round(segment.maxHeartRate)} bpm`
                      : null
                  }
                />

                <DataChip
                  icon="👣"
                  label="Kadenz"
                  value={
                    segment?.avgCadence != null
                      ? `${Math.round(segment.avgCadence)} spm`
                      : null
                  }
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
