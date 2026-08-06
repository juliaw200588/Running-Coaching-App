import { getDefinitionsForActiveSports } from './achievementDefinitions.js'

const DAY_MS = 86400000

const numberFromValue = value => {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const match = String(value).replace(',', '.').match(/-?[\d.]+/)
  return match ? Number(match[0]) || 0 : 0
}

const parsePaceSeconds = value => {
  if (!value) return null
  const match = String(value).match(/(\d+):(\d{2})/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const normalizeSport = value => {
  const raw = String(value || '').toLowerCase()
  if (raw === 'walking') return 'hiking'
  if (raw === 'indoor_cycling' || raw === 'indoor cycling') return 'cycling'
  return raw || 'running'
}

const activityDate = activity => {
  const raw = activity?.actual_date ?? activity?.actualDate ?? activity?.date ?? activity?.created_at
  if (!raw) return null
  const date = raw instanceof Date ? raw : new Date(String(raw).length === 10 ? `${raw}T12:00:00` : raw)
  return Number.isNaN(date.getTime()) ? null : date
}

const activityStartHour = activity => {
  const time = activity?.uhrzeit ?? activity?.start_time ?? activity?.startTime
  if (!time) return null
  const match = String(time).match(/(\d{1,2}):(\d{2})/)
  return match ? Number(match[1]) : null
}

const distanceKm = activity => {
  const meters = numberFromValue(activity?.distance_meters)
  return meters > 0 ? meters / 1000 : numberFromValue(activity?.km ?? activity?.distance)
}

const durationSeconds = activity => {
  const direct = numberFromValue(activity?.moving_time_seconds ?? activity?.duration_seconds)
  if (direct > 0) return direct
  const distance = distanceKm(activity)
  const pace = parsePaceSeconds(activity?.pace)
  return distance > 0 && pace ? distance * pace : 0
}

const elevationMeters = activity => Math.max(0, numberFromValue(activity?.elevation_gain ?? activity?.hoehenmeter ?? activity?.elevationGain))

const averageSpeedKmh = activity => {
  const direct = numberFromValue(activity?.average_speed_kmh ?? activity?.averageSpeedKmh)
  if (direct > 0) return direct
  const distance = distanceKm(activity)
  const seconds = durationSeconds(activity)
  return distance > 0 && seconds > 0 ? distance / (seconds / 3600) : 0
}

const isIndoor = activity => {
  const text = String(activity?.sport ?? activity?.sport_name ?? activity?.activity_name ?? '').toLowerCase()
  return text.includes('indoor') || activity?.is_indoor === true
}

const isPlausible = activity => {
  const sport = normalizeSport(activity?.sport_type)
  const distance = distanceKm(activity)
  const speed = averageSpeedKmh(activity)
  if (distance < 0 || elevationMeters(activity) < 0) return false
  if (sport === 'running' && (distance > 120 || speed > 35)) return false
  if (['cycling', 'mountain_biking'].includes(sport) && (distance > 600 || speed > 100)) return false
  if (sport === 'hiking' && (distance > 150 || speed > 15)) return false
  if (sport === 'swimming' && distance > 30) return false
  return true
}

const normalize = activity => ({
  raw: activity,
  id: activity?.id ?? null,
  sport: normalizeSport(activity?.sport_type),
  date: activityDate(activity),
  startHour: activityStartHour(activity),
  distanceKm: distanceKm(activity),
  durationSeconds: durationSeconds(activity),
  elevationMeters: elevationMeters(activity),
  averageSpeedKmh: averageSpeedKmh(activity),
  paceSeconds: parsePaceSeconds(activity?.pace),
  indoor: isIndoor(activity),
})

const dateKey = date => date.toISOString().slice(0, 10)
const startOfWeek = date => {
  const copy = new Date(date)
  const day = copy.getDay() || 7
  copy.setDate(copy.getDate() - day + 1)
  copy.setHours(12, 0, 0, 0)
  return copy
}
const seasonForDate = date => {
  const month = date.getMonth() + 1
  if ([12, 1, 2].includes(month)) return 'winter'
  if ([3, 4, 5].includes(month)) return 'spring'
  if ([6, 7, 8].includes(month)) return 'summer'
  return 'autumn'
}

const cumulativeCrossing = ({ activities, selector, threshold }) => {
  let total = 0
  for (const activity of activities) {
    total += selector(activity)
    if (total >= threshold) return { unlocked: true, value: total, unlockDate: activity.date, activityId: activity.id }
  }
  return { unlocked: false, value: total, unlockDate: null, activityId: null }
}

const firstMatching = (activities, predicate) => {
  const match = activities.find(predicate)
  return match
    ? { unlocked: true, value: true, unlockDate: match.date, activityId: match.id }
    : { unlocked: false, value: false, unlockDate: null, activityId: null }
}

const longestSequence = (dates, stepDays) => {
  const values = [...new Set(dates.map(dateKey))].sort().map(key => new Date(`${key}T12:00:00`))
  let best = 0, current = 0, previous = null, unlockDate = null
  for (const date of values) {
    current = !previous ? 1 : Math.round((date - previous) / DAY_MS) === stepDays ? current + 1 : 1
    if (current > best) { best = current; unlockDate = date }
    previous = date
  }
  return { value: best, unlockDate }
}

const evaluateDefinition = (definition, allActivities, sportActivities) => {
  let relevant = definition.sport === 'all' ? allActivities : sportActivities
  if (definition.excludeIndoor) relevant = relevant.filter(activity => !activity.indoor)

  switch (definition.metric) {
    case 'activity_count': return cumulativeCrossing({ activities: relevant, selector: () => 1, threshold: definition.threshold })
    case 'total_hours': return cumulativeCrossing({ activities: relevant, selector: a => a.durationSeconds / 3600, threshold: definition.threshold })
    case 'total_distance_km': return cumulativeCrossing({ activities: relevant, selector: a => a.distanceKm, threshold: definition.threshold })
    case 'total_elevation_m': return cumulativeCrossing({ activities: relevant, selector: a => a.elevationMeters, threshold: definition.threshold })
    case 'single_distance_km': return firstMatching(relevant, a => a.distanceKm >= definition.threshold)
    case 'single_duration_hours': return firstMatching(relevant, a => a.durationSeconds / 3600 >= definition.threshold)
    case 'single_elevation_m': return firstMatching(relevant, a => a.elevationMeters >= definition.threshold)
    case 'pace_under_seconds': return firstMatching(relevant, a => a.distanceKm >= (definition.minDistanceKm || 0) && a.paceSeconds != null && a.paceSeconds < definition.threshold)
    case 'average_speed_over': return firstMatching(relevant, a => a.distanceKm >= (definition.minDistanceKm || 0) && a.averageSpeedKmh >= definition.threshold && a.averageSpeedKmh <= (definition.maxPlausibleSpeedKmh || 100))
    case 'vertical_ratio_over': return firstMatching(relevant, a => a.distanceKm >= (definition.minDistanceKm || 0) && a.distanceKm > 0 && a.elevationMeters / a.distanceKm >= definition.threshold)
    case 'active_day_streak': {
      const result = longestSequence(relevant.map(a => a.date), 1)
      return { unlocked: result.value >= definition.threshold, value: result.value, unlockDate: result.value >= definition.threshold ? result.unlockDate : null, activityId: null }
    }
    case 'active_week_streak': {
      const weeks = [...new Map(relevant.map(a => { const week = startOfWeek(a.date); return [dateKey(week), week] })).values()]
      const result = longestSequence(weeks, 7)
      return { unlocked: result.value >= definition.threshold, value: result.value, unlockDate: result.value >= definition.threshold ? result.unlockDate : null, activityId: null }
    }
    case 'start_before_hour': return firstMatching(relevant, a => a.startHour != null && a.startHour < definition.threshold)
    case 'start_after_hour': return firstMatching(relevant, a => a.startHour != null && a.startHour >= definition.threshold)
    case 'calendar_date': return firstMatching(relevant, a => a.date.toISOString().slice(5, 10) === definition.threshold)
    case 'four_seasons': {
      const seasons = new Set(relevant.map(a => seasonForDate(a.date)))
      const last = relevant.at(-1)
      return { unlocked: seasons.size >= definition.threshold, value: seasons.size, unlockDate: seasons.size >= definition.threshold ? last?.date : null, activityId: seasons.size >= definition.threshold ? last?.id : null }
    }
    default: return { unlocked: false, value: 0, unlockDate: null, activityId: null }
  }
}

const progressFor = (definition, result) => {
  const target = Number(definition.threshold)
  const current = typeof result.value === 'number' ? result.value : result.unlocked ? target : 0
  if (!Number.isFinite(target)) return { current, target: definition.threshold, percent: result.unlocked ? 100 : 0, remaining: null }
  return { current, target, percent: Math.max(0, Math.min(100, Math.round((current / target) * 100))), remaining: Math.max(0, target - current) }
}

export const evaluateAchievements = ({ activities = [], existingUnlocks = [] }) => {
  const normalized = activities.filter(isPlausible).map(normalize).filter(a => a.date).sort((a, b) => a.date - b.date)
  const activeSports = [...new Set(normalized.map(a => a.sport))]
  const definitions = getDefinitionsForActiveSports(activeSports)
  const existingById = new Map(existingUnlocks.map(unlock => [unlock.achievement_id ?? unlock.achievementId, unlock]))

  const achievements = definitions.map(definition => {
    const sportActivities = definition.sport === 'all' ? normalized : normalized.filter(a => a.sport === definition.sport)
    const result = evaluateDefinition(definition, normalized, sportActivities)
    const existing = existingById.get(definition.id)
    return {
      ...definition,
      unlocked: Boolean(existing) || result.unlocked,
      newlyUnlocked: !existing && result.unlocked,
      unlockedAt: existing?.unlocked_at ?? existing?.unlockedAt ?? (result.unlockDate ? result.unlockDate.toISOString() : null),
      activityId: existing?.activity_id ?? existing?.activityId ?? result.activityId ?? null,
      progress: progressFor(definition, result),
    }
  })

  const unlocked = achievements.filter(a => a.unlocked)
  return {
    activeSports,
    achievements,
    newlyUnlocked: achievements.filter(a => a.newlyUnlocked),
    unlocked,
    locked: achievements.filter(a => !a.unlocked),
    summary: { total: achievements.length, unlocked: unlocked.length, percent: achievements.length ? Math.round((unlocked.length / achievements.length) * 100) : 0 },
  }
}
