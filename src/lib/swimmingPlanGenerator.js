const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
const poolStep=form=>{
  const p=String(form?.poolLength||'25m').toLowerCase()
  return p==='both'||p.includes('50')?50:25
}
const roundToPool=(v,form)=>{
  const step=poolStep(form)
  return Math.max(step,Math.round(Number(v||0)/step)*step)
}
export const SWIM_PLAN_VERSION='swim-v10.1'

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
  const target=Math.max(0,Number(form.targetDistanceM||0))
  const currentContinuous=roundToPool(form.currentContinuousM,form)
  const currentSession=roundToPool(form.currentSessionM,form)
  const weeks=clamp(Number(form.weeksUntilGoal||10),6,24)
  const units=clamp(Number(form.unitsPerWeek||3),2,4)
  const allowedStrokes=getAllowedSwimmingStrokes(form)
  const strokeWeights=getSwimmingStrokeWeights(form)
  const continuousByWeek=buildContinuousDistanceProgression(form)
  const sessionDistanceByWeek=buildSessionDistanceProgression(form)
  const durationGuidance=getSwimmingDurationGuidance(form)
  const isContinuousTarget=Boolean(['distance','event'].includes(form.goalType)&&target>0&&form.continuousGoal!=='no')
  const executableTarget=form?.venue==='open_water'?target:roundToPool(target,form)
  return {
    version:SWIM_PLAN_VERSION,
    targetDistanceM:target||null,
    executableTargetDistanceM:executableTarget||null,
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
      distanceM:executableTarget,
      instruction:`In der letzten Woche genau eine klar benannte Zieleinheit mit ${executableTarget} m am Stück vorsehen. Diese Einheit nicht als normalen Technikblock darstellen. Vorher 200 m sehr locker einschwimmen, dann ausreichende Erholung, anschließend der Zielversuch; danach locker ausschwimmen.`
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
  const step=poolStep(form)
  const start=Math.max(step,roundToPool(form?.currentContinuousM||100,form))
  const rawTarget=Math.max(start,Number(form?.targetDistanceM||start))
  const target=form?.venue==='open_water'?rawTarget:roundToPool(rawTarget,form)
  if(form?.continuousGoal==='no'||target<=start)return Array(weeks).fill(Math.min(start,target))
  const recovery=weeks>=8?Math.max(3,Math.round(weeks*.65)-1):-1
  const out=[]; let prev=start
  for(let i=0;i<weeks;i++){
    if(i===weeks-1){out.push(target);continue}
    if(i===recovery){
      out.push(roundToPool(Math.max(start,prev*.7),form))
      continue
    }
    const progress=i/Math.max(1,weeks-1)
    const desired=start+(target-start)*Math.pow(progress,1.35)
    const maxFactor=prev<400?1.35:prev<800?1.30:1.25
    const maxNext=prev+Math.max(step,roundToPool(prev*(maxFactor-1),form))
    prev=Math.max(prev,Math.min(target,roundToPool(Math.min(desired,maxNext),form)))
    out.push(prev)
  }
  return out
}

export const buildSessionDistanceProgression=form=>{
  const weeks=clamp(Number(form?.weeksUntilGoal||10),6,24)
  const units=clamp(Number(form?.unitsPerWeek||3),2,4)
  const base=Math.max(poolStep(form)*4,roundToPool(form?.currentSessionM||500,form))
  const target=Math.max(0,Number(form?.targetDistanceM||0))
  const recovery=weeks>=8?Math.max(3,Math.round(weeks*.65)-1):-1
  const spreads=units===2?[.95,1.1]:units===3?[.9,1,1.12]:[.88,.96,1.03,1.12]
  return Array.from({length:weeks},(_,i)=>{
    const p=i/Math.max(1,weeks-1)
    let weekBase=roundToPool(base*(1.05+p*.75),form)
    if(i===recovery)weekBase=roundToPool(base*Math.max(.9,(1.05+p*.75)*.72),form)
    return spreads.map(x=>{
      let d=roundToPool(weekBase*x,form)
      const cap=target?Math.max(base*1.9,target*1.2):base*2
      return Math.max(poolStep(form)*4,Math.min(d,roundToPool(cap,form)))
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
    ?`In der letzten Woche genau eine separate Zieleinheit über ${roundToPool(form.targetDistanceM,form)} m am Stück vorsehen.`
    :'Keinen separaten Am-Stück-Zielversuch erzwingen.'
  ]
 }
}

export const validateSwimmingPlan=(plan,form)=>{
  const c=buildSwimmingGeneratorConstraints(form),errors=[],warnings=[]
  const weeks=(plan?.phases||[]).flatMap(p=>p?.weeks||[])
  const step=poolStep(form)
  const allowed=new Set(c.allowedStrokes||[])

  const strokeChecks=[
    ['backstroke',/\b(backstroke|back\s+stroke|back\s+crawl|rückenschwimmen|rueckenschwimmen|rückenkraul|rueckenkraul)\b/i],
    ['butterfly',/\b(butterfly|delfinschwimmen|delphinschwimmen|schmetterlingsschwimmen)\b/i],
    ['breaststroke',/\b(brustschwimmen|breaststroke|breast\s+stroke)\b/i],
    ['freestyle',/\b(kraul(?:schwimmen)?|freestyle|front\s+crawl)\b/i]
  ]

  weeks.forEach((w,wi)=>{
    const days=Array.isArray(w?.days)?w.days:[]
    days.forEach((s,si)=>{
      const total=Number(s?.totalDistanceM||0)
      const parts=[s?.warmupDistanceM,s?.mainDistanceM,s?.techniqueDistanceM,s?.cooldownDistanceM]
        .map(v=>Number(v||0))
      const calculated=parts.reduce((a,b)=>a+b,0)

      if(total>0&&calculated!==total)errors.push(`W${w.n||wi+1} E${si+1}: Teilstrecken stimmen nicht mit ${total} m überein`)
      for(const value of [...parts,s?.longestContinuousM,s?.targetSegmentM]){
        const d=Number(value||0)
        if(d>0&&Math.abs(d/step-Math.round(d/step))>1e-9){
          errors.push(`W${w.n||wi+1} E${si+1}: ${d} m passt nicht zur ${step}-m-Planung`)
        }
      }

      const longest=Number(s?.longestContinuousM||0)
      if(longest>0&&c.continuousByWeek[wi]&&longest>c.continuousByWeek[wi]){
        errors.push(`W${w.n||wi+1} E${si+1}: zusammenhängende Strecke ${longest} m über Wochenlimit ${c.continuousByWeek[wi]} m`)
      }

      const text=[s?.einheit,s?.details,s?.warmup,s?.mainSet,s?.cooldown,s?.techniqueTitle,s?.techniqueInstructions]
        .filter(Boolean).join(' ')
      for(const [stroke,pattern] of strokeChecks){
        if(pattern.test(text)&&!allowed.has(stroke))errors.push(`W${w.n||wi+1} E${si+1}: nicht ausgewählte Schwimmart ${stroke}`)
      }
    })
  })

  if(!weeks.length)warnings.push('Keine Trainingswochen im Format phases → weeks gefunden.')
  return{valid:!errors.length,errors,warnings,constraints:c}
}
