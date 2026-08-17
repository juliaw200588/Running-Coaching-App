const n = value => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const nonEmpty = value => String(value || '').trim()

export const normalizeWeeklySport = value => {
  const text = String(value || '').toLowerCase()
  if (/mountain|mtb/.test(text)) return 'mountainbike'
  if (/bike|cycling|rad|velo/.test(text)) return 'cycling'
  if (/walk|hike|wander|marsch/.test(text)) return 'hiking'
  if (/swim|schwimm/.test(text)) return 'swimming'
  return 'running'
}

const extractLeadingKm = value => {
  const match = String(value || '').match(/^\s*(\d+(?:[.,]\d+)?)\s*km\b/i)
  return match ? Number(match[1].replace(',', '.')) : null
}

const poolStep = plan => {
  const pool = String(plan?.swimmingProfile?.poolLength || '').toLowerCase()
  return pool.includes('50') || pool.includes('both') || pool.includes('beides') ? 50 : 25
}

const swimmingTextAllowed = (text, plan, day) => {
  const value = String(text || '').toLowerCase()
  if (/rücken|ruecken|backstroke|delfin|delphin|butterfly/.test(value)) return false

  const stroke = String(plan?.swimmingProfile?.stroke || '').toLowerCase()
  if (stroke === 'freestyle' && /\bbrust|breast/.test(value)) return false
  if (stroke === 'breaststroke' && /\bkraul|freistil|freestyle|crawl/.test(value)) return false

  const available = new Set((day?.equipment || []).map(item => String(item).toLowerCase()))
  const toolChecks = [
    { rx: /pull\s*buoy|pullbuoy/, names: ['pull buoy', 'pullbuoy'] },
    { rx: /paddles?/, names: ['paddles', 'paddle'] },
    { rx: /flossen|fins?/, names: ['flossen', 'fins'] },
    { rx: /kickboard|schwimmbrett|brett/, names: ['kickboard', 'schwimmbrett', 'brett'] },
  ]
  for (const tool of toolChecks) {
    if (!tool.rx.test(value)) continue
    if (!tool.names.some(name => available.has(name))) return false
  }
  return true
}

const safeScaleLimit = (oldValue, newValue, action, magnitude) => {
  if (!Number.isFinite(oldValue) || oldValue <= 0 || !Number.isFinite(newValue) || newValue <= 0) {
    return newValue
  }

  const progressCap = magnitude === 'moderate' ? 1.20 : 1.12
  const reduceFloor = magnitude === 'moderate' ? 0.70 : 0.82

  if (action === 'progress') return Math.min(newValue, oldValue * progressCap)
  if (['reduce', 'recovery', 'cautious_return'].includes(action)) {
    return Math.max(newValue, oldValue * reduceFloor)
  }
  if (action === 'swap_type') {
    // Typwechsel soll kein versteckter Umfangssprung sein.
    return Math.min(Math.max(newValue, oldValue * 0.70), oldValue * 1.08)
  }
  return newValue
}

const hasSafetySignal = ({ weekCheckIn, fatigueSignals = [], subjectiveObjectiveSignals = [] }) => {
  const text = JSON.stringify({ weekCheckIn, fatigueSignals, subjectiveObjectiveSignals }).toLowerCase()
  return /(schmerz|pain|verletzt|verletz|krank|fieber|brustsymptom|gelenk|sehne|schulter|blasen|druckstelle|erschöpft|erschoepft|stark müde|stark muede)/.test(text)
}

const allowedByConfidence = ({ item, confidence, nextIsRegenWeek, safetySignal }) => {
  const action = item?.action || 'keep'
  const magnitude = item?.magnitude || 'none'

  if (nextIsRegenWeek && ['progress', 'swap_type'].includes(action)) return false

  if (confidence === 'low') {
    if (!safetySignal) return action === 'keep'
    return ['keep', 'reduce', 'recovery', 'cautious_return'].includes(action)
  }

  if (confidence === 'medium' && action === 'progress' && magnitude === 'moderate') {
    return false
  }

  return true
}

