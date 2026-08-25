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
  // Kurze Pläne brauchen genug Lern-/Aufbauzeit. Bei 8 Wochen:
  // W1–2 Basis, W3–6 Aufbau (W4 Deload), W7 spezifisch, W8 Taper.
  if (totalWeeks <= 8) {
    if (week === totalWeeks) return 'taper'
    if (week === totalWeeks - 1) return 'spezifisch'
    if (week >= 3) return 'aufbau'
    return 'basis'
  }
  const taperWeeks = totalWeeks >= 12 ? 2 : 1
  const specificWeeks = totalWeeks >= 14 ? 3 : 2
  if (week > totalWeeks - taperWeeks) return 'taper'
  if (week > totalWeeks - taperWeeks - specificWeeks) return 'spezifisch'
  if (week >= 3) return 'aufbau'
  return 'basis'
}

const phaseMeta = id => ({
  basis:{ label:'Basis', sub:'Technik & Fundament', icon:'🌿', description:'Stationswerte sauber bestimmen, Laufbasis stabilisieren und Bewegungsqualität aufbauen.', accent:'#6E9A7B' },
  aufbau:{ label:'Aufbau', sub:'Kraftausdauer', icon:'⚡', description:'Lasten, Distanzen und Laufqualität progressiv steigern.', accent:'#E18A57' },
  spezifisch:{ label:'HYROX-spezifisch', sub:'Race Skills', icon:'🔥', description:'Race Loads, Compromised Running, Übergänge und Simulationen verbinden.', accent:'#D86558' },
  taper:{ label:'Taper', sub:'Frische & Schärfe', icon:'✨', description:'Umfang reduzieren, Race-Gefühl erhalten und erholt starten.', accent:'#8B7BAA' },
}[id])

const effortHint = ''

const stationAlternative = (input, station) => {
  if (station === 'sled' && !has(input,'sled')) return 'Kein Sled: schwere Step-ups + Zugübung als Ersatz'
  if (station === 'farmers' && !has(input,'kettlebells')) return 'Farmers Carry mit verfügbaren Kurzhanteln/Gewichten'
  if (station === 'lunges' && !has(input,'sandbag')) return 'Walking Lunges mit Kurzhanteln/Kettlebells'
  if (station === 'wall' && !has(input,'wallBall')) return 'Thruster mit leichtem Gewicht'
  if (station === 'ski' && !has(input,'skiErg')) return has(input,'rower') ? 'Rower mit gleicher Arbeitszeit' : 'Ergometer/Bike'
  if (station === 'row' && !has(input,'rower')) return has(input,'skiErg') ? 'SkiErg mit gleicher Arbeitszeit' : 'Ergometer/Bike'
  return ''
}

const runningProfile = input => {
  const km = input.currentWeeklyKm || 0
  const level = input.level
  if (km < 10 || level === 'beginner') return 'needs_run_base'
  if (km >= 25) return 'run_established'
  return 'balanced'
}

const isHyroxBeginner = input =>
  input.hyroxExperience === 'none' || input.level === 'beginner'

const startsFor = (input,race) => ({
  push:startLoad(input.stationBaselines.sledPushKg,.58,race.sledPush),
  pull:startLoad(input.stationBaselines.sledPullKg,.58,race.sledPull),
  farmers:startLoad(input.stationBaselines.farmersKgEach,.65,race.farmersEach),
  lunges:startLoad(input.stationBaselines.lungesKg,.65,race.lunges),
  wall:input.stationBaselines.wallBallKg || race.wallBall,
})

const currentLoads = (input,race,week,totalWeeks,phaseId) => {
  const s = startsFor(input,race)
  const taper = phaseId === 'taper'
  return {
    push:loadAtWeek({start:s.push,race:race.sledPush,week,totalWeeks,taper}),
    pull:loadAtWeek({start:s.pull,race:race.sledPull,week,totalWeeks,taper}),
    farmers:loadAtWeek({start:s.farmers,race:race.farmersEach,week,totalWeeks,taper}),
    lunges:loadAtWeek({start:s.lunges,race:race.lunges,week,totalWeeks,taper}),
    wall:Math.min(race.wallBall,s.wall),
  }
}

