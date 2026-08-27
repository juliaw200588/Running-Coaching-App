const parseJson = value => {
  if (value == null || value === '') return null
  if (Array.isArray(value) || typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const numeric = value => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const match = String(value)
    .replace(',', '.')
    .match(/-?\d+(?:\.\d+)?/)

  if (!match) return null
  const number = Number(match[0])
  return Number.isFinite(number) ? number : null
}

export const paceToSeconds = value => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const text = String(value).trim()
  const match = text.match(/(\d{1,2}):(\d{2})/)

  if (!match) return null

  return Number(match[1]) * 60 + Number(match[2])
}

export const secondsToPace = value => {
  const seconds = numeric(value)
  if (seconds == null || seconds <= 0) return null

  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

const avg = values => {
  const clean = values.filter(value => Number.isFinite(value))
  if (!clean.length) return null
  return clean.reduce((sum, value) => sum + value, 0) / clean.length
}

const stdDev = values => {
  const clean = values.filter(value => Number.isFinite(value))
  if (clean.length < 2) return null
  const mean = avg(clean)
  return Math.sqrt(
    clean.reduce((sum, value) => sum + ((value - mean) ** 2), 0) /
      clean.length
  )
}

const percentChange = (from, to) => {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null
  return ((to - from) / from) * 100
}

const dateValue = value => {
  if (!value) return null
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? null : date
}

const germanWeekday = value => {
  const date = dateValue(value)
  if (!date) return null

  return [
    'Sonntag',
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
  ][date.getDay()]
}

const diffDays = (a, b) => {
  const da = dateValue(a)
  const db = dateValue(b)
  if (!da || !db) return null
  return Math.round((db - da) / 86400000)
}

const normalizeWorkoutType = value => {
  const text = String(value || '').toLowerCase()

  if (/intervall|interval|wiederholung|repetition/.test(text)) return 'interval'
  if (/tempo|schwelle|threshold|treshold|zügig/.test(text)) return 'tempo'
  if (/long|lang(?:er|e)?\s*lauf|dauerlauf lang|lange\s*(wanderung|tour)|vorermüdungs-wanderung|entlastungs-wanderung/.test(text)) return 'long_run'
  if (/regeneration|recovery|locker|easy|zone\s*1/.test(text)) return 'easy'
  if (/zone\s*2|grundlage|ga1/.test(text)) return 'zone2'
  if (/progressiv|progression/.test(text)) return 'progression'
  if (/berg|hill|zielspezifisch|anstieg|trepp|steigung/.test(text)) return 'hills'
  if (/wettkampf|race|halbmarathon|marathon|10\s*km|5\s*km/.test(text)) return 'race'

  return 'other'
}

const normalizeSplit = split => {
  if (!split || typeof split !== 'object') return null

  const distanceMeters = numeric(
    split.distanzM ??
    split.distanceMeters ??
    split.distance_meters ??
    split.distance
  )

  const durationSeconds = numeric(
    split.dauerSek ??
    split.durationSeconds ??
    split.duration_seconds ??
    split.duration
  )

  let paceSeconds = paceToSeconds(split.pace)

  if (
    paceSeconds == null &&
    distanceMeters &&
    durationSeconds &&
    distanceMeters > 0
  ) {
    paceSeconds = durationSeconds / (distanceMeters / 1000)
  }

  return {
    index: numeric(split.km ?? split.index) ?? null,
    distanceMeters,
    durationSeconds,
    paceSeconds,
    avgHr: numeric(
      split.hfAvg ??
      split.avgHeartRate ??
      split.averageHeartRate ??
      split.avg_hr
    ),
    maxHr: numeric(
      split.hfMax ??
      split.maxHeartRate ??
      split.maximumHeartRate ??
      split.max_hr
    ),
    cadence: numeric(
      split.cadenceAvg ??
      split.avgCadence ??
      split.averageCadence
    ),
    ascentMeters: numeric(
      split.hoehenmeter ??
      split.ascentMeters ??
      split.elevationGain
    ),
  }
}

const normalizeSegment = segment => {
  if (!segment || typeof segment !== 'object') return null

  const distanceMeters = numeric(
    segment.distanceMeters ??
    segment.distanzM ??
    segment.distance_meters ??
    segment.distance
  )

  const durationSeconds = numeric(
    segment.durationSeconds ??
    segment.dauerSek ??
    segment.duration_seconds ??
    segment.duration
  )

  let paceSeconds = paceToSeconds(segment.pace)

  if (
    paceSeconds == null &&
    distanceMeters &&
    durationSeconds &&
    distanceMeters > 0
  ) {
    paceSeconds = durationSeconds / (distanceMeters / 1000)
  }

  const label =
    segment.label ??
    segment.name ??
    segment.phaseName ??
    segment.phase_name ??
    segment.type ??
    null

  return {
    index: numeric(segment.index) ?? null,
    label: label ? String(label) : null,
    distanceMeters,
    durationSeconds,
    paceSeconds,
    avgHr: numeric(
      segment.avgHeartRate ??
      segment.hfAvg ??
      segment.averageHeartRate
    ),
    maxHr: numeric(
      segment.maxHeartRate ??
      segment.hfMax ??
      segment.maximumHeartRate
    ),
    cadence: numeric(
      segment.avgCadence ??
      segment.cadenceAvg ??
      segment.averageCadence
    ),
    ascentMeters: numeric(
      segment.ascentMeters ??
      segment.hoehenmeter ??
      segment.elevationGain
    ),
  }
}


const classifyStructuredBlock = label => {
  if (!String(label || '').trim()) return 'unlabeled'
  const text = String(label || '').toLowerCase()
  if (/warm|ein.?schwimm|einrollen|einlaufen|locker starten/.test(text)) return 'warmup'
  if (/cool|aus.?schwimm|ausrollen|auslaufen/.test(text)) return 'cooldown'
  if (/pause|recovery|erholung|locker|easy|trab/.test(text)) return 'recovery'
  if (/intervall|interval|tempo|threshold|schwelle|zügig|zuegig|hard|belast|sprint|vo2/.test(text)) return 'quality'
  if (/technik|drill|technikblock/.test(text)) return 'technique'
  return 'work'
}

const compactStructuredBlocks = (segments = [], sportType = 'running') => {
  const sport = normalizeSport(sportType)
  return (segments || []).slice(0, 16).map((segment, index) => {
    const distanceMeters = numeric(segment?.distanceMeters)
    const durationSeconds = numeric(segment?.durationSeconds)
    const pacePer100Seconds =
      sport === 'swimming' && distanceMeters > 0 && durationSeconds > 0
        ? durationSeconds / (distanceMeters / 100)
        : null

    return {
      index: segment?.index ?? index + 1,
      label: segment?.label || null,
      kind: classifyStructuredBlock(segment?.label),
      distanceMeters: distanceMeters || null,
      durationSeconds: durationSeconds || null,
      paceSecondsPerKm: sport !== 'swimming' ? numeric(segment?.paceSeconds) : null,
      paceSecondsPer100m: sport === 'swimming' ? pacePer100Seconds : null,
      avgHr: numeric(segment?.avgHr),
      maxHr: numeric(segment?.maxHr),
      cadence: numeric(segment?.cadence),
      ascentMeters: numeric(segment?.ascentMeters),
    }
  })
}

const structuredBlockTrend = (blocks = []) => {
  const quality = blocks.filter(block =>
    block.kind === 'quality' || block.kind === 'work'
  )
  if (quality.length < 2) return null

  const first = quality[0]
  const last = quality.at(-1)
  const hrValues = quality.map(block => block.avgHr).filter(Number.isFinite)
  const durationValues = quality.map(block => block.durationSeconds).filter(Number.isFinite)
  const paceKmValues = quality.map(block => block.paceSecondsPerKm).filter(Number.isFinite)
  const pace100Values = quality.map(block => block.paceSecondsPer100m).filter(Number.isFinite)

  return {
    blockCount: quality.length,
    firstAvgHr: first?.avgHr ?? null,
    lastAvgHr: last?.avgHr ?? null,
    hrDeltaBpm:
      Number.isFinite(first?.avgHr) && Number.isFinite(last?.avgHr)
        ? last.avgHr - first.avgHr
        : null,
    firstPaceSecondsPerKm: first?.paceSecondsPerKm ?? null,
    lastPaceSecondsPerKm: last?.paceSecondsPerKm ?? null,
    paceDeltaSecondsPerKm:
      Number.isFinite(first?.paceSecondsPerKm) && Number.isFinite(last?.paceSecondsPerKm)
        ? last.paceSecondsPerKm - first.paceSecondsPerKm
        : null,
    firstPaceSecondsPer100m: first?.paceSecondsPer100m ?? null,
    lastPaceSecondsPer100m: last?.paceSecondsPer100m ?? null,
    paceDeltaSecondsPer100m:
      Number.isFinite(first?.paceSecondsPer100m) && Number.isFinite(last?.paceSecondsPer100m)
        ? last.paceSecondsPer100m - first.paceSecondsPer100m
        : null,
    averageHr: hrValues.length ? avg(hrValues) : null,
    averageBlockDurationSeconds: durationValues.length ? avg(durationValues) : null,
    paceVariationPercent:
      paceKmValues.length >= 2
        ? (stdDev(paceKmValues) / avg(paceKmValues)) * 100
        : pace100Values.length >= 2
          ? (stdDev(pace100Values) / avg(pace100Values)) * 100
          : null,
  }
}

const heartRateZone = (heartRate, maxHr, restHr) => {
  const hr = numeric(heartRate)
  const max = numeric(maxHr)
  if (hr == null || max == null || max <= 0) return null

  if (numeric(restHr) != null) {
    const rest = numeric(restHr)
    const reserve = max - rest
    if (reserve <= 0) return null
    const pct = (hr - rest) / reserve

    if (pct < 0.60) return 1
    if (pct < 0.70) return 2
    if (pct < 0.80) return 3
    if (pct < 0.90) return 4
    return 5
  }

  const pct = hr / max
  if (pct < 0.60) return 1
  if (pct < 0.70) return 2
  if (pct < 0.80) return 3
  if (pct < 0.90) return 4
  return 5
}

const splitHalfMetrics = splits => {
  const usable = splits.filter(split => Number.isFinite(split?.paceSeconds))
  if (usable.length < 4) return null

  const midpoint = Math.floor(usable.length / 2)
  const first = usable.slice(0, midpoint)
  const second = usable.slice(midpoint)

  const firstPace = avg(first.map(split => split.paceSeconds))
  const secondPace = avg(second.map(split => split.paceSeconds))
  const firstHr = avg(first.map(split => split.avgHr))
  const secondHr = avg(second.map(split => split.avgHr))

  return {
    firstHalfPaceSeconds: firstPace,
    secondHalfPaceSeconds: secondPace,
    paceDeltaSecondsPerKm:
      Number.isFinite(firstPace) && Number.isFinite(secondPace)
        ? secondPace - firstPace
        : null,
    firstHalfAvgHr: firstHr,
    secondHalfAvgHr: secondHr,
    hrDeltaBpm:
      Number.isFinite(firstHr) && Number.isFinite(secondHr)
        ? secondHr - firstHr
        : null,
    paceChangePercent: percentChange(firstPace, secondPace),
    hrChangePercent: percentChange(firstHr, secondHr),
  }
}

const segmentConsistency = segments => {
  const usable = segments.filter(segment => Number.isFinite(segment?.paceSeconds))
  if (usable.length < 2) return null

  const paces = usable.map(segment => segment.paceSeconds)
  const mean = avg(paces)
  const deviation = stdDev(paces)

  return {
    count: usable.length,
    averagePaceSeconds: mean,
    fastestPaceSeconds: Math.min(...paces),
    slowestPaceSeconds: Math.max(...paces),
    spreadSecondsPerKm: Math.max(...paces) - Math.min(...paces),
    standardDeviationSeconds: deviation,
    coefficientOfVariationPercent:
      Number.isFinite(mean) && Number.isFinite(deviation) && mean > 0
        ? (deviation / mean) * 100
        : null,
    firstPaceSeconds: usable[0]?.paceSeconds ?? null,
    lastPaceSeconds: usable.at(-1)?.paceSeconds ?? null,
    firstToLastDeltaSeconds:
      Number.isFinite(usable[0]?.paceSeconds) &&
      Number.isFinite(usable.at(-1)?.paceSeconds)
        ? usable.at(-1).paceSeconds - usable[0].paceSeconds
        : null,
  }
}

const compactContext = value => {
  const context = parseJson(value) || {}
  return {
    weatherTags: Array.isArray(context?.weather?.tags)
      ? context.weather.tags
      : [],
    temperatureC: numeric(context?.weather?.temperature_c),
    windKmh: numeric(context?.weather?.wind_speed_kmh),
    sunPhase: context?.sun?.phase || null,
  }
}

const analyzeRun = (log, maxHr, restHr) => {
  const splitsRaw = parseJson(log?.km_splits) || []
  const segmentsRaw = parseJson(log?.run_segments) || []

  const splits = Array.isArray(splitsRaw)
    ? splitsRaw.map(normalizeSplit).filter(Boolean)
    : []

  const segments = Array.isArray(segmentsRaw)
    ? segmentsRaw.map(normalizeSegment).filter(Boolean)
    : []

  const avgHr = numeric(log?.bpm)
  const maxHeartRate = numeric(log?.hf_max)

  const workoutType = normalizeWorkoutType(
    `${log?.einheit || ''} ${log?.details || ''}`
  )

  const actualDate = log?.actual_date || null

  return {
    key: log?.key || null,
    // WICHTIG: tag = geplanter Plantag, actualDate/actualWeekday = echte Durchführung.
    // Diese Werte dürfen in der Coach-Bewertung nicht miteinander verwechselt werden.
    date: actualDate,
    actualDate,
    actualWeekday: germanWeekday(actualDate),
    plannedTag: log?.tag || null,
    tag: log?.tag || null,
    planWeekNumber: numeric(log?.weekNumber),
    workout: log?.einheit || null,
    workoutType,
    plannedDetails: log?.details || null,
    mainSet: log?.mainSet || null,
    restGuidance: log?.restGuidance || null,
    completed: Boolean(log?.logged),
    skipped: Boolean(log?.skipped),
    skipReason: log?.skipReason || null,
    actual: log?.logged
      ? {
          km: numeric(log?.km),
          paceSeconds: paceToSeconds(log?.pace),
          avgHr,
          maxHr: maxHeartRate,
          avgHrZone: heartRateZone(avgHr, maxHr, restHr),
          durationSeconds: numeric(log?.duration_seconds),
          runningIndex: numeric(log?.running_index),
          cadence: numeric(log?.cadence),
          elevationGainMeters: numeric(
            log?.elevation_gain ?? log?.hoehenmeter
          ),
          feeling: log?.gefuehl || null,
          trainingLoad: numeric(log?.training_load),
          recoveryTime: numeric(log?.recovery_time),
          note: log?.note || null,
          context: compactContext(log?.activity_context),
        }
      : null,
    splits: splits.slice(0, 30),
    segments: segments.slice(0, 30),
    structuredBlocks: compactStructuredBlocks(segments, log?.sport_type || log?.sportType || 'running'),
    structuredBlockTrend: structuredBlockTrend(
      compactStructuredBlocks(segments, log?.sport_type || log?.sportType || 'running')
    ),
    splitTrend: splitHalfMetrics(splits),
    segmentConsistency: segmentConsistency(segments),
    dataQuality: {
      hasSplits: splits.length > 0,
      hasSegments: segments.length > 0,
      hasStructuredBlocks: segments.length > 0,
      hasHr: avgHr != null,
      hasMaxHr: maxHeartRate != null,
      hasRunningIndex: numeric(log?.running_index) != null,
      hasCadence: numeric(log?.cadence) != null,
      hasDuration: numeric(log?.duration_seconds) != null,
    },
  }
}

const summarizeSimilar = (currentRun, historyRuns) => {
  if (!currentRun?.workoutType || currentRun.workoutType === 'other') return null

  const similar = historyRuns
    .filter(run =>
      run.completed &&
      run.workoutType === currentRun.workoutType &&
      run.key !== currentRun.key &&
      run.date
    )
    .sort((a, b) => (dateValue(b.date) || 0) - (dateValue(a.date) || 0))
    .slice(0, 4)

  if (!similar.length) return null

  const currentPace = currentRun.actual?.paceSeconds
  const currentHr = currentRun.actual?.avgHr

  const paceHistory = similar
    .map(run => run.actual?.paceSeconds)
    .filter(Number.isFinite)

  const hrHistory = similar
    .map(run => run.actual?.avgHr)
    .filter(Number.isFinite)

  const riHistory = similar
    .map(run => run.actual?.runningIndex)
    .filter(Number.isFinite)

  return {
    workoutType: currentRun.workoutType,
    comparisonCount: similar.length,
    historicalAveragePaceSeconds: avg(paceHistory),
    historicalAverageHr: avg(hrHistory),
    historicalAverageRunningIndex: avg(riHistory),
    currentVsHistoryPaceDeltaSeconds:
      Number.isFinite(currentPace) && paceHistory.length
        ? currentPace - avg(paceHistory)
        : null,
    currentVsHistoryHrDeltaBpm:
      Number.isFinite(currentHr) && hrHistory.length
        ? currentHr - avg(hrHistory)
        : null,
    examples: similar.map(run => ({
      date: run.date,
      paceSeconds: run.actual?.paceSeconds ?? null,
      avgHr: run.actual?.avgHr ?? null,
      runningIndex: run.actual?.runningIndex ?? null,
      km: run.actual?.km ?? null,
    })),
  }
}

const detectRecoverySpacing = runs => {
  const completed = runs
    .filter(run => run.completed && run.date)
    .sort((a, b) => (dateValue(a.date) || 0) - (dateValue(b.date) || 0))

  const hardTypes = new Set(['interval', 'tempo', 'race', 'hills'])
  const loadRelevantTypes = new Set([
    'interval',
    'tempo',
    'race',
    'hills',
    'long_run',
  ])

  const pairs = []

  for (let index = 1; index < completed.length; index += 1) {
    const previous = completed[index - 1]
    const current = completed[index]
    const gap = diffDays(previous.date, current.date)

    pairs.push({
      previousDate: previous.actualDate,
      previousWeekday: previous.actualWeekday,
      previousWorkout: previous.workout,
      previousType: previous.workoutType,
      currentDate: current.actualDate,
      currentWeekday: current.actualWeekday,
      currentWorkout: current.workout,
      currentType: current.workoutType,
      daysBetween: gap,
      consecutiveDay: gap === 1,
      potentiallyTight:
        gap != null &&
        gap <= 1 &&
        (
          loadRelevantTypes.has(previous.workoutType) ||
          hardTypes.has(current.workoutType)
        ),
    })
  }

  return pairs
}

const buildChronology = runs => {
  const completed = runs
    .filter(run => run.completed && run.date)
    .sort((a, b) => (dateValue(a.date) || 0) - (dateValue(b.date) || 0))

  return completed.map((run, index) => {
    const previous = index > 0 ? completed[index - 1] : null

    return {
      date: run.actualDate,
      weekday: run.actualWeekday,
      plannedTag: run.plannedTag,
      workout: run.workout,
      workoutType: run.workoutType,
      daysSincePreviousRun:
        previous ? diffDays(previous.date, run.date) : null,
      previousWorkout:
        previous?.workout || null,
      previousWorkoutType:
        previous?.workoutType || null,
    }
  })
}


const normalizeSport = value => {
  const text = String(value || '').toLowerCase()
  if (/mountain|mtb/.test(text)) return 'mountainbike'
  if (/bike|cycling|rad|velo/.test(text)) return 'cycling'
  if (/walk|hike|wander/.test(text)) return 'hiking'
  if (/swim|schwimm/.test(text)) return 'swimming'
  if (/run|running|jog|lauf/.test(text)) return 'running'
  if (/strength|kraft|gym|mobility/.test(text)) return 'strength'
  return text || 'other'
}

const activityLoadClass = activity => {
  const sport = normalizeSport(activity?.sport_type)
  const durationMinutes =
    numeric(activity?.moving_time_seconds ?? activity?.duration_seconds) / 60
  const distanceKm = numeric(activity?.km)
  const load = numeric(activity?.training_load)

  if (Number.isFinite(load)) {
    if (load >= 100) return 'high'
    if (load >= 55) return 'moderate'
    return 'low'
  }

  const elevationGain = activityElevationGainMeters(activity)
  const hmPerKm = elevationPerKm(activity)

  if (sport === 'mountainbike' && (
    durationMinutes >= 75 || distanceKm >= 20 ||
    elevationGain >= 500 || hmPerKm >= 25
  )) return 'moderate'
  if (sport === 'cycling' && (
    durationMinutes >= 90 || distanceKm >= 30 ||
    elevationGain >= 700 || hmPerKm >= 15
  )) return 'moderate'
  if (sport === 'hiking' && (
    durationMinutes >= 120 || elevationGain >= 600 || hmPerKm >= 35
  )) return 'moderate'
  if (sport === 'running' && (
    durationMinutes >= 75 || elevationGain >= 350 || hmPerKm >= 25
  )) return 'moderate'
  if (sport === 'swimming' && durationMinutes >= 60) return 'moderate'
  return 'low'
}

const activityElevationGainMeters = activity => {
  const value = numeric(
    activity?.elevation_gain ??
    activity?.hoehenmeter ??
    activity?.elevationGain ??
    activity?.elevationGainMeters ??
    activity?.ascent ??
    activity?.total_ascent
  )
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

const elevationPerKm = activity => {
  const gain = activityElevationGainMeters(activity)
  const km = numeric(activity?.km)
  return gain != null && km != null && km > 0
    ? Math.round((gain / km) * 10) / 10
    : null
}

const buildAllActivityChronology = ({ activityHistory = [], weekStart }) => {
  const start = dateValue(weekStart)
  if (!start) return []
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return (activityHistory || [])
    .filter(activity => {
      const date = dateValue(activity?.actual_date)
      return date && date >= start && date <= end
    })
    .map(activity => ({
      id: activity.id || null,
      date: activity.actual_date,
      weekday: germanWeekday(activity.actual_date),
      sport: normalizeSport(activity.sport_type),
      distanceKm: numeric(activity.km),
      durationMinutes:
        Number.isFinite(numeric(activity.moving_time_seconds ?? activity.duration_seconds))
          ? Math.round(numeric(activity.moving_time_seconds ?? activity.duration_seconds) / 60)
          : null,
      averageHr: numeric(activity.bpm),
      trainingLoad: numeric(activity.training_load),
      elevationGainMeters:
        normalizeSport(activity.sport_type) === 'swimming'
          ? null
          : activityElevationGainMeters(activity),
      elevationMetersPerKm:
        normalizeSport(activity.sport_type) === 'swimming'
          ? null
          : elevationPerKm(activity),
      loadClass: activityLoadClass(activity),
      note: activity.note || activity.gefuehl || null,
      isPlanLinked: Boolean(activity.day_key),
    }))
    .sort((a, b) => (dateValue(a.date) || 0) - (dateValue(b.date) || 0))
}

const buildPlanRealityPattern = historyRuns => {
  const groups = {}

  for (const run of historyRuns) {
    if (!run.completed || !run.plannedTag || !run.actualWeekday) continue
    const key = run.workoutType || run.workout || 'other'
    groups[key] ||= { workoutType: key, samples: 0, transitions: {} }
    const transition = `${run.plannedTag}→${run.actualWeekday}`
    groups[key].samples += 1
    groups[key].transitions[transition] =
      (groups[key].transitions[transition] || 0) + 1
  }

  return Object.values(groups)
    .map(item => {
      const entries = Object.entries(item.transitions).sort((a,b) => b[1]-a[1])
      const [dominantPattern, dominantCount] = entries[0] || []
      return {
        workoutType: item.workoutType,
        samples: item.samples,
        dominantPattern: dominantPattern || null,
        dominantCount: dominantCount || 0,
        consistency: item.samples
          ? Math.round(((dominantCount || 0) / item.samples) * 100)
          : null,
      }
    })
    .filter(item => item.samples >= 2)
}

const buildSubjectiveObjectiveSignals = runs => {
  const subjectiveRegex =
    /(müde|muede|schwer|erschöpft|erschoepft|anstreng|kraftlos|schlapp|matt|frisch|leicht|locker|gut gefühlt|gut gefuehlt)/i

  return runs
    .filter(run => run.completed)
    .map(run => {
      const note = [run.actual?.note, run.actual?.feeling]
        .filter(Boolean)
        .join(' ')

      if (!subjectiveRegex.test(note)) return null

      const objectiveFlags = []
      if (run.secondHalf?.hrDriftBpm != null && run.secondHalf.hrDriftBpm >= 7) {
        objectiveFlags.push(`HF-Drift +${run.secondHalf.hrDriftBpm} bpm`)
      }
      if (run.secondHalf?.paceDriftSecPerKm != null && run.secondHalf.paceDriftSecPerKm >= 12) {
        objectiveFlags.push(`Pace-Drift +${run.secondHalf.paceDriftSecPerKm} sec/km`)
      }
      if (run.actual?.runningIndex != null) {
        objectiveFlags.push(`Running Index ${run.actual.runningIndex}`)
      }

      return {
        workout: run.workout,
        date: run.actualDate,
        weekday: run.actualWeekday,
        subjective: note,
        objectiveFlags,
        hasObjectiveFatigueSignal: objectiveFlags.some(flag => /Drift/.test(flag)),
      }
    })
    .filter(Boolean)
}

const confidenceFor = (runs, sportType = 'running') => {
  const completed = runs.filter(run => run.completed)

  if (!completed.length) {
    return {
      level: 'low',
      score: 0,
      reasons: ['Keine absolvierte Einheit mit Trainingsdaten vorhanden.'],
    }
  }

  const sport = normalizeSport(sportType)
  const scoreParts = completed.map(run => {
    let score = 0
    let max = 0

    const add = (condition, weight = 1) => {
      max += weight
      if (condition) score += weight
    }

    if (sport === 'running') {
      add(run.actual?.paceSeconds != null)
      add(run.actual?.avgHr != null)
      add(run.dataQuality?.hasSplits)
      add(run.dataQuality?.hasSegments)
      add(run.actual?.runningIndex != null, 0.5)
      add(Boolean(run.actual?.note), 0.5)
    } else if (sport === 'swimming') {
      add(run.actual?.durationSeconds != null)
      add(run.actual?.km != null)
      add(run.actual?.avgHr != null, 0.5)
      add(run.dataQuality?.hasStructuredBlocks, 0.75)
      add(Boolean(run.actual?.note), 0.75)
      add(run.actual?.trainingLoad != null, 0.5)
    } else if (sport === 'cycling' || sport === 'mountainbike') {
      add(run.actual?.durationSeconds != null)
      add(run.actual?.km != null)
      add(run.actual?.avgHr != null)
      add(run.dataQuality?.hasStructuredBlocks, 0.75)
      add(run.actual?.elevationGainMeters != null, 0.5)
      add(run.actual?.trainingLoad != null, 0.75)
      add(Boolean(run.actual?.note), 0.5)
    } else if (sport === 'hiking') {
      add(run.actual?.durationSeconds != null)
      add(run.actual?.km != null)
      add(run.actual?.elevationGainMeters != null, 0.75)
      add(Boolean(run.actual?.note), 0.75)
      add(run.actual?.avgHr != null, 0.5)
    } else {
      add(run.actual?.durationSeconds != null)
      add(run.actual?.km != null)
      add(run.actual?.avgHr != null)
      add(Boolean(run.actual?.note))
    }

    return max > 0 ? score / max : 0
  })

  const score = Math.round(avg(scoreParts) * 100)
  const reasons = []

  if (completed.every(run => run.actual?.durationSeconds != null)) {
    reasons.push('Dauer für alle absolvierten Einheiten vorhanden.')
  }
  if (completed.every(run => run.actual?.km != null)) {
    reasons.push(
      sport === 'swimming'
        ? 'Distanz für alle absolvierten Schwimmeinheiten vorhanden.'
        : 'Distanz für alle absolvierten Einheiten vorhanden.'
    )
  }
  if (completed.every(run => run.dataQuality?.hasHr)) {
    reasons.push('Herzfrequenzdaten für alle absolvierten Einheiten vorhanden.')
  }
  if (sport === 'running' && completed.some(run => run.dataQuality?.hasSplits)) {
    reasons.push('Kilometer-Splits stehen für mindestens eine Einheit zur Verfügung.')
  }
  if (sport === 'running' && completed.some(run => run.dataQuality?.hasSegments)) {
    reasons.push('Phasen-/Segmentdaten stehen für mindestens eine Einheit zur Verfügung.')
  }
  if (sport !== 'running' && completed.some(run => run.dataQuality?.hasStructuredBlocks)) {
    reasons.push('Strukturierte Belastungs-/Setdaten stehen für mindestens eine Einheit zur Verfügung.')
  }
  if (completed.some(run => run.actual?.note)) {
    reasons.push('Subjektive Rückmeldung steht für mindestens eine Einheit zur Verfügung.')
  }

  return {
    level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    score,
    reasons,
  }
}

const firstNumericFromText = (value, unitPattern) => {
  const text = String(value || '')
  const match = text.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unitPattern}`, 'i'))
  return match ? Number(match[1].replace(',', '.')) : null
}

const plannedDurationForDay = day => {
  const direct = numeric(day?.durationMinutes)
  if (direct != null && direct > 0) return direct
  return firstNumericFromText(day?.details, '(?:min|minute(?:n)?)\\b')
}

const plannedKmForDay = day => {
  const direct = numeric(day?.distanceKm ?? day?.distance_km)
  if (direct != null && direct > 0) return direct
  const fromGuidance = firstNumericFromText(day?.distanceGuidance, 'km\\b')
  if (fromGuidance != null) return fromGuidance
  return firstNumericFromText(day?.details, 'km\\b')
}

const plannedMetersForSwimmingDay = day => {
  const structured = numeric(day?.totalDistanceM)
  if (structured != null && structured > 0) return structured

  const blocks = [
    numeric(day?.warmupDistanceM),
    numeric(day?.mainDistanceM),
    numeric(day?.techniqueDistanceM),
    numeric(day?.cooldownDistanceM),
  ].filter(Number.isFinite)

  if (blocks.length) return blocks.reduce((sum, value) => sum + value, 0)
  return firstNumericFromText(day?.details, 'm\\b')
}

const buildSportSummary = ({ sportType, plannedDays, weekRuns }) => {
  const sport = normalizeSport(sportType)
  const completed = weekRuns.filter(run => run.completed)

  const actualKm = completed
    .map(run => run.actual?.km)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0)

  const actualDurationMinutes = completed
    .map(run => run.actual?.durationSeconds)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0) / 60

  const actualElevationGainMeters = completed
    .map(run => run.actual?.elevationGainMeters)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0)

  const plannedDurationMinutes = (plannedDays || [])
    .map(plannedDurationForDay)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0)

  const plannedKm = (plannedDays || [])
    .map(plannedKmForDay)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0)

  const plannedMeters = sport === 'swimming'
    ? (plannedDays || [])
        .map(plannedMetersForSwimmingDay)
        .filter(Number.isFinite)
        .reduce((sum, value) => sum + value, 0)
    : null

  const actualMeters = sport === 'swimming' && actualKm > 0
    ? Math.round(actualKm * 1000)
    : null

  const avgHrValues = completed
    .map(run => run.actual?.avgHr)
    .filter(Number.isFinite)

  const trainingLoadValues = completed
    .map(run => run.actual?.trainingLoad)
    .filter(Number.isFinite)

  return {
    sport,
    completedCount: completed.length,
    plannedCount: (plannedDays || []).length,
    plannedDurationMinutes: plannedDurationMinutes > 0 ? Math.round(plannedDurationMinutes) : null,
    actualDurationMinutes: actualDurationMinutes > 0 ? Math.round(actualDurationMinutes) : null,
    plannedDistanceKm: sport !== 'swimming' && plannedKm > 0 ? Math.round(plannedKm * 10) / 10 : null,
    actualDistanceKm: sport !== 'swimming' && actualKm > 0 ? Math.round(actualKm * 10) / 10 : null,
    plannedDistanceM: plannedMeters > 0 ? Math.round(plannedMeters) : null,
    actualDistanceM: actualMeters,
    actualElevationGainMeters: actualElevationGainMeters > 0 ? Math.round(actualElevationGainMeters) : null,
    averageHr: avgHrValues.length ? Math.round(avg(avgHrValues)) : null,
    averageTrainingLoad: trainingLoadValues.length ? Math.round(avg(trainingLoadValues)) : null,
    sessionTypes: weekRuns.map(run => ({
      tag: run.plannedTag,
      workout: run.workout,
      workoutType: run.workoutType,
      completed: run.completed,
      skipped: run.skipped,
      actualDate: run.actualDate,
      durationMinutes: run.actual?.durationSeconds ? Math.round(run.actual.durationSeconds / 60) : null,
      distanceKm: run.actual?.km ?? null,
      avgHr: run.actual?.avgHr ?? null,
      elevationGainMeters: run.actual?.elevationGainMeters ?? null,
      feeling: run.actual?.feeling ?? null,
      note: run.actual?.note ?? null,
      plannedStructure: {
        details: run.plannedDetails || null,
        mainSet: run.mainSet || null,
        restGuidance: run.restGuidance || null,
      },
      structuredBlocks: (run.structuredBlocks || []).slice(0, 12),
      structuredBlockTrend: run.structuredBlockTrend || null,
    })),
  }
}

const HYROX_STATION_LABELS = {
  sled_push:'Sled Push', sled_pull:'Sled Pull', farmers_carry:'Farmers Carry',
  sandbag_lunges:'Sandbag Lunges', wall_balls:'Wall Balls', ski_erg:'SkiErg',
  row:'Row', burpee_broad_jumps:'Burpee Broad Jumps', run:'Laufen',
}

const hyroxRecommendation = values => {
  const effort = String(values?.effort || '').toLowerCase()
  const technique = String(values?.technique || '').toLowerCase()
  const completed = values?.completed
  if (/schwierig/.test(technique) || completed === false || /zu schwer/.test(effort)) return 'reduce'
  if (/schwer/.test(effort)) return 'hold'
  if (/zu leicht|leicht/.test(effort) && /sicher/.test(technique)) return 'small_progress'
  if (/passend/.test(effort) && /sicher/.test(technique)) return 'planned_progression'
  return 'hold'
}

const buildHyroxSummary = (weekLogs, historyLogs = []) => {
  const sessions = []
  const currentStations = {}
  const historyStations = {}

  const collect = (logs, target, source, includeSessions = false) => {
    for (const log of logs || []) {
      const data = log?.hyrox_data
      if (!data || typeof data !== 'object' || !Object.keys(data).length) continue

      const session = {
        key:log.key || log.day_key || null,
        tag:log.tag || null,
        workout:log.einheit || log.workout || null,
        actualDate:log.actual_date || log.actualDate || log.date || null,
        stations:[],
      }

      for (const [stationId, values] of Object.entries(data)) {
        if (!values || typeof values !== 'object') continue
        const recommendation = hyroxRecommendation(values)
        const item = {
          stationId,
          label:HYROX_STATION_LABELS[stationId] || stationId,
          weight:numeric(values.weight),
          weightEach:numeric(values.weight_each),
          distance:numeric(values.distance),
          reps:numeric(values.reps),
          sets:numeric(values.sets),
          time:values.time || null,
          effort:values.effort || null,
          technique:values.technique || null,
          completed:values.completed ?? null,
          recommendation,
          actualDate:session.actualDate,
          source,
        }

        session.stations.push(item)
        if (!target[stationId]) target[stationId] = []
        target[stationId].push(item)
      }

      if (includeSessions) sessions.push(session)
    }
  }

  collect(historyLogs, historyStations, 'history', false)
  collect(weekLogs, currentStations, 'current_week', true)

  const stationIds = new Set([
    ...Object.keys(historyStations),
    ...Object.keys(currentStations),
  ])

  const stationTrends = [...stationIds].map(stationId => {
    const current = currentStations[stationId] || []
    const history = historyStations[stationId] || []
    const latest = current.at(-1) || null
    const previous = history.at(-1) || null
    const combined = [...history, ...current]

    return {
      stationId,
      label:HYROX_STATION_LABELS[stationId] || stationId,
      currentWeekLogs:current.length,
      historicalLogs:history.length,
      totalLogs:combined.length,
      latest,
      previous,
      deterministicRecommendation:latest?.recommendation || 'hold',
      safetyPriority:current.some(e => e.recommendation === 'reduce'),
      trendAvailable:Boolean(latest && previous),
      actualChange:{
        weight:
          Number.isFinite(latest?.weight) && Number.isFinite(previous?.weight)
            ? latest.weight - previous.weight
            : null,
        weightEach:
          Number.isFinite(latest?.weightEach) && Number.isFinite(previous?.weightEach)
            ? latest.weightEach - previous.weightEach
            : null,
        distance:
          Number.isFinite(latest?.distance) && Number.isFinite(previous?.distance)
            ? latest.distance - previous.distance
            : null,
        reps:
          Number.isFinite(latest?.reps) && Number.isFinite(previous?.reps)
            ? latest.reps - previous.reps
            : null,
      },
    }
  })

  return {
    sessions,
    stationTrends,
    rule:'Technik hat Vorrang. Technik schwierig, nicht geschafft oder zu schwer => reduzieren; schwer => halten; leicht + sicher => kleine Steigerung möglich; passend + sicher => geplante Progression zulässig.',
    historyNote:'Historische Stationswerte dienen nur als Trendkontext. Die aktuelle Wochenbewertung und Technik haben Vorrang.',
  }
}

export function buildTrainingAnalysis({
  weekLogs = [],
  plannedDays = [],
  historyLogs = [],
  activityHistory = [],
  weekNumber = null,
  weekStart = null,
  currentHFMax = null,
  currentRuheHF = null,
  isRegenWeek = false,
  nextIsRegenWeek = false,
  aktuelleWochenKm = null,
  sportType = 'running',
}) {
  const weekRuns = weekLogs.map(log =>
    analyzeRun(log, currentHFMax, currentRuheHF)
  )

  const historyRuns = historyLogs.map(log =>
    analyzeRun(log, currentHFMax, currentRuheHF)
  )

  const completed = weekRuns.filter(run => run.completed)
  const skipped = weekRuns.filter(run => run.skipped)
  const missed = weekRuns.filter(run => !run.completed && !run.skipped)

  const actualKm = completed
    .map(run => run.actual?.km)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0)

  const actualDuration = completed
    .map(run => run.actual?.durationSeconds)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0)

  const plannedKm = plannedDays
    .map(day => {
      const match = String(day?.details || '').match(/(\d+(?:[.,]\d+)?)\s*km\b/i)
      return match ? Number(match[1].replace(',', '.')) : null
    })
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0)

  const zoneDistribution = completed.reduce((acc, run) => {
    const zone = run.actual?.avgHrZone
    if (zone) acc[`zone${zone}`] = (acc[`zone${zone}`] || 0) + 1
    return acc
  }, {})

  const similarComparisons = completed
    .map(run => ({
      key: run.key,
      workout: run.workout,
      comparison: summarizeSimilar(run, historyRuns),
    }))
    .filter(item => item.comparison)

  const efficiencyCandidates = similarComparisons
    .filter(item => {
      const paceDelta = item.comparison?.currentVsHistoryPaceDeltaSeconds
      const hrDelta = item.comparison?.currentVsHistoryHrDeltaBpm
      return Number.isFinite(paceDelta) && Number.isFinite(hrDelta)
    })
    .map(item => ({
      workout: item.workout,
      workoutType: item.comparison.workoutType,
      paceDeltaSeconds:
        item.comparison.currentVsHistoryPaceDeltaSeconds,
      hrDeltaBpm:
        item.comparison.currentVsHistoryHrDeltaBpm,
      likelyImprovedEfficiency:
        item.comparison.currentVsHistoryPaceDeltaSeconds < -5 &&
        item.comparison.currentVsHistoryHrDeltaBpm <= 2,
      likelyReducedEfficiency:
        item.comparison.currentVsHistoryPaceDeltaSeconds > 10 &&
        item.comparison.currentVsHistoryHrDeltaBpm >= 3,
    }))

  const fatigueSignals = []

  completed.forEach(run => {
    if (
      run.splitTrend?.paceDeltaSecondsPerKm > 15 &&
      run.splitTrend?.hrDeltaBpm > 4
    ) {
      fatigueSignals.push(
        `${run.workout || run.tag}: zweite Hälfte langsamer bei gleichzeitig höherer HF.`
      )
    }

    if (
      run.segmentConsistency?.firstToLastDeltaSeconds > 15 &&
      ['interval', 'tempo'].includes(run.workoutType)
    ) {
      fatigueSignals.push(
        `${run.workout || run.tag}: deutlicher Pace-Abfall von erster zu letzter Belastungsphase.`
      )
    }
  })


  if (normalizeSport(sportType) === 'swimming') {
    completed.forEach(run => {
      const trend = run.structuredBlockTrend
      if (!trend || trend.blockCount < 2) return

      if (
        Number.isFinite(trend.hrDeltaBpm) && trend.hrDeltaBpm >= 8 &&
        Number.isFinite(trend.paceDeltaSecondsPer100m) &&
        trend.paceDeltaSecondsPer100m > 4
      ) {
        fatigueSignals.push(
          `${run.workout || run.tag}: spätere Schwimmblöcke wurden langsamer bei gleichzeitig höherer Herzfrequenz.`
        )
      }
    })
  }

  efficiencyCandidates
    .filter(item => item.likelyReducedEfficiency)
    .forEach(item => {
      fatigueSignals.push(
        `${item.workout}: gegenüber ähnlichen Einheiten langsamer bei höherer HF.`
      )
    })

  const recoverySpacing = detectRecoverySpacing(weekRuns)
  const chronology = buildChronology(weekRuns)
  const allActivityChronology = buildAllActivityChronology({
    activityHistory,
    weekStart,
  })
  const planRealityPatterns = buildPlanRealityPattern(historyRuns)
  const subjectiveObjectiveSignals = buildSubjectiveObjectiveSignals(weekRuns)
  const sportSummary = buildSportSummary({ sportType, plannedDays, weekRuns })
  const hyroxSummary = normalizeSport(sportType) === 'hyrox' ? buildHyroxSummary(weekLogs, historyLogs) : null

  const previousWeekRuns = Number.isFinite(numeric(weekNumber))
    ? historyRuns.filter(
        run =>
          run.completed &&
          run.planWeekNumber === numeric(weekNumber) - 1
      )
    : []

  const previousWeekActualKm = previousWeekRuns
    .map(run => run.actual?.km)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0)

  const weekKmChangePercent =
    previousWeekActualKm > 0
      ? Math.round(
          ((actualKm - previousWeekActualKm) /
            previousWeekActualKm) *
            100
        )
      : null

  recoverySpacing
    .filter(pair => pair.potentiallyTight)
    .forEach(pair => {
      fatigueSignals.push(
        `${pair.currentWeekday || pair.currentDate}: nur ${pair.daysBetween} Tag(e) seit ` +
        `${pair.previousWorkout || pair.previousType}. Das kann Restbelastung begünstigen, ` +
        `beweist sie aber nicht.`
      )
    })

  const primarySport = normalizeSport(sportType)
  const nonRunningLoad = allActivityChronology.filter(
    activity =>
      activity.sport !== primarySport &&
      activity.loadClass !== 'low'
  )

  const tightLoadChains = []
  for (let index = 1; index < allActivityChronology.length; index += 1) {
    const previous = allActivityChronology[index - 1]
    const current = allActivityChronology[index]
    const gap = diffDays(previous.date, current.date)

    if (
      gap != null &&
      gap <= 1 &&
      (previous.loadClass !== 'low' || current.loadClass !== 'low')
    ) {
      tightLoadChains.push({
        previous,
        current,
        daysBetween: gap,
      })
    }
  }

  return {
    version: 3,
    adherence: {
      plannedCount: plannedDays.length,
      loggedCount: completed.length,
      skippedCount: skipped.length,
      missedCount: missed.length,
      completionPercent:
        plannedDays.length > 0
          ? Math.round(((completed.length + skipped.length) / plannedDays.length) * 100)
          : 0,
      actualKm: Math.round(actualKm * 10) / 10,
      plannedKm: plannedKm > 0 ? Math.round(plannedKm * 10) / 10 : null,
      previousWeekActualKm:
        previousWeekActualKm > 0
          ? Math.round(previousWeekActualKm * 10) / 10
          : null,
      actualKmChangeVsPreviousWeekPercent: weekKmChangePercent,
      profileWeeklyKm: numeric(aktuelleWochenKm),
      actualDurationMinutes:
        actualDuration > 0 ? Math.round(actualDuration / 60) : null,
    },
    weekContext: {
      isRecoveryWeek: Boolean(isRegenWeek),
      nextIsRecoveryWeek: Boolean(nextIsRegenWeek),
      maxHr: numeric(currentHFMax),
      restHr: numeric(currentRuheHF),
    },
    runs: weekRuns,
    intensityProxy: {
      basedOnAverageHrZone: true,
      runCountByAverageZone: zoneDistribution,
      note:
        'Dies ist nur eine grobe Einordnung anhand der Durchschnitts-HF je Einheit, keine echte Zeit-in-Zone-Verteilung.',
    },
    similarComparisons,
    efficiencyCandidates,
    chronology,
    allActivityChronology,
    nonRunningLoad,
    tightLoadChains,
    planRealityPatterns,
    subjectiveObjectiveSignals,
    recoverySpacing,
    fatigueSignals,
    sportType: normalizeSport(sportType),
    sportSummary,
    hyroxSummary,
    confidence: confidenceFor(weekRuns, sportType),
  }
}
