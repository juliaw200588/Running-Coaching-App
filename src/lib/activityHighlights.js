const SPORT_LABELS = {
  running: 'Lauf',
  hiking: 'Wanderung',
  walking: 'Walking-Einheit',
  cycling: 'Radtour',
  mountain_biking: 'Mountainbike-Tour',
  swimming: 'Schwimmeinheit',
}

const normalizeSport = value =>
  value === 'walking' ? 'hiking' : value || 'running'

const numberFromValue = value => {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const match = String(value)
    .replace(',', '.')
    .match(/-?[\d.]+/)

  return match ? Number(match[0]) || 0 : 0
}

const distanceKm = activity => {
  const meters = numberFromValue(activity?.distance_meters)
  if (meters > 0) return meters / 1000
  return numberFromValue(activity?.km ?? activity?.distance)
}

const elevationGain = activity =>
  numberFromValue(
    activity?.elevation_gain ??
      activity?.hoehenmeter ??
      activity?.elevationGain
  )

const averageSpeed = activity =>
  numberFromValue(
    activity?.average_speed_kmh ??
      activity?.averageSpeedKmh ??
      activity?.speed
  )

const heartRate = activity =>
  numberFromValue(activity?.bpm ?? activity?.heartRate)

const parsePaceSeconds = value => {
  if (!value) return null
  const match = String(value).match(/(\d+):(\d{2})/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const paceSeconds = activity =>
  parsePaceSeconds(activity?.pace)

const activityDate = activity => {
  const value =
    activity?.actual_date ??
    activity?.actualDate ??
    activity?.date

  if (!value) return null

  const date =
    value instanceof Date
      ? value
      : new Date(
          String(value).length === 10
            ? `${value}T12:00:00`
            : value
        )

  return Number.isNaN(date.getTime()) ? null : date
}

const sameActivity = (activity, current) => {
  const activityId = String(activity?.id ?? '')
  const currentId = String(current?.id ?? '')

  if (activityId && currentId && activityId === currentId) return true

  const polarId = String(activity?.polar_exercise_id ?? '')
  const currentPolarId = String(current?.polarExerciseId ?? '')

  return Boolean(
    polarId &&
      currentPolarId &&
      polarId === currentPolarId
  )
}

const formatKm = value =>
  `${Number(value).toLocaleString('de-DE', {
    maximumFractionDigits: 1,
  })} km`

const formatHm = value =>
  `${Math.round(Number(value)).toLocaleString('de-DE')} hm`

const formatSpeed = value =>
  `${Number(value).toLocaleString('de-DE', {
    maximumFractionDigits: 1,
  })} km/h`

const formatPaceDifference = value =>
  `${Math.round(value)} Sek./km`

const getTrainingFallback = trainingType => {
  const normalized = String(trainingType || '').toLowerCase()

  if (normalized.includes('intervall')) {
    return {
      priority: 20,
      icon: '🔥',
      text: 'Intervalltraining erfolgreich abgeschlossen',
      type: 'training',
    }
  }

  if (
    normalized.includes('long run') ||
    normalized.includes('langer lauf') ||
    normalized.includes('lang')
  ) {
    return {
      priority: 20,
      icon: '💪',
      text: 'Long Run erfolgreich abgeschlossen',
      type: 'training',
    }
  }

  if (
    normalized.includes('tempo') ||
    normalized.includes('schwelle')
  ) {
    return {
      priority: 20,
      icon: '⚡',
      text: 'Tempolauf erfolgreich abgeschlossen',
      type: 'training',
    }
  }

  if (
    normalized.includes('regeneration') ||
    normalized.includes('recovery')
  ) {
    return {
      priority: 20,
      icon: '🌿',
      text: 'Regenerationseinheit abgeschlossen',
      type: 'training',
    }
  }

  if (normalized.includes('locker')) {
    return {
      priority: 20,
      icon: '🌿',
      text: 'Lockere Einheit abgeschlossen',
      type: 'training',
    }
  }

  return {
    priority: 10,
    icon: '✨',
    text: 'Aktivität erfolgreich abgeschlossen',
    type: 'motivation',
  }
}

export function selectActivityHighlight({
  current,
  history = [],
  trainingType = '',
}) {
  if (!current) return getTrainingFallback(trainingType)

  const sportType = normalizeSport(current.sportType)
  const comparable = history
    .filter(activity => !sameActivity(activity, current))
    .filter(
      activity =>
        normalizeSport(activity?.sport_type) === sportType
    )

  const candidates = []
  const currentDistance = distanceKm(current)
  const currentElevation = elevationGain(current)
  const currentSpeed = averageSpeed(current)
  const currentPace = paceSeconds(current)

  if (currentDistance > 0) {
    const previousMaximum = comparable.reduce(
      (maximum, activity) =>
        Math.max(maximum, distanceKm(activity)),
      0
    )

    if (currentDistance > previousMaximum + 0.01) {
      const labels = {
        running: 'Neuer längster Lauf',
        hiking: 'Neue längste Wanderung',
        cycling: 'Neue längste Radtour',
        mountain_biking: 'Neue längste Mountainbike-Tour',
        swimming: 'Neue längste Schwimmeinheit',
      }

      candidates.push({
        priority: 100,
        icon: '🏅',
        text:
          labels[sportType] ||
          `Neue längste ${SPORT_LABELS[sportType] || 'Aktivität'}`,
        detail: formatKm(currentDistance),
        type: 'record',
      })
    }
  }

  if (
    currentElevation > 0 &&
    ['mountain_biking', 'cycling', 'hiking'].includes(
      sportType
    )
  ) {
    const previousMaximum = comparable.reduce(
      (maximum, activity) =>
        Math.max(maximum, elevationGain(activity)),
      0
    )

    if (currentElevation > previousMaximum + 0.5) {
      candidates.push({
        priority: 96,
        icon: '⛰️',
        text:
          sportType === 'mountain_biking'
            ? 'Neuer MTB-Höhenmeterrekord'
            : 'Neuer Höhenmeterrekord',
        detail: formatHm(currentElevation),
        type: 'record',
      })
    }
  }

  if (
    currentSpeed > 0 &&
    ['mountain_biking', 'cycling'].includes(sportType) &&
    currentDistance >= 3
  ) {
    const previousMaximum = comparable
      .filter(activity => distanceKm(activity) >= 3)
      .reduce(
        (maximum, activity) =>
          Math.max(maximum, averageSpeed(activity)),
        0
      )

    if (currentSpeed > previousMaximum + 0.05) {
      candidates.push({
        priority: 92,
        icon: '⚡',
        text:
          sportType === 'mountain_biking'
            ? 'Schnellste Mountainbike-Tour'
            : 'Schnellste Radtour',
        detail: formatSpeed(currentSpeed),
        type: 'record',
      })
    }
  }

  if (
    sportType === 'running' &&
    currentPace &&
    currentDistance >= 3
  ) {
    const priorPaces = comparable
      .filter(activity => distanceKm(activity) >= 3)
      .map(paceSeconds)
      .filter(value => value != null)

    if (priorPaces.length > 0) {
      const fastestPrior = Math.min(...priorPaces)

      if (currentPace < fastestPrior) {
        candidates.push({
          priority: 94,
          icon: '⚡',
          text: 'Neue schnellste Laufpace',
          detail: `${Math.floor(currentPace / 60)}:${String(
            Math.round(currentPace % 60)
          ).padStart(2, '0')} min/km`,
          type: 'record',
        })
      }

      const recentPrior = comparable
        .filter(activity => distanceKm(activity) >= 3)
        .filter(activity => activityDate(activity))
        .sort(
          (a, b) =>
            activityDate(b).getTime() -
            activityDate(a).getTime()
        )
        .slice(0, 5)
        .map(paceSeconds)
        .filter(value => value != null)

      if (recentPrior.length >= 3) {
        const averagePrior =
          recentPrior.reduce((sum, value) => sum + value, 0) /
          recentPrior.length
        const improvement = averagePrior - currentPace

        if (improvement >= 10) {
          candidates.push({
            priority: 78,
            icon: '📈',
            text: `Pace um ${formatPaceDifference(
              improvement
            )} verbessert`,
            type: 'development',
          })
        }
      }
    }
  }

  const currentHr = heartRate(current)

  if (currentHr > 0 && comparable.length >= 5) {
    const similar = comparable.filter(activity => {
      const candidateDistance = distanceKm(activity)
      if (!candidateDistance || !currentDistance) return false

      return (
        candidateDistance >= currentDistance * 0.8 &&
        candidateDistance <= currentDistance * 1.2
      )
    })

    const priorHeartRates = similar
      .map(heartRate)
      .filter(value => value > 0)

    if (priorHeartRates.length >= 3) {
      const averagePrior =
        priorHeartRates.reduce((sum, value) => sum + value, 0) /
        priorHeartRates.length

      if (averagePrior - currentHr >= 5) {
        candidates.push({
          priority: 70,
          icon: '❤️',
          text: 'Effizienter als bei vergleichbaren Einheiten',
          detail: `${Math.round(
            averagePrior - currentHr
          )} bpm niedriger`,
          type: 'development',
        })
      }
    }
  }

  const allDates = [
    ...history.map(activityDate),
    activityDate(current),
  ]
    .filter(Boolean)
    .map(date => date.toISOString().slice(0, 10))

  const uniqueDates = [...new Set(allDates)].sort()
  let bestStreak = 0
  let currentStreak = 0
  let previousDate = null

  uniqueDates.forEach(value => {
    const date = new Date(`${value}T12:00:00`)

    if (!previousDate) {
      currentStreak = 1
    } else {
      const difference = Math.round(
        (date.getTime() - previousDate.getTime()) /
          86400000
      )
      currentStreak =
        difference === 1 ? currentStreak + 1 : 1
    }

    bestStreak = Math.max(bestStreak, currentStreak)
    previousDate = date
  })

  const currentDateValue = activityDate(current)
    ?.toISOString()
    .slice(0, 10)

  if (
    bestStreak >= 3 &&
    currentDateValue === uniqueDates[uniqueDates.length - 1]
  ) {
    candidates.push({
      priority: 55,
      icon: '🔥',
      text: `${bestStreak} Tage in Folge aktiv`,
      type: 'streak',
    })
  }

  candidates.push(getTrainingFallback(trainingType))

  return candidates.sort(
    (a, b) => b.priority - a.priority
  )[0]
}