const calibrationA = (input,race) => {
  const l = startsFor(input,race)
  return `Kalibrierung A · Zug, Druck & Tragen. Kein Maximaltest. ` +
    (has(input,'sled')
      ? `Sled Push: 3×12,5 m @ ca. ${l.push} kg gesamt. Sled Pull: 3×12,5 m @ ca. ${l.pull} kg gesamt. `
      : `${stationAlternative(input,'sled')}: 3 kontrollierte Runden. `) +
    (has(input,'kettlebells')
      ? `Farmers Carry: 3×40 m @ ca. ${l.farmers} kg je Hand. `
      : `${stationAlternative(input,'farmers')}: 3×40 m. `) +
    `90–120 s Pause. Nicht bis zum Versagen.`
}

const calibrationB = (input,race) => {
  const l = startsFor(input,race)
  const ski = has(input,'skiErg') ? '3×250 m SkiErg locker bis moderat' : `3×75 s ${stationAlternative(input,'ski')}`
  const row = has(input,'rower') ? '3×250 m Row locker bis moderat' : `3×75 s ${stationAlternative(input,'row')}`
  const lunges = has(input,'sandbag') ? `3×10 m Sandbag Lunges @ ca. ${l.lunges} kg` : `3×10 m ${stationAlternative(input,'lunges')}`
  const wall = has(input,'wallBall') ? `3×8 Wall Balls @ ${l.wall} kg` : `3×8 ${stationAlternative(input,'wall')}`
  return `Kalibrierung B · Technik & Rhythmus. ${ski}; ${row}; ${lunges}; ${wall}. 60–90 s Pause. Ziel: sichere Bewegung und ein reproduzierbarer Ausgangswert, nicht Erschöpfung.`
}

const easyRun = (input,week,phaseId) => {
  const base = runningProfile(input) === 'needs_run_base' ? 32 : 40
  const mins = phaseId === 'taper' ? 30 : Math.min(55, base + week * 2)
  return `${mins} Min lockerer Lauf im Gesprächstempo. Danach 8–10 Min Mobility für Sprunggelenk, Hüfte und Brustwirbelsäule.`
}

const runQuality = (input,week,phaseId) => {
  const beginner = isHyroxBeginner(input)
  const variants = phaseId === 'basis'
    ? (beginner
      ? ['6×2 Min kontrolliert zügig / 2 Min locker','6×400 m zügig / 200 m locker','5×500 m kontrolliert / 2 Min locker']
      : ['6×400 m / 200 m locker','5×600 m / 2 Min locker','4×800 m / 2–3 Min locker'])
    : phaseId === 'aufbau'
      ? ['5×600 m / 2 Min locker','4×800 m / 2 Min locker','4×1000 m / 2–3 Min locker']
      : ['4×1000 m kontrolliert / 2 Min locker','3×1200 m kontrolliert / 3 Min locker','5×800 m etwas flotter / 2 Min locker']
  return `12–15 Min einlaufen + Lauf-ABC. ${variants[(week-1)%variants.length]}. Danach 8–10 Min auslaufen. Kontrolliert, nicht all-out.`
}

const strengthSession = (input,week,totalWeeks,phaseId,race,variant=0) => {
  const l = currentLoads(input,race,week,totalWeeks,phaseId)
  const sets = phaseId === 'basis' ? 3 : phaseId === 'aufbau' ? 4 : phaseId === 'spezifisch' ? 3 : 2

  if (variant % 3 === 0) {
    return `Kraft & Sled · ${sets} Runden Kraftblock: Goblet/Front Squat ${sets}×8; Romanian Deadlift ${sets}×8; Split Squat ${sets}×8 je Bein. ` +
      (has(input,'sled') ? `Sled Push ${sets}×12,5–25 m @ ca. ${l.push} kg; Sled Pull ${sets}×12,5–25 m @ ca. ${l.pull} kg. ` : `${stationAlternative(input,'sled')}. `) +
      `90–120 s Pause.`
  }
  if (variant % 3 === 1) {
    return `Kraftausdauer & Carry · ${sets} Runden: 8 Deadlifts; 8 Step-ups je Bein; ` +
      (has(input,'kettlebells') ? `50 m Farmers Carry @ ca. ${l.farmers} kg je Hand; ` : `${stationAlternative(input,'farmers')}; `) +
      (has(input,'sandbag') ? `20 m Sandbag Lunges @ ca. ${l.lunges} kg. ` : `${stationAlternative(input,'lunges')}. `) +
      `Zwischen den Runden 90 s Pause. Gewicht nur steigern, wenn die Technik sicher bleibt.`
  }
  return `Race-Load Technik · ${sets} kontrollierte Blöcke: ` +
    (has(input,'sled') ? `25 m Sled Push @ ca. ${l.push} kg + 25 m Sled Pull @ ca. ${l.pull} kg; ` : `${stationAlternative(input,'sled')}; `) +
    (has(input,'kettlebells') ? `50 m Farmers Carry @ ca. ${l.farmers} kg je Hand; ` : `${stationAlternative(input,'farmers')}; `) +
    (has(input,'sandbag') ? `20 m Lunges @ ca. ${l.lunges} kg. ` : `${stationAlternative(input,'lunges')}. `) +
    `2 Min Blockpause. Heute Qualität vor Tempo.`
}

