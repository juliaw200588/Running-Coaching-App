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
const RESPONSE_SCHEMA={type:'object',additionalProperties:false,properties:{plan:{type:'object',additionalProperties:false,properties:{
  title:{type:'string'},goal:{type:'string'},startDate:{type:'string'},name:{type:'string'},sport_type:{type:'string'},plan_type:{type:'string'},
  event:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,properties:{date:{type:'string'},distanceM:{type:'number'},venue:{type:'string'},label:{type:'string'}},required:['date','distanceM','venue','label']}]},
  phases:{type:'array',items:{type:'object',additionalProperties:false,properties:{
    id:{type:'string'},label:{type:'string'},sub:{type:'string'},icon:{type:'string'},dateRange:{type:'string'},description:{type:'string'},
    accent:{type:'string'},light:{type:'string'},mid:{type:'string'},soft:{type:'string'},
    weeks:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      n:{type:'number'},dateRange:{type:'string'},regen:{type:'boolean'},days:{type:'array',items:DAY_SCHEMA}
    },required:['n','dateRange','regen','days']}}
  },required:['id','label','sub','icon','dateRange','description','accent','light','mid','soft','weeks']}}
},required:['title','goal','startDate','name','sport_type','plan_type','event','phases']}},required:['plan']}

const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0}
const poolMeters=v=>{
  const m=String(v||'').match(/(\d+(?:[.,]\d+)?)/)
  return m?Number(m[1].replace(',','.')):25
}
const isPoolMultiple=(value,pool)=>!n(value)||Math.abs(n(value)/pool-Math.round(n(value)/pool))<1e-9

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

