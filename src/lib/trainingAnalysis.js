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

const diffDays = (a, b) => {
  const da = dateValue(a)
  const db = dateValue(b)
  if (!da || !db) return null
  return Math.round((db - da) / 86400000)
}

const normalizeWorkoutType = value => {
  const text = String(value || '').toLowerCase()

  if (/intervall|interval|wiederholung|repetition/.test(text)) return 'interval'
  if (/tempo|schwelle|threshold|treshold/.test(text)) return 'tempo'
  if (/long|lang(?:er|e)?\s*lauf|dauerlauf lang/.test(text)) return 'long_run'
  if (/regeneration|recovery|locker|easy|zone\s*1/.test(text)) return 'easy'
  if (/zone\s*2|grundlage|ga1/.test(text)) return 'zone2'
  if (/progressiv|progression/.test(text)) return 'progression'
  if (/berg|hill/.test(text)) return 'hills'
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

  return {
    key: log?.key || null,
    date: log?.actual_date || null,
    tag: log?.tag || null,
    workout: log?.einheit || null,
    workoutType,
    plannedDetails: log?.details || null,
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
    splitTrend: splitHalfMetrics(splits),
    segmentConsistency: segmentConsistency(segments),
    dataQuality: {
      hasSplits: splits.length > 0,
      hasSegments: segments.length > 0,
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
  const pairs = []

  for (let index = 1; index < completed.length; index += 1) {
    const previous = completed[index - 1]
    const current = completed[index]
    const gap = diffDays(previous.date, current.date)

    if (hardTypes.has(previous.workoutType) || hardTypes.has(current.workoutType)) {
      pairs.push({
        from: previous.workoutType,
        to: current.workoutType,
        daysBetween: gap,
        potentiallyTight:
          gap != null &&
          gap <= 1 &&
          hardTypes.has(previous.workoutType) &&
          hardTypes.has(current.workoutType),
      })
    }
  }

  return pairs
}

const confidenceFor = runs => {
  const completed = runs.filter(run => run.completed)

  if (!completed.length) {
    return {
      level: 'low',
      score: 0,
      reasons: ['Keine absolvierte Einheit mit Trainingsdaten vorhanden.'],
    }
  }

  const scoreParts = completed.map(run => {
    let score = 0
    if (run.actual?.paceSeconds != null) score += 1
    if (run.actual?.avgHr != null) score += 1
    if (run.dataQuality?.hasSplits) score += 1
    if (run.dataQuality?.hasSegments) score += 1
    if (run.actual?.runningIndex != null) score += 0.5
    if (run.actual?.note) score += 0.5
    return score / 5
  })

  const score = Math.round(avg(scoreParts) * 100)

  const reasons = []
  if (completed.every(run => run.dataQuality?.hasHr)) {
    reasons.push('Herzfrequenzdaten für alle absolvierten Einheiten vorhanden.')
  } else {
    reasons.push('Herzfrequenzdaten fehlen bei mindestens einer Einheit.')
  }

  if (completed.some(run => run.dataQuality?.hasSplits)) {
    reasons.push('Kilometer-Splits stehen für mindestens eine Einheit zur Verfügung.')
  }

  if (completed.some(run => run.dataQuality?.hasSegments)) {
    reasons.push('Phasen-/Segmentdaten stehen für mindestens eine Einheit zur Verfügung.')
  }

  return {
    level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    score,
    reasons,
  }
}

export function buildTrainingAnalysis({
  weekLogs = [],
  plannedDays = [],
  historyLogs = [],
  currentHFMax = null,
  currentRuheHF = null,
  isRegenWeek = false,
  nextIsRegenWeek = false,
  aktuelleWochenKm = null,
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

  efficiencyCandidates
    .filter(item => item.likelyReducedEfficiency)
    .forEach(item => {
      fatigueSignals.push(
        `${item.workout}: gegenüber ähnlichen Einheiten langsamer bei höherer HF.`
      )
    })

  const recoverySpacing = detectRecoverySpacing(weekRuns)

  recoverySpacing
    .filter(pair => pair.potentiallyTight)
    .forEach(pair => {
      fatigueSignals.push(
        `Zwei intensive Reize (${pair.from} → ${pair.to}) lagen höchstens einen Tag auseinander.`
      )
    })

  return {
    version: 2,
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
    recoverySpacing,
    fatigueSignals,
    confidence: confidenceFor(weekRuns),
  }
}