const skillSession = (input,week,phaseId,race,variant=0) => {
  const l = currentLoads(input,race,week,Math.max(8,week+4),phaseId)
  const beginner = isHyroxBeginner(input)

  if (phaseId === 'basis' && beginner) {
    const templates = [
      `Learn & Build · 3 Runden, 2 Min Pause: ${has(input,'skiErg')?'200–250 m SkiErg':`60–75 s ${stationAlternative(input,'ski')}`}; 6–8 Burpee Broad Jumps; ${has(input,'wallBall')?`8 Wall Balls @ ${l.wall} kg`:`8 ${stationAlternative(input,'wall')}`}. Alles ruhig und technisch sauber.`,
      `Stationszirkel · 3 Runden, 90 s Pause: ${has(input,'rower')?'250 m Row':`75 s ${stationAlternative(input,'row')}`}; ${has(input,'kettlebells')?`30 m Farmers Carry @ ${l.farmers} kg je Hand`:stationAlternative(input,'farmers')}; ${has(input,'sandbag')?`10 m Lunges @ ${l.lunges} kg`:stationAlternative(input,'lunges')}; 6 Wall Balls/Thruster.`,
      `Skill Session · 4 Technikblöcke: 4×6 Burpee Broad Jumps; ${has(input,'skiErg')?'4×90 s SkiErg':`4×90 s ${stationAlternative(input,'ski')}`}; ${has(input,'wallBall')?`4×8 Wall Balls @ ${l.wall} kg`:`4×8 ${stationAlternative(input,'wall')}`}. 60–90 s Pause; Bewegungsqualität vor Tempo.`,
    ]
    return templates[variant % templates.length]
  }

  const templates = [
    `Mini Circuit · 4 Runden: ${has(input,'skiErg')?'300–400 m SkiErg':`90 s ${stationAlternative(input,'ski')}`}; 10 m Burpee Broad Jumps; ${has(input,'wallBall')?`10–12 Wall Balls @ ${l.wall} kg`:`10–12 ${stationAlternative(input,'wall')}`}. 90 s Pause.`,
    `Grip & Lunge Capacity · 4 Runden: ${has(input,'kettlebells')?`50 m Farmers Carry @ ${l.farmers} kg je Hand`:stationAlternative(input,'farmers')}; ${has(input,'sandbag')?`20 m Lunges @ ${l.lunges} kg`:stationAlternative(input,'lunges')}; ${has(input,'rower')?'300 m Row':`90 s ${stationAlternative(input,'row')}`}. 90 s Pause.`,
    `Erg Engine · 3 Runden: ${has(input,'skiErg')?'500 m SkiErg':`2 Min ${stationAlternative(input,'ski')}`}; 2 Min locker; ${has(input,'rower')?'500 m Row':`2 Min ${stationAlternative(input,'row')}`}; 2 Min locker. Gleichmäßiges Pacing.`,
  ]
  return templates[variant % templates.length]
}

const hybridSession = (input,week,phaseId,race,variant=0) => {
  const run = phaseId === 'basis' ? 400 : phaseId === 'aufbau' ? 600 : 800
  const rounds = phaseId === 'basis' ? 3 : 4
  const l = currentLoads(input,race,week,Math.max(8,week+4),phaseId)
  const templates = [
    `${rounds} Runden: ${run} m Run + ${has(input,'skiErg')?'250–400 m SkiErg':`90 s ${stationAlternative(input,'ski')}`} + ${has(input,'wallBall')?`8–12 Wall Balls @ ${l.wall} kg`:`8–12 ${stationAlternative(input,'wall')}`}. 2 Min Pause. Fokus: ruhig wieder anlaufen.`,
    `${rounds} Runden: ${run} m Run + ${has(input,'rower')?'250–400 m Row':`90 s ${stationAlternative(input,'row')}`} + ${has(input,'sandbag')?`10–20 m Lunges @ ${l.lunges} kg`:stationAlternative(input,'lunges')}. 2 Min Pause.`,
    `${rounds} Runden: ${run} m Run + 10–15 m Burpee Broad Jumps + ${has(input,'kettlebells')?`40–50 m Farmers Carry @ ${l.farmers} kg je Hand`:stationAlternative(input,'farmers')}. 2 Min Pause.`,
  ]
  return templates[variant % templates.length]
}

