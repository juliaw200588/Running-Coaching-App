const ANTHROPIC_URL='https://api.anthropic.com/v1/messages'
const MODEL='claude-sonnet-4-5'

const DAY_SCHEMA={
  type:'object',additionalProperties:false,
  properties:{
    tag:{type:'string'},einheit:{type:'string'},details:{type:'string'},optional:{type:'boolean'},
    sport_type:{type:'string'},durationMinutes:{type:'number'},totalDistanceM:{type:'number'},
    intensity:{type:'string'},loadGuidance:{anyOf:[{type:'string'},{type:'null'}]},
    warmup:{type:'string'},warmupDistanceM:{type:'number'},
    mainSet:{type:'string'},mainDistanceM:{type:'number'},
    cooldown:{type:'string'},cooldownDistanceM:{type:'number'},
    restGuidance:{type:'string'},
    longestContinuousM:{anyOf:[{type:'number'},{type:'null'}]},
    targetSegmentM:{anyOf:[{type:'number'},{type:'null'}]},
    techniqueTitle:{anyOf:[{type:'string'},{type:'null'}]},
    techniqueInstructions:{anyOf:[{type:'string'},{type:'null'}]},
    techniqueDistanceM:{anyOf:[{type:'number'},{type:'null'}]},
    equipment:{type:'array',items:{type:'string'}},
    openWaterTip:{anyOf:[{type:'string'},{type:'null'}]}
  },
  required:['tag','einheit','details','optional','sport_type','durationMinutes','totalDistanceM','intensity','loadGuidance','warmup','warmupDistanceM','mainSet','mainDistanceM','cooldown','cooldownDistanceM','restGuidance','longestContinuousM','targetSegmentM','techniqueTitle','techniqueInstructions','techniqueDistanceM','equipment','openWaterTip']
}
const SESSION_SCHEMA={
  type:'object',additionalProperties:false,
  properties:{
    einheit:{type:'string'},details:{type:'string'},optional:{type:'boolean'},
    durationMinutes:{type:'number'},intensity:{type:'string'},loadGuidance:{anyOf:[{type:'string'},{type:'null'}]},
    warmup:{type:'string'},warmupDistanceM:{type:'number'},
    mainSet:{type:'string'},mainDistanceM:{type:'number'},
    cooldown:{type:'string'},cooldownDistanceM:{type:'number'},
    restGuidance:{type:'string'},
    longestContinuousM:{anyOf:[{type:'number'},{type:'null'}]},
    targetSegmentM:{anyOf:[{type:'number'},{type:'null'}]},
    techniqueTitle:{anyOf:[{type:'string'},{type:'null'}]},
    techniqueInstructions:{anyOf:[{type:'string'},{type:'null'}]},
    techniqueDistanceM:{anyOf:[{type:'number'},{type:'null'}]},
    equipment:{type:'array',items:{type:'string'}},
    openWaterTip:{anyOf:[{type:'string'},{type:'null'}]}
  },
  required:[
    'einheit','details','optional','durationMinutes','intensity','loadGuidance',
    'warmup','warmupDistanceM','mainSet','mainDistanceM','cooldown','cooldownDistanceM',
    'restGuidance','longestContinuousM','targetSegmentM','techniqueTitle',
    'techniqueInstructions','techniqueDistanceM','equipment','openWaterTip'
  ]
}

const buildSessionSlots=(input)=>{
  const normalize=v=>{
    const raw=String(v||'').trim().toLowerCase()
    const map={
      mo:'mo',montag:'mo',monday:'mo',mon:'mo',
      di:'di',dienstag:'di',tuesday:'di',tue:'di',
      mi:'mi',mittwoch:'mi',wednesday:'mi',wed:'mi',
      do:'do',donnerstag:'do',thursday:'do',thu:'do',thur:'do',thurs:'do',
      fr:'fr',freitag:'fr',friday:'fr',fri:'fr',
      sa:'sa',samstag:'sa',saturday:'sa',sat:'sa',
      so:'so',sonntag:'so',sunday:'so',sun:'so'
    }
    return map[raw]||null
  }
  const canonical={mo:'Mo',di:'Di',mi:'Mi',do:'Do',fr:'Fr',sa:'Sa',so:'So'}
  const preferred=(input.preferredDays||[]).map(normalize).filter(Boolean)
  const needed=n(input.unitsPerWeek)
  const selected=preferred.slice(0,needed)
  if(selected.length!==needed){
    throw new Error('Es wurden zu wenige gültige Trainingstage ausgewählt.')
  }
  const weeks=n(input.weeksUntilGoal)
  const slots=[]
  for(let week=1;week<=weeks;week++){
    for(const dayKey of selected){
      slots.push({
        key:`w${week}_${dayKey}`,
        week,
        dayKey,
        tag:canonical[dayKey]
      })
    }
  }
  return slots
}

