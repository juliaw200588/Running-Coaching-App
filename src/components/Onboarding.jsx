import { useState } from 'react'

const zeitenConfig = {
  '5 km': {
    'Anfänger':        { zielzeit: 'z.B. 0:40', bisherige: 'z.B. 0:50' },
    'Fortgeschritten': { zielzeit: 'z.B. 0:28', bisherige: 'z.B. 0:32' },
    'Erfahren':        { zielzeit: 'z.B. 0:22', bisherige: 'z.B. 0:25' },
  },
  '10 km': {
    'Anfänger':        { zielzeit: 'z.B. 1:20', bisherige: 'z.B. 1:35' },
    'Fortgeschritten': { zielzeit: 'z.B. 0:58', bisherige: 'z.B. 1:08' },
    'Erfahren':        { zielzeit: 'z.B. 0:46', bisherige: 'z.B. 0:52' },
  },
  'Halbmarathon': {
    'Anfänger':        { zielzeit: 'z.B. 2:45', bisherige: 'z.B. 3:00' },
    'Fortgeschritten': { zielzeit: 'z.B. 2:05', bisherige: 'z.B. 2:20' },
    'Erfahren':        { zielzeit: 'z.B. 1:45', bisherige: 'z.B. 1:55' },
  },
  'Marathon': {
    'Anfänger':        { zielzeit: 'z.B. 5:30', bisherige: 'z.B. 6:00' },
    'Fortgeschritten': { zielzeit: 'z.B. 4:15', bisherige: 'z.B. 4:45' },
    'Erfahren':        { zielzeit: 'z.B. 3:30', bisherige: 'z.B. 3:50' },
  },
}

const zielOptionen = [
  { id: 'rennen', icon: '🏁', label: 'Ich habe ein Rennen', sub: 'Gezielt auf ein Event vorbereiten' },
  { id: 'distanz', icon: '🎯', label: 'Eine Distanz schaffen', sub: 'Ein persönliches Ziel erreichen' },
  { id: 'starten', icon: '🌱', label: 'Mit Laufen anfangen', sub: 'Einfach loslegen & dranbleiben' },
]

const niveauOptionen = [
  { id: 'Anfänger', icon: '🐢', label: 'Anfänger', sub: 'Ich laufe selten oder gar nicht' },
  { id: 'Fortgeschritten', icon: '🏃', label: 'Fortgeschritten', sub: 'Ich laufe regelmäßig' },
  { id: 'Erfahren', icon: '⚡', label: 'Erfahren', sub: 'Ich nehme an Wettkämpfen teil' },
]