const copyTextPatch = (target, patch, fields) => {
  for (const field of fields) {
    if (nonEmpty(patch?.[field])) target[field] = String(patch[field]).trim()
  }
}

const applyGenericPatch = (day, item, sport) => {
  const patch = item?.patch || {}
  const result = { ...day }

  copyTextPatch(result, patch, [
    'einheit',
    'details',
    'intensity',
    'loadGuidance',
    'distanceGuidance',
    'paceGuidance',
    'elevationGuidance',
    'restGuidance',
    'techniqueTitle',
    'techniqueInstructions',
    'nutritionTip',
    'strengthPrescription',
  ])

  if (n(patch.durationMinutes) > 0) {
    const oldDuration = n(day.durationMinutes)
    result.durationMinutes = Math.round(
      safeScaleLimit(oldDuration, n(patch.durationMinutes), item.action, item.magnitude)
    )
  }

  if (n(patch.techniqueMinutes) > 0) {
    const oldMinutes = n(day.techniqueMinutes)
    result.techniqueMinutes = Math.round(
      safeScaleLimit(oldMinutes, n(patch.techniqueMinutes), item.action, item.magnitude)
    )
  }

  if (n(patch.distanceKm) > 0) {
    const oldKm = n(day.distanceKm) || extractLeadingKm(day.details)
    result.distanceKm = Math.round(
      safeScaleLimit(oldKm, n(patch.distanceKm), item.action, item.magnitude) * 10
    ) / 10
  }

  // Running/Hiking plans often encode the main distance in details rather than a dedicated field.
  // Reject implausibly large progress jumps even if the free text attempted them.
  if (['running', 'hiking', 'cycling', 'mountainbike'].includes(sport) && nonEmpty(patch.details)) {
    const oldKm = extractLeadingKm(day.details)
    const newKm = extractLeadingKm(patch.details)
    if (oldKm && newKm && item.action === 'progress') {
      const cap = item.magnitude === 'moderate' ? oldKm * 1.20 : oldKm * 1.12
      if (newKm > cap + 0.05) return { ...day, adjusted: false, weeklyAdjustmentRejected: true }
    }
  }

  applyClearFields(result, item, sport)
  return result
}

const applyClearFields = (result, item, sport) => {
  const requested = new Set(item?.clearFields || [])
  const allowed = sport === 'swimming'
    ? new Set(['techniqueTitle','techniqueInstructions','techniqueDistanceM','targetSegmentM'])
    : sport === 'mountainbike'
      ? new Set(['paceGuidance','elevationGuidance','nutritionTip','strengthPrescription','techniqueTitle','techniqueInstructions','techniqueMinutes'])
      : sport === 'cycling'
        ? new Set(['paceGuidance','nutritionTip','strengthPrescription'])
        : new Set(['paceGuidance','elevationGuidance','nutritionTip','strengthPrescription'])

  for (const field of requested) {
    if (!allowed.has(field)) continue
    if (['techniqueDistanceM','targetSegmentM','techniqueMinutes'].includes(field)) result[field] = null
    else result[field] = null
  }
  return result
}

