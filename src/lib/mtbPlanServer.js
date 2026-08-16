import { buildMtbPlanGuardrails } from './mtbPlanGenerator.js'

const RESPONSE_SCHEMA={
  type:'object',additionalProperties:false,
  properties:{
    title:{type:'string'},goal:{type:'string'},sport_type:{type:'string'},plan_type:{type:'string'},
    startDate:{type:'string'},goalDate:{type:['string','null']},weeksUntilRace:{type:'integer'},unitsPerWeek:{type:'integer'},
    planCaution:{type:['string','null']},
    event:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,properties:{title:{type:'string'},date:{type:['string','null']},distanceKm:{type:['number','null']},elevationM:{type:['number','null']},details:{type:'string'}},required:['title','date','distanceKm','elevationM','details']}]},
    phases:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      id:{type:'string'},label:{type:'string'},sub:{type:'string'},icon:{type:'string'},accent:{type:'string'},description:{type:'string'},
      weeks:{type:'array',items:{type:'object',additionalProperties:false,properties:{
        n:{type:'integer'},regen:{type:'boolean'},
        days:{type:'array',items:{type:'object',additionalProperties:false,properties:{
          tag:{type:'string'},einheit:{type:'string'},details:{type:'string'},
          durationMinutes:{type:['integer','null']},intensity:{type:['string','null']},loadGuidance:{type:['string','null']},
          distanceGuidance:{type:['string','null']},elevationGuidance:{type:['string','null']},
          nutritionTip:{type:['string','null']},strengthPrescription:{type:['string','null']},
          techniqueTitle:{type:['string','null']},techniqueMinutes:{type:['integer','null']},techniqueInstructions:{type:['string','null']},
          optional:{type:'boolean'},sport_type:{type:'string'}
        },required:['tag','einheit','details','durationMinutes','intensity','loadGuidance','distanceGuidance','elevationGuidance','nutritionTip','strengthPrescription','techniqueTitle','techniqueMinutes','techniqueInstructions','optional','sport_type']}}
      },required:['n','regen','days']}}
    },required:['id','label','sub','icon','accent','description','weeks']}}
  },
  required:['title','goal','sport_type','plan_type','startDate','goalDate','weeksUntilRace','unitsPerWeek','planCaution','event','phases']
}

const num=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null}
const normalizeDay=value=>{
  const raw=String(value||'').trim().toLowerCase()
  return {mo:'Mo',montag:'Mo',di:'Di',dienstag:'Di',mi:'Mi',mittwoch:'Mi',do:'Do',donnerstag:'Do',fr:'Fr',freitag:'Fr',sa:'Sa',samstag:'Sa',so:'So',sonntag:'So'}[raw]||value
}

const sanitize=body=>({
  name:String(body?.name||'').slice(0,80),goalType:body?.goalType||'',mtbStyle:body?.mtbStyle||'xc',level:body?.level||'',
  targetDistanceKm:num(body?.targetDistanceKm),targetElevationM:num(body?.targetElevationM),eventDate:body?.eventDate||null,
  tourName:String(body?.tourName||'').slice(0,120),tourTotalKm:num(body?.tourTotalKm),tourDays:num(body?.tourDays),longestStageKm:num(body?.longestStageKm),
  targetTerrain:body?.targetTerrain||'mixed',
  currentFrequency:body?.currentFrequency||'',currentWeeklyHours:num(body?.currentWeeklyHours),longestRecentHours:num(body?.longestRecentHours),longestRecentKm:num(body?.longestRecentKm),
  typicalElevationM:num(body?.typicalElevationM),trainingTerrain:body?.trainingTerrain||'flat',trailAccess:body?.trailAccess||'none',
  technicalLevel:body?.technicalLevel||'beginner',techniquePreference:body?.techniquePreference||'sometimes',
  indoorTrainer:body?.indoorTrainer||'no',strengthTraining:body?.strengthTraining==='yes'?'yes':'no',
  alter:num(body?.alter),maxHF:num(body?.maxHF),ruheHF:num(body?.ruheHF),ftp:num(body?.ftp),
  considerations:String(body?.considerations||'').slice(0,600),
  startDate:body?.startDate||'',weeksUntilGoal:num(body?.weeksUntilGoal),availableWeeks:num(body?.availableWeeks),unitsPerWeek:num(body?.unitsPerWeek),
  preferredDays:Array.isArray(body?.preferredDays)?body.preferredDays.slice(0,7):[],allowAdjacentDays:body?.allowAdjacentDays==='yes'?'yes':'no'
})