export default function Onboarding({ onPlanGenerated }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', zielTyp: '', niveau: '',
    goal: '', goalTime: '', previousTime: '',
    startDate: new Date().toISOString().split('T')[0],
    weeksUntilRace: 12, runsPerWeek: 3,
    alter: '', aktuelleWochenKm: '', verletzungen: '', maxHF: '', ruheHF: '', geschlecht: '', wohnort: '',
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
  const optLabel = { fontSize: 10, color: '#D4C4B8', fontWeight: 'normal', letterSpacing: 0, textTransform: 'none', marginLeft: 6 }

  const canProceedStep1 = form.zielTyp && form.niveau
  const showDistanz = form.zielTyp !== 'starten'
  const showZeiten = form.zielTyp !== 'starten' && form.goal
  const zeiten = zeitenConfig[form.goal]?.[form.niveau] || { zielzeit: 'z.B. 2:05', bisherige: 'z.B. 2:20' }

  const berechneteHF = form.alter
    ? form.geschlecht === 'w'
      ? Math.round(206 - 0.88 * parseInt(form.alter))
      : form.geschlecht === 'm'
        ? Math.round(220 - parseInt(form.alter))
        : Math.round(208 - 0.7 * parseInt(form.alter))
    : null

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', minHeight: '100vh' }}>

      <div style={{ background: 'linear-gradient(135deg, #FF8C69 0%, #FFB347 50%, #FF6B9D 100%)', padding: '44px 24px 36px', borderRadius: '0 0 40px 40px', boxShadow: '0 8px 32px rgba(255,140,105,0.3)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -40, left: 20, width: 100, height: 100, background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />
        <img src="/route-icon.png" alt="Route" style={{ width: 72, height: 72, borderRadius: '50%', marginBottom: 10 }} />
        <h1 style={{ color: 'white', fontSize: 26, fontWeight: 'bold', margin: '0 0 4px', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>Run Coaching</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, margin: '0 0 16px', fontFamily: 'sans-serif' }}>Dein persönlicher Trainingsplan</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'white', color: '#FF8C69', fontSize: 13, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>1</div>
          <div style={{ width: 40, height: 2, background: step === 2 ? 'white' : 'rgba(255,255,255,0.3)', borderRadius: 1, transition: 'background 0.3s' }} />
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: step === 2 ? 'white' : 'rgba(255,255,255,0.3)', color: step === 2 ? '#FF8C69' : 'white', fontSize: 13, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>2</div>
        </div>
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '24px 20px 40px' }}>

        {step === 1 && (
          <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 4px 32px rgba(255,140,105,0.12)', border: '1px solid #FFE8D8' }}>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Was ist dein Ziel?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {zielOptionen.map(z => (
                  <button key={z.id} onClick={() => setForm({ ...form, zielTyp: z.id, goal: z.id === 'starten' ? '' : form.goal })}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, border: `2px solid ${form.zielTyp === z.id ? '#FF8C69' : '#F0E8E0'}`, background: form.zielTyp === z.id ? '#FFF5F0' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', boxShadow: form.zielTyp === z.id ? '0 4px 14px rgba(255,140,105,0.2)' : 'none' }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{z.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 'bold', color: form.zielTyp === z.id ? '#FF8C69' : '#3D2B1F', fontFamily: 'sans-serif' }}>{z.label}</div>
                      <div style={{ fontSize: 11, color: '#B8A090', fontFamily: 'sans-serif', marginTop: 2 }}>{z.sub}</div>
                    </div>
                    {form.zielTyp === z.id && <span style={{ marginLeft: 'auto', color: '#FF8C69', fontSize: 18 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 26 }}>
              <label style={labelStyle}>Dein Laufniveau</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {niveauOptionen.map(n => (
                  <button key={n.id} onClick={() => setForm({ ...form, niveau: n.id })}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, border: `2px solid ${form.niveau === n.id ? '#7EC8A4' : '#F0E8E0'}`, background: form.niveau === n.id ? '#F0FAF4' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', boxShadow: form.niveau === n.id ? '0 4px 14px rgba(126,200,164,0.2)' : 'none' }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{n.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 'bold', color: form.niveau === n.id ? '#5BA88A' : '#3D2B1F', fontFamily: 'sans-serif' }}>{n.label}</div>
                      <div style={{ fontSize: 11, color: '#B8A090', fontFamily: 'sans-serif', marginTop: 2 }}>{n.sub}</div>
                    </div>
                    {form.niveau === n.id && <span style={{ marginLeft: 'auto', color: '#7EC8A4', fontSize: 18 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setStep(2)} disabled={!canProceedStep1}
              style={{ width: '100%', padding: '17px', borderRadius: 18, border: 'none', background: canProceedStep1 ? 'linear-gradient(135deg,#FF8C69,#FF6B9D)' : '#F0E8E0', color: canProceedStep1 ? 'white' : '#C4A882', fontSize: 16, fontWeight: 'bold', cursor: canProceedStep1 ? 'pointer' : 'default', fontFamily: 'sans-serif', boxShadow: canProceedStep1 ? '0 8px 24px rgba(255,107,157,0.4)' : 'none', transition: 'all 0.2s' }}>
              Weiter →
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 4px 32px rgba(255,140,105,0.12)', border: '1px solid #FFE8D8' }}>

            <div style={{ marginBottom: 22, padding: '12px 16px', background: '#FFF5F0', borderRadius: 14, border: '1px solid #FFE0CC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#8B6B5A' }}>
                <span style={{ fontWeight: 'bold', color: '#FF8C69' }}>{form.name}</span>
                {' · '}{zielOptionen.find(z => z.id === form.zielTyp)?.icon}
                {' '}{zielOptionen.find(z => z.id === form.zielTyp)?.label}
                {' · '}{niveauOptionen.find(n => n.id === form.niveau)?.icon} {form.niveau}
              </div>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#C4A882', cursor: 'pointer', fontSize: 12, fontFamily: 'sans-serif' }}>✏️</button>
            </div>

            {showDistanz && (
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
            )}

            {showZeiten && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div>
                  <label style={labelStyle}>Zielzeit <span style={optLabel}>optional</span></label>
                  <input style={inputStyle} placeholder={zeiten.zielzeit} value={form.goalTime}
                    onChange={e => setForm({ ...form, goalTime: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Bisherige Zeit <span style={optLabel}>optional</span></label>
                  <input style={inputStyle} placeholder={zeiten.bisherige} value={form.previousTime}
                    onChange={e => setForm({ ...form, previousTime: e.target.value })} />
                </div>
              </div>
            )}

            {showZeiten && !form.goalTime && !form.previousTime && (
              <div style={{ marginBottom: 18, padding: '10px 14px', background: '#F0FAF4', border: '1px solid #B8E4CC', borderRadius: 12, fontSize: 12, color: '#5BA88A', fontFamily: 'sans-serif' }}>
                💡 Ohne Zeitangabe wird ein Finisher-Plan erstellt.
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Geschlecht <span style={optLabel}>optional</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'w', label: '♀ Weiblich' },
                  { id: 'm', label: '♂ Männlich' },
                  { id: 'd', label: '⚧ Divers' },
                ].map(g => (
                  <button key={g.id} onClick={() => setForm({ ...form, geschlecht: g.id })}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `2px solid ${form.geschlecht === g.id ? '#FF8C69' : '#F0E0D0'}`, background: form.geschlecht === g.id ? '#FFF5F0' : 'white', color: form.geschlecht === g.id ? '#FF8C69' : '#C4A882', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all 0.2s' }}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Alter <span style={optLabel}>optional</span></label>
              <input style={inputStyle} type="number" placeholder="z.B. 32" value={form.alter}
                onChange={e => setForm({ ...form, alter: e.target.value, maxHF: '' })} />
              {berechneteHF && (
                <div style={{ fontSize: 11, color: '#7EC8A4', fontFamily: 'sans-serif', marginTop: 6 }}>
                  → Maximale Herzfrequenz wird automatisch berechnet: ca. <strong>{berechneteHF} bpm</strong>
                </div>
              )}
              {!form.alter && (
                <div style={{ fontSize: 11, color: '#D4C4B8', fontFamily: 'sans-serif', marginTop: 6 }}>
                  Die maximale Herzfrequenz wird automatisch aus deinem Alter berechnet (220 minus Alter)
                </div>
              )}
            </div>

            {(form.niveau === 'Fortgeschritten' || form.niveau === 'Erfahren') && (
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Max. HF (bpm) <span style={optLabel}>optional</span></label>
                <input style={inputStyle} type="number" placeholder={berechneteHF ? `Berechnet: ca. ${berechneteHF} bpm` : 'z.B. 185'} value={form.maxHF}
                  onChange={e => setForm({ ...form, maxHF: e.target.value })} />
                <div style={{ fontSize: 11, color: '#D4C4B8', fontFamily: 'sans-serif', marginTop: 6 }}>
                  Du kennst deinen genauen Wert z.B. aus einem Leistungstest? Trag ihn hier ein.
                </div>
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Ruhe-Herzfrequenz (bpm) <span style={optLabel}>optional</span></label>
              <input style={inputStyle} type="number" placeholder="z.B. 55" value={form.ruheHF}
                onChange={e => setForm({ ...form, ruheHF: e.target.value })} />
              <div style={{ fontSize: 11, color: '#D4C4B8', fontFamily: 'sans-serif', marginTop: 6 }}>
                Direkt nach dem Aufwachen gemessen, oder aus deiner Sportuhr. Macht die HF-Zonen deutlich genauer.
              </div>
            </div>

            {!form.alter && !form.maxHF && (
              <div style={{ marginBottom: 18, padding: '10px 14px', background: '#FFF5EE', border: '1px solid #FFE0CC', borderRadius: 12, fontSize: 12, color: '#C17A3A', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
                💡 <strong>Tipp:</strong> Mit Alter oder maximaler Herzfrequenz wird dein Plan noch präziser – die Einheiten werden dann mit individuellen Herzfrequenzzonen (Zone 1–5) ergänzt, statt nur nach Pace. Beides ist optional.
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Aktuelle Wochenkilometer <span style={optLabel}>optional</span></label>
              <input style={inputStyle} type="number" placeholder="z.B. 20 km pro Woche" value={form.aktuelleWochenKm}
                onChange={e => setForm({ ...form, aktuelleWochenKm: e.target.value })} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Verletzungsgeschichte <span style={optLabel}>optional</span></label>
              <input style={inputStyle} placeholder="z.B. Knieprobleme, Achillessehne..." value={form.verletzungen}
                onChange={e => setForm({ ...form, verletzungen: e.target.value })} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Startdatum des Plans</label>
              <input type="date" style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.startDate}
                onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>

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

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)}
                style={{ flex: 1, padding: '17px', borderRadius: 18, border: '1.5px solid #F0E0D0', background: 'white', color: '#C4A882', fontSize: 15, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                ← Zurück
              </button>
              <button onClick={handleGenerate} disabled={loading || (showDistanz && !form.goal)}
                style={{ flex: 2, padding: '17px', borderRadius: 18, border: 'none', background: loading || (showDistanz && !form.goal) ? '#F0E8E0' : 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: loading || (showDistanz && !form.goal) ? '#C4A882' : 'white', fontSize: 15, fontWeight: 'bold', cursor: loading || (showDistanz && !form.goal) ? 'default' : 'pointer', fontFamily: 'sans-serif', boxShadow: loading || (showDistanz && !form.goal) ? 'none' : '0 8px 24px rgba(255,107,157,0.4)', transition: 'all 0.2s' }}>
                {loading ? '⏳ Wird erstellt…' : '🏃‍♀️ Plan generieren'}
              </button>
            </div>

            {loading && (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#C4A882', marginTop: 12, fontFamily: 'sans-serif' }}>
                Das dauert ca. 20–30 Sekunden
              </p>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#D4C4B8', marginTop: 20, fontFamily: 'sans-serif' }}>
          Run Coaching App
        </p>
      </div>
    </div>
  )
}
