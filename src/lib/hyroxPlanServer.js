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

const n = value => {
  const x = Number(String(value ?? '').replace(',','.'))
  return Number.isFinite(x) ? x : 0
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

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
  currentWeeklyKm:n(body?.currentWeeklyKm),
  strengthSessions:n(body?.strengthSessions),
  startDate:body?.startDate || new Date().toISOString().slice(0,10),
  unitsPerWeek:clamp(Math.round(n(body?.unitsPerWeek) || 4),3,6),
  preferredDays:[...new Set((body?.preferredDays || []).map(normalizeDay))]
    .filter(day => DAY_ORDER[day] != null)
    .sort((a,b) => DAY_ORDER[a] - DAY_ORDER[b]),
  equipment:Array.isArray(body?.equipment) ? body.equipment.map(String) : [],
  limitations:String(body?.limitations || '').slice(0,500),
  weeksUntilGoal:clamp(Math.round(n(body?.weeksUntilGoal) || 12),6,24),
})

const phaseTemplate = weeks => {
  const taper = weeks >= 10 ? 2 : 1
  const remaining = weeks - taper
  const base = Math.max(2, Math.round(remaining * .35))
  const build = Math.max(2, Math.round(remaining * .33))
  const specific = Math.max(1, remaining - base - build)

  const defs = [
    ['basis','Basis','Laufen & Kraft','🌿','Aerobe Grundlage, saubere Bewegungsmuster und robuste Kraftbasis.',base],
    ['aufbau','Aufbau','Kraftausdauer','⚡','Mehr Laufqualität, Stationsvolumen und erste belastete Übergänge.',build],
    ['spezifisch','HYROX-spezifisch','Compromised Running','🔥','Laufen unter Vorermüdung, Race-Stationen und kontrollierte Simulationen.',specific],
    ['taper','Taper','Frische & Schärfe','✨','Belastung reduzieren, Qualität erhalten und frisch ins Event gehen.',taper],
  ]

  let startWeek = 1
  return defs.filter(([, , , , , count]) => count > 0).map(([id,label,sub,icon,description,count]) => {
    const phase = { id,label,sub,icon,description,startWeek,endWeek:startWeek + count - 1 }
    startWeek += count
    return phase
  })
}

const stationAlternative = (station, equipment) => {
  const has = id => equipment.includes(id)

  if (station === 'SkiErg') {
    return has('skiErg') ? 'SkiErg' : has('rower') ? 'Rower als SkiErg-Ersatz' : 'zügiges Bike/Ergometer als Zugausdauer-Ersatz'
  }
  if (station === 'Row') {
    return has('rower') ? 'Rower' : has('skiErg') ? 'SkiErg als Ruder-Ersatz' : 'zügiges Bike/Ergometer'
  }
  if (station === 'Sled Push/Pull') {
    return has('sled') ? 'Sled Push/Pull' : 'schwere Beinarbeit + horizontales Ziehen als Sled-Ersatz'
  }
  if (station === 'Farmers Carry') {
    return has('kettlebells') ? 'Farmers Carry' : 'schweres Tragen mit verfügbaren Gewichten'
  }
  if (station === 'Sandbag Lunges') {
    return has('sandbag') ? 'Sandbag Lunges' : 'Walking Lunges mit Kurzhanteln/Kettlebells'
  }
  if (station === 'Wall Balls') {
    return has('wallBall') ? 'Wall Balls' : 'leichte Thruster als Wall-Ball-Ersatz'
  }
  return station
}

const raceLoadLabel = input => {
  if (input.division === 'pro') return 'Pro-Race-Load'
  return 'Open-Race-Load'
}

const baseDuration = input => input.level === 'beginner' ? 45 : input.level === 'experienced' ? 65 : 55

