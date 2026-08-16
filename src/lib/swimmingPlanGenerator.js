const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
const round25=v=>Math.max(25,Math.round(Number(v||0)/25)*25)
export const SWIM_PLAN_VERSION='swim-v3'

export const getRecommendedSwimmingWeeks=form=>{
  const goal=form.goalType
  const target=Number(form.targetDistanceM||0)
  const continuous=Number(form.currentContinuousM||0)
  const total=Number(form.currentSessionM||0)
  const units=Math.max(2,Math.min(4,Number(form.unitsPerWeek||3)))
  const continuousGoal=form.continuousGoal!=='no'

  if(goal==='beginner') return units>=3?8:10
  if(goal==='fitness') return total>=2000?(units>=3?8:10):(units>=3?10:12)

  if(goal==='distance'||goal==='event'){
    let weeks=
      target<=500?8:
      target<=1000?9:
      target<=1500?10:
      target<=2000?12:
      target<=3000?14:
      target<=5000?16:
      target<=7500?18:20

    const baseline=continuousGoal
      ? Math.max(continuous,50)
      : Math.max(total,250)

    const ratio=target>0?target/baseline:1

    if(ratio>10) weeks+=4
    else if(ratio>6) weeks+=2
    else if(ratio>3) weeks+=1
    else if(ratio<=1.5) weeks-=2

    if(total>=target*0.8) weeks-=1
    if(units===2) weeks+=2
    if(units===4) weeks-=1

    weeks=Math.max(8,Math.min(24,weeks))
    return weeks%2===0?weeks:weeks+1
  }

  return 10
}

const getSwimmingDurationGuidance=form=>{
  const level=String(form?.techniqueLevel||'okay')
  const continuous=Math.max(25,Number(form?.currentContinuousM||50))
  const session=Math.max(250,Number(form?.currentSessionM||500))
  const basePace100=
    level==='secure'?2.35:
    level==='unsure'?3.15:2.75
  const enduranceAdjustment=continuous>=800?-.15:continuous<=100?.2:0
  const volumeAdjustment=session>=2000?-.1:0
  const pace100=Math.max(1.9,basePace100+enduranceAdjustment+volumeAdjustment)
  return{
    estimatedSwimMinutesPer100m:Number(pace100.toFixed(2)),
    rule:'Dauer aus Gesamtmetern plus realen Satzpausen ableiten. Keine pauschale Minutenangabe erfinden; bei fehlender Pace konservativ mit dem hinterlegten Schätzwert rechnen.'
  }
}

export const buildSwimmingPlanGuardrails=form=>{
  const target=round25(form.targetDistanceM)
  const currentContinuous=round25(form.currentContinuousM)
  const currentSession=round25(form.currentSessionM)
  const weeks=clamp(Number(form.weeksUntilGoal||10),6,24)
  const units=clamp(Number(form.unitsPerWeek||3),2,4)
  const allowedStrokes=getAllowedSwimmingStrokes(form)
  const strokeWeights=getSwimmingStrokeWeights(form)
  const continuousByWeek=buildContinuousDistanceProgression(form)
  const sessionDistanceByWeek=buildSessionDistanceProgression(form)
  const durationGuidance=getSwimmingDurationGuidance(form)
  const isContinuousTarget=Boolean(['distance','event'].includes(form.goalType)&&target>0&&form.continuousGoal!=='no')
  return {
    version:SWIM_PLAN_VERSION,
    targetDistanceM:target||null,
    currentContinuousM:currentContinuous||null,
    currentSessionM:currentSession||null,
    weeks,unitsPerWeek:units,
    allowedStrokes,
    strokeWeights,
    continuousByWeek,
    sessionDistanceByWeek,
    durationGuidance,
    finalTargetAttempt:isContinuousTarget?{
      enabled:true,
      week:weeks,
      distanceM:target,
      instruction:`In der letzten Woche genau eine klar benannte Zieleinheit mit ${target} m am Stück vorsehen. Diese Einheit nicht als normalen Technikblock darstellen. Vorher 200 m sehr locker einschwimmen, dann ausreichende Erholung, anschließend der Zielversuch; danach locker ausschwimmen.`
    }:{enabled:false},
    shortPreparation:Boolean(['distance','event'].includes(form.goalType)&&target>0&&currentContinuous>0&&target/currentContinuous>=4&&weeks<=10),
    rules:[
      'Technikqualität hat Vorrang vor bloßer Metersteigerung.',
      'Progression entsteht aus Gesamtumfang, längeren zusammenhängenden Abschnitten, passenden Pausen und Technik unter Ermüdung.',
      'Bei knapper Vorbereitungszeit keine aggressiven Sprünge erzwingen.',
      allowedStrokes.length
        ?`Ausschließlich diese Schwimmarten verwenden: ${allowedStrokes.join(', ')}. Auch Einschwimmen, Ausschwimmen, Technik, Erholung und "gemischt" dürfen keine andere Lage enthalten.`
        :'Keine Schwimmart erfinden; lage-neutral formulieren.',
      'Das Wort "gemischt" bedeutet ausschließlich eine Mischung aus den erlaubten Schwimmarten und niemals automatisch Rücken oder Delfin.',
      'Wenn nur eine Schwimmart erlaubt ist, müssen sämtliche schwimmartspezifischen Meter in genau dieser Lage stattfinden.',
      'Die angegebene Einheitsdauer muss zu Gesamtmetern, Intensität und ausgewiesenen Satzpausen passen.',
      isContinuousTarget?'Die letzte Woche enthält genau einen klar erkennbaren Zielversuch über die Zieldistanz am Stück; dieser wird als Zieleinheit und nicht als Technikübung formuliert.':'Keinen künstlichen Zielversuch erzeugen, wenn kein Am-Stück-Ziel vorliegt.',
      'Hilfsmittel nur verwenden, wenn sie laut Eingabe verfügbar sind.',
      'Freiwasser nur einplanen, wenn sichere Trainingsmöglichkeit vorhanden ist.'
    ]
  }
}