const applySwimmingPatch = (day, item, plan) => {
  const patch = item?.patch || {}
  const result = applyClearFields({ ...day }, item, 'swimming')
  const step = poolStep(plan)

  const textFields = [
    'einheit', 'details', 'intensity', 'loadGuidance', 'restGuidance',
    'warmup', 'mainSet', 'cooldown', 'techniqueTitle', 'techniqueInstructions',
  ]

  for (const field of textFields) {
    if (!nonEmpty(patch[field])) continue
    if (!swimmingTextAllowed(patch[field], plan, day)) {
      return { ...day, adjusted: false, weeklyAdjustmentRejected: true }
    }
    result[field] = String(patch[field]).trim()
  }

  const meterFields = [
    'warmupDistanceM', 'mainDistanceM', 'cooldownDistanceM', 'techniqueDistanceM',
    'longestContinuousM', 'targetSegmentM',
  ]

  for (const field of meterFields) {
    const value = n(patch[field])
    if (value <= 0) continue
    if (value % step !== 0) {
      return { ...day, adjusted: false, weeklyAdjustmentRejected: true }
    }
    result[field] = Math.round(value)
  }

  // Warm-up and cool-down must always remain real blocks.
  if (n(result.warmupDistanceM) <= 0 || n(result.cooldownDistanceM) <= 0) {
    return { ...day, adjusted: false, weeklyAdjustmentRejected: true }
  }

  // Never allow a weekly adjustment to jump continuous swimming aggressively.
  if (n(day.longestContinuousM) > 0 && n(result.longestContinuousM) > 0) {
    const maxContinuous = item.action === 'progress'
      ? day.longestContinuousM * (item.magnitude === 'moderate' ? 1.20 : 1.12)
      : Infinity
    if (result.longestContinuousM > maxContinuous + step) {
      return { ...day, adjusted: false, weeklyAdjustmentRejected: true }
    }
  }

  const technique = n(result.techniqueDistanceM)
  result.totalDistanceM =
    n(result.warmupDistanceM) +
    n(result.mainDistanceM) +
    technique +
    n(result.cooldownDistanceM)

  if (result.totalDistanceM % step !== 0) {
    return { ...day, adjusted: false, weeklyAdjustmentRejected: true }
  }

  // Schwimmdauer nach einer Meteränderung wieder konsistent ableiten.
  // Die Weekly soll keine alte Zeitspanne aus der ursprünglichen Einheit stehen lassen.
  const level = String(plan?.swimmingProfile?.techniqueLevel || 'okay').toLowerCase()
  const pacePer100 = level === 'unsure' ? 3.3 : level === 'secure' ? 2.4 : 2.8
  const estimatedCenter = Math.max(10, (result.totalDistanceM / 100) * pacePer100 + 6)
  const low = Math.max(10, Math.floor((estimatedCenter - 2.5) / 5) * 5)
  const high = Math.max(low + 5, Math.ceil((estimatedCenter + 2.5) / 5) * 5)
  result.durationMinutes = Math.round((low + high) / 2)
  result.durationRange = `ca. ${low}–${high} Min`

  return result
}

export function resolveWeeklyAdjustments({
  nextWeekDays = [],
  adjustments = [],
  plan = {},
  facts = {},
  weekCheckIn = null,
  nextIsRegenWeek = false,
}) {
  const sport = normalizeWeeklySport(plan?.sport_type || plan?.plan_type)
  const confidence = facts?.confidence?.level || 'low'
  const safetySignal = hasSafetySignal({
    weekCheckIn,
    fatigueSignals: facts?.fatigueSignals,
    subjectiveObjectiveSignals: facts?.subjectiveObjectiveSignals,
  })

  return (nextWeekDays || []).map(day => {
    const item = (adjustments || []).find(candidate => candidate?.tag === day?.tag)

    if (!item || !item.adjusted || item.action === 'keep') {
      return {
        tag: day.tag,
        adjusted: false,
        action: 'keep',
        adjustmentReason: item?.adjustmentReason || '',
        day,
      }
    }

    if (!allowedByConfidence({ item, confidence, nextIsRegenWeek, safetySignal })) {
      return {
        tag: day.tag,
        adjusted: false,
        action: 'keep',
        adjustmentReason: 'Die Datenbasis reicht für diese automatische Änderung noch nicht aus.',
        day,
      }
    }

    const patched = sport === 'swimming'
      ? applySwimmingPatch(day, item, plan)
      : applyGenericPatch(day, item, sport)

    if (patched.weeklyAdjustmentRejected) {
      const { weeklyAdjustmentRejected, ...safeDay } = patched
      return {
        tag: day.tag,
        adjusted: false,
        action: 'keep',
        adjustmentReason: 'Die vorgeschlagene Änderung wurde durch die Plan-Sicherheitsregeln verworfen.',
        day: safeDay,
      }
    }

    return {
      tag: day.tag,
      adjusted: true,
      action: item.action,
      adjustmentReason: item.adjustmentReason || '',
      day: {
        ...patched,
        adjusted: true,
        adjustmentReason: item.adjustmentReason || '',
      },
    }
  })
}