const buildResponseSchema=(slots)=>({
  type:'object',additionalProperties:false,
  properties:{
    meta:{
      type:'object',additionalProperties:false,
      properties:{
        title:{type:'string'},
        goal:{type:'string'},
        name:{type:'string'},
        phases:{
          type:'array',
          items:{
            type:'object',additionalProperties:false,
            properties:{
              id:{type:'string'},label:{type:'string'},sub:{type:'string'},icon:{type:'string'},
              description:{type:'string'},startWeek:{type:'number'},endWeek:{type:'number'},
              accent:{type:'string'},light:{type:'string'},mid:{type:'string'},soft:{type:'string'}
            },
            required:['id','label','sub','icon','description','startWeek','endWeek','accent','light','mid','soft']
          }
        }
      },
      required:['title','goal','name','phases']
    },
    sessions:{
      type:'object',additionalProperties:false,
      properties:Object.fromEntries(slots.map(slot=>[slot.key,SESSION_SCHEMA])),
      required:slots.map(slot=>slot.key)
    }
  },
  required:['meta','sessions']
})

const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0}
const poolMeters=v=>{
  const raw=String(v||'').trim().toLowerCase()
  if(raw==='both'||raw==='beides')return 50
  const m=raw.match(/(\d+(?:[.,]\d+)?)/)
  return m?Number(m[1].replace(',','.')):25
}
const isPoolMultiple=(value,pool)=>!n(value)||Math.abs(n(value)/pool-Math.round(n(value)/pool))<1e-9

const parseMeterNumber=value=>{
  const raw=String(value||'').trim()
  // Deutsche Tausender-Schreibweise wie 1.500 m sauber als 1500 lesen.
  if(/^\d{1,3}(?:\.\d{3})+$/.test(raw))return Number(raw.replace(/\./g,''))
  return Number(raw.replace(',','.'))
}

const extractSwimDistances=text=>{
  const raw=String(text||'')
  const hits=[]
  const re=/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*m\b(?!\s*-\s*(?:bahn|becken))/gi
  let match
  while((match=re.exec(raw))!==null){
    const value=parseMeterNumber(match[1])
    if(Number.isFinite(value)&&value>0)hits.push(value)
  }
  return hits
}

const validateTextDistances=(day,input,weekN)=>{
  const pool=poolMeters(input.poolLength)
  const fields=[
    ['Einschwimmen',day.warmup,n(day.warmupDistanceM)],
    ['Hauptserie',day.mainSet,n(day.mainDistanceM)],
    ['Technik',day.techniqueInstructions,n(day.techniqueDistanceM)],
    ['Ausschwimmen',day.cooldown,n(day.cooldownDistanceM)]
  ]

  for(const [label,text,expected] of fields){
    if(!text||!expected)continue
    const distances=extractSwimDistances(text)
    for(const value of distances){
      if(!isPoolMultiple(value,pool)){
        throw new Error(`Woche ${weekN}: ${label} enthält die nicht bahngenaue Teilstrecke ${value} m für eine ${pool}-m-Bahn.`)
      }
    }
  }
}

const validateSwimmingDay=(day,input,weekN)=>{
  const pool=poolMeters(input.poolLength)
  const technique=n(day.techniqueDistanceM)
  const parts=[
    ['Einschwimmen',n(day.warmupDistanceM)],
    ['Hauptserie',n(day.mainDistanceM)],
    ['Technik',technique],
    ['Ausschwimmen',n(day.cooldownDistanceM)],
  ]

  for(const [label,value] of parts){
    if(value<0)throw new Error(`Woche ${weekN}: ${label} darf keine negative Distanz enthalten.`)
    if(value&&!isPoolMultiple(value,pool))throw new Error(`Woche ${weekN}: ${label} mit ${value} m passt nicht zur ${pool}-m-Bahn.`)
  }

  const minCooldown=pool*2
  if(n(day.cooldownDistanceM)<minCooldown){
    throw new Error(`Woche ${weekN}: Ausschwimmen muss mindestens ${minCooldown} m betragen.`)
  }

  if(n(day.warmupDistanceM)<pool*2){
    throw new Error(`Woche ${weekN}: Einschwimmen muss mindestens ${pool*2} m betragen.`)
  }

  if(!n(day.mainDistanceM)){
    throw new Error(`Woche ${weekN}: Hauptserie hat keine Distanz.`)
  }

  if(n(day.longestContinuousM)&&!isPoolMultiple(day.longestContinuousM,pool)){
    throw new Error(`Woche ${weekN}: längste Teilstrecke ${day.longestContinuousM} m passt nicht zur ${pool}-m-Bahn.`)
  }
  if(n(day.targetSegmentM)&&!isPoolMultiple(day.targetSegmentM,pool)){
    throw new Error(`Woche ${weekN}: Zielstrecke ${day.targetSegmentM} m passt nicht zur ${pool}-m-Bahn.`)
  }

  const calculated=parts.reduce((sum,[,value])=>sum+value,0)
  if(calculated<=0)throw new Error(`Woche ${weekN}: strukturierte Schwimmdistanzen fehlen.`)

  // Single source of truth: Die sichtbare Gesamtdistanz stammt ausschließlich
  // aus den tatsächlich ausführbaren Blöcken.
  day.warmupDistanceM=n(day.warmupDistanceM)
  day.mainDistanceM=n(day.mainDistanceM)
  day.techniqueDistanceM=technique||null
  day.cooldownDistanceM=n(day.cooldownDistanceM)
  day.totalDistanceM=calculated

  if(n(day.longestContinuousM)>calculated){
    throw new Error(`Woche ${weekN}: längste Teilstrecke ist größer als die gesamte Einheit.`)
  }
  if(n(day.targetSegmentM)>calculated){
    throw new Error(`Woche ${weekN}: Zielstrecke ist größer als die gesamte Einheit.`)
  }

  return day
}

