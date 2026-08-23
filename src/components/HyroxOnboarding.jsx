import { useEffect, useMemo, useState } from 'react'

const DRAFT_KEY = 'hyrox-onboarding-draft-v1'
const DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So']

const DEFAULT_DAYS = {
  3:['Di','Do','Sa'],
  4:['Mo','Mi','Fr','So'],
  5:['Mo','Di','Do','Sa','So'],
  6:['Mo','Di','Mi','Fr','Sa','So'],
}

const EQUIPMENT = [
  { id:'skiErg', label:'SkiErg' },
  { id:'rower', label:'Rower' },
  { id:'sled', label:'Sled Push/Pull' },
  { id:'wallBall', label:'Wall Balls' },
  { id:'kettlebells', label:'Kettlebells/Dumbbells' },
  { id:'sandbag', label:'Sandbag' },
]

const todayIso = () => {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0,10)
}

const weeksBetween = (start, end) => {
  if (!start || !end) return null
  const a = new Date(`${start}T12:00:00`)
  const b = new Date(`${end}T12:00:00`)
  return Math.ceil((b - a) / (7 * 86400000))
}

const recommendedWeeks = form => {
  if (form.goalType === 'event' && form.eventDate) {
    return Math.max(6, Math.min(24, weeksBetween(form.startDate, form.eventDate) || 12))
  }
  if (form.level === 'beginner') return 14
  if (form.level === 'experienced') return 10
  return 12
}

const initialForm = {
  name:'',
  goalType:'event',
  raceFormat:'single',
  division:'open',
  gender:'women',
  eventDate:'',
  level:'intermediate',
  hyroxExperience:'none',
  fiveKTime:'',
  currentWeeklyKm:'',
  strengthSessions:'2',
  startDate:todayIso(),
  unitsPerWeek:4,
  preferredDays:DEFAULT_DAYS[4],
  equipment:['rower','kettlebells','wallBall'],
  limitations:'',
}

const card = {
  background:'#fff',
  border:'1px solid #EEE3DC',
  borderRadius:20,
  boxShadow:'0 8px 24px rgba(74,52,39,.055)',
  boxSizing:'border-box',
}

const labelStyle = {
  display:'block',
  marginBottom:7,
  color:'#A27F6D',
  fontSize:10,
  fontWeight:900,
  letterSpacing:1,
  fontFamily:'sans-serif',
}

const inputStyle = {
  width:'100%',
  boxSizing:'border-box',
  border:'1.5px solid #EADDD5',
  borderRadius:14,
  padding:'12px 13px',
  background:'#FFFDFC',
  color:'#49372C',
  outline:'none',
  fontSize:13,
  fontFamily:'sans-serif',
}

function Choice({ active, children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      border:active ? '2px solid #E5745F' : '1.5px solid #E9DDD6',
      background:active ? '#FFF1EA' : '#fff',
      color:active ? '#B85C49' : '#806A5F',
      borderRadius:13,
      padding:'10px 11px',
      fontSize:11,
      fontWeight:850,
      cursor:'pointer',
      fontFamily:'sans-serif',
    }}>{children}</button>
  )
}

