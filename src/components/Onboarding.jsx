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
  <img 
    src="data:image/png;base64,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"
    alt="Laufstrecke"
    style={{ width: 90, height: 90, borderRadius: '50%' }}
  />
</div>
</div>
        <h1 style={{ color: 'white', fontSize: 28, fontWeight: 'bold', margin: '0 0 6px', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>Run Coaching</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: 0, fontFamily: 'sans-serif' }}>Dein persönlicher Trainingsplan</p>
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '28px 20px 40px' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 4px 32px rgba(255,140,105,0.12)', border: '1px solid #FFE8D8' }}>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Dein Name</label>
            <input style={inputStyle} placeholder="z.B. Julia" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          {["5 km", "10 km", "Halbmarathon", "Marathon"].map((goal) => (
<button
key={goal}
onClick={() => setForm({...form, goal})}
style={{
background: form.goal === goal ? "#FF8C69" : "white",
color: form.goal === goal ? "white" : "#8B7355",
border: "1px solid #F0E8E0",
borderRadius: 12,
padding: "10px 12px",
fontSize: 12,
cursor: "pointer",
flex: 1,
}}
>
{goal}
</button>
))}


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
          Run Coaching App
        </p>
      </div>
    </div>
  )
}