const hfContext=input=>{
  if(!input.maxHF)return'Keine verlässliche maximale Herzfrequenz angegeben. Keine HF-Zahlen erfinden.'
  if(input.ruheHF){
    const z=p=>Math.round((input.maxHF-input.ruheHF)*p+input.ruheHF)
    return `HFmax ${input.maxHF}, Ruhe-HF ${input.ruheHF}. Orientierung Herzfrequenzreserve: Zone 2 ca. ${z(.60)}-${z(.70)} bpm, Zone 3 ca. ${z(.70)}-${z(.80)} bpm, Zone 4 ca. ${z(.80)}-${z(.90)} bpm.`
  }
  return `HFmax ${input.maxHF}. Nur grobe Orientierung nach %HFmax; keine Scheingenauigkeit.`
}
const ftpContext=input=>input.ftp?`FTP ${input.ftp} W. Grundlage grob 55-70 %, Tempo/Kraftausdauer je nach Einheit etwa 76-90 %, kurze intensive Belastungen höher. Watt nur passend zum Einheitstyp verwenden.`:'Keine FTP angegeben.'

const flattenWeeks=plan=>(plan?.phases||[]).flatMap(p=>p?.weeks||[])

const validate=(plan,input,g)=>{
  if(!plan||typeof plan!=='object')throw new Error('Planantwort fehlt.')
  const weeks=flattenWeeks(plan)
  if(weeks.length!==Number(g.requestedWeeks))throw new Error(`Plan enthält ${weeks.length} statt ${g.requestedWeeks} Wochen.`)
  weeks.forEach((week,index)=>{
    if(Number(week.n)!==index+1)throw new Error('Wochennummerierung ist nicht vollständig.')
    const required=(week.days||[]).filter(d=>!d.optional)
    if(required.length!==Number(input.unitsPerWeek))throw new Error(`Woche ${week.n} enthält ${required.length} statt ${input.unitsPerWeek} Pflichteinheiten.`)
    for(const day of week.days||[]){
      day.tag=normalizeDay(day.tag);day.sport_type='mountain_biking'
      const back=/back[- ]?to[- ]?back/i.test(String(day.einheit||''))
      const exception=input.allowAdjacentDays==='yes'&&g.backToBack?.appropriate&&back
      if(!input.preferredDays.includes(day.tag)&&!exception)throw new Error(`Woche ${week.n} nutzt den nicht ausgewählten Trainingstag ${day.tag}.`)

      const isStrength=Boolean(day.strengthPrescription)||/kraft|stabilität|strength/i.test(String(day.einheit||''))
      if(isStrength){
        if(input.strengthTraining!=='yes')throw new Error('Plan enthält Krafttraining, obwohl es nicht ausgewählt wurde.')
        day.durationMinutes=day.durationMinutes||30
      }else{
        const duration=Number(day.durationMinutes)
        if(!Number.isFinite(duration)||duration<20)throw new Error(`Woche ${week.n}: Für "${day.einheit}" fehlt eine konkrete Trainingsdauer.`)
        day.durationMinutes=Math.round(duration)
      }

      const hasTechnique=Boolean(day.techniqueTitle||day.techniqueInstructions)
      if(input.techniquePreference==='no'&&hasTechnique)throw new Error('Plan enthält einen Technikblock, obwohl Techniktraining abgewählt wurde.')
      if(hasTechnique){
        if(!day.techniqueTitle||!day.techniqueInstructions||!Number(day.techniqueMinutes))throw new Error(`Woche ${week.n}: Technikblock ist nicht vollständig erklärt.`)
        if(String(day.techniqueInstructions).length<90)throw new Error(`Woche ${week.n}: Technikübung ist zu knapp erklärt.`)
      }

      const text=[day.details,day.loadGuidance,day.distanceGuidance,day.elevationGuidance].join(' ')
      if(/\b\d+(?:[.,]\d+)?\s*km\/h\b/i.test(text))throw new Error(`Woche ${week.n} enthält eine Geschwindigkeitsvorgabe in km/h.`)
    }
  })
  return {...plan,sport_type:'mountain_biking',plan_type:'mtb_endurance',weeksUntilRace:Number(g.requestedWeeks),unitsPerWeek:Number(input.unitsPerWeek),mtbProfile:{...input,guardrails:g}}
}