const simulationSession = (input,week,totalWeeks,race) => {
  const beginner = isHyroxBeginner(input)
  const late = week >= totalWeeks - 2
  const count = beginner ? (late ? 5 : 4) : (late ? 6 : 5)
  const stations = [
    'SkiErg',
    `Sled Push bis ${race.sledPush} kg`,
    `Sled Pull bis ${race.sledPull} kg`,
    'Burpee Broad Jumps',
    'Row',
    `Farmers Carry ${race.farmersEach} kg je Hand`,
    `Sandbag Lunges ${race.lunges} kg`,
    `Wall Balls ${race.wallBall} kg`,
  ]
  const run = beginner ? 750 : 1000
  const share = input.raceFormat === 'doubles'
    ? 'Doubles: Wechsel und Stationsaufteilung bewusst üben.'
    : 'Single: Stationsarbeit selbst absolvieren; Technik hat Vorrang vor Race Load.'
  return `Kontrollierte Teil-Simulation: ${count}× ${run} m Run, jeweils gefolgt von einer Station: ${stations.slice(0,count).join(' · ')}. ${share} Keine Vollgas-Generalprobe.`
}

const station = (id,label,fields) => ({ id,label,fields })
const logStationsFor = (type, calibration, variant=0) => {
  if (calibration === 'A') return [
    station('sled_push','Sled Push',['weight','distance','effort','technique']),
    station('sled_pull','Sled Pull',['weight','distance','effort','technique']),
    station('farmers_carry','Farmers Carry',['weight_each','distance','effort','technique']),
  ]
  if (calibration === 'B') return [
    station('ski_erg','SkiErg',['distance','time','effort','technique']),
    station('row','Row',['distance','time','effort','technique']),
    station('sandbag_lunges','Sandbag Lunges',['weight','distance','effort','technique']),
    station('wall_balls','Wall Balls',['weight','reps','effort','technique']),
  ]
  if (type === 'strength') return variant % 3 === 0
    ? [station('strength','Kraftblock',['sets','effort','technique']),station('sled_push','Sled Push',['weight','distance','effort','technique']),station('sled_pull','Sled Pull',['weight','distance','effort','technique'])]
    : variant % 3 === 1
      ? [station('strength','Kraftblock',['sets','effort','technique']),station('farmers_carry','Farmers Carry',['weight_each','distance','effort','technique']),station('sandbag_lunges','Sandbag Lunges',['weight','distance','effort','technique'])]
      : [station('sled_push','Sled Push',['weight','distance','effort','technique']),station('sled_pull','Sled Pull',['weight','distance','effort','technique']),station('farmers_carry','Farmers Carry',['weight_each','distance','effort','technique']),station('sandbag_lunges','Sandbag Lunges',['weight','distance','effort','technique'])]
  if (type === 'skills') return variant % 3 === 0
    ? [station('ski_erg','SkiErg',['distance','time','effort']),station('burpee_broad_jumps','Burpee Broad Jumps',['distance','reps','effort','technique']),station('wall_balls','Wall Balls',['weight','reps','effort','technique'])]
    : variant % 3 === 1
      ? [station('farmers_carry','Farmers Carry',['weight_each','distance','effort','technique']),station('sandbag_lunges','Sandbag Lunges',['weight','distance','effort','technique']),station('row','Row',['distance','time','effort'])]
      : [station('ski_erg','SkiErg',['distance','time','effort']),station('row','Row',['distance','time','effort'])]
  if (type === 'hybrid') return variant % 3 === 0
    ? [station('run','Laufen',['distance','time','pace','effort']),station('ski_erg','SkiErg',['distance','time','effort']),station('wall_balls','Wall Balls',['weight','reps','effort','technique'])]
    : variant % 3 === 1
      ? [station('run','Laufen',['distance','time','pace','effort']),station('row','Row',['distance','time','effort']),station('sandbag_lunges','Sandbag Lunges',['weight','distance','effort','technique'])]
      : [station('run','Laufen',['distance','time','pace','effort']),station('burpee_broad_jumps','Burpee Broad Jumps',['distance','reps','effort','technique']),station('farmers_carry','Farmers Carry',['weight_each','distance','effort','technique'])]
  if (type === 'simulation') return [station('run','Laufen gesamt',['distance','time','pace','effort']),station('ski_erg','SkiErg',['distance','time','effort']),station('sled_push','Sled Push',['weight','distance','effort','technique']),station('sled_pull','Sled Pull',['weight','distance','effort','technique']),station('burpee_broad_jumps','Burpee Broad Jumps',['distance','effort','technique']),station('row','Row',['distance','time','effort']),station('farmers_carry','Farmers Carry',['weight_each','distance','effort','technique']),station('sandbag_lunges','Sandbag Lunges',['weight','distance','effort','technique']),station('wall_balls','Wall Balls',['weight','reps','effort','technique'])]
  return []
}


