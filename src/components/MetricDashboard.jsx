import React from 'react'

const cardStyle = {
  background: '#FFF8F5',
  border: '1px solid #F0E8E0',
  borderRadius: 14,
  padding: '10px 11px',
  minHeight: 64,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxShadow: '0 3px 10px rgba(92,61,46,0.04)',
}

const labelStyle = {
  fontSize: 9,
  color: '#B8A090',
  textTransform: 'uppercase',
  letterSpacing: 0.7,
  fontFamily: 'sans-serif',
  marginBottom: 4,
}

const valueStyle = {
  fontSize: 13,
  color: '#3D2B1F',
  fontWeight: 'bold',
  fontFamily: 'sans-serif',
  lineHeight: 1.35,
}

function MetricCard({ icon, label, value }) {
  if (!value) return null

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>
        <span style={{ marginRight: 5 }}>{icon}</span>
        {value}
      </div>
    </div>
  )
}

export default function MetricDashboard({
  time,
  distance,
  pace,
  averageHeartRate,
  calories,
  maxHeartRate,
  elevation,
  cadence,
  runningIndex,
  shoe,
}) {
  const metrics = [
    { icon: '🕐', label: 'Uhrzeit', value: time },
    { icon: '📍', label: 'Distanz', value: distance },
    { icon: '⏱', label: 'Pace', value: pace },
    { icon: '❤️', label: 'Ø Herzfrequenz', value: averageHeartRate },
    { icon: '🔥', label: 'Kalorien', value: calories },
    { icon: '💓', label: 'Max. Herzfrequenz', value: maxHeartRate },
    { icon: '⛰️', label: 'Höhenmeter', value: elevation },
    { icon: '👣', label: 'Kadenz', value: cadence },
    { icon: '🏃', label: 'Running Index', value: runningIndex },
  ]

  const visibleMetrics = metrics.filter(metric => metric.value)

  if (visibleMetrics.length === 0 && !shoe) return null

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
        Laufdaten
      </div>

      {visibleMetrics.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {visibleMetrics.map(metric => (
            <MetricCard
              key={metric.label}
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </div>
      )}

      {shoe && (
        <div
          style={{
            marginTop: 8,
            background: '#FFF5EE',
            border: '1px solid #FFE0CC',
            borderRadius: 14,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'sans-serif',
          }}
        >
          <span style={{ fontSize: 16 }}>👟</span>
          <div>
            <div style={labelStyle}>Schuh</div>
            <div style={valueStyle}>{shoe}</div>
          </div>
        </div>
      )}
    </div>
  )
}