const validatePlan=(plan,input)=>{
  if(!plan?.phases?.length)throw new Error('Der Schwimmplan ist unvollständig.')
  plan.sport_type='swimming';plan.plan_type='swimming_endurance'
  const weeks=plan.phases.flatMap(p=>p.weeks||[])
  if(n(input.weeksUntilGoal)&&weeks.length!==n(input.weeksUntilGoal)){
    throw new Error(`Der Schwimmplan enthält ${weeks.length} statt ${input.weeksUntilGoal} Wochen.`)
  }

  const normalizeDay=v=>{
    const s=String(v||'').trim().toLowerCase()
    const map={
      'mo':'mo','montag':'mo','monday':'mo',
      'di':'di','dienstag':'di','tuesday':'di',
      'mi':'mi','mittwoch':'mi','wednesday':'mi',
      'do':'do','donnerstag':'do','thursday':'do',
      'fr':'fr','freitag':'fr','friday':'fr',
      'sa':'sa','samstag':'sa','saturday':'sa',
      'so':'so','sonntag':'so','sunday':'so'
    }
    return map[s]||s
  }

  const days=new Set((input.preferredDays||[]).map(normalizeDay))
  const tools=new Set(input.equipment||[])

  for(const week of weeks){
    if((week.days||[]).length!==n(input.unitsPerWeek)){
      throw new Error(`Woche ${week.n} enthält nicht die gewählte Anzahl Schwimmeinheiten.`)
    }

    for(const day of week.days||[]){
      day.sport_type='swimming'
      if(days.size&&!days.has(normalizeDay(day.tag))){
        throw new Error(`Nicht gewählter Trainingstag in Woche ${week.n}: ${day.tag}`)
      }
      if(!n(day.durationMinutes))throw new Error(`Zeit fehlt in Woche ${week.n}.`)
      if(!day.warmup||!n(day.warmupDistanceM))throw new Error(`Einschwimmen fehlt in Woche ${week.n}.`)
      if(!day.mainSet||!n(day.mainDistanceM)||!day.restGuidance)throw new Error(`Serie, Seriendistanz oder Pausenangabe fehlt in Woche ${week.n}.`)
      if(!day.cooldown||!n(day.cooldownDistanceM))throw new Error(`Ausschwimmen fehlt in Woche ${week.n}.`)

      validateSwimmingDay(day,input,week.n)

      if(day.techniqueTitle&&!day.techniqueInstructions){
        throw new Error(`Technikerklärung fehlt in Woche ${week.n}.`)
      }
      if(n(day.techniqueDistanceM)&&!day.techniqueTitle){
        throw new Error(`Woche ${week.n}: Technikdistanz ist vorhanden, aber der Technikblock fehlt.`)
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
1. Genau ${input.unitsPerWeek} Einheiten/Woche ausschließlich an preferredDays; sport_type="swimming".
2. Jede Einheit braucht durationMinutes. Gib warmupDistanceM, mainDistanceM, techniqueDistanceM und cooldownDistanceM strukturiert aus. totalDistanceM muss EXAKT warmupDistanceM + mainDistanceM + techniqueDistanceM + cooldownDistanceM entsprechen. Die Gesamtdistanz darf niemals unabhängig von diesen Blöcken erfunden werden.
3. Baue jede Einheit in dieser Reihenfolge: (a) Einschwimmen fest reservieren, (b) Ausschwimmen fest reservieren, (c) ggf. Technikmeter reservieren, (d) NUR die danach verbleibenden Meter als Hauptserie planen. Hauptserie niemals so groß machen, dass das Ausschwimmen entfällt.
4. Jede einzelne Einheit braucht ein echtes Einschwimmen UND ein echtes Ausschwimmen. Bei einer ${pool}-m-Bahn muss Ausschwimmen mindestens ${minCooldown} m betragen. Verwende 25 m Ausschwimmen bei einer 25-m-Bahn NICHT als Resteverwertung. Typisch sind bei kurzen Einheiten 50–100 m, bei längeren Einheiten 100–200 m.
5. Einschwimmen soll ebenfalls ein echter Block sein: bei kürzeren Einheiten meist 100–150 m, bei längeren Einheiten meist 150–200 m, jeweils passend zum Ausgangsniveau. Es darf nicht unter ${pool*2} m liegen.
6. Jede Einheit ist direkt ausführbar: warmup, mainSet, cooldown und restGuidance sind Pflicht. Beschreibe in den Texten exakt dieselben Distanzen, die in den zugehörigen Distanzfeldern stehen.
7. Rechne JEDE Einheit vor Ausgabe intern nach. Beispiel: 150 m Einschwimmen + 450 m Hauptserie + 50 m Technik + 100 m Ausschwimmen = 750 m gesamt. Wenn die Summe nicht stimmt, ändere die Hauptserie oder einen bewusst geplanten Block; entferne niemals einfach das Ausschwimmen.
8. Progression NICHT nur über Meter: Gesamtumfang, längere zusammenhängende Abschnitte, passend reduzierte Pausen, Tempowechsel und stabile Technik unter Ermüdung. Keine mechanische lineare Steigerung jeder Einheit.
9. Regenerationswochen trainingslogisch, typischerweise nach 3–4 Belastungswochen. Eine Regenerationswoche muss im Umfang und/oder in der Belastungsdichte tatsächlich leichter sein.
10. Ausgang: ca. ${input.currentSessionM||'unbekannt'} m/Einheit, ${input.currentContinuousM||'unbekannt'} m am Stück. Keine unrealistischen Sprünge.
11. Hauptstil=${input.stroke}; bei mixed Schwerpunkt=${input.mixedPriority}. Andere Lagen nur sinnvoll ergänzend. Bei Anfängern Technikqualität vor aggressiver Umfangssteigerung.
12. Technikniveau=${input.techniqueLevel}; Schwerpunkte=${(input.techniqueFocus||[]).join(', ')||'keine besonderen'}. Technik regelmäßig passend zum Niveau einbauen.
13. techniqueTitle kurz; techniqueInstructions vollständig und anfängertauglich: Durchführung, worauf achten, häufige Fehler. UI klappt Details ein.
14. Becken=${input.poolLength}. JEDE schwimmbare Teilstrecke und JEDE Unterteilung innerhalb von warmup, mainSet, technique und cooldown muss ein exaktes Vielfaches der Beckenlänge sein. Bei 25-m-Bahn sind z.B. 140 m oder 60 m verboten. Auch gemischte Aufteilungen müssen bahngenau ausführbar sein.
15. techniqueDistanceM zählt NUR dann zusätzliche Meter, wenn der Technikblock tatsächlich zusätzlich geschwommene Meter enthält. Ist Technik bereits Bestandteil von warmup oder mainSet, setze techniqueDistanceM=null, damit Meter nicht doppelt gezählt werden.
16. Verfügbare Hilfsmittel=${(input.equipment||[]).join(', ')||'keine'}. NUR diese verwenden; ohne Hilfsmittel muss der Plan funktionieren.
17. Intensität nur einfach: locker, zügig, intensiv aber kontrolliert. Keine RPE-Zahlen; keine HF-Pflicht.
18. Zieltyp=${input.goalType}; Zieldistanz=${target||'keine feste'} m; Ziel am Stück=${input.continuousGoal==='yes'?'ja':'nein/gesamt'}.
19. ${finalLogic}
20. Freiwasserziel=${input.venue||'nein'}, sicherer Zugang=${input.openWaterAccess||'nein'}. Freiwasser nur verlangen, wenn sicher verfügbar. Sighting/Orientierung sonst im Becken vorbereiten.
21. Eigene lange Ziele wie 5.000 m nicht linear hochskalieren; bei knapper Zeit konservativ bleiben.
22. Vier Phasen: Basis, Aufbau, Spezifisch und passend Zielphase/Abschluss/Festigung. Die Phasen müssen zur tatsächlichen Plandauer passen; bei kurzen Plänen dürfen Phasen unterschiedlich viele Wochen enthalten.
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

  const response=await fetch(ANTHROPIC_URL,{method:'POST',headers:{
    'Content-Type':'application/json',
    'x-api-key':process.env.ANTHROPIC_API_KEY,
    'anthropic-version':'2023-06-01'
  },body:JSON.stringify({
    model:MODEL,
    max_tokens:14000,
    system,
    output_config:{format:{type:'json_schema',schema:RESPONSE_SCHEMA}},
    messages:[{role:'user',content:`Erstelle den vollständigen Schwimmplan aus diesem Kontext:\n${JSON.stringify(input)}`}]
  })})

  const data=await response.json()
  if(!response.ok)throw new Error(data?.error?.message||`Planservice Fehler ${response.status}`)
  const text=data?.content?.find(x=>x?.type==='text')?.text
  if(!text)throw new Error('Es wurde kein Schwimmplan zurückgegeben.')
  const raw=JSON.parse(text)
  raw.plan=validatePlan(raw.plan,input)
  return raw
}