const sessionDetails = ({ type, phaseId, week, totalWeeks, input }) => {
  const progress = totalWeeks <= 1 ? 1 : (week - 1) / (totalWeeks - 1)
  const duration = baseDuration(input)
  const taperFactor = phaseId === 'taper' ? .7 : 1

  if (type === 'easy') {
    const minutes = Math.round((duration - 10 + progress * 10) * taperFactor)
    return {
      einheit:'Easy Run + Mobility',
      details:`${minutes} Min lockerer Lauf im Gesprächstempo. Danach 8–10 Min Mobility für Sprunggelenk, Hüfte und Brustwirbelsäule.`,
      durationMinutes:minutes + 10,
      intensity:'Locker',
    }
  }

  if (type === 'intervals') {
    const reps = phaseId === 'basis' ? 5 : phaseId === 'aufbau' ? 6 : phaseId === 'spezifisch' ? 5 : 4
    const repMeters = phaseId === 'basis' ? 600 : phaseId === 'aufbau' ? 800 : 1000
    return {
      einheit:'HYROX Run Intervals',
      details:`15 Min einlaufen. ${reps} × ${repMeters} m kontrolliert zügig, dazwischen 2–3 Min locker. Nicht all-out: Ziel ist gleichmäßige Qualität für das spätere 1-km-Race-Format.`,
      durationMinutes:Math.round(duration * taperFactor),
      intensity:'Zügig',
    }
  }

  if (type === 'strength') {
    const sled = stationAlternative('Sled Push/Pull', input.equipment)
    const carry = stationAlternative('Farmers Carry', input.equipment)
    const lunges = stationAlternative('Sandbag Lunges', input.equipment)
    return {
      einheit:'Strength & Stations',
      details:`Ganzkörper-Kraft mit Fokus auf Beine, Zug-/Drückkraft und Rumpf. 3–4 kontrollierte Runden: Kniebeuge-/Hinge-Muster, ${sled}, ${carry}, ${lunges}. Qualität vor maximalem Gewicht.`,
      durationMinutes:Math.round((duration + 5) * taperFactor),
      intensity:'Moderat–kräftig',
    }
  }

  if (type === 'stations') {
    const ski = stationAlternative('SkiErg', input.equipment)
    const row = stationAlternative('Row', input.equipment)
    const wall = stationAlternative('Wall Balls', input.equipment)
    return {
      einheit:'HYROX Stations',
      details:`Technik & Kraftausdauer: ${ski}, Burpee Broad Jumps, ${row}, ${wall}. Arbeite in sauberen Blöcken mit kurzen Pausen. ${raceLoadLabel(input)} dient nur als Orientierung – Trainingslast progressiv und technisch sauber wählen.`,
      durationMinutes:Math.round(duration * taperFactor),
      intensity:'Moderat',
    }
  }

  if (type === 'hybrid') {
    const stations = [
      stationAlternative('SkiErg', input.equipment),
      stationAlternative('Sled Push/Pull', input.equipment),
      stationAlternative('Row', input.equipment),
      stationAlternative('Wall Balls', input.equipment),
    ]
    const rounds = phaseId === 'basis' ? 3 : phaseId === 'aufbau' ? 4 : phaseId === 'spezifisch' ? 5 : 3
    const runM = phaseId === 'basis' ? 600 : phaseId === 'aufbau' ? 800 : 1000
    return {
      einheit:'Compromised Running',
      details:`${rounds} Runden: ${runM} m kontrollierter Lauf + jeweils eine wechselnde Station (${stations.join(', ')}). Fokus: nach der Station schnell wieder in einen ruhigen Laufrhythmus finden.`,
      durationMinutes:Math.round((duration + 10) * taperFactor),
      intensity:'Race-spezifisch',
    }
  }

  if (type === 'simulation') {
    const share = input.raceFormat === 'doubles'
      ? 'Doubles: gemeinsam laufen; Stationsarbeit sinnvoll im Wechsel aufteilen.'
      : 'Single: Stationsarbeit kontrolliert selbst absolvieren.'
    return {
      einheit:'HYROX Simulation',
      details:`Race-nahe Simulation bei etwa ${phaseId === 'taper' ? '35–45' : '55–70'} % des Gesamtumfangs: 1-km-Laufblöcke mit wechselnden Workstations. ${share} Keine Vollgas-Generalprobe – saubere Übergänge und Pacing stehen im Vordergrund.`,
      durationMinutes:Math.round((duration + 20) * taperFactor),
      intensity:'Race-spezifisch',
    }
  }

  return {
    einheit:'Recovery',
    details:'30–40 Min sehr locker bewegen oder vollständiger Ruhetag, je nach Ermüdung.',
    durationMinutes:35,
    intensity:'Sehr locker',
  }
}

const sessionPattern = units => ({
  3:['intervals','strength','hybrid'],
  4:['easy','strength','intervals','hybrid'],
  5:['easy','strength','intervals','stations','hybrid'],
  6:['easy','strength','intervals','easy','stations','hybrid'],
}[units] || ['easy','strength','intervals','hybrid'])