const strokePatterns={
  freestyle:[
    /\bkraul(?:en|schwimmen|lage|technik|züge?|zug)?\b/i,
    /\bfreistil(?:schwimmen|lage|technik)?\b/i,
    /\bfreestyle\b/i,
    /\bfront\s+crawl\b/i,
    /\bcrawl\s+stroke\b/i
  ],
  breaststroke:[
    /\bbrustschwimmen\b/i,
    /\bbrust(?:lage|technik|züge?|zug)\b/i,
    /\bbrust\s+schwimmen\b/i,
    /\b\d+(?:[.,]\d+)?\s*m\s+brust\b/i,
    /\bbreaststroke\b/i,
    /\bbreast\s+stroke\b/i
  ],
  backstroke:[
    /\brückenschwimmen\b/i,
    /\brueckenschwimmen\b/i,
    /\brücken(?:lage|technik|züge?|zug)\b/i,
    /\bruecken(?:lage|technik|züge?|zug)\b/i,
    /\brücken\s+schwimmen\b/i,
    /\bruecken\s+schwimmen\b/i,
    /\b\d+(?:[.,]\d+)?\s*m\s+rücken\b/i,
    /\b\d+(?:[.,]\d+)?\s*m\s+ruecken\b/i,
    /\bbackstroke\b/i,
    /\bback\s+stroke\b/i,
    /\bback\s+crawl\b/i,
    /\brückenkraul\b/i,
    /\brueckenkraul\b/i,
    /\brücken(?:beine|kick|kicks)\b/i,
    /\bruecken(?:beine|kick|kicks)\b/i,
    /\brücken[-\s]?züge?\b/i,
    /\bruecken[-\s]?zuege?\b/i
  ],
  butterfly:[
    /\bdelfin(?:schwimmen|lage|technik|züge?|zug)?\b/i,
    /\bschmetterling(?:schwimmen|lage|technik|züge?|zug)?\b/i,
    /\bbutterfly(?:\s+stroke)?\b/i,
    /\bdelfin(?:kick|kicks|beine)\b/i,
    /\bschmetterling(?:kick|kicks|beine)\b/i
  ]
}

const forbiddenStrokeTypes=input=>{
  if(input.stroke==='freestyle')return ['breaststroke','backstroke','butterfly']
  if(input.stroke==='breaststroke')return ['freestyle','backstroke','butterfly']
  return ['backstroke','butterfly']
}


const preferredAllowedStroke=input=>{
  if(input.stroke==='breaststroke')return 'Brust'
  if(input.stroke==='freestyle')return 'Kraul'
  const priority=String(input.mixedPriority||'').toLowerCase()
  return priority.includes('brust')||priority.includes('breast')?'Brust':'Kraul'
}