const firstNumber = (text, regex) => {
  const match = String(text || '').match(regex)
  if (!match) return null
  const value = Number(String(match[1]).replace(',','.'))
  return Number.isFinite(value) ? value : null
}

const extractHyroxTargets = (details, stations=[]) => {
  const targets = {}

  for (const item of stations || []) {
    if (!item?.id) continue
    const id = item.id
    let target = null

    if (id === 'sled_push') {
      target = {weight:firstNumber(details, /\bSled Push\b[\s\S]{0,80}?(?:@|bis)\s*(?:ca\.\s*)?(\d+(?:[.,]\d+)?)\s*kg/i)}
    } else if (id === 'sled_pull') {
      target = {weight:firstNumber(details, /\bSled Pull\b[\s\S]{0,80}?(?:@|bis)\s*(?:ca\.\s*)?(\d+(?:[.,]\d+)?)\s*kg/i)}
    } else if (id === 'farmers_carry') {
      target = {weight_each:firstNumber(details, /\bFarmers Carry\b[\s\S]{0,90}?@\s*(?:ca\.\s*)?(\d+(?:[.,]\d+)?)\s*kg\s+je\s+Hand/i)}
    } else if (id === 'sandbag_lunges') {
      target = {weight:firstNumber(details, /\b(?:Sandbag\s+)?Lunges\b[\s\S]{0,90}?@\s*(?:ca\.\s*)?(\d+(?:[.,]\d+)?)\s*kg/i)}
    } else if (id === 'wall_balls') {
      target = {weight:firstNumber(details, /\bWall Balls\b[\s\S]{0,70}?@\s*(?:ca\.\s*)?(\d+(?:[.,]\d+)?)\s*kg/i)}
    } else if (id === 'ski_erg') {
      target = {distance:firstNumber(details, /(\d+(?:[.,]\d+)?)\s*m\s+SkiErg\b/i)}
    } else if (id === 'row') {
      target = {distance:firstNumber(details, /(\d+(?:[.,]\d+)?)\s*m\s+(?:Row|Rower)\b/i)}
    } else if (id === 'burpee_broad_jumps') {
      target = {distance:firstNumber(details, /(\d+(?:[.,]\d+)?)\s*m\s+Burpee Broad Jumps\b/i)}
    }

    if (target && Object.values(target).some(value => value != null)) targets[id] = target
  }

  return targets
}



const calibrationAWarmup = {
  title:'10 Min Warm-up · Zug, Druck & Tragen',
  subtitle:'Keine Vorermüdung – Gelenke, Haltung und Bewegungsmuster vorbereiten.',
  steps:[
    {time:'2–3 Min',title:'Locker in Bewegung kommen',text:'Zügig gehen, locker rudern oder Bike. Gesprächstempo.'},
    {time:'2 Min',title:'Mobilisieren',text:'Je 6–8 kontrollierte Wiederholungen für Sprunggelenke, Hüfte, Schultern und Brustwirbelsäule.'},
    {time:'2 Min',title:'Sled Push vorbereiten',text:'1–2 kurze Bahnen mit deutlich weniger Gewicht. Rumpf fest, kurze gleichmäßige Schritte.'},
    {time:'1–2 Min',title:'Sled Pull vorbereiten',text:'1–2 kurze leichte Bahnen. Stabil stehen und kontrolliert ziehen.'},
    {time:'1 Min',title:'Farmers Carry vorbereiten',text:'20–30 m leicht tragen. Aufrecht bleiben, Schultern ruhig, Griff kontrolliert.'},
  ],
  tip:'Du sollst dich danach warm und sicher fühlen, nicht müde. Erst dann beginnt die Kalibrierung.',
}


