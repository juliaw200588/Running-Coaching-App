import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { buildHikingPlanGuardrails, getRecommendedHikingWeeks } from '../lib/hikingPlanGenerator.js'

const todayIso = () => new Date().toISOString().split('T')[0]

const weeksBetween = (startValue, endValue) => {
  if (!startValue || !endValue) return null
  const start = new Date(`${startValue}T12:00:00`)
  const end = new Date(`${endValue}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const days = Math.floor((end - start) / 86400000)
  return days >= 7 ? Math.floor(days / 7) : 0
}

const goalOptions = [
  { id:'march', icon:'🏁', label:'Ich trainiere für einen Marsch', sub:'Gezielt auf eine Veranstaltung vorbereiten' },
  { id:'distance', icon:'🎯', label:'Ich möchte eine Distanz schaffen', sub:'Eine bestimmte Strecke sicher bewältigen' },
  { id:'tour', icon:'🗺️', label:'Ich trainiere für eine Wanderung oder Tour', sub:'Für eine Tages-, Mehrtages- oder Fernwanderung vorbereiten' },
  { id:'beginner', icon:'🌱', label:'Ich möchte mit Wandern anfangen', sub:'Schritt für Schritt mehr Ausdauer aufbauen' },
]

const levelOptions = [
  { id:'start', icon:'🌱', label:'Ich starte gerade', sub:'Längere Wanderungen gehören noch nicht zu meinem Alltag' },
  { id:'regular', icon:'🥾', label:'Ich bin regelmäßig unterwegs', sub:'Ich wandere oder marschiere bereits regelmäßig' },
  { id:'long', icon:'🗺️', label:'Ich mache längere Touren', sub:'Längere Strecken oder Wandertage sind mir vertraut' },
]

const terrainOptions = [
  { id:'flat', label:'Überwiegend flach' },
  { id:'hilly', label:'Leicht hügelig' },
  { id:'climbs', label:'Regelmäßig Anstiege möglich' },
  { id:'mixed', label:'Gemischt' },
]

const targetTerrainOptions = [
  { id:'flat', label:'Eher flach' },
  { id:'hilly', label:'Hügelig' },
  { id:'mountainous', label:'Viele Höhenmeter' },
  { id:'mixed', label:'Gemischt / noch offen' },
]

const trainingTools = [
  { id:'stairs', label:'Treppen' },
  { id:'treadmill', label:'Laufband mit Steigung' },
  { id:'gym', label:'Fitnessstudio / Krafttraining' },
  { id:'occasional_hills', label:'Gelegentlich hügeliges Gelände' },
]

const dayOptions = ['Mo','Di','Mi','Do','Fr','Sa','So']

const inputStyle = {
  width:'100%', padding:'13px 15px', borderRadius:14, border:'1.5px solid #EADFD8',
  fontSize:15, color:'#3D2B1F', outline:'none', boxSizing:'border-box',
  background:'#FFF9F5', fontFamily:'sans-serif',
}

const labelStyle = {
  display:'block', marginBottom:7, fontFamily:'sans-serif', fontSize:10.5,
  fontWeight:900, color:'#9D8374', textTransform:'uppercase', letterSpacing:1,
}

const optional = {
  fontSize:9.5, color:'#C8B6AA', textTransform:'none', letterSpacing:0, fontWeight:600,
}

const card = {
  background:'#fff', border:'1px solid #EEE1D8', borderRadius:24, padding:22,
  boxShadow:'0 6px 30px rgba(87,61,46,.08)',
}

export default function HikingOnboarding({ onPlanGenerated }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    name:'',
    goalType:'',
    level:'',
    targetDistanceKm:'',
    customDistance:false,
    eventDate:'',
    routeName:'',
    tourType:'day',
    tourTotalKm:'',
    tourDays:'',
    longestStageKm:'',
    targetTerrain:'mixed',
    currentFrequency:'',
    currentWeeklyKm:'',
    longestRecentKm:'',
    trainingTerrain:'flat',
    trainingOptions:[],
    movementStyle:'walk',
    goalBackpack:'no',
    backpackKg:'',
    considerations:'',
    hasConsiderations:'no',
    startDate:todayIso(),
    weeksUntilGoal:12,
    availableWeeks:null,
    unitsPerWeek:3,
    preferredDays:['Di','Do','Sa'],
  })

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user?.id) return

        const { data } = await supabase
          .from('profiles')
          .select('name,wohnort')
          .eq('id', user.id)
          .maybeSingle()

        if (!active) return

        setForm(current => ({
          ...current,
          name: data?.name || user.user_metadata?.name || current.name,
        }))
      } catch (e) {
        console.warn('[HikingOnboarding] Profil konnte nicht vorgeladen werden:', e)
      } finally {
        if (active) setProfileLoading(false)
      }
    }

    loadProfile()
    return () => { active = false }
  }, [])

  const eventWeeks = useMemo(
    () => weeksBetween(form.startDate, form.eventDate),
    [form.startDate, form.eventDate]
  )

  const recommendation = useMemo(
    () => getRecommendedHikingWeeks(form),
    [form.goalType, form.targetDistanceKm, form.tourDays, form.longestStageKm, form.longestRecentKm]
  )

  useEffect(() => {
    if (form.eventDate && eventWeeks != null && eventWeeks > 0) {
      setForm(current => ({
        ...current,
        weeksUntilGoal:eventWeeks,
        availableWeeks:eventWeeks,
      }))
      return
    }

    setForm(current => ({
      ...current,
      weeksUntilGoal:recommendation,
      availableWeeks:null,
    }))
  }, [eventWeeks, form.eventDate, recommendation])

  const toggleTool = id => {
    setForm(current => ({
      ...current,
      trainingOptions: current.trainingOptions.includes(id)
        ? current.trainingOptions.filter(item => item !== id)
        : [...current.trainingOptions, id],
    }))
  }

  const toggleDay = day => {
    setForm(current => {
      const selected = current.preferredDays.includes(day)
      const next = selected
        ? current.preferredDays.filter(item => item !== day)
        : [...current.preferredDays, day]
      return { ...current, preferredDays:next }
    })
  }

  const canStep1 =
    Boolean(form.goalType) &&
    Boolean(form.level) &&
    (
      form.goalType === 'beginner' ||
      (form.goalType === 'tour'
        ? Boolean(form.routeName || form.tourTotalKm) && Boolean(form.longestStageKm)
        : Boolean(Number(form.targetDistanceKm) > 0))
    ) &&
    (
      !['march','tour'].includes(form.goalType) ||
      !form.eventDate ||
      (eventWeeks != null && eventWeeks > 0)
    )

  const canStep2 =
    Boolean(form.currentFrequency) &&
    Boolean(Number(form.longestRecentKm) >= 0) &&
    Boolean(form.trainingTerrain) &&
    Boolean(form.movementStyle)

  const canGenerate =
    Boolean(form.startDate) &&
    form.unitsPerWeek >= 2 &&
    form.preferredDays.length >= form.unitsPerWeek

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const guardrails = buildHikingPlanGuardrails(form)

      const response = await fetch('/api/generate-hiking-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sport_type: 'hiking',
          plan_type: 'hiking_march',
          guardrails,
        }),
      })

      const data = await response.json()

      if (!response.ok || data?.error) {
        throw new Error(data?.error || `HTTP ${response.status}`)
      }

      if (!data?.plan?.phases?.length) {
        throw new Error('Der Trainingsplan ist unvollständig.')
      }

      onPlanGenerated(data.plan)
    } catch (e) {
      console.error('[HikingOnboarding] Plan konnte nicht erstellt werden:', e)
      setError(
        'Dein Plan konnte gerade nicht erstellt werden. Bitte versuche es noch einmal.'
      )
    } finally {
      setLoading(false)
    }
  }

  const OptionButton = ({ selected, icon, title, text, onClick, tone='orange' }) => {
    const color = tone === 'green' ? '#6BB18D' : '#E27B5F'
    const bg = tone === 'green' ? '#F2FAF5' : '#FFF5F0'
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          width:'100%', display:'grid', gridTemplateColumns:'40px 1fr 22px',
          gap:11, alignItems:'center', textAlign:'left', padding:'13px 14px',
          borderRadius:15, border:`2px solid ${selected ? color : '#EEE4DE'}`,
          background:selected ? bg : '#fff', cursor:'pointer',
        }}
      >
        <span style={{fontSize:22}}>{icon}</span>
        <span>
          <span style={{display:'block',fontFamily:'sans-serif',fontWeight:850,fontSize:13,color:selected ? color : '#3D2B1F'}}>{title}</span>
          {text && <span style={{display:'block',fontFamily:'sans-serif',fontSize:10.2,lineHeight:1.4,color:'#AE9587',marginTop:2}}>{text}</span>}
        </span>
        <span style={{fontFamily:'sans-serif',fontWeight:900,color:selected ? color : 'transparent'}}>✓</span>
      </button>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#FFF8F0 0%,#F0FAF4 50%,#FFF0F5 100%)',color:'#3D2B1F'}}>
      <header style={{minHeight:238,position:'relative',overflow:'hidden',display:'flex',alignItems:'flex-end',background:'#607267'}}>
        <div aria-hidden="true" style={{position:'absolute',inset:0,backgroundImage:'url("/hero/hiking/03.webp")',backgroundSize:'cover',backgroundPosition:'center 52%'}} />
        <div aria-hidden="true" style={{position:'absolute',inset:0,background:'linear-gradient(90deg,rgba(22,27,23,.74),rgba(25,25,22,.42) 54%,rgba(20,20,18,.10) 80%),linear-gradient(180deg,rgba(15,18,16,.04),rgba(22,20,18,.65))'}} />
        <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:720,margin:'0 auto',boxSizing:'border-box',padding:'32px 20px 24px',color:'#fff'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:40,height:40,borderRadius:'50%',display:'grid',placeItems:'center',background:'rgba(255,248,240,.94)',border:'1px solid rgba(255,255,255,.72)',boxShadow:'0 4px 14px rgba(0,0,0,.16)'}}>
              <img src="/route-icon.png" alt="" aria-hidden="true" style={{width:32,height:32,borderRadius:'50%',display:'block'}} />
            </div>
            <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,letterSpacing:1.4,opacity:.92}}>DEIN TRAININGSPLAN</div>
          </div>
          <h1 style={{margin:'8px 0 4px',fontFamily:"'Georgia','Times New Roman',serif",fontSize:30,lineHeight:1.06}}>Marsch & Wandern</h1>
          <p style={{margin:0,fontFamily:'sans-serif',fontSize:11.5,lineHeight:1.5,opacity:.9}}>Wir bauen deine Ausdauer und Belastbarkeit Schritt für Schritt für lange Strecken auf.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:18,maxWidth:390}}>
            {['Ziel','Training','Plan'].map((label,index) => {
              const n=index+1
              const active=step===n
              const done=step>n
              return (
                <div key={label}>
                  <div style={{height:4,borderRadius:99,background:active||done?'#fff':'rgba(255,255,255,.28)'}} />
                  <div style={{marginTop:6,fontFamily:'sans-serif',fontSize:9.5,fontWeight:active?900:700,opacity:active||done?1:.7}}>{n} · {label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </header>

      <main style={{maxWidth:520,margin:'0 auto',padding:'24px 18px 44px'}}>
        {profileLoading && <div style={{fontFamily:'sans-serif',fontSize:10.5,color:'#A88F80',marginBottom:10}}>Profil wird übernommen…</div>}

        {step===1 && (
          <section style={card}>
            <div style={{marginBottom:24}}>
              <div style={labelStyle}>Wofür möchtest du trainieren?</div>
              <div style={{display:'grid',gap:9}}>
                {goalOptions.map(option => (
                  <OptionButton
                    key={option.id}
                    selected={form.goalType===option.id}
                    icon={option.icon}
                    title={option.label}
                    text={option.sub}
                    onClick={() => setForm(current => ({
                      ...current,
                      goalType:option.id,
                      targetDistanceKm:option.id==='beginner'?'':current.targetDistanceKm,
                      eventDate:['march','tour'].includes(option.id)?current.eventDate:'',
                    }))}
                  />
                ))}
              </div>
            </div>

            <div style={{marginBottom:24}}>
              <div style={labelStyle}>Wo stehst du gerade?</div>
              <div style={{display:'grid',gap:9}}>
                {levelOptions.map(option => (
                  <OptionButton key={option.id} selected={form.level===option.id} icon={option.icon} title={option.label} text={option.sub} tone="green" onClick={() => setForm(current => ({...current,level:option.id}))} />
                ))}
              </div>
            </div>

            {['march','distance'].includes(form.goalType) && (
              <div style={{marginBottom:22}}>
                <div style={labelStyle}>Deine Zieldistanz</div>
                <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                  {[20,30,50,100].map(km => (
                    <button key={km} type="button" onClick={() => setForm(current => ({...current,targetDistanceKm:String(km),customDistance:false}))}
                      style={{padding:'10px 12px',borderRadius:12,border:`2px solid ${String(km)===String(form.targetDistanceKm)&&!form.customDistance?'#E27B5F':'#EEE3DC'}`,background:String(km)===String(form.targetDistanceKm)&&!form.customDistance?'#FFF2EC':'#fff',color:'#8A7366',fontFamily:'sans-serif',fontWeight:850,cursor:'pointer'}}>
                      {km} km
                    </button>
                  ))}
                  <button type="button" onClick={() => setForm(current => ({...current,customDistance:true,targetDistanceKm:current.customDistance?current.targetDistanceKm:''}))}
                    style={{padding:'10px 12px',borderRadius:12,border:`2px solid ${form.customDistance?'#E27B5F':'#EEE3DC'}`,background:form.customDistance?'#FFF2EC':'#fff',color:'#8A7366',fontFamily:'sans-serif',fontWeight:850,cursor:'pointer'}}>
                    Andere Distanz
                  </button>
                </div>
                {form.customDistance && (
                  <input style={{...inputStyle,marginTop:10}} type="number" min="5" max="200" placeholder="z. B. 55, 60 oder 75" value={form.targetDistanceKm}
                    onChange={e => setForm(current => ({...current,targetDistanceKm:e.target.value}))} />
                )}
              </div>
            )}

            {form.goalType==='tour' && (
              <>
                <div style={{marginBottom:18}}>
                  <label style={labelStyle}>Deine Tour <span style={optional}>Name optional</span></label>
                  <input style={inputStyle} placeholder="z. B. Malerweg, Jakobsweg, Alpenüberquerung" value={form.routeName}
                    onChange={e => setForm(current => ({...current,routeName:e.target.value}))} />
                </div>
                <div style={{marginBottom:18}}>
                  <div style={labelStyle}>Was hast du vor?</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>
                    {[['day','Tageswanderung'],['multi','Mehrtages-tour'],['longtrail','Fernwanderweg']].map(([id,label]) => (
                      <button key={id} type="button" onClick={() => setForm(current => ({...current,tourType:id}))}
                        style={{padding:'10px 5px',borderRadius:12,border:`2px solid ${form.tourType===id?'#7EC8A4':'#EEE3DC'}`,background:form.tourType===id?'#F2FAF5':'#fff',color:'#7B6A60',fontFamily:'sans-serif',fontSize:10,fontWeight:850,cursor:'pointer'}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
                  <div>
                    <label style={labelStyle}>Gesamtdistanz <span style={optional}>km</span></label>
                    <input style={inputStyle} type="number" min="5" placeholder="z. B. 116" value={form.tourTotalKm}
                      onChange={e => setForm(current => ({...current,tourTotalKm:e.target.value}))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Anzahl Tage</label>
                    <input style={inputStyle} type="number" min="1" max="60" placeholder="z. B. 8" value={form.tourDays}
                      onChange={e => setForm(current => ({...current,tourDays:e.target.value}))} />
                  </div>
                </div>
                <div style={{marginBottom:18}}>
                  <label style={labelStyle}>Längste geplante Tagesetappe</label>
                  <input style={inputStyle} type="number" min="5" placeholder="z. B. 20 km" value={form.longestStageKm}
                    onChange={e => setForm(current => ({...current,longestStageKm:e.target.value}))} />
                </div>
              </>
            )}

            {form.goalType && form.goalType!=='beginner' && (
              <div style={{marginBottom:18}}>
                <div style={labelStyle}>Wie ist dein Zielgelände?</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                  {targetTerrainOptions.map(option => (
                    <button key={option.id} type="button" onClick={() => setForm(current => ({...current,targetTerrain:option.id}))}
                      style={{padding:'10px 8px',borderRadius:12,border:`2px solid ${form.targetTerrain===option.id?'#A98BC1':'#EEE3DC'}`,background:form.targetTerrain===option.id?'#F8F4FB':'#fff',color:'#806E79',fontFamily:'sans-serif',fontSize:10.5,fontWeight:850,cursor:'pointer'}}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {['march','tour'].includes(form.goalType) && (
              <div style={{marginBottom:22}}>
                <label style={labelStyle}>{form.goalType==='march'?'Wann ist dein Marsch?':'Wann startet deine Tour?'} <span style={optional}>optional</span></label>
                <input type="date" min={form.startDate} style={{...inputStyle,cursor:'pointer'}} value={form.eventDate}
                  onChange={e => setForm(current => ({...current,eventDate:e.target.value}))} />
                {form.eventDate && eventWeeks===0 && <div style={{fontFamily:'sans-serif',fontSize:10,color:'#B8674E',marginTop:6}}>Zwischen Planstart und Ziel sollte mindestens eine Trainingswoche liegen.</div>}
              </div>
            )}

            <button type="button" disabled={!canStep1} onClick={() => setStep(2)}
              style={{width:'100%',padding:15,borderRadius:17,border:'none',background:canStep1?'linear-gradient(135deg,#FF8C69,#FF6B9D)':'#EEE7E2',color:canStep1?'#fff':'#BCA99D',fontFamily:'sans-serif',fontWeight:900,cursor:canStep1?'pointer':'default'}}>
              Weiter zu deinem Training →
            </button>
          </section>
        )}

        {step===2 && (
          <section style={card}>
            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Wie oft trainierst du aktuell bewusst zu Fuß?</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {[['0','Noch gar nicht'],['1','1× pro Woche'],['2','2× pro Woche'],['3','3× pro Woche'],['4plus','4× oder häufiger']].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setForm(current => ({...current,currentFrequency:id}))}
                    style={{padding:'10px 8px',borderRadius:12,border:`2px solid ${form.currentFrequency===id?'#7EC8A4':'#EEE3DC'}`,background:form.currentFrequency===id?'#F2FAF5':'#fff',color:'#7D6A5F',fontFamily:'sans-serif',fontSize:10.5,fontWeight:850,cursor:'pointer'}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:22}}>
              <div>
                <label style={labelStyle}>Längste Tour zuletzt</label>
                <input style={inputStyle} type="number" min="0" placeholder="z. B. 12 km" value={form.longestRecentKm}
                  onChange={e => setForm(current => ({...current,longestRecentKm:e.target.value}))} />
              </div>
              <div>
                <label style={labelStyle}>Wochenumfang <span style={optional}>optional</span></label>
                <input style={inputStyle} type="number" min="0" placeholder="z. B. 25 km" value={form.currentWeeklyKm}
                  onChange={e => setForm(current => ({...current,currentWeeklyKm:e.target.value}))} />
              </div>
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Welches Gelände steht dir normalerweise zur Verfügung?</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {terrainOptions.map(option => (
                  <button key={option.id} type="button" onClick={() => setForm(current => ({...current,trainingTerrain:option.id}))}
                    style={{padding:'10px 8px',borderRadius:12,border:`2px solid ${form.trainingTerrain===option.id?'#7EC8A4':'#EEE3DC'}`,background:form.trainingTerrain===option.id?'#F2FAF5':'#fff',color:'#7D6A5F',fontFamily:'sans-serif',fontSize:10.2,fontWeight:850,cursor:'pointer'}}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {form.goalType !== 'beginner' && ['hilly','mountainous','mixed'].includes(form.targetTerrain) && ['flat','hilly'].includes(form.trainingTerrain) && (
              <div style={{marginBottom:22,padding:'15px',borderRadius:16,background:'#F7F5FA',border:'1px solid #E8DFEC'}}>
                <div style={{...labelStyle,color:'#80699A'}}>Was kannst du gelegentlich nutzen? <span style={optional}>optional</span></div>
                <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                  {trainingTools.map(tool => {
                    const selected=form.trainingOptions.includes(tool.id)
                    return (
                      <button key={tool.id} type="button" onClick={() => toggleTool(tool.id)}
                        style={{padding:'8px 10px',borderRadius:999,border:`1.5px solid ${selected?'#A98BC1':'#DDD3E3'}`,background:selected?'#F1EAF6':'#fff',color:'#77647F',fontFamily:'sans-serif',fontSize:9.8,fontWeight:800,cursor:'pointer'}}>
                        {selected?'✓ ':''}{tool.label}
                      </button>
                    )
                  })}
                </div>
                <div style={{fontFamily:'sans-serif',fontSize:10,lineHeight:1.45,color:'#96879D',marginTop:9}}>Wenn nichts davon passt, ist das völlig in Ordnung. Der Plan verlangt dann keine künstlichen Höhenmeter.</div>
              </div>
            )}

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Wie möchtest du dein Ziel absolvieren?</div>
              <div style={{display:'grid',gap:7}}>
                {[['walk','Gehen / Wandern'],['brisk','Zügiges Gehen'],['runwalk','Gehen + Laufanteile']].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setForm(current => ({...current,movementStyle:id}))}
                    style={{padding:'11px 12px',borderRadius:12,border:`2px solid ${form.movementStyle===id?'#E6A66A':'#EEE3DC'}`,background:form.movementStyle===id?'#FFF7EF':'#fff',color:'#826E61',fontFamily:'sans-serif',fontSize:11,fontWeight:850,cursor:'pointer'}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Wirst du dein Ziel mit Rucksack absolvieren?</div>
              <div style={{display:'flex',gap:7}}>
                {[['no','Nein'],['yes','Ja']].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setForm(current => ({...current,goalBackpack:id,backpackKg:id==='no'?'':current.backpackKg}))}
                    style={{flex:1,padding:10,borderRadius:12,border:`2px solid ${form.goalBackpack===id?'#E6A66A':'#EEE3DC'}`,background:form.goalBackpack===id?'#FFF7EF':'#fff',color:'#826E61',fontFamily:'sans-serif',fontSize:11,fontWeight:850,cursor:'pointer'}}>
                    {label}
                  </button>
                ))}
              </div>
              {form.goalBackpack==='yes' && <input style={{...inputStyle,marginTop:9}} type="number" min="1" max="30" placeholder="Geplantes Gewicht, z. B. 6 kg" value={form.backpackKg} onChange={e => setForm(current => ({...current,backpackKg:e.target.value}))} />}
            </div>

            <div style={{marginBottom:24}}>
              <div style={labelStyle}>Gibt es etwas, das wir berücksichtigen sollen? <span style={optional}>optional</span></div>
              <div style={{display:'flex',gap:7}}>
                {[['no','Nein'],['yes','Ja']].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setForm(current => ({...current,hasConsiderations:id,considerations:id==='no'?'':current.considerations}))}
                    style={{flex:1,padding:10,borderRadius:12,border:`2px solid ${form.hasConsiderations===id?'#FFB079':'#EEE3DC'}`,background:form.hasConsiderations===id?'#FFF7EF':'#fff',color:'#826E61',fontFamily:'sans-serif',fontSize:11,fontWeight:850,cursor:'pointer'}}>
                    {label}
                  </button>
                ))}
              </div>
              {form.hasConsiderations==='yes' && <textarea style={{...inputStyle,minHeight:82,resize:'vertical',marginTop:9}} placeholder="z. B. wiederkehrende Fuß-, Knie- oder Rückenbeschwerden" value={form.considerations} onChange={e => setForm(current => ({...current,considerations:e.target.value}))} />}
            </div>

            <div style={{display:'flex',gap:8}}>
              <button type="button" onClick={() => setStep(1)} style={{flex:1,padding:14,borderRadius:16,border:'1.5px solid #E8DDD6',background:'#fff',color:'#A18B7E',fontFamily:'sans-serif',fontWeight:850,cursor:'pointer'}}>← Zurück</button>
              <button type="button" disabled={!canStep2} onClick={() => setStep(3)} style={{flex:2,padding:14,borderRadius:16,border:'none',background:canStep2?'linear-gradient(135deg,#FF8C69,#FF6B9D)':'#EEE7E2',color:canStep2?'#fff':'#BCA99D',fontFamily:'sans-serif',fontWeight:900,cursor:canStep2?'pointer':'default'}}>Weiter zu deinem Plan →</button>
            </div>
          </section>
        )}

        {step===3 && (
          <section style={card}>
            <div style={{marginBottom:20,padding:'12px 13px',borderRadius:14,background:'#F2FAF5',fontFamily:'sans-serif',fontSize:10.5,lineHeight:1.5,color:'#698173'}}>
              Dein Plan startet bewusst auf Basis dessen, was du aktuell gut verträgst. Verpasste Wochen werden später nicht durch größere Sprünge „nachgeholt“.
            </div>

            <div style={{marginBottom:20}}>
              <label style={labelStyle}>Startdatum des Plans</label>
              <input type="date" min={todayIso()} style={{...inputStyle,cursor:'pointer'}} value={form.startDate}
                onChange={e => setForm(current => ({...current,startDate:e.target.value}))} />
            </div>

            <div style={{marginBottom:20,padding:'14px 15px',borderRadius:15,background:'#FFF7F0',border:'1px solid #F2DED0',fontFamily:'sans-serif'}}>
              <div style={{fontSize:9.5,fontWeight:900,letterSpacing:.7,color:'#B56E4E'}}>VORBEREITUNGSZEIT</div>
              <div style={{fontSize:21,fontWeight:900,color:'#4B372C',marginTop:4}}>{form.weeksUntilGoal} Wochen</div>
              <div style={{fontSize:10.2,lineHeight:1.45,color:'#9B8376',marginTop:4}}>
                {form.eventDate
                  ? `Ergibt sich aus Planstart und Zieltermin. Empfehlung für dein Profil: etwa ${recommendation} Wochen.`
                  : `Für dein Ziel empfehlen wir aktuell etwa ${recommendation} Wochen.`}
              </div>
              {form.availableWeeks && form.availableWeeks < recommendation && (
                <div style={{marginTop:9,padding:'9px 10px',borderRadius:11,background:'#FFF0E8',color:'#B8674E',fontSize:10,lineHeight:1.45}}>
                  Die verfügbare Zeit ist kürzer als die Empfehlung. Der Plan steigert deshalb nicht künstlich aggressiver.
                </div>
              )}
            </div>

            <div style={{marginBottom:20}}>
              <div style={labelStyle}>Wie oft möchtest du pro Woche trainieren?</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7}}>
                {[2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setForm(current => {
                    const need=n-current.preferredDays.length
                    const add=need>0?dayOptions.filter(day=>!current.preferredDays.includes(day)).slice(0,need):[]
                    return {...current,unitsPerWeek:n,preferredDays:[...current.preferredDays,...add]}
                  })}
                    style={{padding:'11px 4px',borderRadius:12,border:`2px solid ${form.unitsPerWeek===n?'#7EC8A4':'#EEE3DC'}`,background:form.unitsPerWeek===n?'#F2FAF5':'#fff',color:'#75665D',fontFamily:'sans-serif',fontWeight:900,cursor:'pointer'}}>
                    {n}×
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Welche Tage passen dir?</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:5}}>
                {dayOptions.map(day => {
                  const selected=form.preferredDays.includes(day)
                  return (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      style={{padding:'10px 2px',borderRadius:10,border:`1.5px solid ${selected?'#E6A66A':'#EEE3DC'}`,background:selected?'#FFF7EF':'#fff',color:'#7D6D64',fontFamily:'sans-serif',fontSize:9.5,fontWeight:850,cursor:'pointer'}}>
                      {day}
                    </button>
                  )
                })}
              </div>
              <div style={{fontFamily:'sans-serif',fontSize:9.8,lineHeight:1.4,color:'#AE9A8E',marginTop:6}}>Bitte mindestens so viele Tage auswählen, wie du Einheiten pro Woche planst.</div>
            </div>

            <div style={{marginBottom:22,padding:'14px 15px',borderRadius:15,background:'#F8F5FA',border:'1px solid #E8DFEC',fontFamily:'sans-serif'}}>
              <div style={{fontSize:9.5,fontWeight:900,letterSpacing:.7,color:'#80699A'}}>DEIN PLAN</div>
              <div style={{display:'grid',gap:5,marginTop:7,fontSize:10.5,color:'#756574'}}>
                <div>{goalOptions.find(x=>x.id===form.goalType)?.icon} {goalOptions.find(x=>x.id===form.goalType)?.label}</div>
                {form.targetDistanceKm && <div>🎯 Ziel: {form.targetDistanceKm} km</div>}
                {form.routeName && <div>🗺️ {form.routeName}</div>}
                <div>📅 {form.weeksUntilGoal} Wochen · {form.unitsPerWeek} Einheiten pro Woche</div>
                <div>🥾 Startpunkt: längste zuletzt gut bewältigte Tour {form.longestRecentKm || 0} km</div>
              </div>
            </div>

            {error && <div style={{marginBottom:14,padding:'11px 13px',borderRadius:12,background:'#FDECEA',border:'1px solid #F5C4CC',fontFamily:'sans-serif',fontSize:11,color:'#B85464'}}>{error}</div>}

            <div style={{display:'flex',gap:8}}>
              <button type="button" disabled={loading} onClick={() => setStep(2)} style={{flex:1,padding:14,borderRadius:16,border:'1.5px solid #E8DDD6',background:'#fff',color:'#A18B7E',fontFamily:'sans-serif',fontWeight:850,cursor:'pointer'}}>← Zurück</button>
              <button type="button" disabled={loading||!canGenerate} onClick={handleGenerate}
                style={{flex:2,padding:14,borderRadius:16,border:'none',background:loading||!canGenerate?'#EEE7E2':'linear-gradient(135deg,#FF8C69,#FF6B9D)',color:loading||!canGenerate?'#BCA99D':'#fff',fontFamily:'sans-serif',fontWeight:900,cursor:loading||!canGenerate?'default':'pointer'}}>
                {loading?'Plan wird erstellt…':'Trainingsplan erstellen →'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