const replacementPatterns={
  freestyle:[/\bfreestyle\b/gi,/\bfront\s+crawl\b/gi,/\bcrawl\s+stroke\b/gi,/\bkraul(?:schwimmen|lage)?\b/gi,/\bfreistil(?:schwimmen|lage)?\b/gi],
  breaststroke:[/\bbreaststroke\b/gi,/\bbreast\s+stroke\b/gi,/\bbrustschwimmen\b/gi,/\bbrustlage\b/gi,/\bbrust\s+schwimmen\b/gi,/\bbrusttechnik\b/gi],
  backstroke:[/\bbackstroke\b/gi,/\bback\s+stroke\b/gi,/\bback\s+crawl\b/gi,/\brückenschwimmen\b/gi,/\brueckenschwimmen\b/gi,/\brückenlage\b/gi,/\brueckenlage\b/gi,/\brückenkraul\b/gi,/\brueckenkraul\b/gi,/\brücken(?:beine|kick|kicks)\b/gi,/\bruecken(?:beine|kick|kicks)\b/gi,/\brücken[-\s]?züge?\b/gi,/\bruecken[-\s]?zuege?\b/gi,/\brücken\s+schwimmen\b/gi,/\bruecken\s+schwimmen\b/gi],
  butterfly:[/\bbutterfly(?:\s+stroke)?\b/gi,/\bdelfin(?:schwimmen|lage|technik|kick|kicks|beine)?\b/gi,/\bschmetterling(?:schwimmen|lage|technik|kick|kicks|beine)?\b/gi]
}

const replaceForbiddenStrokeNames=(text,input)=>{
  let out=String(text||'')
  const replacement=preferredAllowedStroke(input)
  for(const type of forbiddenStrokeTypes(input)){
    for(const pattern of replacementPatterns[type]||[])out=out.replace(pattern,replacement)
  }
  // Kontextgebundene Kurzformen wie „100 m Rücken“ oder „100 m Brust“.
  if(forbiddenStrokeTypes(input).includes('backstroke')){
    out=out.replace(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*m\s+rücken\b/gi,(_,d)=>`${d} m ${replacement}`)
    out=out.replace(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*m\s+ruecken\b/gi,(_,d)=>`${d} m ${replacement}`)
  }
  if(forbiddenStrokeTypes(input).includes('breaststroke')){
    out=out.replace(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*m\s+brust\b/gi,(_,d)=>`${d} m ${replacement}`)
  }
  return out
}

const genericTechniqueForStroke=input=>{
  const stroke=preferredAllowedStroke(input)
  if(stroke==='Brust')return {
    title:'Brusttechnik sauber halten',
    instructions:'Schwimme die vorgesehenen Technikmeter locker in Brust. Achte auf eine ruhige Gleitphase, symmetrische Arm- und Beinbewegungen und einen entspannten Kopf. Häufiger Fehler: die nächste Bewegung zu früh beginnen und dadurch die Gleitphase verkürzen.'
  }
  return {
    title:'Kraultechnik sauber halten',
    instructions:'Schwimme die vorgesehenen Technikmeter locker in Kraul. Achte auf eine lange Körperlinie, einen ruhigen Kopf und saubere, kontrollierte Züge. Häufiger Fehler: das Tempo erhöhen, obwohl die Technik unsauber wird.'
  }
}

const containsForbiddenStroke=(text,input)=>forbiddenStrokeTypes(input).some(type=>(strokePatterns[type]||[]).some(pattern=>pattern.test(String(text||''))))

const repairForbiddenStrokes=(plan,input)=>{
  if(!plan?.phases?.length)return plan
  for(const phase of plan.phases){
    for(const week of phase.weeks||[]){
      for(const day of week.days||[]){
        // Struktur-/Distanztexte lokal auf eine erlaubte Lage umstellen. Meter bleiben unverändert.
        for(const field of ['einheit','details','warmup','mainSet','cooldown','restGuidance','loadGuidance','openWaterTip']){
          if(day[field]&&containsForbiddenStroke(day[field],input))day[field]=replaceForbiddenStrokeNames(day[field],input)
        }
        // Bei Technik nicht nur einen Lagennamen austauschen: die gesamte Erklärung wird
        // durch einen neutralen, fachlich passenden Hinweis für die erlaubte Lage ersetzt.
        if(containsForbiddenStroke(day.techniqueTitle,input)||containsForbiddenStroke(day.techniqueInstructions,input)){
          const generic=genericTechniqueForStroke(input)
          day.techniqueTitle=generic.title
          day.techniqueInstructions=generic.instructions
        }
      }
    }
  }
  return plan
}

const validateStrokes=(day,input,weekN)=>{
  const text=[day.einheit,day.details,day.warmup,day.mainSet,day.cooldown,day.restGuidance,day.techniqueTitle,day.techniqueInstructions,day.loadGuidance,day.openWaterTip].filter(Boolean).join(' ')
  for(const type of forbiddenStrokeTypes(input)){
    if((strokePatterns[type]||[]).some(pattern=>pattern.test(text))){
      throw new Error(`Woche ${weekN}: Nicht gewählte Schwimmart im Plan (${type}).`)
    }
  }
}