const makeSession = ({type,input,week,totalWeeks,phaseId,race,calibration,variant=0}) => {
  const commonLog = {
    choices:['Zu leicht','Leicht','Passend','Schwer','Zu schwer'],
    techniquePrompt:'Wie sauber war die Technik?',
    techniqueChoices:['Sicher','Etwas unsicher','Technik schwierig'],
  }

  if (calibration === 'A') return {
    einheit:'HYROX Kalibrierung A',
    details:calibrationA(input,race),
    durationMinutes:60,
    intensity:'Kontrolliert',
    hyroxWarmup:calibrationAWarmup,
    hyroxLog:{kind:'calibration_a',prompt:'Wie war die Einheit?',...commonLog,stations:logStationsFor('skills','A',variant)},
  }
  if (calibration === 'B') return {
    einheit:'HYROX Kalibrierung B',
    details:calibrationB(input,race), durationMinutes:55, intensity:'Technik',
    hyroxLog:{kind:'calibration_b',prompt:'Wie war die Einheit?',...commonLog,stations:logStationsFor('skills','B',variant)},
  }
  if (type === 'easy') return { einheit:phaseId === 'taper' ? 'Easy Run + Strides' : 'Easy Run + Mobility', details:phaseId === 'taper' ? '25–30 Min sehr locker. Danach 4×20 s lockere Steigerungen mit vollständiger Erholung. Frisch aufhören.' : easyRun(input,week,phaseId), durationMinutes:phaseId === 'taper' ? 35 : 50, intensity:'Locker' }
  if (type === 'run_quality') return { einheit:'Run Quality', details:runQuality(input,week,phaseId), durationMinutes:58, intensity:'Zügig' }
  if (type === 'strength') return {
    einheit:phaseId === 'taper' ? 'Strength Primer' : phaseId === 'spezifisch' ? 'Race-Load Strength' : 'Strength & Stations',
    details:phaseId === 'taper' ? 'Strength Primer · 2 lockere Runden: 6 Squats, 6 Romanian Deadlifts, 10–15 m Sled Push/Pull oder Ersatz. Ca. 60–70 % der zuletzt gut kontrollierten Last. Keine Ermüdung erzeugen.' : strengthSession(input,week,totalWeeks,phaseId,race,variant), durationMinutes:phaseId === 'taper' ? 40 : 65, intensity:phaseId === 'taper' ? 'Aktivierung' : 'Kraft',
    hyroxLog:{kind:'loads',prompt:'Wie war die Einheit?',...commonLog,stations:logStationsFor('strength',null,variant)},
  }
  if (type === 'skills') return {
    einheit:phaseId === 'taper' ? 'Stations Primer' : phaseId === 'basis' && isHyroxBeginner(input) ? 'Learn & Build' : 'HYROX Skills & Circuit',
    details:phaseId === 'taper' ? 'Stationsaktivierung · 2 lockere Technikrunden: 200 m SkiErg oder Row, 6 Burpee Broad Jumps, 6–8 Wall Balls. Viel Pause, Bewegungen scharf halten.' : skillSession(input,week,phaseId,race,variant), durationMinutes:phaseId === 'taper' ? 35 : 55, intensity:phaseId === 'taper' ? 'Technik locker' : 'Technik/Kraftausdauer',
    hyroxLog:{kind:'stations',prompt:'Wie war die Einheit?',...commonLog,stations:logStationsFor('skills',null,variant)},
  }
  if (type === 'hybrid') return { einheit:phaseId === 'taper' ? 'Race Primer' : 'Run + Stations', details:phaseId === 'taper' ? 'Kurzer Race Primer: 2 Runden: 400 m lockerer Run + 200 m Erg + 6 Wall Balls/Thruster. Lange Pausen, frisch aufhören.' : hybridSession(input,week,phaseId,race,variant), durationMinutes:phaseId === 'taper' ? 35 : 62, intensity:phaseId === 'taper' ? 'Locker-spritzig' : 'HYROX-spezifisch', hyroxLog:{kind:'hybrid',prompt:'Wie war die Einheit?',...commonLog,stations:logStationsFor('hybrid',null,variant)} }
  if (type === 'simulation') return { einheit:'HYROX Teil-Simulation', details:simulationSession(input,week,totalWeeks,race), durationMinutes:80, intensity:'Race-spezifisch', hyroxLog:{kind:'simulation',prompt:'Wie war die Simulation?',...commonLog,stations:logStationsFor('simulation',null,variant)} }
  return { einheit:'Recovery', details:'30–40 Min sehr locker bewegen oder vollständiger Ruhetag.', durationMinutes:35, intensity:'Sehr locker' }
}

