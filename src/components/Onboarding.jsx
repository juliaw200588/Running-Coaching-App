import { useState } from 'react'

export default function Onboarding({ onPlanGenerated }) {
  const [form, setForm] = useState({
    name: '',
    goalTime: '2:05',
    previousTime: '2:14:38',
    weeksUntilRace: 16,
    runsPerWeek: 3,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      onPlanGenerated(data.plan)
    } catch (e) {
      setError('Fehler: ' + e.message)
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1.5px solid #e2e8f0',
    fontSize: 16,
    color: '#1e293b',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#f8fafc',
    WebkitAppearance: 'none',
  }

  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    display: 'block',
    marginBottom: 6,
  }

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: 'linear-gradient(160deg,#f0f9ff 0%,#faf5ff 50%,#fff7ed 100%)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏃‍♀️</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', letterSpacing: -0.5 }}>Run Coaching</h1>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>Dein persönlicher Halbmarathon-Trainingsplan</p>
        </div>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: 24, padding: 28, boxShadow: '0 4px 40px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Dein Name</label>
            <input
              style={inputStyle}
              placeholder="z.B. Julia"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Zielzeit</label>
              <input
                style={inputStyle}
                placeholder="2:05"
                value={form.goalTime}
                onChange={e => setForm({ ...form, goalTime: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Bisherige HM-Zeit</label>
              <input
                style={inputStyle}
                placeholder="2:14:38"
                value={form.previousTime}
                onChange={e => setForm({ ...form, previousTime: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Wochen bis zum Rennen</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[8, 12, 16, 20].map(w => (
                <button
                  key={w}
                  onClick={() => setForm({ ...form, weeksUntilRace: w })}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    border: form.weeksUntilRace === w ? '2px solid #7c3aed' : '1.5px solid #e2e8f0',
                    background: form.weeksUntilRace === w ? '#f5f3ff' : 'white',
                    color: form.weeksUntilRace === w ? '#7c3aed' : '#94a3b8',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Läufe pro Woche</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[3, 4, 5].map(r => (
                <button
                  key={r}
                  onClick={() => setForm({ ...form, runsPerWeek: r })}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    border: form.runsPerWeek === r ? '2px solid #059669' : '1.5px solid #e2e8f0',
                    background: form.runsPerWeek === r ? '#ecfdf5' : 'white',
                    color: form.runsPerWeek === r ? '#059669' : '#94a3b8',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {r}×
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, fontSize: 13, color: '#be123c' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: loading ? '#e2e8f0' : 'linear-gradient(135deg,#059669,#0d9488)',
              color: loading ? '#94a3b8' : 'white',
              fontSize: 16, fontWeight: 800, cursor: loading ? 'default' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(5,150,105,0.35)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Plan wird erstellt…' : 'Trainingsplan generieren →'}
          </button>

          {loading && (
            <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
              Das dauert ca. 20–30 Sekunden
            </p>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 20 }}>
          Run Coaching App
        </p>
      </div>
    </div>
  )
}
