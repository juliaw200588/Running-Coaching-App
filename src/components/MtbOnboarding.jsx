import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import {
  buildMtbPlanGuardrails,
  getRecommendedMtbWeeks,
} from '../lib/mtbPlanGenerator.js'

const DRAFT_KEY = 'mtb-onboarding-draft-v1'
const DAYS = ['Mo','Di','Mi','Do','Fr','Sa','So']
const DEFAULT_DAYS = {
  2:['Mi','So'],
  3:['Di','Do','So'],
  4:['Di','Do','Sa','So'],
  5:['Di','Mi','Do','Sa','So'],
}
const todayIso = () => new Date().toISOString().split('T')[0]

const weeksBetween = (startValue,endValue) => {
  if (!startValue || !endValue) return null
  const start = new Date(`${startValue}T12:00:00`)
  const end = new Date(`${endValue}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const days = Math.floor((end-start)/86400000)
  return days < 7 ? 0 : Math.floor(days/7)
}

const loadDraft = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

const panel={background:'#fff',border:'1px solid #E4E7DF',borderRadius:24,padding:22,boxShadow:'0 6px 30px rgba(57,72,55,.08)'}
const labelStyle={display:'block',fontFamily:'sans-serif',fontSize:10,fontWeight:900,textTransform:'uppercase',letterSpacing:1,color:'#89917F',marginBottom:8}
const inputStyle={width:'100%',padding:'12px 14px',borderRadius:13,border:'1.5px solid #E0E4DC',background:'#FEFFFC',color:'#3E4539',boxSizing:'border-box',outline:'none',fontFamily:'sans-serif',fontSize:14}
const small={fontFamily:'sans-serif',fontSize:10.3,lineHeight:1.48,color:'#8D9585'}
const choiceStyle=selected=>({width:'100%',padding:'12px 13px',borderRadius:14,border:`2px solid ${selected?'#6D9A79':'#E5E8E1'}`,background:selected?'#F0F7F1':'#fff',color:selected?'#497255':'#737B6D',fontFamily:'sans-serif',fontSize:11.5,fontWeight:850,cursor:'pointer',textAlign:'left'})

export default function MtbOnboarding({ onPlanGenerated }) {
  const savedDraft=loadDraft()
  const [step,setStep]=useState(savedDraft?.step||1)
  const [loading,setLoading]=useState(false)
  const [profileLoading,setProfileLoading]=useState(true)
  const [error,setError]=useState(null)
  const [weeksManuallySelected,setWeeksManuallySelected]=useState(Boolean(savedDraft?.weeksManuallySelected))

  const [form,setForm]=useState(()=>({
    name:'',
    goalType:'',
    mtbStyle:'xc',
    level:'',
    targetDistanceKm:'',
    customDistance:false,
    targetElevationM:'',
    eventDate:'',
    tourName:'',
    tourTotalKm:'',
    tourDays:'',
    longestStageKm:'',
    targetTerrain:'mixed',

    currentFrequency:'',
    currentWeeklyHours:'',
    longestRecentHours:'',
    longestRecentKm:'',
    typicalElevationM:'',
    trainingTerrain:'flat',
    trailAccess:'easy',
    technicalLevel:'beginner',
    techniquePreference:'sometimes',
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
    ...(savedDraft?.form||{}),
  }))

  useEffect(()=>{
    let active=true
    const loadProfile=async()=>{
      try{
        const {data:authData}=await supabase.auth.getUser()
        const user=authData?.user
        if(!user?.id)return
        const {data}=await supabase.from('profiles').select('name,geburtsdatum,max_hf,ruhe_hf').eq('id',user.id).maybeSingle()
        if(!active)return
        let age=''
        if(data?.geburtsdatum){
          const birth=new Date(`${data.geburtsdatum}T12:00:00`)
          const now=new Date()
          age=now.getFullYear()-birth.getFullYear()-(new Date(now.getFullYear(),now.getMonth(),now.getDate())<new Date(now.getFullYear(),birth.getMonth(),birth.getDate())?1:0)
        }
        setForm(current=>({...current,name:data?.name||user.user_metadata?.name||current.name,alter:age||current.alter,maxHF:data?.max_hf?String(data.max_hf):current.maxHF,ruheHF:data?.ruhe_hf?String(data.ruhe_hf):current.ruheHF}))
      }catch(e){console.warn('[MtbOnboarding] Profil konnte nicht vorgeladen werden:',e)}
      finally{if(active)setProfileLoading(false)}
    }
    loadProfile()
    return()=>{active=false}
  },[])

  useEffect(()=>{
    if(typeof window==='undefined')return
    try{window.sessionStorage.setItem(DRAFT_KEY,JSON.stringify({step,form,weeksManuallySelected}))}catch{}
  },[step,form,weeksManuallySelected])

  const eventWeeks=useMemo(()=>weeksBetween(form.startDate,form.eventDate),[form.startDate,form.eventDate])
  const recommendation=useMemo(()=>getRecommendedMtbWeeks(form),[
    form.goalType,form.targetDistanceKm,form.targetElevationM,form.tourDays,
    form.longestStageKm,form.longestRecentKm,form.longestRecentHours,form.level
  ])
  const weekChoices=useMemo(()=>{
    if(form.eventDate&&eventWeeks>0)return[eventWeeks]
    return [...new Set([recommendation-4,recommendation-2,recommendation,recommendation+2].filter(v=>v>=6&&v<=24))].sort((a,b)=>a-b)
  },[form.eventDate,eventWeeks,recommendation])

  useEffect(()=>{
    if(form.eventDate&&eventWeeks!=null&&eventWeeks>0){
      setWeeksManuallySelected(false)
      setForm(c=>({...c,weeksUntilGoal:eventWeeks,availableWeeks:eventWeeks}))
      return
    }
    if(!weeksManuallySelected)setForm(c=>({...c,weeksUntilGoal:recommendation,availableWeeks:null}))
  },[form.eventDate,eventWeeks,recommendation,weeksManuallySelected])

  const toggleDay=day=>setForm(c=>{
    const selected=c.preferredDays.includes(day)
    if(selected)return{...c,preferredDays:c.preferredDays.filter(x=>x!==day)}
    if(c.preferredDays.length>=Number(c.unitsPerWeek))return c
    return{...c,preferredDays:[...c.preferredDays,day]}
  })
  const selectUnits=units=>setForm(c=>({...c,unitsPerWeek:units,preferredDays:DEFAULT_DAYS[units]}))

  const targetNeeded=!['fitness'].includes(form.goalType)
  const canStep1=Boolean(form.goalType)&&Boolean(form.mtbStyle)&&Boolean(form.level)&&(
    !targetNeeded ||
    (form.goalType==='tour'
      ? Number(form.tourTotalKm)>0&&Number(form.tourDays)>0&&Number(form.longestStageKm)>0
      : Number(form.targetDistanceKm)>0)
  )&&(form.goalType!=='event'||(Boolean(form.eventDate)&&eventWeeks>0))

  const canStep2=Boolean(form.currentFrequency)&&Boolean(form.trainingTerrain)&&Boolean(form.trailAccess)&&Boolean(form.technicalLevel)&&Boolean(form.techniquePreference)
  const canGenerate=Boolean(form.startDate)&&form.unitsPerWeek>=2&&form.preferredDays.length===Number(form.unitsPerWeek)
  const targetNeedsAdjacent=form.goalType==='tour'&&Number(form.tourDays)>=2

  const handleGenerate=async()=>{
    setLoading(true);setError(null)
    try{
      const guardrails=buildMtbPlanGuardrails(form)
      const response=await fetch('/api/generate-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,sport_type:'mountain_biking',plan_type:'mtb_endurance',guardrails})})
      const data=await response.json()
      if(!response.ok||data?.error)throw new Error(data?.error||`HTTP ${response.status}`)
      if(!data?.plan?.phases?.length)throw new Error('Der Trainingsplan ist unvollständig.')
      if(typeof window!=='undefined')window.sessionStorage.removeItem(DRAFT_KEY)
      onPlanGenerated(data.plan)
    }catch(e){
      console.error('[MtbOnboarding] Plan konnte nicht erstellt werden:',e)
      setError(e?.message?`Dein Plan konnte gerade nicht erstellt werden: ${e.message}`:'Dein Plan konnte gerade nicht erstellt werden.')
    }finally{setLoading(false)}
  }

  const progress=[{n:1,label:'Ziel'},{n:2,label:'Training'},{n:3,label:'Plan'}]

  return <div style={{minHeight:'100vh',background:'linear-gradient(160deg,#F4F8F3 0%,#FFF8F0 52%,#F4F1F7 100%)',color:'#3E4539',fontFamily:"'Georgia','Times New Roman',serif"}}>
    <header style={{minHeight:245,position:'relative',overflow:'hidden',display:'flex',alignItems:'flex-end',background:'#455B48'}}>
      <div aria-hidden="true" style={{position:'absolute',inset:0,backgroundImage:'url("/hero/mtb/03.webp"), url("/hero/cycling/03.webp")',backgroundSize:'cover',backgroundPosition:'center 55%'}}/>
      <div aria-hidden="true" style={{position:'absolute',inset:0,background:'linear-gradient(90deg,rgba(20,29,21,.78),rgba(20,29,21,.42) 58%,rgba(20,29,21,.15)),linear-gradient(180deg,rgba(0,0,0,.05),rgba(14,20,15,.60))'}}/>
      <div style={{position:'relative',zIndex:2,width:'100%',maxWidth:720,margin:'0 auto',padding:'34px 20px 24px',boxSizing:'border-box',color:'#fff'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:40,height:40,borderRadius:'50%',background:'rgba(255,248,240,.94)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px rgba(0,0,0,.16)'}}><img src="/route-icon.png" alt="" style={{width:32,height:32,borderRadius:'50%'}}/></div>
          <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,letterSpacing:1.4}}>DEIN TRAININGSPLAN</div>
        </div>
        <h1 style={{fontSize:31,margin:'8px 0 4px',lineHeight:1.05}}>Mountainbike</h1>
        <p style={{margin:0,fontFamily:'sans-serif',fontSize:12,lineHeight:1.5,opacity:.9}}>Ausdauer, Gelände und Fahrtechnik – passend zu deinem Ziel und den Möglichkeiten vor Ort.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:18,maxWidth:390}}>
          {progress.map(item=><div key={item.n}><div style={{height:4,borderRadius:99,background:step>=item.n?'#fff':'rgba(255,255,255,.28)'}}/><div style={{marginTop:6,fontFamily:'sans-serif',fontSize:9.5,fontWeight:step===item.n?900:700,opacity:step>=item.n?1:.7}}>{item.n} · {item.label}</div></div>)}
        </div>
      </div>
    </header>

    <main style={{maxWidth:520,margin:'0 auto',padding:'24px 18px 42px'}}>
      {profileLoading&&<div style={{...small,marginBottom:12}}>Profil wird übernommen…</div>}

      {step===1&&<section style={panel}>
        <div style={{marginBottom:24}}>
          <div style={labelStyle}>Wofür möchtest du trainieren?</div>
          <div style={{display:'grid',gap:9}}>
            {[
              ['event','🏁','Ich trainiere für ein MTB-Event','Gezielt auf Strecke und Anforderungen vorbereiten'],
              ['distance','🎯','Ich möchte eine MTB-Distanz schaffen','Eine persönliche Strecke sicher bewältigen'],
              ['tour','🗺️','Ich trainiere für Tour / Alpencross','Für lange oder mehrtägige Belastung vorbereiten'],
              ['fitness','🌲','Ich möchte allgemein fitter auf dem MTB werden','Ausdauer und Fahrkönnen entwickeln'],
            ].map(([id,icon,title,sub])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,goalType:id}))} style={choiceStyle(form.goalType===id)}><span style={{fontSize:20,marginRight:9}}>{icon}</span>{title}<span style={{display:'block',marginLeft:31,marginTop:3,fontSize:10,color:'#929A8A',fontWeight:600}}>{sub}</span></button>)}
          </div>
        </div>

        <div style={{marginBottom:24}}>
          <div style={labelStyle}>Wie fährst du überwiegend?</div>
          <div style={{display:'grid',gap:8}}>
            {[
              ['xc','Cross-Country / XC','Sportlich, wechselndes Gelände, Anstiege und Abfahrten'],
              ['trail','Trail / All-Mountain','Mehr Fokus auf Trails, Gelände und Fahrtechnik'],
              ['tour','Touren / Genuss-MTB','Längere Touren und vielseitiges Gelände'],
            ].map(([id,title,sub])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,mtbStyle:id}))} style={choiceStyle(form.mtbStyle===id)}>{title}<span style={{display:'block',marginTop:3,fontSize:10,color:'#929A8A',fontWeight:600}}>{sub}</span></button>)}
          </div>
          <div style={{...small,marginTop:7}}>MTB-Marathon wird über dein Event-/Distanzziel abgebildet und ist keine eigene Fahrradart.</div>
        </div>

        <div style={{marginBottom:24}}>
          <div style={labelStyle}>Wie viel MTB-Erfahrung hast du aktuell?</div>
          <div style={{display:'grid',gap:8}}>
            {[
              ['beginner','🌱','Ich starte gerade','Selten oder noch nicht regelmäßig auf dem MTB'],
              ['regular','🚵','Ich fahre regelmäßig','MTB gehört bereits zu meiner Woche'],
              ['ambitious','⚡','Ich trainiere ambitioniert','Längere oder strukturierte MTB-Einheiten sind vertraut'],
            ].map(([id,icon,title,sub])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,level:id}))} style={choiceStyle(form.level===id)}>{icon} {title}<span style={{display:'block',marginTop:3,fontSize:10,color:'#929A8A',fontWeight:600}}>{sub}</span></button>)}
          </div>
        </div>

        {['event','distance'].includes(form.goalType)&&<div style={{marginBottom:22}}>
          <div style={labelStyle}>Zieldistanz</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
            {[30,50,75,100].map(km=><button key={km} type="button" onClick={()=>setForm(c=>({...c,targetDistanceKm:String(km),customDistance:false}))} style={{padding:'9px 12px',borderRadius:11,border:`2px solid ${Number(form.targetDistanceKm)===km&&!form.customDistance?'#759B78':'#E1E6DE'}`,background:Number(form.targetDistanceKm)===km&&!form.customDistance?'#EFF7F0':'#fff',color:'#6B7667',fontFamily:'sans-serif',fontSize:11,fontWeight:850,cursor:'pointer'}}>{km} km</button>)}
            <button type="button" onClick={()=>setForm(c=>({...c,customDistance:true,targetDistanceKm:c.customDistance?c.targetDistanceKm:''}))} style={{padding:'9px 12px',borderRadius:11,border:`2px solid ${form.customDistance?'#759B78':'#E1E6DE'}`,background:form.customDistance?'#EFF7F0':'#fff',color:'#6B7667',fontFamily:'sans-serif',fontSize:11,fontWeight:850,cursor:'pointer'}}>Eigene</button>
          </div>
          {form.customDistance&&<input style={{...inputStyle,marginTop:9}} type="number" min="10" placeholder="z. B. 65" value={form.targetDistanceKm} onChange={e=>setForm(c=>({...c,targetDistanceKm:e.target.value}))}/>}
        </div>}

        {form.goalType==='event'&&<div style={{marginBottom:22}}><label style={labelStyle}>Wann ist dein Event?</label><input style={inputStyle} type="date" min={form.startDate||todayIso()} value={form.eventDate} onChange={e=>setForm(c=>({...c,eventDate:e.target.value}))}/></div>}

        {form.goalType==='tour'&&<div style={{marginBottom:22}}>
          <label style={labelStyle}>Name der Tour <span style={{textTransform:'none',fontWeight:600}}>optional</span></label>
          <input style={inputStyle} placeholder="z. B. Alpencross" value={form.tourName} onChange={e=>setForm(c=>({...c,tourName:e.target.value}))}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginTop:9}}>
            <div><label style={labelStyle}>Gesamt-km</label><input style={inputStyle} type="number" min="10" value={form.tourTotalKm} onChange={e=>setForm(c=>({...c,tourTotalKm:e.target.value}))}/></div>
            <div><label style={labelStyle}>Tage</label><input style={inputStyle} type="number" min="1" value={form.tourDays} onChange={e=>setForm(c=>({...c,tourDays:e.target.value}))}/></div>
          </div>
          <div style={{marginTop:9}}><label style={labelStyle}>Längste geplante Tagesetappe</label><input style={inputStyle} type="number" min="10" placeholder="km" value={form.longestStageKm} onChange={e=>setForm(c=>({...c,longestStageKm:e.target.value}))}/></div>
          <div style={{marginTop:9}}><label style={labelStyle}>Zieltermin <span style={{textTransform:'none',fontWeight:600}}>optional</span></label><input style={inputStyle} type="date" min={form.startDate||todayIso()} value={form.eventDate} onChange={e=>setForm(c=>({...c,eventDate:e.target.value}))}/></div>
        </div>}

        {targetNeeded&&<div style={{marginBottom:22}}>
          <label style={labelStyle}>Höhenmeter des Ziels <span style={{textTransform:'none',fontWeight:600}}>optional</span></label>
          <input style={inputStyle} type="number" min="0" step="50" placeholder="z. B. 1.500 hm" value={form.targetElevationM} onChange={e=>setForm(c=>({...c,targetElevationM:e.target.value}))}/>
          <div style={{...small,marginTop:6}}>Falls bekannt. Das hilft, eine 60-km-Strecke mit 300 hm anders zu planen als 60 km mit 1.800 hm.</div>
        </div>}

        {targetNeeded&&<div style={{marginBottom:22}}>
          <div style={labelStyle}>Wie ist das Gelände am Ziel?</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            {[['flat','Eher flach'],['hilly','Hügelig'],['mountainous','Bergig'],['alpine','Alpin / viele Anstiege']].map(([id,label])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,targetTerrain:id}))} style={{...choiceStyle(form.targetTerrain===id),textAlign:'center'}}>{label}</button>)}
          </div>
        </div>}

        <button type="button" onClick={()=>setStep(2)} disabled={!canStep1} style={{width:'100%',padding:15,borderRadius:16,border:'none',background:canStep1?'linear-gradient(135deg,#668D6D,#89AA8D)':'#ECEFEA',color:canStep1?'#fff':'#A8AFA4',fontFamily:'sans-serif',fontSize:14,fontWeight:900,cursor:canStep1?'pointer':'default'}}>Weiter zu deinem Training →</button>
      </section>}

      {step===2&&<section style={panel}>
        <div style={{marginBottom:20,padding:'11px 13px',borderRadius:13,background:'#F0F6F0',...small,color:'#607563'}}>Beim MTB zählen Zeit, Belastung und Gelände mehr als Durchschnittsgeschwindigkeit. Höhenmeter ergänzen den Kontext, wenn du sie kennst.</div>

        <div style={{marginBottom:22}}>
          <div style={labelStyle}>Wie oft fährst du aktuell MTB?</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            {[['0','Noch gar nicht'],['1','1× pro Woche'],['2','2× pro Woche'],['3','3× pro Woche'],['4plus','4× oder häufiger']].map(([id,label])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,currentFrequency:id}))} style={choiceStyle(form.currentFrequency===id)}>{label}</button>)}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:22}}>
          <div><label style={labelStyle}>Stunden/Woche <span style={{textTransform:'none',fontWeight:600}}>optional</span></label><input style={inputStyle} type="number" step=".5" min="0" value={form.currentWeeklyHours} onChange={e=>setForm(c=>({...c,currentWeeklyHours:e.target.value}))}/></div>
          <div><label style={labelStyle}>Höhenmeter bei typischer längerer Tour <span style={{textTransform:'none',fontWeight:600}}>optional</span></label><input style={inputStyle} type="number" step="50" min="0" value={form.typicalElevationM} onChange={e=>setForm(c=>({...c,typicalElevationM:e.target.value}))}/></div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:22}}>
          <div><label style={labelStyle}>Längste Fahrt · Stunden <span style={{textTransform:'none',fontWeight:600}}>optional</span></label><input style={inputStyle} type="number" step=".25" min="0" value={form.longestRecentHours} onChange={e=>setForm(c=>({...c,longestRecentHours:e.target.value}))}/></div>
          <div><label style={labelStyle}>Längste Fahrt · km <span style={{textTransform:'none',fontWeight:600}}>optional</span></label><input style={inputStyle} type="number" min="0" value={form.longestRecentKm} onChange={e=>setForm(c=>({...c,longestRecentKm:e.target.value}))}/></div>
        </div>

        <div style={{marginBottom:22}}>
          <div style={labelStyle}>Welches Gelände hast du normalerweise?</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            {[['flat','Überwiegend flach'],['hilly','Hügelig'],['climbs','Viele Anstiege'],['mountainous','Bergig']].map(([id,label])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,trainingTerrain:id}))} style={{...choiceStyle(form.trainingTerrain===id),textAlign:'center'}}>{label}</button>)}
          </div>
        </div>

        <div style={{marginBottom:22}}>
          <div style={labelStyle}>Welche Trail-Möglichkeiten hast du?</div>
          <div style={{display:'grid',gap:7}}>
            {[['none','Kaum / keine Trails'],['easy','Einfache Trails verfügbar'],['advanced','Auch anspruchsvollere Trails verfügbar']].map(([id,label])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,trailAccess:id}))} style={choiceStyle(form.trailAccess===id)}>{label}</button>)}
          </div>
        </div>

        <div style={{marginBottom:22}}>
          <div style={labelStyle}>Wie sicher fühlst du dich auf Trails?</div>
          <div style={{display:'grid',gap:7}}>
            {[['beginner','Einsteiger','Grundposition, Bremsen und einfache Linien noch lernen'],['basic','Einfache Trails sicher','Auf einfachen Trails kontrolliert unterwegs'],['experienced','Technisch erfahren','Auch anspruchsvollere Abschnitte sind vertraut']].map(([id,title,sub])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,technicalLevel:id}))} style={choiceStyle(form.technicalLevel===id)}>{title}<span style={{display:'block',marginTop:3,fontSize:10,color:'#929A8A',fontWeight:600}}>{sub}</span></button>)}
          </div>
        </div>

        <div style={{marginBottom:22,padding:'15px',borderRadius:17,background:'#F4F7F1',border:'1px solid #DDE6D9'}}>
          <div style={{...labelStyle,color:'#5E7D61'}}>Möchtest du Fahrtechnik gezielt mittrainieren?</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>
            {[['regular','Regelmäßig'],['sometimes','Gelegentlich'],['no','Nein']].map(([id,label])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,techniquePreference:id}))} style={{...choiceStyle(form.techniquePreference===id),textAlign:'center',padding:'11px 5px'}}>{label}</button>)}
          </div>
          <div style={{...small,marginTop:8}}>Technikaufgaben werden – wenn gewählt – Schritt für Schritt erklärt. Keine bloßen Hinweise wie „Kurven üben“.</div>
        </div>

        <div style={{marginBottom:22}}>
          <div style={labelStyle}>Kannst du Indoor-Radtraining nutzen?</div>
          <div style={{...small,margin:'-2px 0 8px'}}>Zum Beispiel Rollentrainer, Smart-Trainer oder Indoorbike.</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>
            {[['no','Nein'],['sometimes','Gelegentlich'],['regular','Regelmäßig']].map(([id,label])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,indoorTrainer:id}))} style={{...choiceStyle(form.indoorTrainer===id),textAlign:'center',padding:'11px 5px'}}>{label}</button>)}
          </div>
        </div>

        <div style={{marginBottom:22}}>
          <div style={labelStyle}>Krafttraining ergänzen? <span style={{textTransform:'none',fontWeight:600}}>optional</span></div>
          <div style={{display:'flex',gap:7}}>{[['no','Nein'],['yes','Ja']].map(([id,label])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,strengthTraining:id}))} style={{...choiceStyle(form.strengthTraining===id),textAlign:'center'}}>{label}</button>)}</div>
        </div>

        <div style={{margin:'0 -4px 22px',padding:'16px',borderRadius:18,background:'#F7FAF7',border:'1px solid #DFE8DE'}}>
          <div style={{...labelStyle,color:'#5E7D61'}}>Trainingsintensität <span style={{textTransform:'none',fontWeight:600}}>optional</span></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
            <div><label style={labelStyle}>Max. HF</label><input style={inputStyle} type="number" min="80" max="240" value={form.maxHF} onChange={e=>setForm(c=>({...c,maxHF:e.target.value}))}/></div>
            <div><label style={labelStyle}>Ruhe-HF</label><input style={inputStyle} type="number" min="30" max="130" value={form.ruheHF} onChange={e=>setForm(c=>({...c,ruheHF:e.target.value}))}/></div>
          </div>
          <div style={{marginTop:9}}><label style={labelStyle}>FTP in Watt <span style={{textTransform:'none',fontWeight:600}}>falls bekannt</span></label><input style={inputStyle} type="number" min="50" max="600" value={form.ftp} onChange={e=>setForm(c=>({...c,ftp:e.target.value}))}/></div>
        </div>

        <div style={{marginBottom:22}}>
          <div style={labelStyle}>Gibt es etwas, das wir berücksichtigen sollen? <span style={{textTransform:'none',fontWeight:600}}>optional</span></div>
          <div style={{display:'flex',gap:7}}>{[['no','Nein'],['yes','Ja']].map(([id,label])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,hasConsiderations:id,considerations:id==='no'?'':c.considerations}))} style={{...choiceStyle(form.hasConsiderations===id),textAlign:'center'}}>{label}</button>)}</div>
          {form.hasConsiderations==='yes'&&<textarea style={{...inputStyle,minHeight:80,resize:'vertical',marginTop:9}} value={form.considerations} placeholder="z. B. Kniebeschwerden, Unsicherheit bei Abfahrten …" onChange={e=>setForm(c=>({...c,considerations:e.target.value}))}/>}
        </div>

        <div style={{display:'flex',gap:8}}>
          <button type="button" onClick={()=>setStep(1)} style={{flex:1,padding:13,borderRadius:15,border:'1px solid #E2E6DE',background:'#fff',color:'#778071',fontWeight:850,cursor:'pointer'}}>← Zurück</button>
          <button type="button" onClick={()=>setStep(3)} disabled={!canStep2} style={{flex:2,padding:13,borderRadius:15,border:'none',background:canStep2?'linear-gradient(135deg,#668D6D,#89AA8D)':'#ECEFEA',color:canStep2?'#fff':'#A8AFA4',fontWeight:900,cursor:canStep2?'pointer':'default'}}>Weiter zum Plan →</button>
        </div>
      </section>}

      {step===3&&<section style={panel}>
        <div style={{marginBottom:22}}><label style={labelStyle}>Startdatum</label><input style={inputStyle} type="date" min={todayIso()} value={form.startDate} onChange={e=>setForm(c=>({...c,startDate:e.target.value}))}/></div>

        <div style={{marginBottom:22,padding:'14px 15px',borderRadius:15,background:'#F4F7F1',border:'1px solid #DDE6D9',fontFamily:'sans-serif'}}>
          <div style={{fontSize:9.5,fontWeight:900,letterSpacing:.7,color:'#638069'}}>VORBEREITUNGSZEIT</div>
          {form.eventDate&&eventWeeks>0?<><div style={{fontSize:21,fontWeight:900,color:'#3E4539',marginTop:4}}>{eventWeeks} Wochen</div><div style={{...small,marginTop:4}}>Ergibt sich aus Planstart und Zieltermin. Empfehlung für dein Profil: etwa {recommendation} Wochen.</div></>:<>
            <div style={{display:'flex',alignItems:'baseline',gap:7,marginTop:4}}><div style={{fontSize:21,fontWeight:900,color:'#3E4539'}}>{recommendation} Wochen</div><div style={{fontSize:9.2,fontWeight:900,color:'#6F966F',textTransform:'uppercase'}}>empfohlen</div></div>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:10}}>{weekChoices.map(weeks=><button key={weeks} type="button" onClick={()=>{setWeeksManuallySelected(true);setForm(c=>({...c,weeksUntilGoal:weeks,availableWeeks:weeks}))}} style={{padding:'9px 11px',borderRadius:11,border:`2px solid ${Number(form.weeksUntilGoal)===weeks?'#759B78':'#E1E6DE'}`,background:Number(form.weeksUntilGoal)===weeks?'#EFF7F0':'#fff',color:'#697467',fontSize:10.5,fontWeight:850,cursor:'pointer'}}>{weeks} Wo.</button>)}</div>
            {Number(form.weeksUntilGoal)<recommendation&&<div style={{marginTop:9,padding:'9px 10px',borderRadius:11,background:'#FFF2E9',color:'#A8654E',fontSize:10,lineHeight:1.45}}><strong>Ambitionierter Zeitrahmen:</strong> Der Plan bleibt konservativ und erzwingt keine Belastungssprünge.</div>}
          </>}
        </div>

        <div style={{marginBottom:22}}>
          <div style={labelStyle}>Wie oft möchtest du pro Woche trainieren?</div>
          <div style={{display:'flex',gap:7}}>{[2,3,4,5].map(units=><button key={units} type="button" onClick={()=>selectUnits(units)} style={{flex:1,padding:'11px 0',borderRadius:11,border:`2px solid ${form.unitsPerWeek===units?'#759B78':'#E1E6DE'}`,background:form.unitsPerWeek===units?'#EFF7F0':'#fff',color:'#697467',fontWeight:900,cursor:'pointer'}}>{units}×</button>)}</div>
        </div>

        <div style={{marginBottom:22}}>
          <div style={labelStyle}>Welche Tage passen dir?</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{DAYS.map(day=>{const selected=form.preferredDays.includes(day);const limit=!selected&&form.preferredDays.length>=Number(form.unitsPerWeek);return <button key={day} type="button" disabled={limit} onClick={()=>toggleDay(day)} style={{width:52,padding:'10px 0',borderRadius:11,border:`2px solid ${selected?'#759B78':'#E1E6DE'}`,background:selected?'#EFF7F0':'#fff',color:selected?'#497255':'#778071',opacity:limit?.45:1,fontWeight:900,cursor:limit?'default':'pointer'}}>{day}</button>})}</div>
          <div style={{...small,marginTop:7}}>Wähle genau {form.unitsPerWeek} Tage. Intensive, lange und technische Einheiten werden sinnvoll verteilt.</div>
        </div>

        {targetNeedsAdjacent&&<div style={{marginBottom:22,padding:'14px',borderRadius:15,background:'#F6F3F8',border:'1px solid #E4DDE8'}}>
          <div style={{...labelStyle,color:'#75647F'}}>Dürfen bei der Mehrtagestour einzelne Trainingswochen zwei aufeinanderfolgende lange Tage enthalten?</div>
          <div style={{display:'flex',gap:7}}>{[['no','Nein'],['yes','Ja']].map(([id,label])=><button key={id} type="button" onClick={()=>setForm(c=>({...c,allowAdjacentDays:id}))} style={{...choiceStyle(form.allowAdjacentDays===id),textAlign:'center'}}>{label}</button>)}</div>
        </div>}

        <div style={{marginBottom:22,padding:'14px 15px',borderRadius:15,background:'#F2F7F2',border:'1px solid #DCE7DC',fontFamily:'sans-serif'}}>
          <div style={{fontSize:9.5,fontWeight:900,color:'#5C7B60',letterSpacing:.7}}>DEIN PLAN</div>
          <div style={{display:'grid',gap:5,marginTop:7,fontSize:10.5,color:'#657266'}}>
            <div>🚵 {form.mtbStyle==='xc'?'Cross-Country / XC':form.mtbStyle==='trail'?'Trail / All-Mountain':'Touren / Genuss-MTB'}</div>
            {targetNeeded&&<div>🎯 {form.goalType==='tour'?`${form.tourTotalKm} km · ${form.tourDays} Tage`:`${form.targetDistanceKm} km`}{form.targetElevationM?` · ca. ${Number(form.targetElevationM).toLocaleString('de-DE')} hm`:''}</div>}
            <div>📅 {form.weeksUntilGoal} Wochen · {form.unitsPerWeek} Einheiten pro Woche</div>
            <div>🗓️ {form.preferredDays.join(' · ')}</div>
            <div>🛠️ Technik: {form.techniquePreference==='regular'?'regelmäßig':form.techniquePreference==='sometimes'?'gelegentlich':'keine eigenen Technikblöcke'}</div>
            <div>⏱️ Zeit & Belastung steuern den Umfang; km/h wird nicht vorgegeben</div>
          </div>
        </div>

        {error&&<div style={{marginBottom:14,padding:'11px 13px',borderRadius:12,background:'#FDECEA',border:'1px solid #F5C4CC',color:'#B85464',fontFamily:'sans-serif',fontSize:11,lineHeight:1.5}}>{error}</div>}

        <div style={{display:'flex',gap:8}}>
          <button type="button" onClick={()=>setStep(2)} disabled={loading} style={{flex:1,padding:14,borderRadius:15,border:'1px solid #E2E6DE',background:'#fff',color:'#778071',fontWeight:850,cursor:'pointer'}}>← Zurück</button>
          <button type="button" onClick={handleGenerate} disabled={!canGenerate||loading} style={{flex:2,padding:14,borderRadius:15,border:'none',background:canGenerate&&!loading?'linear-gradient(135deg,#668D6D,#89AA8D)':'#ECEFEA',color:canGenerate&&!loading?'#fff':'#A8AFA4',fontWeight:900,cursor:canGenerate&&!loading?'pointer':'default'}}>{loading?'Plan wird erstellt…':'Trainingsplan erstellen →'}</button>
        </div>
      </section>}
    </main>
  </div>
}