const normalizeStroke=v=>{
 const s=String(v||'').toLowerCase()
 if(s.includes('brust')||s.includes('breast'))return'breaststroke'
 if(s.includes('kraul')||s.includes('free'))return'freestyle'
 if(s.includes('rück')||s.includes('rueck')||s.includes('back'))return'backstroke'
 if(s.includes('delf')||s.includes('delph')||s.includes('butter'))return'butterfly'
 return null
}
const uniq=a=>[...new Set((a||[]).filter(Boolean))]

export const getAllowedSwimmingStrokes=form=>{
 const onboardingStroke=String(form?.stroke||'').toLowerCase()
 if(onboardingStroke==='mixed')return['freestyle','breaststroke']
 const direct=normalizeStroke(onboardingStroke)
 if(direct)return[direct]

 const raw=[
  ...(Array.isArray(form?.strokes)?form.strokes:[]),
  ...(Array.isArray(form?.selectedStrokes)?form.selectedStrokes:[]),
  ...(Array.isArray(form?.swimStyles)?form.swimStyles:[]),
  form?.primaryStroke,form?.secondaryStroke,form?.strokeChoice,
  form?.mainSwimmingStyle,form?.swimmingStyle,form?.preferredStyles
 ]
 return uniq(raw.map(normalizeStroke))
}

export const getSwimmingStrokeWeights=form=>{
 const allowed=getAllowedSwimmingStrokes(form)
 if(!allowed.length)return{}
 if(allowed.length===1)return{[allowed[0]]:1}

 const onboardingPriority=form?.mixedPriority==='equal'?null:normalizeStroke(form?.mixedPriority)
 const focus=onboardingPriority||normalizeStroke(form?.focusStroke||form?.developmentStroke||form?.strokeToImprove||form?.strongerDevelopment||form?.developStroke)
 if(focus&&allowed.includes(focus)){
  const rest=.3/(allowed.length-1)
  return Object.fromEntries(allowed.map(s=>[s,s===focus?.7:rest]))
 }
 const each=1/allowed.length
 return Object.fromEntries(allowed.map(s=>[s,each]))
}

export const buildContinuousDistanceProgression=form=>{
 const weeks=clamp(Number(form?.weeksUntilGoal||10),6,24)
 const start=Math.max(25,round25(form?.currentContinuousM||100))
 const target=Math.max(start,round25(form?.targetDistanceM||start))
 if(form?.continuousGoal==='no'||target<=start)return Array(weeks).fill(Math.min(start,target))
 const recovery=weeks>=8?Math.max(3,Math.round(weeks*.65)-1):-1
 const out=[]; let prev=start
 for(let i=0;i<weeks;i++){
  if(i===weeks-1){out.push(target);continue}
  if(i===recovery){out.push(round25(Math.max(start,prev*.7)));continue}
  const progress=i/Math.max(1,weeks-1)
  const desired=start+(target-start)*Math.pow(progress,1.35)
  const maxFactor=prev<400?1.35:prev<800?1.30:1.25
  const maxNext=prev+Math.max(50,round25(prev*(maxFactor-1)))
  prev=Math.max(prev,Math.min(target,round25(Math.min(desired,maxNext))))
  out.push(prev)
 }
 return out
}

export const buildSessionDistanceProgression=form=>{
 const weeks=clamp(Number(form?.weeksUntilGoal||10),6,24)
 const units=clamp(Number(form?.unitsPerWeek||3),2,4)
 const base=Math.max(250,round25(form?.currentSessionM||500))
 const target=Math.max(0,round25(form?.targetDistanceM||0))
 const recovery=weeks>=8?Math.max(3,Math.round(weeks*.65)-1):-1
 const spreads=units===2?[.95,1.1]:units===3?[.9,1,1.12]:[.88,.96,1.03,1.12]
 return Array.from({length:weeks},(_,i)=>{
  const p=i/Math.max(1,weeks-1)
  let weekBase=round25(base*(1.05+p*.75))
  if(i===recovery)weekBase=round25(base*Math.max(.9,(1.05+p*.75)*.72))
  return spreads.map(x=>{
   let d=round25(weekBase*x)
   const cap=target?Math.max(base*1.9,target*1.2):base*2
   return Math.max(250,Math.min(d,round25(cap)))
  })
 })
}