const chooseType = ({ phaseId, weekInPhase, phaseLength, slotIndex, units }) => {
  const pattern = sessionPattern(units)
  let type = pattern[slotIndex] || 'easy'

  if (phaseId === 'spezifisch') {
    if (slotIndex === pattern.length - 1) type = weekInPhase === phaseLength ? 'simulation' : 'hybrid'
    if (units >= 5 && slotIndex === pattern.length - 2) type = 'stations'
  }

  if (phaseId === 'taper') {
    if (slotIndex === pattern.length - 1) type = weekInPhase === 1 ? 'simulation' : 'easy'
    if (type === 'strength') type = 'stations'
  }

  return type
}

const buildPlan = input => {
  if (input.preferredDays.length !== input.unitsPerWeek) {
    throw new Error(`Bitte genau ${input.unitsPerWeek} Trainingstage auswählen.`)
  }

  if (input.goalType === 'event' && !input.eventDate) {
    throw new Error('Für einen HYROX-Wettkampf wird ein Eventdatum benötigt.')
  }

  const totalWeeks = input.weeksUntilGoal
  const phases = phaseTemplate(totalWeeks)

  for (const phase of phases) {
    const weeks = []
    const phaseLength = phase.endWeek - phase.startWeek + 1

    for (let week = phase.startWeek; week <= phase.endWeek; week++) {
      const weekInPhase = week - phase.startWeek + 1
      const regen = phase.id !== 'taper' && week % 4 === 0

      const days = input.preferredDays.map((tag, slotIndex) => {
        let type = chooseType({
          phaseId:phase.id,
          weekInPhase,
          phaseLength,
          slotIndex,
          units:input.unitsPerWeek,
        })

        if (regen && type === 'simulation') type = 'hybrid'
        const session = sessionDetails({
          type,
          phaseId:phase.id,
          week,
          totalWeeks,
          input,
        })

        return {
          tag,
          einheit:session.einheit,
          details:regen
            ? `${session.details} Regenerationswoche: Umfang ca. 20–25 % reduzieren.`
            : session.details,
          durationMinutes:regen
            ? Math.max(30, Math.round(session.durationMinutes * .78))
            : session.durationMinutes,
          intensity:session.intensity,
          optional:false,
          sport_type:'hyrox',
          hyrox_session_type:type,
        }
      })

      weeks.push({
        n:week,
        dateRange:dateRangeForWeek(input.startDate, week),
        regen,
        days,
      })
    }

    phase.weeks = weeks
    phase.dateRange = `${weeks[0]?.dateRange?.split('–')[0] || ''}–${weeks.at(-1)?.dateRange?.split('–')[1] || ''}`
    phase.accent = phase.id === 'basis' ? '#6E9A7B' : phase.id === 'aufbau' ? '#E18A57' : phase.id === 'spezifisch' ? '#D86558' : '#8B7BAA'
    phase.light = '#FFF7F2'
    phase.mid = '#F3E6DE'
    phase.soft = '#FBF7F4'
    delete phase.startWeek
    delete phase.endWeek
  }

  const formatLabel = input.raceFormat === 'doubles' ? 'Doubles' : 'Single'
  const divisionLabel = input.division === 'pro' ? 'Pro' : 'Open'
  const goalText = input.goalType === 'event'
    ? `HYROX ${formatLabel} ${divisionLabel} am ${input.eventDate}`
    : `HYROX-Fitness · ${formatLabel} ${divisionLabel}`

  return {
    title:input.goalType === 'event'
      ? `HYROX ${formatLabel}: Race Ready`
      : 'HYROX: Engine & Strength',
    goal:goalText,
    name:input.name || '',
    startDate:input.startDate,
    goalDate:input.eventDate || null,
    sport_type:'hyrox',
    plan_type:'hyrox',
    weeksUntilRace:totalWeeks,
    unitsPerWeek:input.unitsPerWeek,
    planCaution:input.limitations
      ? `Berücksichtige deine Angabe: ${input.limitations}. Bei Beschwerden Training anpassen und im Zweifel medizinisch/fachlich abklären.`
      : null,
    phases,
    hyroxProfile:{
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
      raceStructure:{
        runs:8,
        runDistanceKm:1,
        stations:[
          '1000 m SkiErg',
          '50 m Sled Push',
          '50 m Sled Pull',
          '80 m Burpee Broad Jumps',
          '1000 m Row',
          '200 m Farmers Carry',
          '100 m Sandbag Lunges',
          '100 Wall Balls',
        ],
      },
    },
  }
}

export const generateHyroxPlan = async body => {
  const input = sanitize(body || {})
  return { plan:buildPlan(input) }
}