const phaseForWeek=(metaPhases,weekN)=>{
  const phases=(metaPhases||[]).filter(p=>n(p.startWeek)<=weekN&&n(p.endWeek)>=weekN)
  return phases[0]||null
}

const buildDeterministicPlan=(raw,input,slots)=>{
  if(!raw?.meta||!raw?.sessions)throw new Error('Der Schwimmplan ist unvollständig.')
  const weeksCount=n(input.weeksUntilGoal)
  const units=n(input.unitsPerWeek)

  const byWeek=new Map()
  for(let week=1;week<=weeksCount;week++)byWeek.set(week,[])

  for(const slot of slots){
    const session=raw.sessions[slot.key]
    if(!session)throw new Error(`Trainingseinheit ${slot.key} fehlt.`)
    byWeek.get(slot.week).push({
      tag:slot.tag,
      sport_type:'swimming',
      ...session
    })
  }

  const metaPhases=Array.isArray(raw.meta.phases)?raw.meta.phases:[]
  const phaseBuckets=[]
  for(let week=1;week<=weeksCount;week++){
    const phase=phaseForWeek(metaPhases,week)||{
      id:'phase',
      label: input.goalType==='event'?'Zielphase':input.goalType==='distance'?'Abschluss':'Festigung',
      sub:'',
      icon:'',
      description:'',
      accent:'',
      light:'',
      mid:'',
      soft:'',
      startWeek:1,
      endWeek:weeksCount
    }
    let bucket=phaseBuckets.find(x=>x.id===phase.id&&x.label===phase.label)
    if(!bucket){
      bucket={
        id:phase.id,label:phase.label,sub:phase.sub,icon:phase.icon,description:phase.description,
        accent:phase.accent,light:phase.light,mid:phase.mid,soft:phase.soft,weeks:[]
      }
      phaseBuckets.push(bucket)
    }
    bucket.weeks.push({
      n:week,
      dateRange:'',
      regen:false,
      days:byWeek.get(week)
    })
  }

  return {
    title:raw.meta.title,
    goal:raw.meta.goal,
    startDate:input.startDate||'',
    name:raw.meta.name,
    sport_type:'swimming',
    plan_type:'swimming_endurance',
    event:null,
    phases:phaseBuckets
  }
}

const validatePlan=(plan,input)=>{
  if(!plan?.phases?.length)throw new Error('Der Schwimmplan ist unvollständig.')
  plan.sport_type='swimming';plan.plan_type='swimming_endurance'
  const weeks=plan.phases.flatMap(p=>p.weeks||[])
  if(n(input.weeksUntilGoal)&&weeks.length!==n(input.weeksUntilGoal)){
    throw new Error(`Der Schwimmplan enthält ${weeks.length} statt ${input.weeksUntilGoal} Wochen.`)
  }

  const normalizeDay=v=>{
    const s=String(v||'').trim().toLowerCase()
    const patterns=[
      [/\b(mo|montag|monday|mon)\b/,'mo'],
      [/\b(di|dienstag|tuesday|tue)\b/,'di'],
      [/\b(mi|mittwoch|wednesday|wed)\b/,'mi'],
      [/\b(do|donnerstag|thursday|thu|thur|thurs)\b/,'do'],
      [/\b(fr|freitag|friday|fri)\b/,'fr'],
      [/\b(sa|samstag|saturday|sat)\b/,'sa'],
      [/\b(so|sonntag|sunday|sun)\b/,'so']
    ]
    for(const [pattern,key] of patterns){
      if(pattern.test(s))return key
    }
    return null
  }
  const canonicalDayTag={mo:'Mo',di:'Di',mi:'Mi',do:'Do',fr:'Fr',sa:'Sa',so:'So'}

  const days=new Set((input.preferredDays||[]).map(normalizeDay).filter(Boolean))
  const tools=new Set(input.equipment||[])

  for(const week of weeks){
    if((week.days||[]).length!==n(input.unitsPerWeek)){
      throw new Error(`Interner Strukturfehler in Woche ${week.n}.`)
    }

    for(const day of week.days||[]){
      day.sport_type='swimming'
      const normalizedTag=normalizeDay(day.tag)
      if(!normalizedTag){
        throw new Error(`Trainingstag in Woche ${week.n} konnte nicht erkannt werden: ${day.tag}`)
      }
      if(days.size&&!days.has(normalizedTag)){
        throw new Error(`Nicht gewählter Trainingstag in Woche ${week.n}: ${day.tag}`)
      }
      day.tag=canonicalDayTag[normalizedTag]
      if(!n(day.durationMinutes))throw new Error(`Zeit fehlt in Woche ${week.n}.`)
      if(!day.warmup||!n(day.warmupDistanceM))throw new Error(`Einschwimmen fehlt in Woche ${week.n}.`)
      if(!day.mainSet||!n(day.mainDistanceM)||!day.restGuidance)throw new Error(`Serie, Seriendistanz oder Pausenangabe fehlt in Woche ${week.n}.`)
      if(!day.cooldown||!n(day.cooldownDistanceM))throw new Error(`Ausschwimmen fehlt in Woche ${week.n}.`)

      validateSwimmingDay(day,input,week.n)
      validateStrokes(day,input,week.n)

      if(day.techniqueTitle&&!day.techniqueInstructions){
        const generic=genericTechniqueForStroke(input)
        day.techniqueInstructions=generic.instructions
      }
      if(n(day.techniqueDistanceM)&&!day.techniqueTitle){
        const generic=genericTechniqueForStroke(input)
        day.techniqueTitle=generic.title
        if(!day.techniqueInstructions)day.techniqueInstructions=generic.instructions
      }

      day.equipment=(day.equipment||[]).filter(x=>tools.has(x))
      if(input.venue!=='open_water'||input.openWaterAccess==='no')day.openWaterTip=null
    }
  }

  if(input.goalType!=='event')plan.event=null
  return plan
}