export const getAvailableSwimmingEquipment=form=>uniq([
 ...(Array.isArray(form?.equipment)?form.equipment:[]),
 ...(Array.isArray(form?.availableEquipment)?form.availableEquipment:[]),
 ...(Array.isArray(form?.swimEquipment)?form.swimEquipment:[])
].map(v=>String(v).trim().toLowerCase()))

export const buildSwimmingGeneratorConstraints=form=>{
 const allowedStrokes=getAllowedSwimmingStrokes(form)
 return{
  allowedStrokes,
  strokeWeights:getSwimmingStrokeWeights(form),
  equipment:getAvailableSwimmingEquipment(form),
  continuousByWeek:buildContinuousDistanceProgression(form),
  sessionDistanceByWeek:buildSessionDistanceProgression(form),
  instructions:[
   allowedStrokes.length
    ?`Ausschließlich diese Schwimmarten verwenden: ${allowedStrokes.join(', ')}.`
    :'Keine Schwimmart erfinden; lage-neutral formulieren.',
   'Mixed/gemischt darf ausschließlich aus erlaubten Schwimmarten bestehen; Rücken und Delfin niemals ergänzen, wenn sie nicht ausdrücklich erlaubt sind.',
   'Diese Regel gilt auch für Einschwimmen, Ausschwimmen, aktive Erholung, Technikblöcke und frei formulierte Hinweise.',
   'Eine priorisierte Schwimmart soll ungefähr 70 % der schwimmartspezifischen Meter erhalten.',
   'Gesamtumfang und längste zusammenhängende Strecke getrennt progressieren.',
   'Die längste zusammenhängende Strecke darf das Wochenlimit nicht überschreiten.',
   'Technikblöcke sind konkrete kurze Technikübungen; lange Zielstrecken gehören in die Hauptserie.',
   'Hilfsmittel nur verwenden, wenn sie laut Eingabe verfügbar sind.',
   'Teilstrecken müssen sich exakt zur ausgewiesenen Gesamtdistanz addieren.',
   'Zeitangaben müssen aus Schwimmmetern plus Satzpausen plausibel abgeleitet werden.',
   form?.continuousGoal!=='no'&&Number(form?.targetDistanceM||0)>0
    ?`In der letzten Woche genau eine separate Zieleinheit über ${round25(form.targetDistanceM)} m am Stück vorsehen.`
    :'Keinen separaten Am-Stück-Zielversuch erzwingen.'
  ]
 }
}

export const validateSwimmingPlan=(plan,form)=>{
 const c=buildSwimmingGeneratorConstraints(form),errors=[],warnings=[]
 const txt=JSON.stringify(plan||{}).toLowerCase()
 const used=[
  txt.includes('brust')||txt.includes('breast')?'breaststroke':null,
  txt.includes('kraul')||txt.includes('freestyle')?'freestyle':null,
  txt.includes('rücken')||txt.includes('ruecken')||txt.includes('backstroke')?'backstroke':null,
  txt.includes('delfin')||txt.includes('delphin')||txt.includes('butterfly')?'butterfly':null
 ].filter(Boolean)
 uniq(used).forEach(s=>{if(!c.allowedStrokes.includes(s))errors.push(`Nicht ausgewählte Schwimmart im Plan: ${s}`)})
 const weeks=Array.isArray(plan?.weeks)?plan.weeks:[]
 weeks.forEach((w,wi)=>{
  const sessions=Array.isArray(w?.sessions)?w.sessions:Array.isArray(w?.workouts)?w.workouts:[]
  sessions.forEach((s,si)=>{
   const total=Number(s?.distanceM??s?.totalDistanceM??s?.distance??0)
   const parts=[s?.warmupDistanceM,s?.mainDistanceM,s?.techniqueDistanceM,s?.cooldownDistanceM].map(Number).filter(Number.isFinite)
   if(total>0&&parts.length>=2&&parts.reduce((a,b)=>a+b,0)!==total)errors.push(`W${wi+1} E${si+1}: Teilstrecken stimmen nicht mit ${total} m überein`)
   const longest=Number(s?.longestContinuousM??s?.continuousDistanceM??0)
   if(longest>0&&c.continuousByWeek[wi]&&longest>c.continuousByWeek[wi])errors.push(`W${wi+1} E${si+1}: zusammenhängende Strecke ${longest} m über Wochenlimit ${c.continuousByWeek[wi]} m`)
  })
 })
 if(!weeks.length)warnings.push('Kein standardisiertes weeks[]-Array: strukturierte Distanzprüfung ist nur eingeschränkt möglich.')
 return{valid:!errors.length,errors,warnings,constraints:c}
}