export default function HyroxOnboarding({ onPlanGenerated }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null')
      return {
        ...initialForm,
        ...(saved?.form || {}),
        equipment:Array.isArray(saved?.form?.equipment)
          ? saved.form.equipment
          : initialForm.equipment,
      }
    } catch {
      return initialForm
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, form }))
    } catch {}
  }, [step, form])

  const eventWeeks = useMemo(
    () => weeksBetween(form.startDate, form.eventDate),
    [form.startDate, form.eventDate]
  )

  const weeks = useMemo(() => recommendedWeeks(form), [
    form.goalType,
    form.eventDate,
    form.startDate,
    form.level,
  ])

  const patch = values => setForm(current => ({ ...current, ...values }))

  const toggleDay = day => {
    setForm(current => {
      const selected = current.preferredDays.includes(day)
      if (selected) {
        return {
          ...current,
          preferredDays:current.preferredDays.filter(item => item !== day),
        }
      }
      if (current.preferredDays.length >= Number(current.unitsPerWeek)) return current
      return {
        ...current,
        preferredDays:[...current.preferredDays, day]
          .sort((a,b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
      }
    })
  }

  const setUnits = units => {
    setForm(current => ({
      ...current,
      unitsPerWeek:units,
      preferredDays:DEFAULT_DAYS[units],
    }))
  }

  const toggleEquipment = id => {
    setForm(current => ({
      ...current,
      equipment:current.equipment.includes(id)
        ? current.equipment.filter(item => item !== id)
        : [...current.equipment, id],
    }))
  }

  const canStep1 =
    Boolean(form.goalType) &&
    Boolean(form.raceFormat) &&
    Boolean(form.division) &&
    Boolean(form.gender) &&
    (form.goalType !== 'event' || (Boolean(form.eventDate) && eventWeeks != null && eventWeeks > 0))

  const canStep2 =
    Boolean(form.level) &&
    Boolean(form.hyroxExperience) &&
    Number(form.strengthSessions) >= 0

  const canGenerate =
    Boolean(form.startDate) &&
    Number(form.unitsPerWeek) >= 3 &&
    form.preferredDays.length === Number(form.unitsPerWeek)

  const handleGenerate = async () => {
    if (!canGenerate) return
    setLoading(true)
    setError('')

    try {
      const normalizedForm = {
        ...form,
        preferredDays:[...(form.preferredDays || [])]
          .sort((a,b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
        weeksUntilGoal:weeks,
        sport_type:'hyrox',
        plan_type:'hyrox',
      }

      const response = await fetch('/api/generate-plan', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify(normalizedForm),
      })

      const data = await response.json()
      if (!response.ok || data?.error) {
        throw new Error(data?.error || `HTTP ${response.status}`)
      }

      if (!data?.plan?.phases?.length) {
        throw new Error('Der HYROX-Plan ist unvollständig.')
      }

      try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
      onPlanGenerated(data.plan)
    } catch (e) {
      console.error('[HyroxOnboarding] Plan konnte nicht erstellt werden:', e)
      setError(
        e?.message
          ? `Dein HYROX-Plan konnte gerade nicht erstellt werden: ${e.message}`
          : 'Dein HYROX-Plan konnte gerade nicht erstellt werden.'
      )
    } finally {
      setLoading(false)
    }
  }

  const next = () => {
    setError('')
    if (step === 1 && !canStep1) {
      setError('Bitte vervollständige zuerst dein HYROX-Ziel.')
      return
    }
    if (step === 2 && !canStep2) {
      setError('Bitte vervollständige zuerst deinen aktuellen Trainingsstand.')
      return
    }
    setStep(current => Math.min(3, current + 1))
  }

  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(160deg,#FFF8F0 0%,#F3F8F4 52%,#FFF1F0 100%)',
      padding:'18px 16px 110px',
      boxSizing:'border-box',
    }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{
          ...card,
          padding:'20px 18px',
          background:'linear-gradient(145deg,#2E2926,#4C3A31 58%,#714F42)',
          color:'#fff',
          overflow:'hidden',
          position:'relative',
        }}>
          <div style={{ fontSize:10, fontWeight:900, letterSpacing:1.15, opacity:.72, fontFamily:'sans-serif' }}>
            HYROX TRAININGSPLAN
          </div>
          <h1 style={{
            margin:'7px 0 7px',
            fontFamily:"'Georgia','Times New Roman',serif",
            fontSize:'clamp(27px,6vw,38px)',
            lineHeight:1.05,
          }}>
            Laufstärke trifft Functional Fitness.
          </h1>
          <p style={{ margin:0, maxWidth:560, opacity:.78, fontSize:11.5, lineHeight:1.55, fontFamily:'sans-serif' }}>
            Dein Plan kombiniert Laufen, Kraft, Stationsarbeit und später gezielte HYROX-Simulationen.
          </p>
        </div>

        <div style={{ display:'flex', gap:7, margin:'14px 0 17px' }}>
          {[1,2,3].map(n => (
            <div key={n} style={{
              flex:1,
              height:5,
              borderRadius:99,
              background:n <= step ? '#E5745F' : '#E9DED7',
            }} />
          ))}
        </div>

        {step === 1 && (
          <div style={{ ...card, padding:18 }}>
            <div style={{ color:'#C46752', fontSize:10, fontWeight:900, letterSpacing:1, fontFamily:'sans-serif' }}>1 · DEIN ZIEL</div>
            <h2 style={{ margin:'5px 0 17px', color:'#3E2D24', fontFamily:"'Georgia','Times New Roman',serif", fontSize:24 }}>
              Wofür trainierst du?
            </h2>

            <div style={{ marginBottom:17 }}>
              <div style={labelStyle}>Ziel</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8 }}>
                <Choice active={form.goalType === 'event'} onClick={() => patch({ goalType:'event' })}>Wettkampf</Choice>
                <Choice active={form.goalType === 'fitness'} onClick={() => patch({ goalType:'fitness', eventDate:'' })}>HYROX-Fitness</Choice>
              </div>
            </div>

            <div style={{ marginBottom:17 }}>
              <div style={labelStyle}>Format</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8 }}>
                <Choice active={form.raceFormat === 'single'} onClick={() => patch({ raceFormat:'single' })}>Single</Choice>
                <Choice active={form.raceFormat === 'doubles'} onClick={() => patch({ raceFormat:'doubles' })}>Doubles</Choice>
              </div>
              {form.raceFormat === 'doubles' && (
                <div style={{ marginTop:7, color:'#9B8377', fontSize:10.5, lineHeight:1.45, fontFamily:'sans-serif' }}>
                  Ihr lauft gemeinsam; die Workstations können im Wechsel aufgeteilt werden.
                </div>
              )}
            </div>

            <div style={{ marginBottom:17 }}>
              <div style={labelStyle}>Division</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8 }}>
                <Choice active={form.division === 'open'} onClick={() => patch({ division:'open' })}>Open</Choice>
                <Choice active={form.division === 'pro'} onClick={() => patch({ division:'pro' })}>Pro</Choice>
              </div>
            </div>

            <div style={{ marginBottom:17 }}>
              <div style={labelStyle}>Kategorie</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8 }}>
                <Choice active={form.gender === 'women'} onClick={() => patch({ gender:'women' })}>Women</Choice>
                <Choice active={form.gender === 'men'} onClick={() => patch({ gender:'men' })}>Men</Choice>
              </div>
            </div>

            {form.goalType === 'event' && (
              <div>
                <label style={labelStyle}>Wettkampfdatum</label>
                <input
                  type="date"
                  min={form.startDate || todayIso()}
                  value={form.eventDate}
                  onChange={event => patch({ eventDate:event.target.value })}
                  style={inputStyle}
                />
                {eventWeeks != null && eventWeeks > 0 && (
                  <div style={{ marginTop:6, color:'#A28B7F', fontSize:10.5, fontFamily:'sans-serif' }}>
                    Noch etwa {eventWeeks} Trainingswochen bis zum Event.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={{ ...card, padding:18 }}>
            <div style={{ color:'#C46752', fontSize:10, fontWeight:900, letterSpacing:1, fontFamily:'sans-serif' }}>2 · DEIN AUSGANGSPUNKT</div>
            <h2 style={{ margin:'5px 0 17px', color:'#3E2D24', fontFamily:"'Georgia','Times New Roman',serif", fontSize:24 }}>
              Wo stehst du gerade?
            </h2>

            <div style={{ marginBottom:17 }}>
              <div style={labelStyle}>Trainingsniveau</div>
              <div style={{ display:'grid', gap:7 }}>
                {[
                  ['beginner','Einsteiger · wenig strukturierte Lauf-/Krafterfahrung'],
                  ['intermediate','Fortgeschritten · regelmäßiges Ausdauer- und Krafttraining'],
                  ['experienced','Erfahren · HYROX/Functional Fitness bereits vertraut'],
                ].map(([id,text]) => (
                  <Choice key={id} active={form.level === id} onClick={() => patch({ level:id })}>{text}</Choice>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:17 }}>
              <div style={labelStyle}>HYROX-Erfahrung</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:7 }}>
                {[
                  ['none','Noch keine'],
                  ['training','Im Training'],
                  ['race','Race-Erfahrung'],
                ].map(([id,text]) => (
                  <Choice key={id} active={form.hyroxExperience === id} onClick={() => patch({ hyroxExperience:id })}>{text}</Choice>
                ))}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:10, marginBottom:13 }}>
              <div>
                <label style={labelStyle}>5-km-Zeit <span style={{ fontWeight:500, letterSpacing:0 }}>(optional)</span></label>
                <input placeholder="z. B. 27:30" value={form.fiveKTime} onChange={e => patch({ fiveKTime:e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Lauf-km/Woche <span style={{ fontWeight:500, letterSpacing:0 }}>(optional)</span></label>
                <input type="number" min="0" placeholder="z. B. 20" value={form.currentWeeklyKm} onChange={e => patch({ currentWeeklyKm:e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom:13 }}>
              <label style={labelStyle}>Krafteinheiten pro Woche</label>
              <select value={form.strengthSessions} onChange={e => patch({ strengthSessions:e.target.value })} style={inputStyle}>
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3+</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Besonderheiten <span style={{ fontWeight:500, letterSpacing:0 }}>(optional)</span></label>
              <textarea
                rows={3}
                placeholder="z. B. empfindliche Knie, kein Springen, Wiedereinstieg …"
                value={form.limitations}
                onChange={e => patch({ limitations:e.target.value })}
                style={{ ...inputStyle, resize:'vertical' }}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ ...card, padding:18 }}>
            <div style={{ color:'#C46752', fontSize:10, fontWeight:900, letterSpacing:1, fontFamily:'sans-serif' }}>3 · DEIN TRAINING</div>
            <h2 style={{ margin:'5px 0 17px', color:'#3E2D24', fontFamily:"'Georgia','Times New Roman',serif", fontSize:24 }}>
              Was passt in deinen Alltag?
            </h2>

            <div style={{ marginBottom:17 }}>
              <label style={labelStyle}>Planstart</label>
              <input type="date" value={form.startDate} onChange={e => patch({ startDate:e.target.value })} style={inputStyle} />
            </div>

            <div style={{ marginBottom:17 }}>
              <div style={labelStyle}>Einheiten pro Woche</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:7 }}>
                {[3,4,5,6].map(units => (
                  <Choice key={units} active={Number(form.unitsPerWeek) === units} onClick={() => setUnits(units)}>{units}</Choice>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:19 }}>
              <div style={labelStyle}>Trainingstage · wähle {form.unitsPerWeek}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', gap:5 }}>
                {DAYS.map(day => (
                  <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                    border:form.preferredDays.includes(day) ? '2px solid #E5745F' : '1px solid #E8DDD6',
                    background:form.preferredDays.includes(day) ? '#FFF0EA' : '#fff',
                    color:form.preferredDays.includes(day) ? '#B85C49' : '#8A766B',
                    borderRadius:10,
                    padding:'9px 2px',
                    fontSize:10,
                    fontWeight:900,
                    cursor:'pointer',
                  }}>{day}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:17 }}>
              <div style={labelStyle}>Verfügbares Equipment</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:7 }}>
                {EQUIPMENT.map(item => (
                  <Choice
                    key={item.id}
                    active={form.equipment.includes(item.id)}
                    onClick={() => toggleEquipment(item.id)}
                  >
                    {item.label}
                  </Choice>
                ))}
              </div>
              <div style={{ marginTop:8, color:'#9D887C', fontSize:10.5, lineHeight:1.45, fontFamily:'sans-serif' }}>
                Fehlende Race-Stations werden im Plan durch passende Alternativen ersetzt.
              </div>
            </div>

            <div style={{
              padding:'12px 13px',
              borderRadius:14,
              background:'#F5F8F5',
              border:'1px solid #DBE7DE',
              color:'#6F7D72',
              fontSize:10.5,
              lineHeight:1.5,
              fontFamily:'sans-serif',
            }}>
              Geplanter Aufbau: ca. <b>{weeks} Wochen</b> · Basis → Aufbau → HYROX-spezifisch → Taper.
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop:11,
            padding:'10px 12px',
            borderRadius:13,
            background:'#FFF1EF',
            border:'1px solid #F2D1CB',
            color:'#B95E54',
            fontSize:10.8,
            fontFamily:'sans-serif',
          }}>
            {error}
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginTop:13 }}>
          {step > 1 && (
            <button type="button" disabled={loading} onClick={() => setStep(current => current - 1)} style={{
              flex:1,
              border:'1.5px solid #E5D9D2',
              borderRadius:15,
              padding:'12px',
              background:'#fff',
              color:'#8B756A',
              fontWeight:850,
              cursor:'pointer',
            }}>
              Zurück
            </button>
          )}

          {step < 3 ? (
            <button type="button" onClick={next} style={{
              flex:2,
              border:'none',
              borderRadius:15,
              padding:'12px',
              background:'linear-gradient(135deg,#E9826A,#D95F59)',
              color:'#fff',
              fontWeight:900,
              cursor:'pointer',
            }}>
              Weiter
            </button>
          ) : (
            <button type="button" disabled={loading || !canGenerate} onClick={handleGenerate} style={{
              flex:2,
              border:'none',
              borderRadius:15,
              padding:'12px',
              background:'linear-gradient(135deg,#E9826A,#D95F59)',
              color:'#fff',
              fontWeight:900,
              cursor:loading ? 'default' : 'pointer',
              opacity:loading || !canGenerate ? .6 : 1,
            }}>
              {loading ? 'HYROX-Plan wird erstellt…' : 'HYROX-Plan erstellen'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
