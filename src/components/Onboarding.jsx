import { useState } from 'react'

const distanzConfig = {
  '5 km':        { zielzeit: 'z.B. 0:25', bisherige: 'z.B. 0:28' },
  '10 km':       { zielzeit: 'z.B. 0:55', bisherige: 'z.B. 1:05' },
  'Halbmarathon':{ zielzeit: 'z.B. 2:05', bisherige: 'z.B. 2:14' },
  'Marathon':    { zielzeit: 'z.B. 4:30', bisherige: 'z.B. 4:55' },
}

export default function Onboarding({ onPlanGenerated }) {
  const [form, setForm] = useState({
    name: '',
    goal: 'Halbmarathon',
    goalTime: '',
    previousTime: '',
    startDate: new Date().toISOString().split('T')[0],
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

  const optionalBadge = {
    fontSize: 10, color: '#D4C4B8', fontWeight: 'normal',
    marginLeft: 6, textTransform: 'none', letterSpacing: 0,
  }

  const config = distanzConfig[form.goal] || distanzConfig['Halbmarathon']

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #FF8C69 0%, #FFB347 50%, #FF6B9D 100%)', padding: '56px 24px 48px', borderRadius: '0 0 40px 40px', boxShadow: '0 8px 32px rgba(255,140,105,0.3)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -40, left: 20, width: 100, height: 100, background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />
        <img src="/route-icon.png" alt="Route" style={{ width: 90, height: 90, borderRadius: '50%', marginBottom: 12 }} />
        <h1 style={{ color: 'white', fontSize: 28, fontWeight: 'bold', margin: '0 0 6px', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>Run Coaching</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: 0, fontFamily: 'sans-serif' }}>Dein persönlicher Trainingsplan</p>
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '28px 20px 40px' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 4px 32px rgba(255,140,105,0.12)', border: '1px solid #FFE8D8' }}>

          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Dein Name</label>
            <input style={inputStyle} placeholder="z.B. Julia" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>

          {/* Distanz */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Renndistanz</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['5 km', '10 km', 'Halbmarathon', 'Marathon'].map(g => (
                <button key={g} onClick={() => setForm({ ...form, goal: g, goalTime: '', previousTime: '' })}
                  style={{ background: form.goal === g ? '#FF8C69' : 'white', color: form.goal === g ? 'white' : '#8B7355', border: `2px solid ${form.goal === g ? '#FF8C69' : '#F0E8E0'}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: form.goal === g ? '0 4px 14px rgba(255,140,105,0.4)' : 'none' }}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Zielzeit + bisherige Zeit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>
                Zielzeit
                <span style={optionalBadge}>optional</span>
              </label>
              <input style={inputStyle} placeholder={config.zielzeit} value={form.goalTime}
                onChange={e => setForm({ ...form, goalTime: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>
                Bisherige Zeit
                <span style={optionalBadge}>optional</span>
              </label>
              <input style={inputStyle} placeholder={config.bisherige} value={form.previousTime}
                onChange={e => setForm({ ...form, previousTime: e.target.value })} />
            </div>
          </div>

          {/* Hinweis wenn keine Zeiten */}
          {!form.goalTime && !form.previousTime && (
            <div style={{ marginBottom: 18, padding: '10px 14px', background: '#F0FAF4', border: '1px solid #B8E4CC', borderRadius: 12, fontSize: 12, color: '#5BA88A', fontFamily: 'sans-serif' }}>
              💡 Ohne Zeitangabe wird ein Plan erstellt, der dir hilft die Distanz zu finishen.
            </div>
          )}

          {/* Startdatum */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Startdatum des Plans</label>
            <input type="date" style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.startDate}
              onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </div>

          {/* Planlänge */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Wie lange soll dein Plan gehen?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[8, 12, 16, 20].map(w => (
                <button key={w} onClick={() => setForm({ ...form, weeksUntilRace: w })}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `2px solid ${form.weeksUntilRace === w ? '#FF8C69' : '#F0E0D0'}`, background: form.weeksUntilRace === w ? 'linear-gradient(135deg,#FF8C69,#FFB347)' : 'white', color: form.weeksUntilRace === w ? 'white' : '#C4A882', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', boxShadow: form.weeksUntilRace === w ? '0 4px 14px rgba(255,140,105,0.4)' : 'none', transition: 'all 0.2s' }}>
                  {w} Wo.
                </button>
              ))}
            </div>
          </div>

          {/* Läufe pro Woche */}
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