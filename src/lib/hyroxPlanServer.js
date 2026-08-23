const DAY_ORDER = { Mo:0, Di:1, Mi:2, Do:3, Fr:4, Sa:5, So:6 }

const normalizeDay = value => {
  const raw = String(value || '').trim().toLowerCase()
  const map = {
    mo:'Mo', montag:'Mo', monday:'Mo', mon:'Mo',
    di:'Di', dienstag:'Di', tuesday:'Di', tue:'Di',
    mi:'Mi', mittwoch:'Mi', wednesday:'Mi', wed:'Mi',
    do:'Do', donnerstag:'Do', thursday:'Do', thu:'Do',
    fr:'Fr', freitag:'Fr', friday:'Fr', fri:'Fr',
    sa:'Sa', samstag:'Sa', saturday:'Sa', sat:'Sa',
    so:'So', sonntag:'So', sunday:'So', sun:'So',
  }
  return map[raw] || value
}

const num = value => {
  const n = Number(String(value ?? '').replace(',','.'))
  return Number.isFinite(n) ? n : 0
}
const clamp = (value,min,max) => Math.max(min,Math.min(max,value))
const roundLoad = value => Math.max(1, Math.round(value / 2) * 2)

const RACE_LOADS = {
  women_open:{ sledPush:102, sledPull:78, farmersEach:16, lunges:10, wallBall:4 },
  women_pro:{ sledPush:152, sledPull:103, farmersEach:24, lunges:20, wallBall:6 },
  men_open:{ sledPush:152, sledPull:103, farmersEach:24, lunges:20, wallBall:6 },
  men_pro:{ sledPush:202, sledPull:153, farmersEach:32, lunges:30, wallBall:9 },
}

