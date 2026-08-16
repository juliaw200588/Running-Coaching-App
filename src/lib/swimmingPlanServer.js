const ANTHROPIC_URL='https://api.anthropic.com/v1/messages'
const MODEL='claude-sonnet-4-5'

const DAY_SCHEMA={
  type:'object',additionalProperties:false,
  properties:{
    tag:{type:'string'},einheit:{type:'string'},details:{type:'string'},optional:{type:'boolean'},
    sport_type:{type:'string'},durationMinutes:{type:'number'},totalDistanceM:{type:'number'},
    intensity:{type:'string'},loadGuidance:{anyOf:[{type:'string'},{type:'null'}]},
    warmup:{anyOf:[{type:'string'},{type:'null'}]},mainSet:{type:'string'},
    cooldown:{anyOf:[{type:'string'},{type:'null'}]},restGuidance:{type:'string'},
    techniqueTitle:{anyOf:[{type:'string'},{type:'null'}]},
    techniqueInstructions:{anyOf:[{type:'string'},{type:'null'}]},
    techniqueDistanceM:{anyOf:[{type:'number'},{type:'null'}]},
    equipment:{type:'array',items:{type:'string'}},
    openWaterTip:{anyOf:[{type:'string'},{type:'null'}]}
  },
  required:['tag','einheit','details','optional','sport_type','durationMinutes','totalDistanceM','intensity','loadGuidance','warmup','mainSet','cooldown','restGuidance','techniqueTitle','techniqueInstructions','techniqueDistanceM','equipment','openWaterTip']
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
const validatePlan=(plan,input)=>{
  if(!plan?.phases?.length)throw new Error('Der Schwimmplan ist unvollständig.')
  plan.sport_type='swimming';plan.plan_type='swimming_endurance'
  const weeks=plan.phases.flatMap(p=>p.weeks||[])
  if(n(input.weeksUntilGoal)&&weeks.length!==n(input.weeksUntilGoal))throw new Error(`Der Schwimmplan enthält ${weeks.length} statt ${input.weeksUntilGoal} Wochen.`)
  const days=new Set(input.preferredDays||[]),tools=new Set(input.equipment||[])
  for(const week of weeks){
    if((week.days||[]).length!==n(input.unitsPerWeek))throw new Error(`Woche ${week.n} enthält nicht die gewählte Anzahl Schwimmeinheiten.`)
    for(const day of week.days||[]){
      day.sport_type='swimming'
      if(days.size&&!days.has(day.tag))throw new Error(`Nicht gewählter Trainingstag in Woche ${week.n}: ${day.tag}`)
      if(!n(day.durationMinutes)||!n(day.totalDistanceM))throw new Error(`Zeit oder Gesamtmeter fehlen in Woche ${week.n}.`)
      if(!day.mainSet||!day.restGuidance)throw new Error(`Serie oder Pausenangabe fehlt in Woche ${week.n}.`)
      if(day.techniqueTitle&&!day.techniqueInstructions)throw new Error(`Technikerklärung fehlt in Woche ${week.n}.`)
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
  const finalLogic=input.goalType==='event'
    ? 'Fester Eventtermin: letzte Phase ist Zielphase mit angemessener Taperung. Event separat in event ausgeben.'
    : input.goalType==='distance'
      ? 'Persönliches Distanzziel ohne Event: keine Wettkampf-Taperphase. Letzte Phase heißt Abschluss; moderat zum persönlichen Distanzversuch hinführen.'
      : 'Allgemeiner Aufbau/Fitness: kein automatischer Taper. Letzte Phase heißt Festigung und führt in weiteres Training.'
  const system=`Du erstellst einen sicheren, konkreten Schwimmtrainingsplan.
1. Genau ${input.unitsPerWeek} Einheiten/Woche ausschließlich an preferredDays; sport_type="swimming".
2. Jede Einheit braucht durationMinutes und totalDistanceM. Die Dauer bestimmt der Plan selbst passend zu Ausgangsniveau, Ziel, Trainingsphase und Einheitenart.
   - Bei 2 Einheiten/Woche: meist eine normale und eine längere Einheit.
   - Bei 3 Einheiten/Woche: meist zwei normale Einheiten und eine längere Einheit.
   - Bei 4 Einheiten/Woche: zusätzliche kurze Technik-/Entlastungseinheit möglich.
   - Anfänger nicht unnötig mit sehr langen Einheiten belasten. Längere Einheiten dürfen sich erst im Verlauf entwickeln.
   - Zeit und Meter müssen zueinander plausibel sein; eine längere Einheit darf typischerweise länger dauern als Technik-/Qualitätseinheiten.
3. Jede Einheit ist direkt ausführbar: warmup, mainSet, cooldown und restGuidance. Pausen sind Pflicht, z.B. "6 × 100 m locker · 30 Sek. Pause".
4. Progression NICHT nur über Meter: Gesamtumfang, längere zusammenhängende Abschnitte, passend reduzierte Pausen und stabile Technik unter Ermüdung.
5. Regenerationswochen trainingslogisch, typischerweise nach 3 Belastungswochen. Nie nur entlasten, weil der Plan endet.
6. Ausgang: ca. ${input.currentSessionM||'unbekannt'} m/Einheit, ${input.currentContinuousM||'unbekannt'} m am Stück. Keine unrealistischen Sprünge.
7. Hauptstil=${input.stroke}; bei mixed Schwerpunkt=${input.mixedPriority}. Andere Lagen nur sinnvoll ergänzend.
8. Technikniveau=${input.techniqueLevel}; Schwerpunkte=${(input.techniqueFocus||[]).join(', ')||'keine besonderen'}. Technik regelmäßig passend zum Niveau einbauen.
9. techniqueTitle kurz; techniqueInstructions vollständig und anfängertauglich: Durchführung, worauf achten, häufige Fehler. UI klappt Details ein.
10. Becken=${input.poolLength}; Serien passend zur Beckenlänge, Distanzen möglichst in 25-m-Schritten.
11. Verfügbare Hilfsmittel=${(input.equipment||[]).join(', ')||'keine'}. NUR diese verwenden; ohne Hilfsmittel muss der Plan funktionieren.
12. Intensität nur einfach: locker, zügig, intensiv aber kontrolliert. Keine RPE-Zahlen; keine HF-Pflicht.
13. Zieltyp=${input.goalType}; Zieldistanz=${target||'keine feste'} m; Ziel am Stück=${input.continuousGoal==='yes'?'ja':'nein/gesamt'}.
14. ${finalLogic}
15. Freiwasserziel=${input.venue||'nein'}, sicherer Zugang=${input.openWaterAccess||'nein'}. Freiwasser nur verlangen, wenn sicher verfügbar. Sighting/Orientierung sonst im Becken vorbereiten.
16. Eigene lange Ziele wie 5.000 m nicht linear hochskalieren; bei knapper Zeit konservativ bleiben.
17. Vier Phasen: Basis, Aufbau, Spezifisch und passend Zielphase/Abschluss/Festigung.
18. details kurz. Serien in warmup/mainSet/cooldown/restGuidance; Technikdetails in techniqueInstructions.
19. Keine internen technischen Begriffe, Modelle, APIs oder Kosten erwähnen.
AUSGABE: ausschließlich das verlangte JSON.`
  const response=await fetch(ANTHROPIC_URL,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({
    model:MODEL,max_tokens:14000,system,output_config:{format:{type:'json_schema',schema:RESPONSE_SCHEMA}},
    messages:[{role:'user',content:`Erstelle den vollständigen Schwimmplan aus diesem Kontext:\n${JSON.stringify(input)}`}]
  })})
  const data=await response.json()
  if(!response.ok)throw new Error(data?.error?.message||`Planservice Fehler ${response.status}`)
  const text=data?.content?.find(x=>x?.type==='text')?.text
  if(!text)throw new Error('Es wurde kein Schwimmplan zurückgegeben.')
  const raw=JSON.parse(text);raw.plan=validatePlan(raw.plan,input);return raw
}
