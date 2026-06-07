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
    width: '100%', padding: '13px 16px', borderRadius: 14,
    border: '1.5px solid #F0E0D0', fontSize: 16, color: '#3D2B1F',
    outline: 'none', boxSizing: 'border-box', background: '#FFF8F5',
    fontFamily: 'sans-serif',
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 'bold', color: '#B8A090',
    textTransform: 'uppercase', letterSpacing: 1,
    display: 'block', marginBottom: 6, fontFamily: 'sans-serif',
  }

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #FF8C69 0%, #FFB347 50%, #FF6B9D 100%)', padding: '56px 24px 48px', borderRadius: '0 0 40px 40px', boxShadow: '0 8px 32px rgba(255,140,105,0.3)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -40, left: 20, width: 100, height: 100, background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />
  <div style={{ marginBottom: 12 }}>
  <svg width="90" height="90" viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
    <circle cx="45" cy="45" r="45" fill="rgba(255,255,255,0.18)"/>
    <circle cx="45" cy="45" r="36" fill="rgba(255,255,255,0.13)"/>
    <path d="M22 68 C22 68 28 60 35 54 C42 48 50 50 56 44 C62 38 64 28 70 24"
          fill="none" stroke="white" stroke-width="5"
          stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
    <circle cx="22" cy="68" r="5" fill="white" opacity="0.95"/>
    <line x1="70" y1="18" x2="70" y2="30" stroke="white" stroke-width="3" stroke-linecap="round" opacity="0.95"/>
    <polygon points="70,18 82,22 70,26" fill="white" opacity="0.95"/>
  </svg>
</div>
        <h1 style={{ color: 'white', fontSize: 28, fontWeight: 'bold', margin: '0 0 6px', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>Run Coaching</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: 0, fontFamily: 'sans-serif' }}>Dein persönlicher Trainingsplan</p>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '28px 20px 40px' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 4px 32px rgba(255,140,105,0.12)', border: '1px solid #FFE8D8' }}>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Dein Name</label>
            <input style={inputStyle} placeholder="z.B. Julia" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Zielzeit</label>
              <input style={inputStyle} placeholder="2:05" value={form.goalTime}
                onChange={e => setForm({ ...form, goalTime: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Bisherige HM-Zeit</label>
              <input style={inputStyle} placeholder="2:14:38" value={form.previousTime}
                onChange={e => setForm({ ...form, previousTime: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Wochen bis zum Rennen</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[8, 12, 16, 20].map(w => (
                <button key={w} onClick={() => setForm({ ...form, weeksUntilRace: w })}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `2px solid ${form.weeksUntilRace === w ? '#FF8C69' : '#F0E0D0'}`, background: form.weeksUntilRace === w ? 'linear-gradient(135deg,#FF8C69,#FFB347)' : 'white', color: form.weeksUntilRace === w ? 'white' : '#C4A882', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', boxShadow: form.weeksUntilRace === w ? '0 4px 14px rgba(255,140,105,0.4)' : 'none', transition: 'all 0.2s' }}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 26 }}>
            <label style={labelStyle}>Läufe pro Woche</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[3, 4, 5].map(r => (
                <button key={r} onClick={() => setForm({ ...form, runsPerWeek: r })}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `2px solid ${form.runsPerWeek === r ? '#7EC8A4' : '#F0E0D0'}`, background: form.runsPerWeek === r ? 'linear-gradient(135deg,#7EC8A4,#5BA88A)' : 'white', color: form.runsPerWeek === r ? 'white' : '#C4A882', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', boxShadow: form.runsPerWeek === r ? '0 4px 14px rgba(126,200,164,0.4)' : 'none', transition: 'all 0.2s' }}>
                  {r}×
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 14, padding: '12px 16px', background: '#FDECEA', border: '1px solid #F5C4CC', borderRadius: 12, fontSize: 13, color: '#B85464', fontFamily: 'sans-serif' }}>
              {error}
            </div>
          )}

          <button onClick={handleGenerate} disabled={loading}
            style={{ width: '100%', padding: '17px', borderRadius: 18, border: 'none', background: loading ? '#F0E8E0' : 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: loading ? '#C4A882' : 'white', fontSize: 16, fontWeight: 'bold', cursor: loading ? 'default' : 'pointer', fontFamily: 'sans-serif', boxShadow: loading ? 'none' : '0 8px 24px rgba(255,107,157,0.4)', letterSpacing: 0.5, transition: 'all 0.2s' }}>
            {loading ? '⏳ Plan wird erstellt…' : '🏃‍♀️ Trainingsplan generieren'}
          </button>

          {loading && (
            <p style={{ textAlign: 'center', fontSize: 12, color: '#C4A882', marginTop: 12, fontFamily: 'sans-serif' }}>
              Das dauert ca. 20–30 Sekunden
            </p>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#D4C4B8', marginTop: 20, fontFamily: 'sans-serif' }}>
          Powered by Claude AI · Run Coaching App
        </p>
      </div>
    </div>
  )
}