const dateRangeForWeek = (startDate, week) => {
  const start = new Date(`${startDate}T12:00:00`)
  start.setDate(start.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = date => `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}.`
  return `${fmt(start)}–${fmt(end)}`
}

const sanitize = body => ({
  name:String(body?.name || '').slice(0,80),
  goalType:['event','fitness'].includes(body?.goalType) ? body.goalType : 'fitness',
  raceFormat:['single','doubles'].includes(body?.raceFormat) ? body.raceFormat : 'single',
  division:['open','pro'].includes(body?.division) ? body.division : 'open',
  gender:['women','men'].includes(body?.gender) ? body.gender : 'women',
  eventDate:body?.eventDate || null,
  level:['beginner','intermediate','experienced'].includes(body?.level) ? body.level : 'intermediate',
  hyroxExperience:['none','training','race'].includes(body?.hyroxExperience) ? body.hyroxExperience : 'none',
  fiveKTime:String(body?.fiveKTime || '').slice(0,20),
  currentWeeklyKm:num(body?.currentWeeklyKm),
  strengthSessions:num(body?.strengthSessions),
  startDate:body?.startDate || new Date().toISOString().slice(0,10),
  unitsPerWeek:clamp(Math.round(num(body?.unitsPerWeek) || 4),3,6),
  preferredDays:[...new Set((body?.preferredDays || []).map(normalizeDay))]
    .filter(day => DAY_ORDER[day] != null)
    .sort((a,b) => DAY_ORDER[a] - DAY_ORDER[b]),
  equipment:Array.isArray(body?.equipment) ? body.equipment.map(String) : [],
  limitations:String(body?.limitations || '').slice(0,500),
  weeksUntilGoal:clamp(Math.round(num(body?.weeksUntilGoal) || 12),6,24),
  knowsStationLoads:body?.knowsStationLoads === 'yes',
  stationBaselines:{
    sledPushKg:num(body?.stationBaselines?.sledPushKg),
    sledPullKg:num(body?.stationBaselines?.sledPullKg),
    farmersKgEach:num(body?.stationBaselines?.farmersKgEach),
    lungesKg:num(body?.stationBaselines?.lungesKg),
    wallBallKg:num(body?.stationBaselines?.wallBallKg),
    wallBallUnbroken:num(body?.stationBaselines?.wallBallUnbroken),
    ski1000Time:String(body?.stationBaselines?.ski1000Time || '').slice(0,20),
    row1000Time:String(body?.stationBaselines?.row1000Time || '').slice(0,20),
  },
})

const raceLoadsFor = input => RACE_LOADS[`${input.gender}_${input.division}`] || RACE_LOADS.women_open

const has = (input,id) => input.equipment.includes(id)

const startLoad = (known, fallbackRatio, raceLoad) =>
  known > 0 ? Math.min(known, raceLoad) : roundLoad(raceLoad * fallbackRatio)

const loadAtWeek = ({ start, race, week, totalWeeks, taper=false }) => {
  if (taper) return roundLoad(Math.min(race, Math.max(start, race * .75)))
  const progress = clamp((week - 1) / Math.max(1,totalWeeks - 3),0,1)
  return roundLoad(Math.min(race, start + (race - start) * progress))
}

const phaseForWeek = (week,totalWeeks) => {
  const taperWeeks = totalWeeks >= 10 ? 2 : 1
  const specificStart = Math.max(5,totalWeeks - taperWeeks - Math.max(2,Math.round(totalWeeks*.25)) + 1)
  const buildStart = Math.max(3,Math.round(totalWeeks*.35)+1)
  if (week > totalWeeks - taperWeeks) return 'taper'
  if (week >= specificStart) return 'spezifisch'
  if (week >= buildStart) return 'aufbau'
  return 'basis'
}

const phaseMeta = id => ({
  basis:{ label:'Basis', sub:'Technik & Fundament', icon:'🌿', description:'Stationswerte sauber bestimmen, Laufbasis stabilisieren und Bewegungsqualität aufbauen.', accent:'#6E9A7B' },
  aufbau:{ label:'Aufbau', sub:'Kraftausdauer', icon:'⚡', description:'Lasten, Distanzen und Laufqualität progressiv steigern.', accent:'#E18A57' },
  spezifisch:{ label:'HYROX-spezifisch', sub:'Race Skills', icon:'🔥', description:'Race Loads, Compromised Running, Übergänge und Simulationen verbinden.', accent:'#D86558' },
  taper:{ label:'Taper', sub:'Frische & Schärfe', icon:'✨', description:'Umfang reduzieren, Race-Gefühl erhalten und erholt starten.', accent:'#8B7BAA' },
}[id])

const effortHint = `Beim Loggen: „Wie war das Gewicht?“ → Zu leicht · Leicht · Passend · Schwer · Zu schwer. Ziel ist meist „Passend“: fordernd, aber technisch sauber.`

const stationAlternative = (input, station) => {
  if (station === 'sled' && !has(input,'sled')) return 'Kein Sled vorhanden: 4×10 schwere Step-ups je Bein + 4×12 Cable/Band Rows als Ersatz.'
  if (station === 'farmers' && !has(input,'kettlebells')) return 'Kein passendes Carry-Gewicht vorhanden: schweres Tragen mit verfügbaren Kurzhanteln/Gewichten.'
  if (station === 'lunges' && !has(input,'sandbag')) return 'Kein Sandbag vorhanden: Walking Lunges mit Kurzhanteln/Kettlebells.'
  if (station === 'wall' && !has(input,'wallBall')) return 'Kein Wall Ball vorhanden: Thruster mit leichtem Gewicht, gleiche Wiederholungsstruktur.'
  if (station === 'ski' && !has(input,'skiErg')) return has(input,'rower') ? 'SkiErg ersetzen durch Rower mit gleicher Arbeitszeit.' : 'SkiErg ersetzen durch 4×2 Min zügiges Ergometer/Bike.'
  if (station === 'row' && !has(input,'rower')) return has(input,'skiErg') ? 'Rower ersetzen durch SkiErg mit gleicher Arbeitszeit.' : 'Rower ersetzen durch 4×2 Min zügiges Ergometer/Bike.'
  return ''
}

const calibrationText = (input,race) => {
  const known = input.stationBaselines
  const push = known.sledPushKg || roundLoad(race.sledPush*.6)
  const pull = known.sledPullKg || roundLoad(race.sledPull*.6)
  const farmers = known.farmersKgEach || roundLoad(race.farmersEach*.7)
  const lunges = known.lungesKg || roundLoad(race.lunges*.7)
  const wall = known.wallBallKg || race.wallBall

  return `Kalibrierung ohne Maximaltest: Sled Push 4×12,5 m @ ca. ${push} kg gesamt; Sled Pull 4×12,5 m @ ca. ${pull} kg gesamt; Farmers Carry 3×50 m @ ca. ${farmers} kg je Hand; Sandbag Lunges 3×20 m @ ca. ${lunges} kg; Wall Balls 4×10 @ ca. ${wall} kg. Zwischen den Blöcken 90–120 s Pause. Wenn die Technik kippt, Gewicht reduzieren. ${effortHint}`
}

const strengthText = (input,week,totalWeeks,phaseId,race) => {
  const taper = phaseId === 'taper'
  const starts = {
    push:startLoad(input.stationBaselines.sledPushKg,.62,race.sledPush),
    pull:startLoad(input.stationBaselines.sledPullKg,.62,race.sledPull),
    farmers:startLoad(input.stationBaselines.farmersKgEach,.7,race.farmersEach),
    lunges:startLoad(input.stationBaselines.lungesKg,.7,race.lunges),
  }
  const push = loadAtWeek({start:starts.push,race:race.sledPush,week,totalWeeks,taper})
  const pull = loadAtWeek({start:starts.pull,race:race.sledPull,week,totalWeeks,taper})
  const farmers = loadAtWeek({start:starts.farmers,race:race.farmersEach,week,totalWeeks,taper})
  const lunges = loadAtWeek({start:starts.lunges,race:race.lunges,week,totalWeeks,taper})
  const sets = phaseId === 'basis' ? 3 : phaseId === 'aufbau' ? 4 : phaseId === 'spezifisch' ? 3 : 2

  const sledAlt = stationAlternative(input,'sled')
  const farmersAlt = stationAlternative(input,'farmers')
  const lungesAlt = stationAlternative(input,'lunges')

  return `Kraftblock: Goblet/Front Squat ${sets}×8, Romanian Deadlift ${sets}×8, Split Squat ${sets}×8 je Bein. ` +
    (has(input,'sled')
      ? `Danach Sled Push ${sets}×12,5–25 m @ ca. ${push} kg gesamt + Sled Pull ${sets}×12,5–25 m @ ca. ${pull} kg gesamt. `
      : `${sledAlt} `) +
    (has(input,'kettlebells')
      ? `Farmers Carry ${sets}×50 m @ ca. ${farmers} kg je Hand. `
      : `${farmersAlt} `) +
    (has(input,'sandbag')
      ? `Sandbag Lunges ${sets}×20 m @ ca. ${lunges} kg. `
      : `${lungesAlt} `) +
    `90–120 s Satzpause. ${effortHint}`
}

const stationSkillText = (input,week,phaseId,race) => {
  const wallStart = input.stationBaselines.wallBallKg || race.wallBall
  const wall = Math.min(race.wallBall, wallStart)
  const reps = phaseId === 'basis' ? '5×10' : phaseId === 'aufbau' ? '4×15' : '4×20'
  const erg = phaseId === 'basis' ? 500 : phaseId === 'aufbau' ? 750 : 1000
  const ski = has(input,'skiErg') ? `${erg} m SkiErg` : stationAlternative(input,'ski')
  const row = has(input,'rower') ? `${erg} m Row` : stationAlternative(input,'row')
  const wallText = has(input,'wallBall') ? `Wall Balls ${reps} @ ${wall} kg` : stationAlternative(input,'wall')
  return `${ski}; Burpee Broad Jumps ${phaseId === 'basis' ? '4×10 m' : '4×15–20 m'}; ${row}; ${wallText}. 60–90 s Pause zwischen Technikblöcken. Ziel: gleichmäßige Wiederholungen statt Erschöpfung.`
}

const runIntervalsText = (week,phaseId) => {
  const variants = phaseId === 'basis'
    ? [
        '6×400 m zügig, 200 m locker traben',
        '5×600 m kontrolliert zügig, 2 Min locker',
        '4×800 m zügig, 2–3 Min locker',
      ]
    : phaseId === 'aufbau'
      ? [
          '5×800 m zügig, 2 Min locker',
          '4×1000 m kontrolliert, 2–3 Min locker',
          '3×1200 m knapp unter 10-km-Anstrengung, 3 Min locker',
        ]
      : [
          '5×1000 m im angestrebten HYROX-Laufrhythmus, 2 Min locker',
          '4×1000 m im HYROX-Rhythmus + je 10 Wall Balls danach',
          '3×(1000 m + 500 m Erg), 3 Min Serienpause',
        ]
  const item = variants[(week-1)%variants.length]
  return `15 Min einlaufen + Lauf-ABC. ${item}. Danach 10 Min auslaufen. Die schnellen Abschnitte sollen kontrolliert bleiben, nicht all-out.`
}

const hybridText = (input,week,phaseId,race) => {
  const rounds = phaseId === 'basis' ? 3 : phaseId === 'aufbau' ? 4 : phaseId === 'spezifisch' ? 4 : 2
  const run = phaseId === 'basis' ? 600 : phaseId === 'aufbau' ? 800 : 1000
  const rotation = week % 3
  if (rotation === 1) {
    return `${rounds} Runden: ${run} m Run + ${has(input,'skiErg') ? '500 m SkiErg' : stationAlternative(input,'ski')} + 10–15 Wall Balls. 2 Min Serienpause. Fokus: nach der Station ruhig in den Lauf finden.`
  }
  if (rotation === 2) {
    return `${rounds} Runden: ${run} m Run + ${has(input,'rower') ? '500 m Row' : stationAlternative(input,'row')} + 20 m Sandbag Lunges. 2 Min Serienpause. Gleichmäßiges Pacing.`
  }
  return `${rounds} Runden: ${run} m Run + 20 m Burpee Broad Jumps + 50 m Farmers Carry. 2 Min Serienpause. Technik auch unter Vorermüdung sauber halten.`
}

const simulationText = (input,week,totalWeeks,race) => {
  const fraction = week >= totalWeeks-2 ? .7 : .55
  const stations = [
    'SkiErg',
    `Sled Push @ bis zu ${race.sledPush} kg`,
    `Sled Pull @ bis zu ${race.sledPull} kg`,
    'Burpee Broad Jumps',
    'Row',
    `Farmers Carry @ ${race.farmersEach} kg je Hand`,
    `Sandbag Lunges @ ${race.lunges} kg`,
    `Wall Balls @ ${race.wallBall} kg`,
  ]
  const count = fraction >= .7 ? 6 : 4
  const share = input.raceFormat === 'doubles'
    ? 'Doubles: alle Laufblöcke gemeinsam; Stationsarbeit bewusst aufteilen und Wechselstrategie testen.'
    : 'Single: Stationsarbeit selbst absolvieren und bewusst unter Race Load bleiben, wenn die Technik nachlässt.'
  return `${count}× 1 km Run, jeweils gefolgt von einer Race-Station aus: ${stations.slice(0,count).join(' · ')}. ${share} Das ist eine kontrollierte Simulation, keine Vollgas-Generalprobe.`
}

const makeSession = ({type,input,week,totalWeeks,phaseId,race,calibration}) => {
  if (calibration && type === 'strength') return {
    einheit:'HYROX Kalibrierung · Gewichte',
    details:calibrationText(input,race),
    durationMinutes:65,
    intensity:'Kontrolliert',
    hyroxLog:{
      kind:'calibration',
      prompt:'Wie war das Gewicht?',
      choices:['Zu leicht','Leicht','Passend','Schwer','Zu schwer'],
      capture:['weight','completed','effort'],
    },
  }
  if (type === 'easy') return {
    einheit:week % 2 ? 'Easy Run + Mobility' : 'Aerobic Engine',
    details:week % 2
      ? `${40 + Math.min(20,week*2)} Min lockerer Lauf im Gesprächstempo. Danach 10 Min Mobility.`
      : `${35 + Math.min(20,week*2)} Min locker: wahlweise Run oder Ergometer. Alle 8 Min 60 s etwas flotter, sonst entspannt.`,
    durationMinutes:50,
    intensity:'Locker',
  }
  if (type === 'intervals') return {
    einheit:'HYROX Run Quality',
    details:runIntervalsText(week,phaseId),
    durationMinutes:60,
    intensity:'Zügig',
  }
  if (type === 'strength') return {
    einheit:phaseId === 'spezifisch' ? 'Race-Load Strength' : 'Strength & Sled',
    details:strengthText(input,week,totalWeeks,phaseId,race),
    durationMinutes:70,
    intensity:'Kraft',
    hyroxLog:{
      kind:'loads',
      prompt:'Wie war das Gewicht?',
      choices:['Zu leicht','Leicht','Passend','Schwer','Zu schwer'],
      capture:['weight','sets','distance','completed','effort'],
    },
  }
  if (type === 'stations') return {
    einheit:'HYROX Stations & Skills',
    details:stationSkillText(input,week,phaseId,race),
    durationMinutes:60,
    intensity:'Technik/Kraftausdauer',
    hyroxLog:{
      kind:'stations',
      prompt:'Wie anstrengend war die Einheit?',
      choices:['Sehr leicht','Leicht','Passend','Schwer','Zu schwer'],
      capture:['weight','reps','distance','time','completed','effort'],
    },
  }
  if (type === 'hybrid') return {
    einheit:'Compromised Running',
    details:hybridText(input,week,phaseId,race),
    durationMinutes:65,
    intensity:'Race-spezifisch',
  }
  if (type === 'simulation') return {
    einheit:'HYROX Simulation',
    details:simulationText(input,week,totalWeeks,race),
    durationMinutes:85,
    intensity:'Race-spezifisch',
  }
  return { einheit:'Recovery', details:'30–40 Min sehr locker bewegen oder vollständiger Ruhetag.', durationMinutes:35, intensity:'Sehr locker' }
}

const patternFor = (units,phaseId,week,totalWeeks) => {
  const patterns = {
    basis:{
      3:['strength','easy','hybrid'],
      4:['easy','strength','intervals','stations'],
      5:['easy','strength','intervals','stations','hybrid'],
      6:['easy','strength','intervals','easy','stations','hybrid'],
    },
    aufbau:{
      3:['strength','intervals','hybrid'],
      4:['intervals','strength','stations','hybrid'],
      5:['easy','strength','intervals','stations','hybrid'],
      6:['easy','strength','intervals','easy','stations','hybrid'],
    },
    spezifisch:{
      3:['strength','intervals','hybrid'],
      4:['intervals','strength','stations', week % 2 === 0 ? 'simulation' : 'hybrid'],
      5:['easy','strength','intervals','stations', week % 2 === 0 ? 'simulation' : 'hybrid'],
      6:['easy','strength','intervals','easy','stations', week % 2 === 0 ? 'simulation' : 'hybrid'],
    },
    taper:{
      3:['easy','stations','hybrid'],
      4:['easy','intervals','stations','hybrid'],
      5:['easy','strength','intervals','stations','hybrid'],
      6:['easy','strength','intervals','easy','stations','hybrid'],
    },
  }
  return patterns[phaseId]?.[units] || patterns.basis[4]
}

const buildPlan = input => {
  if (input.preferredDays.length !== input.unitsPerWeek) throw new Error(`Bitte genau ${input.unitsPerWeek} Trainingstage auswählen.`)
  if (input.goalType === 'event' && !input.eventDate) throw new Error('Für einen HYROX-Wettkampf wird ein Eventdatum benötigt.')

  const totalWeeks = input.weeksUntilGoal
  const race = raceLoadsFor(input)
  const weeks = []

  for (let week=1; week<=totalWeeks; week++) {
    const phaseId = phaseForWeek(week,totalWeeks)
    const deload = phaseId !== 'taper' && week > 1 && week % 4 === 0
    let pattern = patternFor(input.unitsPerWeek,phaseId,week,totalWeeks)

    // If the user does not know station loads, the first strength slot is explicitly a calibration.
    const needsCalibration = !input.knowsStationLoads && week === 1

    const days = input.preferredDays.map((tag,index) => {
      const type = pattern[index] || 'easy'
      const session = makeSession({
        type,input,week,totalWeeks,phaseId,race,
        calibration:needsCalibration && type === 'strength',
      })
      return {
        tag,
        einheit:session.einheit,
        details:deload ? `${session.details} Deload: Umfang dieser Einheit um ca. 20–25 % reduzieren.` : session.details,
        durationMinutes:deload ? Math.max(30,Math.round(session.durationMinutes*.78)) : session.durationMinutes,
        intensity:session.intensity,
        optional:false,
        sport_type:'hyrox',
        hyrox_session_type:type,
        hyrox_log:session.hyroxLog || null,
      }
    })

    weeks.push({ n:week, dateRange:dateRangeForWeek(input.startDate,week), regen:deload, phaseId, days })
  }

  const phases = []
  for (const week of weeks) {
    let phase = phases.find(p => p.id === week.phaseId)
    if (!phase) {
      const meta = phaseMeta(week.phaseId)
      phase = {
        id:week.phaseId, label:meta.label, sub:meta.sub, icon:meta.icon,
        description:meta.description, accent:meta.accent,
        light:'#FFF7F2', mid:'#F3E6DE', soft:'#FBF7F4', weeks:[],
      }
      phases.push(phase)
    }
    const { phaseId,...cleanWeek } = week
    phase.weeks.push(cleanWeek)
  }
  for (const phase of phases) {
    phase.dateRange = `${phase.weeks[0]?.dateRange?.split('–')[0] || ''}–${phase.weeks.at(-1)?.dateRange?.split('–')[1] || ''}`
  }

  const formatLabel = input.raceFormat === 'doubles' ? 'Doubles' : 'Single'
  const divisionLabel = input.division === 'pro' ? 'Pro' : 'Open'

  return {
    title:input.goalType === 'event' ? `HYROX ${formatLabel}: Race Ready` : 'HYROX: Engine & Strength',
    goal:input.goalType === 'event' ? `HYROX ${formatLabel} ${divisionLabel} am ${input.eventDate}` : `HYROX-Fitness · ${formatLabel} ${divisionLabel}`,
    name:input.name || '',
    startDate:input.startDate,
    goalDate:input.eventDate || null,
    sport_type:'hyrox',
    plan_type:'hyrox',
    weeksUntilRace:totalWeeks,
    unitsPerWeek:input.unitsPerWeek,
    planCaution:input.limitations ? `Berücksichtige deine Angabe: ${input.limitations}. Bei Beschwerden Training anpassen und im Zweifel medizinisch/fachlich abklären.` : null,
    phases,
    hyroxProfile:{
      version:2,
      goalType:input.goalType,
      raceFormat:input.raceFormat,
      division:input.division,
      gender:input.gender,
      level:input.level,
      hyroxExperience:input.hyroxExperience,
      fiveKTime:input.fiveKTime || null,
      currentWeeklyKm:input.currentWeeklyKm || null,
      strengthSessions:input.strengthSessions,
      equipment:input.equipment,
      limitations:input.limitations || null,
      stationBaselines:input.stationBaselines,
      loadFeedback:{
        labels:['Zu leicht','Leicht','Passend','Schwer','Zu schwer'],
        internalMap:{ 'Zu leicht':4, 'Leicht':5.5, 'Passend':7, 'Schwer':8.5, 'Zu schwer':10 },
        rule:'Progression erst nach Log anwenden: Zu leicht/Leicht + vollständig geschafft = kleine Steigerung; Passend = geplante Progression; Schwer = halten; Zu schwer/nicht geschafft = reduzieren.',
      },
      raceLoads:race,
      raceStructure:{
        runs:8, runDistanceKm:1,
        stations:['1000 m SkiErg','50 m Sled Push','50 m Sled Pull','80 m Burpee Broad Jumps','1000 m Row','200 m Farmers Carry','100 m Sandbag Lunges','100 Wall Balls'],
      },
    },
  }
}

export const generateHyroxPlan = async body => {
  const input = sanitize(body || {})
  return { plan:buildPlan(input) }
}