export async function generateSwimmingPlan(payload={}){
  const input={...payload}
  const target=n(input.targetDistanceM)
  const pool=poolMeters(input.poolLength)
  const minCooldown=pool*2

  const finalLogic=input.goalType==='event'
    ? 'Fester Eventtermin: letzte Phase ist Zielphase. Vor dem Hauptereignis Belastung sinnvoll reduzieren, ohne die Technikarbeit vollständig zu streichen. Event separat in event ausgeben.'
    : input.goalType==='distance'
      ? 'Persönliches Distanzziel ohne Event: letzte Phase heißt Abschluss. Die vorletzte Belastungsphase enthält den höchsten normalen Trainingsreiz; in der Abschlusswoche zunächst etwas Frische herstellen, dann gezielt vorbereiten und den persönlichen Distanzversuch bzw. die Abschluss-Einheit durchführen.'
      : 'Allgemeiner Aufbau/Fitness: kein automatischer Taper. Letzte Phase heißt Festigung und führt in weiteres Training.'

  const system=`Du erstellst einen sicheren, konkreten Schwimmtrainingsplan.
1. Die Wochen- und Tagesstruktur wird serverseitig festgelegt. Du befüllst ausschließlich die vorgegebenen Session-Slots und darfst KEINEN Slot weglassen, hinzufügen oder umbenennen. Die Zuordnung der Slots zu Woche und Wochentag ist verbindlich.
2. Jede Einheit braucht durationMinutes. Gib warmupDistanceM, mainDistanceM, techniqueDistanceM und cooldownDistanceM strukturiert aus. totalDistanceM muss EXAKT warmupDistanceM + mainDistanceM + techniqueDistanceM + cooldownDistanceM entsprechen. Die Gesamtdistanz darf niemals unabhängig von diesen Blöcken erfunden werden.
3. Baue jede Einheit in dieser Reihenfolge: (a) fachlich sinnvollen Hauptreiz aus Ziel, Niveau und Einheitentyp bestimmen, (b) Einschwimmen fest einplanen, (c) Ausschwimmen fest einplanen, (d) ggf. zusätzliche Technikmeter ergänzen. currentSessionM ist dabei keine harte Obergrenze. Die Gesamteinheit ergibt sich aus allen tatsächlich geschwommenen Blöcken; der Hauptreiz darf nicht künstlich zu kurz werden, nur um exakt auf currentSessionM zu kommen.
4. Jede einzelne Einheit braucht ein echtes Einschwimmen UND ein echtes Ausschwimmen. Bei einer ${pool}-m-Bahn muss Ausschwimmen mindestens ${minCooldown} m betragen. Verwende 25 m Ausschwimmen bei einer 25-m-Bahn NICHT als Resteverwertung. Typisch sind bei kurzen Einheiten 50–100 m, bei längeren Einheiten 100–200 m.
5. Einschwimmen soll ebenfalls ein echter Block sein: bei kürzeren Einheiten meist 100–150 m, bei längeren Einheiten meist 150–200 m, jeweils passend zum Ausgangsniveau. Es darf nicht unter ${pool*2} m liegen.
6. Jede Einheit ist direkt ausführbar: warmup, mainSet, cooldown und restGuidance sind Pflicht. Beschreibe in den Texten exakt dieselben Distanzen, die in den zugehörigen Distanzfeldern stehen.
7. Rechne JEDE Einheit vor Ausgabe intern nach. Beispiel: 150 m Einschwimmen + 750 m Hauptserie + 100 m Technik + 100 m Ausschwimmen = 1100 m gesamt. Wenn die Summe nicht stimmt, korrigiere den bewusst geplanten Block; entferne niemals einfach das Ausschwimmen und kürze den Hauptreiz nicht nur deshalb, um exakt auf currentSessionM zu kommen.
8. Progression NICHT nur über Meter: Gesamtumfang, längere zusammenhängende Abschnitte, passend reduzierte Pausen, Tempowechsel und stabile Technik unter Ermüdung. Keine mechanische lineare Steigerung jeder Einheit.
9. Regenerationswochen trainingslogisch, typischerweise nach 3–4 Belastungswochen. Eine Regenerationswoche muss im Umfang und/oder in der Belastungsdichte tatsächlich leichter sein.
10. Ausgang: ca. ${input.currentSessionM||'unbekannt'} m/Einheit, ${input.currentContinuousM||'unbekannt'} m am Stück. currentSessionM ist eine ungefähre Ausgangsreferenz für die bisher verträgliche Trainingsgröße, KEIN starres Gesamtmeter-Budget. Plane den Hauptreiz fachlich sinnvoll aus Ziel, Niveau und Einheitentyp und ergänze dazu angemessenes Ein-/Ausschwimmen sowie ggf. zusätzliche Technikmeter. Die Gesamteinheit darf deshalb moderat über currentSessionM liegen, solange die Steigerung realistisch bleibt. Keine unrealistischen Sprünge.
11. Schwimmart ist eine HARTE Auswahl: stroke=freestyle bedeutet ausschließlich Kraul/Freistil; stroke=breaststroke bedeutet ausschließlich Brust; stroke=mixed bedeutet ausschließlich Kraul/Freistil und Brust. Rücken, Delfin/Schmetterling und jede andere nicht gewählte Lage sind verboten. Das gilt AUSDRÜCKLICH auch für englische Bezeichnungen und Synonyme in ALLEN Textfeldern: backstroke/back stroke, butterfly, breaststroke/breast stroke, freestyle/front crawl dürfen nur vorkommen, wenn die entsprechende Lage ausgewählt und erlaubt ist. Verwende in den nutzerseitigen Texten bevorzugt die deutschen Bezeichnungen Kraul/Freistil und Brust und füge niemals eine weitere Lage zur Abwechslung, Technik oder Erholung hinzu. Prüfe vor der Ausgabe jedes Textfeld noch einmal auf nicht erlaubte Schwimmarten. Bei mixed Schwerpunkt=${input.mixedPriority}. Die priorisierte Schwimmart soll über eine Einheit bzw. sinnvoll über die Trainingswoche ungefähr 70 % des Schwimmumfangs ausmachen, die andere ungefähr 30 %. Das ist eine fachliche Zielgröße, keine mathematisch starre Quote: praktikable, bahngenaue Teilstrecken haben Vorrang. Bei Anfängern Technikqualität vor aggressiver Umfangssteigerung.
12. Technikniveau=${input.techniqueLevel}; Schwerpunkte=${(input.techniqueFocus||[]).join(', ')||'keine besonderen'}. Technik regelmäßig passend zum Niveau einbauen.
13. techniqueTitle kurz; techniqueInstructions vollständig und anfängertauglich: Durchführung, worauf achten, häufige Fehler. UI klappt Details ein.
14. Becken=${input.poolLength}. JEDE tatsächlich zu schwimmende Teilstrecke und JEDE Unterteilung innerhalb von warmup, mainSet, technique und cooldown muss bahngenau ausführbar sein. Schreibe Tausenderdistanzen bevorzugt ohne Tausenderpunkt (z.B. 1500 m statt 1.500 m), damit Angaben eindeutig bleiben. Formuliere Serien für Nutzer natürlich mit Komma, „danach“, „davon“ oder „je“ statt künstlichen Rechenketten mit Pluszeichen. Die strukturierten Distanzfelder sind die verbindliche Quelle für die Berechnung; Freitext kann zusätzlich Orientierungsangaben enthalten (z.B. „5 m vor der Wand“), die keine eigene Schwimmstrecke darstellen. Bei 25m nur Vielfache von 25 m, bei 50m nur Vielfache von 50 m. Bei "both"/"Beides" ausschließlich Vielfache von 50 m für tatsächlich zu schwimmende Teilstrecken verwenden, damit jede Einheit sowohl im 25-m- als auch im 50-m-Becken funktioniert. Auch gemischte Aufteilungen müssen diese Regel erfüllen.
15. techniqueDistanceM zählt NUR dann zusätzliche Meter, wenn der Technikblock tatsächlich zusätzlich geschwommene Meter enthält. Ist Technik bereits Bestandteil von warmup oder mainSet, setze techniqueDistanceM=null, damit Meter nicht doppelt gezählt werden.
16. Verfügbare Hilfsmittel=${(input.equipment||[]).join(', ')||'keine'}. NUR diese verwenden; ohne Hilfsmittel muss der Plan funktionieren.
17. Intensität nur einfach: locker, zügig, intensiv aber kontrolliert. Keine RPE-Zahlen; keine HF-Pflicht.
18. Zieltyp=${input.goalType}; Zieldistanz=${target||'keine feste'} m; Ziel am Stück=${input.continuousGoal==='yes'?'ja':'nein/gesamt'}.
19. ${finalLogic}
20. Freiwasserziel=${input.venue||'nein'}, sicherer Zugang=${input.openWaterAccess||'nein'}. Freiwasser nur verlangen, wenn sicher verfügbar. Sighting/Orientierung sonst im Becken vorbereiten.
21. Eigene lange Ziele wie 5.000 m nicht linear hochskalieren; bei knapper Zeit konservativ bleiben.
22. Beschreibe in meta.phases vier fachlich passende Phasen mit startWeek/endWeek: Basis, Aufbau, Spezifisch und passend Zielphase/Abschluss/Festigung. Die Wochen selbst werden serverseitig aus den festen Session-Slots zusammengesetzt.
23. details kurz. Serien in warmup/mainSet/cooldown/restGuidance; Technikdetails in techniqueInstructions.
24. longestContinuousM enthält die längste tatsächlich am Stück geschwommene Teilstrecke. Wiederholungen wie 6 × 100 m bedeuten longestContinuousM=100, nicht 600.
25. targetSegmentM nur setzen, wenn eine klar benannte Ziel-/Teststrecke existiert, sonst null.
26. Bei einer Zieleinheit Gesamtumfang und Zielstrecke getrennt behandeln: z.B. 200 m Einschwimmen + 1500 m Zielversuch + 200 m Ausschwimmen = totalDistanceM 1900 und targetSegmentM 1500.
27. Bei einem langen einzelnen Hauptblock keine künstliche Serienpause innerhalb des Blocks formulieren. Stattdessen anschließend angemessen locker erholen und dann ausschwimmen.
28. Bei einem persönlichen Distanzziel soll die Abschlusswoche NICHT einfach die normale lineare Steigerung fortsetzen: zuerst Technik/Frische, dann moderate Aktivierung, dann Abschluss-/Zieleinheit. Bei 2 Einheiten/Woche entsprechend auf zwei sinnvolle Schritte verdichten.
29. Die höchste normale Trainingsbelastung liegt bei Distanzzielen grundsätzlich vor der Abschlusswoche, nicht zufällig in jeder letzten Einheit.
30. Mentale Segmentierung einer langen Zielstrecke ist erlaubt, aber sie darf die Strecke nicht physisch in Teilserien mit Pausen verwandeln, wenn das Ziel "am Stück" lautet.
31. Keine internen technischen Begriffe, Modelle, APIs oder Kosten erwähnen.
AUSGABE: ausschließlich das verlangte JSON.`

  const slots=buildSessionSlots(input)
  const responseSchema=buildResponseSchema(slots)
  const slotContext=slots.map(slot=>({key:slot.key,week:slot.week,tag:slot.tag}))

  const response=await fetch(ANTHROPIC_URL,{method:'POST',headers:{
    'Content-Type':'application/json',
    'x-api-key':process.env.ANTHROPIC_API_KEY,
    'anthropic-version':'2023-06-01'
  },body:JSON.stringify({
    model:MODEL,
    max_tokens:14000,
    system,
    output_config:{format:{type:'json_schema',schema:responseSchema}},
    messages:[{role:'user',content:`Erstelle die Schwimm-Trainingsinhalte für GENAU diese festen Session-Slots. Kein Slot darf fehlen oder zusätzlich entstehen.\nSlots: ${JSON.stringify(slotContext)}\nNutzerdaten: ${JSON.stringify(input)}`}]
  })})

  const data=await response.json()
  if(!response.ok)throw new Error(data?.error?.message||`Planservice Fehler ${response.status}`)
  if(data?.stop_reason==='max_tokens')throw new Error('Der Schwimmplan wurde unvollständig erzeugt. Bitte erneut versuchen.')
  const text=data?.content?.find(x=>x?.type==='text')?.text
  if(!text)throw new Error('Es wurde kein Schwimmplan zurückgegeben.')

  const raw=JSON.parse(text)
  let plan=buildDeterministicPlan(raw,input,slots)
  plan=repairForbiddenStrokes(plan,input)
  plan=validatePlan(plan,input)
  return {plan}
}