const patternFor = (input,phaseId,week,totalWeeks) => {
  const units = input.unitsPerWeek
  const run = runningProfile(input)
  const beginner = isHyroxBeginner(input)
  const simulation = phaseId === 'spezifisch' && (week % 2 === 0 || week === totalWeeks - 1) ? 'simulation' : 'hybrid'

  // Bei vier Tagen standardmäßig nur ein reiner Lauftag.
  // Ein zweiter Laufreiz kommt nur bei klar schwacher Laufbasis hinzu.
  if (units === 4) {
    if (phaseId === 'basis') {
      return run === 'needs_run_base'
        ? ['easy','strength','run_quality','skills']
        : ['easy','strength','skills','hybrid']
    }
    if (phaseId === 'aufbau') {
      if (run === 'needs_run_base') return ['easy','strength','run_quality','hybrid']
      // Bei solider, aber noch ausbaufähiger Laufbasis etwa jede zweite Woche
      // einen Qualitätslauf statt einer separaten Skill-Einheit einstreuen.
      if (run === 'balanced' && week % 2 === 1) return ['easy','strength','run_quality','hybrid']
      return ['easy','strength','skills','hybrid']
    }
    if (phaseId === 'spezifisch') return ['easy','strength','skills',simulation]
    if (phaseId === 'taper') return ['easy','strength','skills','hybrid']
    return ['easy','strength','skills','hybrid']
  }

  if (units === 3) {
    if (phaseId === 'basis' && beginner) return ['easy','strength','skills']
    return ['strength','skills',phaseId === 'spezifisch' ? simulation : 'hybrid']
  }

  if (units === 5) {
    if (phaseId === 'basis') return ['easy','strength','skills','run_quality','hybrid']
    return ['easy','strength','run_quality','skills',phaseId === 'spezifisch' ? simulation : 'hybrid']
  }

  // 6 Einheiten: zwei Laufreize sind sinnvoll, weil genug Platz für drei HYROX/Kraft-Reize bleibt.
  return ['easy','strength','skills','run_quality','strength',phaseId === 'spezifisch' ? simulation : 'hybrid']
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
    let pattern = patternFor(input,phaseId,week,totalWeeks)

    // Unbekannte Stationswerte werden in Woche 1 auf zwei kontrollierte Einheiten verteilt.
    const needsCalibration = !input.knowsStationLoads && week === 1
    if (needsCalibration) {
      const nonEasy = pattern.map((type,index) => ({type,index})).filter(x => x.type !== 'easy')
      if (nonEasy[0]) pattern[nonEasy[0].index] = 'calibration_a'
      if (nonEasy[1]) pattern[nonEasy[1].index] = 'calibration_b'
    }

    const days = input.preferredDays.map((tag,index) => {
      const type = pattern[index] || 'easy'
      const calibration = type === 'calibration_a' ? 'A' : type === 'calibration_b' ? 'B' : null
      const session = makeSession({
        type: calibration ? 'skills' : type,input,week,totalWeeks,phaseId,race,
        calibration,
        variant:(week + index) % 3,
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
        hyrox_warmup:session.hyroxWarmup || null,
        hyrox_targets:session.hyroxLog?.stations?.length
          ? extractHyroxTargets(session.details, session.hyroxLog.stations)
          : {},
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
      version:2.5,
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
        rule:'Progression erst nach Log anwenden. Technik hat Vorrang: Bei Technik schwierig niemals steigern. Zu leicht/Leicht + sicher + vollständig = kleine Steigerung; Passend + sicher = geplante Progression; Schwer = halten; Zu schwer/nicht geschafft = reduzieren.',
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
