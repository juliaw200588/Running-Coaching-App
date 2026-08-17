import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import {
  buildCyclingPlanGuardrails,
  getRecommendedCyclingWeeks,
} from '../lib/cyclingPlanGenerator.js'

const DRAFT_KEY = 'cycling-onboarding-draft-v1'
const DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So']

const DEFAULT_DAYS = {
  2: ['Mi','So'],
  3: ['Di','Do','So'],
  4: ['Di','Do','Sa','So'],
  5: ['Di','Mi','Do','Sa','So'],
}

const todayIso = () => new Date().toISOString().split('T')[0]

const weeksBetween = (startValue, endValue) => {
  if (!startValue || !endValue) return null
  const start = new Date(`${startValue}T12:00:00`)
  const end = new Date(`${endValue}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const days = Math.floor((end - start) / 86400000)
  if (days < 7) return 0
  return Math.floor(days / 7)
}

const loadDraft = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const panel = {
  background:'#fff',
  border:'1px solid #EEE1D8',
  borderRadius:24,
  padding:22,
  boxShadow:'0 6px 30px rgba(87,61,46,.08)',
}

const labelStyle = {
  display:'block',
  fontFamily:'sans-serif',
  fontSize:10,
  fontWeight:900,
  textTransform:'uppercase',
  letterSpacing:1,
  color:'#A88F80',
  marginBottom:8,
}

const inputStyle = {
  width:'100%',
  padding:'12px 14px',
  borderRadius:13,
  border:'1.5px solid #E9DED7',
  background:'#FFFDFC',
  color:'#4A372C',
  boxSizing:'border-box',
  outline:'none',
  fontFamily:'sans-serif',
  fontSize:14,
}

const small = {
  fontFamily:'sans-serif',
  fontSize:10.3,
  lineHeight:1.45,
  color:'#A48C7E',
}

const choiceStyle = selected => ({
  width:'100%',
  padding:'12px 13px',
  borderRadius:14,
  border:`2px solid ${selected ? '#77A99B' : '#EEE3DC'}`,
  background:selected ? '#F1F8F5' : '#fff',
  color:selected ? '#477C6D' : '#806E63',
  fontFamily:'sans-serif',
  fontSize:11.5,
  fontWeight:850,
  cursor:'pointer',
  textAlign:'left',
})

export default function CyclingOnboarding({ onPlanGenerated }) {
  const savedDraft = loadDraft()
  const [step, setStep] = useState(savedDraft?.step || 1)
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState(null)
  const [weeksManuallySelected, setWeeksManuallySelected] = useState(
    Boolean(savedDraft?.weeksManuallySelected)
  )

  const [form, setForm] = useState(() => ({
    name:'',
    goalType:'',
    bikeType:'road',
    level:'',
    targetDistanceKm:'',
    customDistance:false,
    eventDate:'',
    tourName:'',
    tourTotalKm:'',
    tourDays:'',
    longestStageKm:'',
    targetTerrain:'mixed',

    currentFrequency:'',
    currentWeeklyHours:'',
    currentWeeklyKm:'',
    longestRecentHours:'',
    longestRecentKm:'',
    trainingTerrain:'flat',
    indoorTrainer:'no',
    strengthTraining:'no',

    alter:'',
    maxHF:'',
    ruheHF:'',
    ftp:'',
    considerations:'',
    hasConsiderations:'no',

    startDate:todayIso(),
    weeksUntilGoal:12,
    availableWeeks:null,
    unitsPerWeek:3,
    preferredDays:DEFAULT_DAYS[3],
    allowAdjacentDays:'no',
    ...(savedDraft?.form || {}),
  }))

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user?.id) return

        const { data } = await supabase
          .from('profiles')
          .select('name,geburtsdatum,max_hf,ruhe_hf')
          .eq('id', user.id)
          .maybeSingle()

        if (!active) return

        let age = ''
        if (data?.geburtsdatum) {
          const birth = new Date(`${data.geburtsdatum}T12:00:00`)
          const now = new Date()
          age =
            now.getFullYear() -
            birth.getFullYear() -
            (new Date(now.getFullYear(), now.getMonth(), now.getDate()) <
            new Date(now.getFullYear(), birth.getMonth(), birth.getDate())
              ? 1
              : 0)
        }

        setForm(current => ({
          ...current,
          name:data?.name || user.user_metadata?.name || current.name,
          alter:age || current.alter,
          maxHF:data?.max_hf ? String(data.max_hf) : current.maxHF,
          ruheHF:data?.ruhe_hf ? String(data.ruhe_hf) : current.ruheHF,
        }))
      } catch (e) {
        console.warn('[CyclingOnboarding] Profil konnte nicht vorgeladen werden:', e)
      } finally {
        if (active) setProfileLoading(false)
      }
    }

    loadProfile()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ step, form, weeksManuallySelected })
      )
    } catch (e) {
      console.warn('[CyclingOnboarding] Entwurf konnte nicht gespeichert werden:', e)
    }
  }, [step, form, weeksManuallySelected])

  const eventWeeks = useMemo(
    () => weeksBetween(form.startDate, form.eventDate),
    [form.startDate, form.eventDate]
  )

  const recommendation = useMemo(
    () => getRecommendedCyclingWeeks(form),
    [
      form.goalType,
      form.targetDistanceKm,
      form.tourDays,
      form.longestStageKm,
      form.longestRecentKm,
      form.longestRecentHours,
    ]
  )

  const weekChoices = useMemo(() => {
    if (form.eventDate && eventWeeks > 0) return [eventWeeks]
    return [...new Set(
      [recommendation - 4, recommendation - 2, recommendation, recommendation + 2]
        .filter(value => value >= 6 && value <= 24)
    )].sort((a,b) => a-b)
  }, [form.eventDate, eventWeeks, recommendation])

  useEffect(() => {
    if (form.eventDate && eventWeeks != null && eventWeeks > 0) {
      setWeeksManuallySelected(false)
      setForm(current => ({
        ...current,
        weeksUntilGoal:eventWeeks,
        availableWeeks:eventWeeks,
      }))
      return
    }

    if (!weeksManuallySelected) {
      setForm(current => ({
        ...current,
        weeksUntilGoal:recommendation,
        availableWeeks:null,
      }))
    }
  }, [form.eventDate, eventWeeks, recommendation, weeksManuallySelected])

  const toggleDay = day => {
    setForm(current => {
      const selected = current.preferredDays.includes(day)

      if (selected) {
        return {
          ...current,
          preferredDays:current.preferredDays.filter(item => item !== day),
        }
      }

      if (current.preferredDays.length >= Number(current.unitsPerWeek)) {
        return current
      }

      return {
        ...current,
        preferredDays:[...current.preferredDays, day]
          .sort((a,b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
      }
    })
  }

  const selectUnits = units => {
    setForm(current => ({
      ...current,
      unitsPerWeek:units,
      preferredDays:DEFAULT_DAYS[units],
    }))
  }

  const canStep1 =
    Boolean(form.goalType) &&
    Boolean(form.bikeType) &&
    Boolean(form.level) &&
    (
      form.goalType === 'beginner' ||
      (form.goalType === 'tour'
        ? Boolean(Number(form.tourTotalKm) > 0) &&
          Boolean(Number(form.tourDays) > 0) &&
          Boolean(Number(form.longestStageKm) > 0)
        : Boolean(Number(form.targetDistanceKm) > 0))
    ) &&
    (
      form.goalType !== 'event' ||
      (Boolean(form.eventDate) && eventWeeks != null && eventWeeks > 0)
    )

  const canStep2 =
    Boolean(form.currentFrequency) &&
    Boolean(form.trainingTerrain) &&
    Boolean(form.indoorTrainer)

  const canGenerate =
    Boolean(form.startDate) &&
    form.unitsPerWeek >= 2 &&
    form.preferredDays.length === Number(form.unitsPerWeek)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const normalizedForm = {
        ...form,
        preferredDays:[...(form.preferredDays || [])]
          .sort((a,b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
      }
      const guardrails = buildCyclingPlanGuardrails(normalizedForm)

      const response = await fetch('/api/generate-plan', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({
          ...normalizedForm,
          sport_type:'cycling',
          plan_type:'cycling_endurance',
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

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(DRAFT_KEY)
      }

      onPlanGenerated(data.plan)
    } catch (e) {
      console.error('[CyclingOnboarding] Plan konnte nicht erstellt werden:', e)
      setError(
        e?.message
          ? `Dein Plan konnte gerade nicht erstellt werden: ${e.message}`
          : 'Dein Plan konnte gerade nicht erstellt werden.'
      )
    } finally {
      setLoading(false)
    }
  }

  const progress = [
    {n:1,label:'Ziel'},
    {n:2,label:'Training'},
    {n:3,label:'Plan'},
  ]

  const targetNeedsAdjacent =
    form.goalType === 'tour' ||
    Number(form.targetDistanceKm || 0) >= 150

  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(160deg,#F8FAF8 0%,#FFF8F0 52%,#F5F0FA 100%)',
      color:'#44342B',
      fontFamily:"'Georgia','Times New Roman',serif",
    }}>
      <header style={{minHeight:245,position:'relative',overflow:'hidden',display:'flex',alignItems:'flex-end',background:'#536B63'}}>
        <div aria-hidden="true" style={{
          position:'absolute',inset:0,
          backgroundImage:'url("/hero/cycling/03.webp")',
          backgroundSize:'cover',backgroundPosition:'center 55%',
        }}/>
        <div aria-hidden="true" style={{
          position:'absolute',inset:0,
          background:'linear-gradient(90deg,rgba(20,27,24,.76),rgba(20,27,24,.42) 58%,rgba(20,27,24,.14)),linear-gradient(180deg,rgba(0,0,0,.05),rgba(15,20,17,.58))',
        }}/>
        <div style={{position:'relative',zIndex:2,width:'100%',maxWidth:720,margin:'0 auto',padding:'34px 20px 24px',boxSizing:'border-box',color:'#fff'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(255,248,240,.94)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px rgba(0,0,0,.16)'}}>
              <img src="/route-icon.png" alt="" style={{width:32,height:32,borderRadius:'50%'}}/>
            </div>
            <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,letterSpacing:1.4}}>DEIN TRAININGSPLAN</div>
          </div>
          <h1 style={{fontSize:31,margin:'8px 0 4px',lineHeight:1.05}}>Radfahren</h1>
          <p style={{margin:0,fontFamily:'sans-serif',fontSize:12,lineHeight:1.5,opacity:.9}}>
            Zeit und Belastung geben die Richtung vor – nicht Wind oder Durchschnittsgeschwindigkeit.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:18,maxWidth:390}}>
            {progress.map(item => (
              <div key={item.n}>
                <div style={{height:4,borderRadius:99,background:step >= item.n ? '#fff' : 'rgba(255,255,255,.28)'}}/>
                <div style={{marginTop:6,fontFamily:'sans-serif',fontSize:9.5,fontWeight:step===item.n?900:700,opacity:step>=item.n?1:.7}}>
                  {item.n} · {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main style={{maxWidth:520,margin:'0 auto',padding:'24px 18px 42px'}}>
        {profileLoading && <div style={{...small,marginBottom:12}}>Profil wird übernommen…</div>}

        {step === 1 && (
          <section style={panel}>
            <div style={{marginBottom:24}}>
              <div style={labelStyle}>Wofür möchtest du trainieren?</div>
              <div style={{display:'grid',gap:9}}>
                {[
                  ['event','🏁','Ich trainiere für ein Rad-Event','Gezielt auf eine Veranstaltung vorbereiten'],
                  ['distance','🎯','Ich möchte eine Distanz schaffen','Eine persönliche Zieldistanz sicher bewältigen'],
                  ['tour','🗺️','Ich trainiere für eine Tour oder Radreise','Für Tages- oder Mehrtagestouren vorbereiten'],
                  ['beginner','🌱','Ich möchte mit Radtraining anfangen','Schritt für Schritt Ausdauer aufbauen'],
                ].map(([id,icon,title,sub]) => {
                  const selected = form.goalType === id
                  return (
                    <button key={id} type="button" onClick={() => setForm(current => ({...current,goalType:id}))} style={choiceStyle(selected)}>
                      <span style={{fontSize:20,marginRight:9}}>{icon}</span>
                      <span>{title}</span>
                      <span style={{display:'block',marginLeft:31,marginTop:3,fontSize:10,color:'#A38D80',fontWeight:600}}>{sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{marginBottom:24}}>
              <div style={labelStyle}>Welche Art von Rad fährst du überwiegend?</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>
                {[
                  ['road','Rennrad'],
                  ['gravel','Gravel'],
                  ['trekking','Trekking / Tour'],
                ].map(([id,label]) => {
                  const selected = form.bikeType === id
                  return (
                    <button key={id} type="button" onClick={() => setForm(current => ({...current,bikeType:id}))}
                      style={{...choiceStyle(selected),textAlign:'center',padding:'11px 6px'}}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{marginBottom:24}}>
              <div style={labelStyle}>Wo stehst du gerade?</div>
              <div style={{display:'grid',gap:8}}>
                {[
                  ['beginner','🌱','Ich starte gerade','Ich fahre selten oder noch nicht regelmäßig'],
                  ['regular','🚴','Ich fahre regelmäßig','Radfahren gehört bereits zu meiner Woche'],
                  ['ambitious','⚡','Ich trainiere ambitioniert','Längere Touren oder strukturiertes Training sind mir vertraut'],
                ].map(([id,icon,title,sub]) => {
                  const selected = form.level === id
                  return (
                    <button key={id} type="button" onClick={() => setForm(current => ({...current,level:id}))} style={choiceStyle(selected)}>
                      {icon} {title}
                      <span style={{display:'block',marginTop:3,fontSize:10,color:'#A38D80',fontWeight:600}}>{sub}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {['event','distance'].includes(form.goalType) && (
              <div style={{marginBottom:22}}>
                <div style={labelStyle}>Zieldistanz</div>
                <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                  {[50,100,150,200].map(km => (
                    <button key={km} type="button" onClick={() => setForm(current => ({...current,targetDistanceKm:String(km),customDistance:false}))}
                      style={{padding:'9px 12px',borderRadius:11,border:`2px solid ${Number(form.targetDistanceKm)===km && !form.customDistance?'#E6A66A':'#EADFD7'}`,background:Number(form.targetDistanceKm)===km&&!form.customDistance?'#FFF4EA':'#fff',color:'#8A6D5B',fontFamily:'sans-serif',fontSize:11,fontWeight:850,cursor:'pointer'}}>
                      {km} km
                    </button>
                  ))}
                  <button type="button" onClick={() => setForm(current => ({...current,customDistance:true,targetDistanceKm:current.customDistance?current.targetDistanceKm:''}))}
                    style={{padding:'9px 12px',borderRadius:11,border:`2px solid ${form.customDistance?'#E6A66A':'#EADFD7'}`,background:form.customDistance?'#FFF4EA':'#fff',color:'#8A6D5B',fontFamily:'sans-serif',fontSize:11,fontWeight:850,cursor:'pointer'}}>
                    Eigene
                  </button>
                </div>
                {form.customDistance && (
                  <input style={{...inputStyle,marginTop:9}} type="number" min="10" placeholder="z. B. 120" value={form.targetDistanceKm}
                    onChange={e => setForm(current => ({...current,targetDistanceKm:e.target.value}))}/>
                )}
              </div>
            )}

            {form.goalType === 'event' && (
              <div style={{marginBottom:22}}>
                <label style={labelStyle}>Wann ist dein Event?</label>
                <input style={inputStyle} type="date" min={form.startDate || todayIso()} value={form.eventDate}
                  onChange={e => setForm(current => ({...current,eventDate:e.target.value}))}/>
              </div>
            )}

            {form.goalType === 'tour' && (
              <div style={{marginBottom:22}}>
                <label style={labelStyle}>Name der Tour <span style={{textTransform:'none',fontWeight:600}}>optional</span></label>
                <input style={inputStyle} placeholder="z. B. Bodensee-Runde" value={form.tourName}
                  onChange={e => setForm(current => ({...current,tourName:e.target.value}))}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:9}}>
                  <div>
                    <label style={labelStyle}>Gesamt-km</label>
                    <input style={inputStyle} type="number" min="10" value={form.tourTotalKm}
                      onChange={e => setForm(current => ({...current,tourTotalKm:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={labelStyle}>Tage</label>
                    <input style={inputStyle} type="number" min="1" value={form.tourDays}
                      onChange={e => setForm(current => ({...current,tourDays:e.target.value}))}/>
                  </div>
                </div>
                <div style={{marginTop:9}}>
                  <label style={labelStyle}>Längste geplante Tagesetappe</label>
                  <input style={inputStyle} type="number" min="10" placeholder="km" value={form.longestStageKm}
                    onChange={e => setForm(current => ({...current,longestStageKm:e.target.value}))}/>
                </div>
                <div style={{marginTop:9}}>
                  <label style={labelStyle}>Zieltermin <span style={{textTransform:'none',fontWeight:600}}>optional</span></label>
                  <input style={inputStyle} type="date" min={form.startDate || todayIso()} value={form.eventDate}
                    onChange={e => setForm(current => ({...current,eventDate:e.target.value}))}/>
                </div>
              </div>
            )}

            {form.goalType !== 'beginner' && (
              <div style={{marginBottom:22}}>
                <div style={labelStyle}>Wie ist dein Zielprofil?</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                  {[
                    ['flat','Flach'],
                    ['hilly','Hügelig'],
                    ['mountainous','Bergig'],
                    ['mixed','Gemischt / unsicher'],
                  ].map(([id,label]) => (
                    <button key={id} type="button" onClick={() => setForm(current => ({...current,targetTerrain:id}))}
                      style={{...choiceStyle(form.targetTerrain===id),textAlign:'center'}}>{label}</button>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={() => setStep(2)} disabled={!canStep1}
              style={{width:'100%',padding:15,borderRadius:16,border:'none',background:canStep1?'linear-gradient(135deg,#6F9F90,#8EB8A9)':'#EEE8E4',color:canStep1?'#fff':'#B8A79D',fontFamily:'sans-serif',fontSize:14,fontWeight:900,cursor:canStep1?'pointer':'default'}}>
              Weiter zu deinem Training →
            </button>
          </section>
        )}

        {step === 2 && (
          <section style={panel}>
            <div style={{marginBottom:22,padding:'11px 13px',borderRadius:13,background:'#F0F7F4',...small,color:'#657D73'}}>
              Dein Plan richtet sich primär nach <strong>Zeit und Belastung</strong>. Kilometer helfen bei langen spezifischen Ausfahrten nur als Orientierung.
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Wie oft fährst du aktuell?</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {[
                  ['0','Noch gar nicht'],
                  ['1','1× pro Woche'],
                  ['2','2× pro Woche'],
                  ['3','3× pro Woche'],
                  ['4plus','4× oder häufiger'],
                ].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setForm(current => ({...current,currentFrequency:id}))}
                    style={choiceStyle(form.currentFrequency===id)}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:22}}>
              <div>
                <label style={labelStyle}>Aktuell Stunden/Woche <span style={{textTransform:'none',fontWeight:600}}>optional</span></label>
                <input style={inputStyle} type="number" step=".5" min="0" placeholder="z. B. 4" value={form.currentWeeklyHours}
                  onChange={e => setForm(current => ({...current,currentWeeklyHours:e.target.value}))}/>
              </div>
              <div>
                <label style={labelStyle}>Aktuell km/Woche <span style={{textTransform:'none',fontWeight:600}}>optional</span></label>
                <input style={inputStyle} type="number" min="0" placeholder="z. B. 90" value={form.currentWeeklyKm}
                  onChange={e => setForm(current => ({...current,currentWeeklyKm:e.target.value}))}/>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:22}}>
              <div>
                <label style={labelStyle}>Längste Fahrt zuletzt · Stunden <span style={{textTransform:'none',fontWeight:600}}>optional</span></label>
                <input style={inputStyle} type="number" step=".25" min="0" placeholder="z. B. 2.5" value={form.longestRecentHours}
                  onChange={e => setForm(current => ({...current,longestRecentHours:e.target.value}))}/>
              </div>
              <div>
                <label style={labelStyle}>Längste Fahrt zuletzt · km <span style={{textTransform:'none',fontWeight:600}}>optional</span></label>
                <input style={inputStyle} type="number" min="0" placeholder="z. B. 55" value={form.longestRecentKm}
                  onChange={e => setForm(current => ({...current,longestRecentKm:e.target.value}))}/>
              </div>
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Wo kannst du normalerweise fahren?</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {[
                  ['flat','Überwiegend flach'],
                  ['hilly','Leicht hügelig'],
                  ['climbs','Viele Anstiege'],
                  ['mixed','Gemischt'],
                ].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setForm(current => ({...current,trainingTerrain:id}))}
                    style={{...choiceStyle(form.trainingTerrain===id),textAlign:'center'}}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Kannst du Indoor-Radtraining nutzen?</div>
              <div style={{...small,margin:'-2px 0 8px'}}>Zum Beispiel Rollentrainer, Smart-Trainer oder Indoorbike.</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>
                {[
                  ['no','Nein'],
                  ['sometimes','Gelegentlich'],
                  ['regular','Regelmäßig'],
                ].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setForm(current => ({...current,indoorTrainer:id}))}
                    style={{...choiceStyle(form.indoorTrainer===id),textAlign:'center',padding:'11px 5px'}}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Kannst du ergänzend Krafttraining machen? <span style={{textTransform:'none',fontWeight:600}}>optional</span></div>
              <div style={{display:'flex',gap:7}}>
                {[
                  ['no','Nein'],
                  ['yes','Ja'],
                ].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setForm(current => ({...current,strengthTraining:id}))}
                    style={{...choiceStyle(form.strengthTraining===id),textAlign:'center'}}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{margin:'0 -4px 22px',padding:'16px',borderRadius:18,background:'#F7FAF8',border:'1px solid #DFEAE4'}}>
              <div style={{...labelStyle,color:'#5E8877'}}>Trainingsintensität <span style={{textTransform:'none',fontWeight:600}}>optional</span></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
                <div>
                  <label style={labelStyle}>Max. HF</label>
                  <input style={inputStyle} type="number" min="80" max="240" value={form.maxHF}
                    onChange={e => setForm(current => ({...current,maxHF:e.target.value}))}/>
                </div>
                <div>
                  <label style={labelStyle}>Ruhe-HF</label>
                  <input style={inputStyle} type="number" min="30" max="130" value={form.ruheHF}
                    onChange={e => setForm(current => ({...current,ruheHF:e.target.value}))}/>
                </div>
              </div>
              <div style={{marginTop:9}}>
                <label style={labelStyle}>FTP in Watt <span style={{textTransform:'none',fontWeight:600}}>falls bekannt</span></label>
                <input style={inputStyle} type="number" min="50" max="600" placeholder="z. B. 210" value={form.ftp}
                  onChange={e => setForm(current => ({...current,ftp:e.target.value}))}/>
              </div>
              <div style={{...small,marginTop:9}}>
                Sind HF oder FTP bekannt, kann der Plan zusätzlich konkrete Belastungsbereiche nennen. Geschwindigkeit in km/h wird bewusst nicht als Trainingsziel verwendet.
              </div>
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Gibt es etwas, das wir berücksichtigen sollen? <span style={{textTransform:'none',fontWeight:600}}>optional</span></div>
              <div style={{display:'flex',gap:7}}>
                {[
                  ['no','Nein'],
                  ['yes','Ja'],
                ].map(([id,label]) => (
                  <button key={id} type="button" onClick={() => setForm(current => ({...current,hasConsiderations:id,considerations:id==='no'?'':current.considerations}))}
                    style={{...choiceStyle(form.hasConsiderations===id),textAlign:'center'}}>{label}</button>
                ))}
              </div>
              {form.hasConsiderations === 'yes' && (
                <textarea style={{...inputStyle,minHeight:80,resize:'vertical',marginTop:9}} value={form.considerations}
                  placeholder="z. B. Kniebeschwerden, wenig Zeit unter der Woche …"
                  onChange={e => setForm(current => ({...current,considerations:e.target.value}))}/>
              )}
            </div>

            <div style={{display:'flex',gap:8}}>
              <button type="button" onClick={() => setStep(1)} style={{flex:1,padding:13,borderRadius:15,border:'1px solid #E8DDD6',background:'#fff',color:'#8B7467',fontWeight:850,cursor:'pointer'}}>← Zurück</button>
              <button type="button" onClick={() => setStep(3)} disabled={!canStep2} style={{flex:2,padding:13,borderRadius:15,border:'none',background:canStep2?'linear-gradient(135deg,#6F9F90,#8EB8A9)':'#EEE8E4',color:canStep2?'#fff':'#B8A79D',fontWeight:900,cursor:canStep2?'pointer':'default'}}>Weiter zum Plan →</button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section style={panel}>
            <div style={{marginBottom:22}}>
              <label style={labelStyle}>Startdatum</label>
              <input style={inputStyle} type="date" min={todayIso()} value={form.startDate}
                onChange={e => setForm(current => ({...current,startDate:e.target.value}))}/>
            </div>

            <div style={{marginBottom:22,padding:'14px 15px',borderRadius:15,background:'#FFF7F0',border:'1px solid #F2DED0',fontFamily:'sans-serif'}}>
              <div style={{fontSize:9.5,fontWeight:900,letterSpacing:.7,color:'#B56E4E'}}>VORBEREITUNGSZEIT</div>
              {form.eventDate && eventWeeks > 0 ? (
                <>
                  <div style={{fontSize:21,fontWeight:900,color:'#4B372C',marginTop:4}}>{eventWeeks} Wochen</div>
                  <div style={{...small,marginTop:4}}>Ergibt sich aus Planstart und Zieltermin. Empfehlung für dein Profil: etwa {recommendation} Wochen.</div>
                </>
              ) : (
                <>
                  <div style={{display:'flex',alignItems:'baseline',gap:7,marginTop:4}}>
                    <div style={{fontSize:21,fontWeight:900,color:'#4B372C'}}>{recommendation} Wochen</div>
                    <div style={{fontSize:9.2,fontWeight:900,color:'#E27B5F',textTransform:'uppercase'}}>empfohlen</div>
                  </div>
                  <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:10}}>
                    {weekChoices.map(weeks => (
                      <button key={weeks} type="button" onClick={() => {
                        setWeeksManuallySelected(true)
                        setForm(current => ({...current,weeksUntilGoal:weeks,availableWeeks:weeks}))
                      }}
                        style={{padding:'9px 11px',borderRadius:11,border:`2px solid ${Number(form.weeksUntilGoal)===weeks?'#E6A66A':'#EADFD7'}`,background:Number(form.weeksUntilGoal)===weeks?'#FFF0E4':'#fff',color:'#846F62',fontSize:10.5,fontWeight:850,cursor:'pointer'}}>
                        {weeks} Wo.
                      </button>
                    ))}
                  </div>
                  {Number(form.weeksUntilGoal) < recommendation && (
                    <div style={{marginTop:9,padding:'9px 10px',borderRadius:11,background:'#FFF0E8',color:'#B8674E',fontSize:10,lineHeight:1.45}}>
                      <strong>Ambitionierter Zeitrahmen:</strong> Der Aufbau wird kompakter, ohne Belastungssprünge künstlich zu erzwingen.
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Wie oft möchtest du pro Woche trainieren?</div>
              <div style={{display:'flex',gap:7}}>
                {[2,3,4,5].map(units => (
                  <button key={units} type="button" onClick={() => selectUnits(units)}
                    style={{flex:1,padding:'11px 0',borderRadius:11,border:`2px solid ${form.unitsPerWeek===units?'#77A99B':'#EADFD7'}`,background:form.unitsPerWeek===units?'#F1F8F5':'#fff',color:'#806E63',fontWeight:900,cursor:'pointer'}}>
                    {units}×
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:22}}>
              <div style={labelStyle}>Welche Tage passen dir?</div>
              <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
                {DAYS.map(day => {
                  const selected = form.preferredDays.includes(day)
                  const limitReached = !selected && form.preferredDays.length >= Number(form.unitsPerWeek)
                  return (
                    <button key={day} type="button" disabled={limitReached} onClick={() => toggleDay(day)}
                      style={{width:52,padding:'10px 0',borderRadius:11,border:`2px solid ${selected?'#77A99B':'#EADFD7'}`,background:selected?'#F1F8F5':'#fff',color:selected?'#477C6D':'#8F796C',opacity:limitReached?.45:1,fontWeight:900,cursor:limitReached?'default':'pointer'}}>
                      {day}
                    </button>
                  )
                })}
              </div>
              <div style={{...small,marginTop:7}}>Wähle genau {form.unitsPerWeek} Tage. Lange und intensive Einheiten werden so sinnvoll wie möglich verteilt.</div>
            </div>

            {targetNeedsAdjacent && (
              <div style={{marginBottom:22,padding:'14px',borderRadius:15,background:'#F7F3FA',border:'1px solid #E6DBEC'}}>
                <div style={{...labelStyle,color:'#80699A'}}>Dürfen einzelne lange Wochen zwei aufeinanderfolgende Tage enthalten?</div>
                <div style={{display:'flex',gap:7}}>
                  {[
                    ['no','Nein'],
                    ['yes','Ja'],
                  ].map(([id,label]) => (
                    <button key={id} type="button" onClick={() => setForm(current => ({...current,allowAdjacentDays:id}))}
                      style={{...choiceStyle(form.allowAdjacentDays===id),textAlign:'center'}}>{label}</button>
                  ))}
                </div>
                <div style={{...small,marginTop:8}}>Nur bei „Ja“ darf für einzelne Back-to-back-Wochen ausnahmsweise ein benachbarter Tag außerhalb deiner normalen Auswahl genutzt werden.</div>
              </div>
            )}

            <div style={{marginBottom:22,padding:'14px 15px',borderRadius:15,background:'#F4F8F6',border:'1px solid #DCE9E3',fontFamily:'sans-serif'}}>
              <div style={{fontSize:9.5,fontWeight:900,color:'#5C8775',letterSpacing:.7}}>DEIN PLAN</div>
              <div style={{display:'grid',gap:5,marginTop:7,fontSize:10.5,color:'#677A70'}}>
                <div>🚴 {form.bikeType === 'road' ? 'Rennrad' : form.bikeType === 'gravel' ? 'Gravel' : 'Trekking / Tour'}</div>
                <div>📅 {form.weeksUntilGoal} Wochen · {form.unitsPerWeek} Einheiten pro Woche</div>
                <div>🗓️ {form.preferredDays.join(' · ')}</div>
                <div>⏱️ Zeit & Belastung haben Vorrang vor Kilometern</div>
              </div>
            </div>

            {error && <div style={{marginBottom:14,padding:'11px 13px',borderRadius:12,background:'#FDECEA',border:'1px solid #F5C4CC',color:'#B85464',fontFamily:'sans-serif',fontSize:11,lineHeight:1.5}}>{error}</div>}

            <div style={{display:'flex',gap:8}}>
              <button type="button" onClick={() => setStep(2)} disabled={loading} style={{flex:1,padding:14,borderRadius:15,border:'1px solid #E8DDD6',background:'#fff',color:'#8B7467',fontWeight:850,cursor:'pointer'}}>← Zurück</button>
              <button type="button" onClick={handleGenerate} disabled={!canGenerate || loading}
                style={{flex:2,padding:14,borderRadius:15,border:'none',background:canGenerate&&!loading?'linear-gradient(135deg,#6F9F90,#8EB8A9)':'#EEE8E4',color:canGenerate&&!loading?'#fff':'#B8A79D',fontWeight:900,cursor:canGenerate&&!loading?'pointer':'default'}}>
                {loading ? 'Plan wird erstellt…' : 'Trainingsplan erstellen →'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
