const normalizeSport = value => {
  const raw = String(value || '').toLowerCase()
  if (raw === 'walking') return 'hiking'
  if (raw === 'indoor_cycling' || raw === 'indoor cycling') return 'cycling'
  return raw || 'all'
}

export const JOURNEY_SPORT_META = {
  all: { label: 'Alle', icon: '✨' },
  running: { label: 'Laufen', icon: '🏃' },
  cycling: { label: 'Radfahren', icon: '🚴' },
  mountain_biking: { label: 'MTB', icon: '🚵' },
  hiking: { label: 'Wandern', icon: '🥾' },
  swimming: { label: 'Schwimmen', icon: '🏊' },
}

const toDate = value => {
  if (!value) return null

  const date = new Date(
    String(value).length === 10
      ? `${value}T12:00:00`
      : value
  )

  return Number.isNaN(date.getTime()) ? null : date
}

const isMajorAchievement = achievement => {
  if (!achievement?.unlocked) return false
  if (achievement.category === 'moments') return true
  if (achievement.visibility === 'secret') return true

  const threshold = Number(achievement.threshold)

  if (achievement.metric === 'activity_count') {
    return [1, 10, 50, 100, 250, 500, 1000].includes(threshold)
  }

  if (achievement.metric === 'single_distance_km') {
    return true
  }

  if (achievement.metric === 'total_distance_km') {
    return [100, 500, 1000, 2500, 5000, 10000, 25000].includes(threshold)
  }

  if (achievement.metric === 'total_elevation_m') {
    return [10000, 25000, 50000, 100000, 250000, 500000].includes(threshold)
  }

  if (achievement.metric === 'pace_under_seconds') {
    return threshold <= 420
  }

  if (achievement.metric === 'active_day_streak') {
    return threshold >= 7
  }

  if (achievement.metric === 'active_week_streak') {
    return threshold >= 10
  }

  return ['epic', 'legendary'].includes(achievement.rarity)
}

const buildAchievementEvents = achievements =>
  achievements
    .filter(achievement => achievement.unlocked && achievement.unlockedAt)
    .map(achievement => ({
      id: `achievement_${achievement.id}`,
      type: 'achievement',
      date: toDate(achievement.unlockedAt),
      sport: achievement.sport || 'all',
      title: achievement.title,
      story: achievement.story || achievement.description,
      description: achievement.description,
      icon: achievement.icon || '🏆',
      rarity: achievement.rarity || 'common',
      highlight: isMajorAchievement(achievement),
      activityId: achievement.activityId || null,
      achievementId: achievement.id,
    }))
    .filter(event => event.date)

const firstSportStory = sport => {
  switch (sport) {
    case 'running':
      return 'Hier begann dein Weg laufend.'
    case 'cycling':
      return 'Hier begann dein Weg auf zwei Rädern.'
    case 'mountain_biking':
      return 'Hier begann dein erstes Abenteuer im Gelände.'
    case 'hiking':
      return 'Hier begann dein Weg zu Fuß.'
    case 'swimming':
      return 'Hier begann dein Weg im Wasser.'
    default:
      return 'Hier begann ein neuer Teil deines sportlichen Weges.'
  }
}

const firstSportTitle = sport => {
  switch (sport) {
    case 'running':
      return 'Erster Lauf'
    case 'cycling':
      return 'Erste Radtour'
    case 'mountain_biking':
      return 'Erste MTB-Tour'
    case 'hiking':
      return 'Erste Wanderung'
    case 'swimming':
      return 'Erste Schwimmeinheit'
    default:
      return 'Erste Aktivität'
  }
}

const sportIcon = sport =>
  JOURNEY_SPORT_META[sport]?.icon || '✨'

const buildFirstSportEvents = (activities, achievements) => {
  const sports = [
    'running',
    'cycling',
    'mountain_biking',
    'hiking',
    'swimming',
  ]

  const achievementFirstSports = new Set(
    achievements
      .filter(
        achievement =>
          achievement.unlocked &&
          achievement.metric === 'activity_count' &&
          Number(achievement.threshold) === 1 &&
          achievement.sport !== 'all'
      )
      .map(achievement => achievement.sport)
  )

  return sports
    .filter(sport => !achievementFirstSports.has(sport))
    .map(sport => {
      const first = activities
        .filter(
          activity =>
            normalizeSport(activity?.sport_type) === sport
        )
        .map(activity => ({
          activity,
          date: toDate(activity?.actual_date || activity?.date),
        }))
        .filter(item => item.date)
        .sort((a, b) => a.date - b.date)[0]

      if (!first) return null

      return {
        id: `first_sport_${sport}`,
        type: 'first_sport',
        date: first.date,
        sport,
        title: firstSportTitle(sport),
        story: firstSportStory(sport),
        description: first.activity?.activity_name || null,
        icon: sportIcon(sport),
        rarity: 'common',
        highlight: true,
        activityId: first.activity?.id || null,
      }
    })
    .filter(Boolean)
}

const attachActivity = (event, activityMap) => {
  if (!event.activityId) return event
  const activity = activityMap.get(String(event.activityId))
  if (!activity) return event

  const km =
    activity?.km ??
    (activity?.distance_meters != null
      ? Number(activity.distance_meters) / 1000
      : null)

  return {
    ...event,
    activity: {
      name: activity?.activity_name || null,
      km:
        km != null && Number.isFinite(Number(km))
          ? Number(km)
          : null,
      sport: normalizeSport(activity?.sport_type),
    },
  }
}

export const buildJourney = ({
  achievements = [],
  activities = [],
}) => {
  const activityMap = new Map(
    activities
      .filter(activity => activity?.id != null)
      .map(activity => [String(activity.id), activity])
  )

  const events = [
    ...buildAchievementEvents(achievements),
    ...buildFirstSportEvents(activities, achievements),
  ]
    .map(event => attachActivity(event, activityMap))
    .sort((a, b) => b.date - a.date)

  return events
}

export const groupJourneyByYear = events => {
  const groups = new Map()

  events.forEach(event => {
    const year = event.date.getFullYear()

    if (!groups.has(year)) {
      groups.set(year, [])
    }

    groups.get(year).push(event)
  })

  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, yearEvents]) => ({
      year,
      events: yearEvents,
    }))
}
