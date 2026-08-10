const HERO_POOL_SIZE = 8
const RECENT_BLOCK_SIZE = 3
const STORAGE_VERSION = 'v1'

export const HERO_IMAGE_POOLS = {
  easy: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/running/easy/${String(i + 1).padStart(2, '0')}.webp`),
  tempo: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/running/tempo/${String(i + 1).padStart(2, '0')}.webp`),
  interval: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/running/interval/${String(i + 1).padStart(2, '0')}.webp`),
  long: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/running/long/${String(i + 1).padStart(2, '0')}.webp`),
  recovery: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/running/recovery/${String(i + 1).padStart(2, '0')}.webp`),
  rest: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/rest/${String(i + 1).padStart(2, '0')}.webp`),
  cycling: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/cycling/${String(i + 1).padStart(2, '0')}.webp`),
  mountain_biking: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/mtb/${String(i + 1).padStart(2, '0')}.webp`),
  hiking: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/hiking/${String(i + 1).padStart(2, '0')}.webp`),
  swimming: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/swimming/${String(i + 1).padStart(2, '0')}.webp`),
  free: Array.from({ length: HERO_POOL_SIZE }, (_, i) => `/hero/free/${String(i + 1).padStart(2, '0')}.webp`),
}

const normalizeSport = value => {
  const text = String(value || '').toLowerCase()
  if (/mountain|mtb/.test(text)) return 'mountain_biking'
  if (/bike|cycling|rad|velo/.test(text)) return 'cycling'
  if (/walk|hike|wander|marsch/.test(text)) return 'hiking'
  if (/swim|schwimm/.test(text)) return 'swimming'
  if (/run|running|jog|lauf/.test(text)) return 'running'
  return 'other'
}

const runningCategoryFromText = value => {
  const text = String(value || '').toLowerCase()
  if (/intervall|800m|400m|1000m|wiederholung|repetition/.test(text)) return 'interval'
  if (/tempo|schwelle|threshold|tempodauer|fahrtspiel|race pace/.test(text)) return 'tempo'
  if (/lang|long run|langstrecke/.test(text)) return 'long'
  if (/regeneration|recovery|erholung/.test(text)) return 'recovery'
  return 'easy'
}

const categoryForHero = hero => {
  if (!hero) return 'free'
  if (hero.type === 'rest') return 'rest'

  const sport = normalizeSport(hero?.log?.sport_type ?? hero?.plannedDay?.sport_type)

  if (sport === 'cycling') return 'cycling'
  if (sport === 'mountain_biking') return 'mountain_biking'
  if (sport === 'hiking') return 'hiking'
  if (sport === 'swimming') return 'swimming'

  if (sport === 'running') {
    return runningCategoryFromText(
      `${hero?.plannedDay?.einheit || ''} ${hero?.plannedDay?.details || ''} ${hero?.title || ''}`
    )
  }

  if (['today', 'trained', 'already', 'open'].includes(hero.type) && hero?.plannedDay) {
    return runningCategoryFromText(
      `${hero.plannedDay.einheit || ''} ${hero.plannedDay.details || ''} ${hero.title || ''}`
    )
  }

  if (['analysis', 'weekDone', 'before', 'completedPlan'].includes(hero.type)) {
    return 'rest'
  }

  return 'free'
}

const stableKeyForHero = ({ hero, dateKey, weekNumber }) => {
  const activityId = hero?.log?.id ?? hero?.log?.polar_exercise_id ?? hero?.log?.polar_session_id
  if (activityId) return `activity:${activityId}`
  if (hero?.plannedDay?.key) return `planned:${hero.plannedDay.key}`
  if (hero?.type === 'analysis' && weekNumber != null) return `analysis:week:${weekNumber}`
  if (hero?.type === 'weekDone' && weekNumber != null) return `weekDone:${weekNumber}`
  return `${hero?.type || 'hero'}:${dateKey || 'today'}`
}

const hashString = value => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const storageKey = userId =>
  `run_coaching_hero_images_${STORAGE_VERSION}_${userId || 'anonymous'}`

const readState = userId => {
  if (typeof window === 'undefined') return { assignments: {}, recent: {} }
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return { assignments: {}, recent: {} }
    const parsed = JSON.parse(raw)
    return {
      assignments: parsed?.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {},
      recent: parsed?.recent && typeof parsed.recent === 'object' ? parsed.recent : {},
    }
  } catch {
    return { assignments: {}, recent: {} }
  }
}

const writeState = (userId, state) => {
  if (typeof window === 'undefined') return
  try {
    const assignmentEntries = Object.entries(state.assignments || {})
    const trimmedAssignments = Object.fromEntries(assignmentEntries.slice(-200))
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ assignments: trimmedAssignments, recent: state.recent || {} })
    )
  } catch {}
}

const chooseIndex = ({ category, stableKey, userId, poolLength }) => {
  const state = readState(userId)
  const assignmentKey = `${category}|${stableKey}`
  const existing = state.assignments?.[assignmentKey]

  if (existing != null && Number.isInteger(existing) && existing >= 0 && existing < poolLength) {
    return existing
  }

  const recent = Array.isArray(state.recent?.[category])
    ? state.recent[category].filter(index => Number.isInteger(index) && index >= 0 && index < poolLength)
    : []

  let candidates = Array.from({ length: poolLength }, (_, index) => index)
    .filter(index => !recent.slice(0, RECENT_BLOCK_SIZE).includes(index))

  if (!candidates.length) {
    candidates = Array.from({ length: poolLength }, (_, index) => index)
  }

  const seed = hashString(`${userId || 'anonymous'}|${category}|${stableKey}`)
  const index = candidates[seed % candidates.length]

  state.assignments ||= {}
  state.recent ||= {}
  state.assignments[assignmentKey] = index
  state.recent[category] = [index, ...recent.filter(item => item !== index)]
    .slice(0, RECENT_BLOCK_SIZE)

  writeState(userId, state)
  return index
}

export const getHeroImageForDashboard = ({ hero, userId, dateKey, weekNumber }) => {
  const category = categoryForHero(hero)
  const pool = HERO_IMAGE_POOLS[category] ?? HERO_IMAGE_POOLS.free
  if (!pool?.length) return null

  const stableKey = stableKeyForHero({ hero, dateKey, weekNumber })
  const index = chooseIndex({ category, stableKey, userId, poolLength: pool.length })

  return pool[index] || pool[0] || null
}