export async function generateMtbPlan(body={}){
  const input=sanitize(body)
  const guardrails=body?.guardrails||buildMtbPlanGuardrails(input)
  if(!process.env.ANTHROPIC_API_KEY)throw new Error('Planservice ist nicht konfiguriert.')
  if(!input.startDate)throw new Error('Startdatum fehlt.')
  if(!input.unitsPerWeek||input.unitsPerWeek<2)throw new Error('Ungültige Trainingshäufigkeit.')
  if(input.preferredDays.length<input.unitsPerWeek)throw new Error('Zu wenige Trainingstage ausgewählt.')

  const system=`Du bist ein professioneller Mountainbike-Trainer. Erstelle einen sicheren, alltagstauglichen und wirklich MTB-spezifischen Trainingsplan.

NUTZERDATEN:
${JSON.stringify(input)}

FACHLICHE GRENZEN:
${JSON.stringify(guardrails)}

HERZFREQUENZ:
${hfContext(input)}

LEISTUNG:
${ftpContext(input)}

GRUNDPRINZIPIEN:
1. Erzeuge EXAKT ${guardrails.requestedWeeks} Wochen und EXAKT ${input.unitsPerWeek} Pflicht-Trainingseinheiten je Woche.
2. Alle Pflicht-Einheiten grundsätzlich nur an preferredDays. Back-to-back-Ausnahme ausschließlich wenn guardrails.backToBack.appropriate=true.
3. sport_type immer "mountain_biking".
4. Phasen: Basis, Aufbau, Spezifisch, Zielphase. Alle vier verwenden.
5. Entlastungswochen ungefähr alle 3-4 Wochen sinnvoll einbauen.
6. MTB wird primär über ZEIT + BELASTUNG gesteuert. Jede Radeinheit MUSS durationMinutes haben.
7. Niemals km/h als Zielgeschwindigkeit verwenden.
8. Kilometer nur bei langen/zielspezifischen Einheiten als grobe Orientierung. Zeit und Belastung haben Vorrang.
9. Höhenmeter sind Belastungskontext und dürfen bei zielspezifischen langen Einheiten als Orientierung erscheinen. Keine künstlichen Höhenmeter verlangen, wenn sie in der Trainingsumgebung nicht verfügbar sind.
10. Lange Ausfahrt konservativ von guardrails.startLongHours entwickeln; guardrails.peakLongHours nicht unnötig überschreiten.
11. Intensität nutzerverständlich bevorzugt "locker", "zügig", "intensiv". HF/Watt nur ergänzend, wenn Daten vorhanden.
12. XC: Ausdauer, wiederholte Anstiege, kontrollierte Qualität und effizientes Fahren betonen.
13. Trail/All-Mountain: Ausdauer plus Fahrtechnik stärker gewichten; technische Schwierigkeit niemals erzwingen.
14. Touren/Genuss-MTB: lange Belastbarkeit, gleichmäßiges Fahren, Sitzzeit, Anstiege und Tourentauglichkeit priorisieren.

TECHNIK – BESONDERS WICHTIG:
15. Technik nur wenn input.techniquePreference nicht "no".
16. Bei "regular" regelmäßig konkrete Technikblöcke einbauen; bei "sometimes" gezielt gelegentlich.
17. Technikblöcke haben IMMER techniqueTitle, techniqueMinutes und techniqueInstructions.
18. techniqueInstructions muss für einen Anfänger ohne Vorwissen direkt ausführbar sein und enthalten:
    - WO üben: sichere, übersichtliche Fläche bzw. zum Niveau passender bekannter Trail.
    - WAS genau tun: konkrete Schritte.
    - WIE OFT / WIE LANGE: Wiederholungen oder Minuten.
    - WORAUF achten: 1-3 klare Fokuspunkte.
    - ZIEL der Übung.
    - PROGRESSION nur, wenn die einfache Stufe sicher gelingt.
19. Niemals nur "Kurventechnik üben", "Blickführung trainieren" o.ä. schreiben.
20. Sinnvolle Technikbibliothek:
    Anfänger: Grundposition, dosiertes Bremsen, Blickführung, weite Kurven, Gewichtsverlagerung, Anfahren am leichten Anstieg.
    Einfache Trails sicher: Linienwahl, Kurven, kontrolliertes Bremsen vor Kurven, kurze steilere Anstiege, kleine rollbare Hindernisse.
    Erfahren: Linienwahl unter moderater Ermüdung, saubere Kurvenkombinationen, kontrollierte technische Anstiege – aber keine riskanten Features als Pflicht.
21. Keine Sprünge, Drops, steilen technischen Abfahrten oder riskanten Hindernisse als Pflichtaufgabe.
22. Indoor kann niemals Fahrtechnik ersetzen.

GELÄNDE:
23. Zielgelände und verfügbares Trainingsgelände unterscheiden. Bei terrain.mismatch keine Berge erfinden.
24. Wenn keine Trails verfügbar sind, Technik auf sicherer breiter Fläche üben und keine Trail-Einheit voraussetzen.
25. Bei höhenmeterreichem Ziel ohne Berge: vorhandene kurze Anstiege wiederholen, Kraftausdauer entwickeln oder – nur wenn verfügbar – Indoor-Widerstand nutzen.

KRAFT:
26. Nur wenn strengthTraining="yes". Dann 4-5 Übungen mit 2-3 Sätzen und meist 8-12 Wiederholungen, z.B. Split Squats, Step-ups, RDL/Hüftbeuge, Wadenheben, Rumpfstabilität. Nicht bis Muskelversagen.

VERPFLEGUNG – LERNKURVE:
27. Kurze Einheiten nicht mit Ernährungshinweisen überladen.
28. Früh bei längeren Fahrten Essen/Trinken kennenlernen: ab etwa 60-90 Min kleine Kohlenhydratmenge testen und regelmäßig trinken; konkrete Beispiele nennen (Gel, Riegel, Banane).
29. Danach Rhythmus lernen: nicht erst bei Hunger essen; zunächst etwa 30 g KH/h als Orientierung.
30. Mit längeren Einheiten schrittweise etwa 30-40 g KH/h, später bei langen spezifischen Einheiten etwa 40-50 g KH/h testen, sofern verträglich.
31. Beispiele immer als Orientierung; Nährwertangaben der Produkte beachten.
32. Generalprobe mit denselben gut verträglichen Produkten wie am Zieltag. Keine neuen Produkte.
33. Zielwoche: 1-2 Tage vorher normal und ausreichend essen, Kohlenhydrate nicht einschränken, regelmäßig trinken, nichts Ungewohntes testen.
34. Zieltag: früh mit erprobter Verpflegung beginnen und nicht auf Hunger warten.

SICHERHEIT:
35. Technikqualität sinkt unter Ermüdung. Schwierige Technik nicht ans Ende einer maximal erschöpfenden Einheit setzen.
36. Bei knapper Vorbereitungszeit keine aggressiven Belastungssprünge.
37. Keine Diagnosen oder Erfolgsgarantien.
38. Keine internen technischen Begriffe, Modelle, APIs oder Kosten erwähnen.
39. details kurz und konkret; techniqueInstructions darf ausführlicher sein.
40. Event/Tour separat in event ausgeben, nicht als normale Trainingseinheit in phases. Letzte Woche enthält Taper/Vorbereitung.

AUSGABE ausschließlich als strukturiertes JSON gemäß Schema.`

  const response=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({
      model:'claude-sonnet-4-5',max_tokens:16000,system,
      output_config:{format:{type:'json_schema',schema:RESPONSE_SCHEMA}},
      messages:[{role:'user',content:'Erstelle den vollständigen MTB-Trainingsplan aus diesem Kontext:\n'+JSON.stringify({input,guardrails})}]
    })
  })
  const data=await response.json()
  if(!response.ok){console.error('[MTB Plan] Anthropic Fehler:',data);throw new Error(data?.error?.message||`Planservice Fehler ${response.status}`)}
  if(data.stop_reason==='max_tokens')throw new Error('Der Trainingsplan war für die Ausgabe zu umfangreich. Bitte erneut versuchen.')
  const text=data?.content?.find(item=>item?.type==='text')?.text
  if(!text)throw new Error('Es wurde kein Trainingsplan zurückgegeben.')
  const plan=validate(JSON.parse(text),input,guardrails)
  return{plan,meta:{guardrailsVersion:guardrails.version}}
}
