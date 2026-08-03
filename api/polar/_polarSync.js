import { createClient } from '@supabase/supabase-js'

const POLAR_API_BASE = 'https://www.polaraccesslink.com/v4/data'
const POLAR_TOKEN_URL = 'https://auth.polar.com/oauth/token'
const LOOKBACK_DAYS = 30

const SPORT_IMPORT_VERSIONS = {
  running: 1,
  walking: 1,
  hiking: 1,
  cycling: 1,
  mountain_biking: 1,
  swimming: 1,
}

// Polar V4 Sync v2.1:
// Detaildaten bleiben erhalten, auch wenn Training Targets nicht verfügbar sind.

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${name}`)
  return value
}

async function readJsonOrText(response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function polarErrorMessage(payload) {
  if (!payload) return ''
  if (typeof payload === 'string') return payload
  return (
    payload.errorMessage ||
    payload.error ||
    payload.message ||
    JSON.stringify(payload)
  )
}

async function polarFetch(path, token, query = {}) {
  const url = new URL(`${POLAR_API_BASE}${path}`)

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue

    if (Array.isArray(value)) {
      for (const entry of value) url.searchParams.append(key, String(entry))
    } else {
      url.searchParams.set(key, String(value))
    }
  }

  console.log('[Polar V4] GET', url.toString())

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  const payload = await readJsonOrText(response)

  console.log(`[Polar V4] Antwort ${response.status}: ${url.pathname}`)

  if (!response.ok) {
    const message = polarErrorMessage(payload)
    console.error('[Polar V4] Request fehlgeschlagen:', {
      status: response.status,
      url: url.toString(),
      response: message,
    })

    const error = new Error(
      `Polar V4 API Fehler (${response.status})${message ? `: ${message}` : ''}`
    )
    error.status = response.status
    error.payload = payload
    throw error
  }

  return payload || {}
}

async function getIntegration(userId) {
  const { data, error } = await supabase
    .from('integrations')
    .select(
      'polar_access_token, polar_refresh_token, polar_token_expires_at'
    )
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('[Polar V4] Integration konnte nicht geladen werden:', error)
    throw new Error('Polar-Verbindung konnte nicht geladen werden')
  }

  if (!data?.polar_access_token) {
    throw new Error('Polar ist nicht verbunden')
  }

  return data
}

async function refreshAccessToken(userId, integration) {
  if (!integration.polar_refresh_token) {
    throw new Error(
      'Polar-Zugriff ist abgelaufen und es ist kein Refresh-Token vorhanden. Bitte Polar neu verbinden.'
    )
  }

  const clientId = requireEnv('POLAR_CLIENT_ID')
  const clientSecret = requireEnv('POLAR_CLIENT_SECRET')
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(POLAR_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.polar_refresh_token,
    }),
  })

  const payload = await readJsonOrText(response)

  if (!response.ok || !payload?.access_token) {
    const message = polarErrorMessage(payload)
    console.error('[Polar V4] Token-Refresh fehlgeschlagen:', {
      status: response.status,
      response: message,
    })
    throw new Error(
      'Polar-Token konnte nicht erneuert werden. Bitte Polar trennen und neu verbinden.'
    )
  }

  const expiresIn = Number(payload.expires_in || 43199)
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error } = await supabase
    .from('integrations')
    .update({
      polar_access_token: payload.access_token,
      polar_refresh_token:
        payload.refresh_token || integration.polar_refresh_token,
      polar_token_expires_at: expiresAt,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('[Polar V4] Neue Tokens konnten nicht gespeichert werden:', error)
    throw new Error('Erneuerter Polar-Token konnte nicht gespeichert werden')
  }

  return payload.access_token
}

async function getValidAccessToken(userId) {
  const integration = await getIntegration(userId)

  const expiresAt = integration.polar_token_expires_at
    ? new Date(integration.polar_token_expires_at).getTime()
    : 0

  const expiresSoon =
    !Number.isFinite(expiresAt) || expiresAt - Date.now() < 5 * 60 * 1000

  if (!expiresSoon) return integration.polar_access_token

  return refreshAccessToken(userId, integration)
}

// Polar akzeptiert bei Training Sessions lokale ISO-Datumszeiten ohne
// Millisekunden und ohne Zeitzonen-Suffix, z. B. 2026-08-02T10:30:00.
function formatPolarLocalDateTime(date) {
  return date.toISOString().slice(0, 19)
}

function addUtcDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function getSportsMap(token) {
  try {
    const data = await polarFetch('/sports/list', token)

    // Unterschiedliche mögliche Antwortstrukturen abfangen.
    const sports =
      Array.isArray(data)
        ? data
        : Array.isArray(data?.sports)
          ? data.sports
          : Array.isArray(data?.data?.sports)
            ? data.data.sports
            : Array.isArray(data?.result?.sports)
              ? data.result.sports
              : Array.isArray(data?.items)
                ? data.items
                : []

    const map = {}

    for (const sport of sports) {
      const id =
        sport?.id?.id ??
        sport?.id ??
        sport?.sportId?.id ??
        sport?.sportId

      if (id === undefined || id === null) continue

      const localizedNames = sport?.localizedNames || {}

      const localizedName =
        localizedNames?.de?.longName ||
        localizedNames?.de_DE?.longName ||
        localizedNames?.['de-DE']?.longName ||
        localizedNames?.en?.longName ||
        localizedNames?.en_US?.longName ||
        localizedNames?.['en-US']?.longName ||
        null

      const name =
        localizedName ||
        sport?.name ||
        sport?.displayName ||
        sport?.sportName ||
        null

      map[String(id)] = name
    }


    return map
  } catch (error) {
    if (error.status === 403) {
      console.warn(
        '[Polar V4] Sportarten-Katalog nicht freigegeben. Der Scope "sports:read" fehlt.'
      )
      return {}
    }

    throw error
  }
}

function detectSportType(sportName) {
  if (!sportName) return null

  const normalized = String(sportName).trim().toLowerCase()

  // Reihenfolge ist wichtig: Mountainbike muss vor dem allgemeinen
  // Fahrrad-Mapping geprüft werden.
  if (
    normalized.includes('mountain bike') ||
    normalized.includes('mountainbike') ||
    normalized.includes('mountain biking') ||
    normalized.includes('mtb')
  ) {
    return 'mountain_biking'
  }

  if (
    normalized.includes('running') ||
    normalized.includes('run') ||
    normalized.includes('laufen') ||
    normalized.includes('lauf') ||
    normalized.includes('jogging') ||
    normalized.includes('trail running')
  ) {
    return 'running'
  }

  if (
    normalized.includes('hiking') ||
    normalized.includes('wandern') ||
    normalized.includes('wanderung') ||
    normalized.includes('trekking') ||
    normalized.includes('trek')
  ) {
    return 'hiking'
  }

  if (
    normalized.includes('nordic walking') ||
    normalized.includes('walking') ||
    normalized.includes('gehen')
  ) {
    return 'walking'
  }

  if (
    normalized.includes('cycling') ||
    normalized.includes('biking') ||
    normalized.includes('bike') ||
    normalized.includes('bicycle') ||
    normalized.includes('radfahren') ||
    normalized.includes('rennrad') ||
    normalized.includes('gravel')
  ) {
    return 'cycling'
  }

  if (
    normalized.includes('swimming') ||
    normalized.includes('swim') ||
    normalized.includes('schwimmen')
  ) {
    return 'swimming'
  }

  return null
}

function isRunningSportType(sportType) {
  return sportType === 'running'
}

function isFootSportType(sportType) {
  return (
    sportType === 'running' ||
    sportType === 'walking' ||
    sportType === 'hiking'
  )
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null)
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function calculatePace(distanceMeters, durationMillis) {
  const distance = numberOrNull(distanceMeters)
  const duration = numberOrNull(durationMillis)

  if (!distance || distance <= 0 || !duration || duration <= 0) return null

  const totalSecondsPerKm = Math.round((duration / 1000) / (distance / 1000))
  const minutes = Math.floor(totalSecondsPerKm / 60)
  const seconds = totalSecondsPerKm % 60

  return `${minutes}:${String(seconds).padStart(2, '0')} min/km`
}

function getStatisticsList(container) {
  return Array.isArray(container?.statistics?.statistics)
    ? container.statistics.statistics
    : Array.isArray(container?.statistics)
      ? container.statistics
      : []
}

function getStatistic(container, type) {
  return getStatisticsList(container).find(stat => stat?.type === type) || null
}

function averageNumericValues(values) {
  const numbers = (values || [])
    .map(numberOrNull)
    .filter(value => value !== null)

  if (!numbers.length) return null
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

function extractCadence(exercise) {
  const cadenceStatistic = getStatistic(
    exercise,
    'STATISTICS_TYPE_CADENCE'
  )

  const cadenceFromStatistics = numberOrNull(cadenceStatistic?.avg)
  if (cadenceFromStatistics !== null) {
    return Math.round(cadenceFromStatistics)
  }

  const samples = Array.isArray(exercise?.samples?.samples)
    ? exercise.samples.samples
    : []

  const cadenceSample = samples.find(
    sample => String(sample?.type || '').toUpperCase() === 'CADENCE'
  )

  const cadenceFromSamples = averageNumericValues(cadenceSample?.values)
  return cadenceFromSamples !== null
    ? Math.round(cadenceFromSamples)
    : null
}

function extractWayPoints(exercise) {
  const possibleRoutes = [
    exercise?.routes?.route,
    exercise?.route,
    exercise?.routes,
  ]

  for (const route of possibleRoutes) {
    if (Array.isArray(route?.wayPoints)) return route.wayPoints
    if (Array.isArray(route?.waypoints)) return route.waypoints
  }

  return null
}

function formatPaceFromSeconds(totalSeconds) {
  const seconds = numberOrNull(totalSeconds)
  if (seconds === null || seconds <= 0) return null

  const rounded = Math.round(seconds)
  const minutesPart = Math.floor(rounded / 60)
  const secondsPart = rounded % 60

  return `${minutesPart}:${String(secondsPart).padStart(2, '0')} min/km`
}

function lapToSegment(lap, index, type) {
  const distanceMeters = numberOrNull(lap?.distanceMeters)
  const durationMillis = numberOrNull(lap?.durationMillis)

  const pace =
    distanceMeters && durationMillis
      ? calculatePace(distanceMeters, durationMillis)
      : null

  const heartRate = getStatistic(
    lap,
    'STATISTICS_TYPE_HEART_RATE'
  )
  const cadence = getStatistic(
    lap,
    'STATISTICS_TYPE_CADENCE'
  )
  const speed = getStatistic(
    lap,
    'STATISTICS_TYPE_SPEED'
  )

  return {
    type,
    index: index + 1,
    distanceMeters,
    durationSeconds:
      durationMillis !== null ? Math.round(durationMillis / 1000) : null,
    pace,
    avgHeartRate: numberOrNull(heartRate?.avg),
    maxHeartRate: numberOrNull(heartRate?.max),
    avgCadence: numberOrNull(cadence?.avg),
    maxCadence: numberOrNull(cadence?.max),
    avgSpeed: numberOrNull(speed?.avg),
    maxSpeed: numberOrNull(speed?.max),
    ascentMeters: numberOrNull(lap?.ascentMeters),
    descentMeters: numberOrNull(lap?.descentMeters),
    splitTimeSeconds:
      lap?.splitTimeMillis !== undefined && lap?.splitTimeMillis !== null
        ? Math.round(Number(lap.splitTimeMillis) / 1000)
        : null,
  }
}

function extractSplits(exercise) {
  const autoLaps = Array.isArray(exercise?.laps?.autoLaps)
    ? exercise.laps.autoLaps
    : []

  if (!autoLaps.length) return null

  return autoLaps.map((lap, index) => {
    const segment = lapToSegment(lap, index, 'auto')

    return {
      km: index + 1,
      distanzM: segment.distanceMeters,
      dauerSek: segment.durationSeconds,
      pace: segment.pace,
      hfAvg: segment.avgHeartRate,
      hfMax: segment.maxHeartRate,
      cadenceAvg: segment.avgCadence,
      hoehenmeter: segment.ascentMeters,
      abstiegMeter: segment.descentMeters,
    }
  })
}

function extractRunSegments(exercise) {
  const manualLaps = Array.isArray(exercise?.laps?.laps)
    ? exercise.laps.laps
    : []

  if (!manualLaps.length) return null

  return manualLaps.map((lap, index) =>
    lapToSegment(lap, index, 'manual')
  )
}

function extractAscentMeters(exercise, session) {
  const directAscent = firstDefined(
    exercise?.ascentMeters,
    session?.ascentMeters
  )

  const directNumber = numberOrNull(directAscent)
  if (directNumber !== null) return directNumber

  const route = extractWayPoints(exercise)
  if (!Array.isArray(route) || route.length < 2) return null

  let ascent = 0
  let previousAltitude = numberOrNull(
    route[0]?.altitude ?? route[0]?.altitudeMeters
  )

  for (let index = 1; index < route.length; index += 1) {
    const altitude = numberOrNull(
      route[index]?.altitude ?? route[index]?.altitudeMeters
    )

    if (
      altitude !== null &&
      previousAltitude !== null &&
      altitude > previousAltitude
    ) {
      ascent += altitude - previousAltitude
    }

    if (altitude !== null) previousAltitude = altitude
  }

  return ascent > 0 ? Math.round(ascent) : null
}

function extractDescentMeters(exercise, session) {
  const directDescent = firstDefined(
    exercise?.descentMeters,
    session?.descentMeters
  )

  const directNumber = numberOrNull(directDescent)
  if (directNumber !== null) return directNumber

  const route = extractWayPoints(exercise)
  if (!Array.isArray(route) || route.length < 2) return null

  let descent = 0
  let previousAltitude = numberOrNull(
    route[0]?.altitude ?? route[0]?.altitudeMeters
  )

  for (let index = 1; index < route.length; index += 1) {
    const altitude = numberOrNull(
      route[index]?.altitude ?? route[index]?.altitudeMeters
    )

    if (
      altitude !== null &&
      previousAltitude !== null &&
      altitude < previousAltitude
    ) {
      descent += previousAltitude - altitude
    }

    if (altitude !== null) previousAltitude = altitude
  }

  return descent > 0 ? Math.round(descent) : null
}

function normalizeSpeedToKmh(value) {
  const speed = numberOrNull(value)
  if (speed === null || speed < 0) return null

  // Polar AccessLink V4 liefert die Geschwindigkeitsstatistiken bereits
  // in km/h. Deshalb darf hier nicht noch einmal mit 3,6 multipliziert werden.
  return Math.round(speed * 100) / 100
}

function extractSpeedStats(exercise, session, distanceMeters, durationMillis) {
  const speedStatistic =
    getStatistic(exercise, 'STATISTICS_TYPE_SPEED') ||
    getStatistic(session, 'STATISTICS_TYPE_SPEED')

  const directAverage = firstDefined(
    speedStatistic?.avg,
    exercise?.averageSpeed,
    exercise?.avgSpeed,
    session?.averageSpeed,
    session?.avgSpeed
  )

  const directMaximum = firstDefined(
    speedStatistic?.max,
    exercise?.maximumSpeed,
    exercise?.maxSpeed,
    session?.maximumSpeed,
    session?.maxSpeed
  )

  let averageSpeedKmh = normalizeSpeedToKmh(directAverage)
  const maxSpeedKmh = normalizeSpeedToKmh(directMaximum)

  if (
    averageSpeedKmh === null &&
    distanceMeters !== null &&
    durationMillis !== null &&
    distanceMeters > 0 &&
    durationMillis > 0
  ) {
    averageSpeedKmh =
      Math.round(
        (distanceMeters / 1000) /
          (durationMillis / 3600000) *
          100
      ) / 100
  }

  return {
    averageSpeedKmh,
    maxSpeedKmh,
  }
}

function buildActivityName(sportType, sportName) {
  const defaults = {
    running: 'Lauf',
    walking: 'Walking',
    hiking: 'Wanderung',
    cycling: 'Radtour',
    mountain_biking: 'Mountainbike-Tour',
    swimming: 'Schwimmen',
  }

  return defaults[sportType] || sportName || 'Sportaktivität'
}

function mapV4Exercise(
  session,
  exercise,
  sportName,
  sportType
) {
  const distanceMeters = firstDefined(
    exercise?.distanceMeters,
    session?.distanceMeters
  )
  const durationMillis = firstDefined(
    exercise?.durationMillis,
    session?.durationMillis
  )
  const movingTimeMillis = firstDefined(
    exercise?.movingTimeMillis,
    session?.movingTimeMillis,
    durationMillis
  )
  const startTime = firstDefined(exercise?.startTime, session?.startTime)
  const recoveryTimeMillis = firstDefined(
    exercise?.recoveryTimeMillis,
    session?.recoveryTimeMillis
  )

  const distance = numberOrNull(distanceMeters)
  const duration = numberOrNull(durationMillis)
  const movingTime = numberOrNull(movingTimeMillis)
  const calories = firstDefined(exercise?.calories, session?.calories)
  const trainingLoad = firstDefined(
    exercise?.trainingLoad,
    session?.trainingLoad
  )
  const cadence = extractCadence(exercise)
  const ascentMeters = extractAscentMeters(exercise, session)
  const descentMeters = extractDescentMeters(exercise, session)
  const { averageSpeedKmh, maxSpeedKmh } = extractSpeedStats(
    exercise,
    session,
    distance,
    movingTime || duration
  )

  const title = firstDefined(
    exercise?.title,
    exercise?.name,
    session?.title,
    session?.name
  )

  const pace = isFootSportType(sportType)
    ? calculatePace(distance, movingTime || duration)
    : null

  return {
    polar_exercise_id:
      exercise?.identifier?.id || session?.identifier?.id || null,
    datum: startTime ? String(startTime).slice(0, 10) : null,
    uhrzeit:
      startTime && String(startTime).includes('T')
        ? String(startTime).split('T')[1].slice(0, 5)
        : null,
    distanz:
      distance !== null ? `${(distance / 1000).toFixed(2)} km` : null,
    pace,
    herzfrequenz:
      session?.hrAvg !== undefined && session?.hrAvg !== null
        ? `${session.hrAvg} bpm`
        : null,
    hf_max:
      session?.hrMax !== undefined && session?.hrMax !== null
        ? String(session.hrMax)
        : null,
    kalorien:
      calories !== undefined && calories !== null ? String(calories) : null,
    dauer:
      duration !== null ? `${Math.round(duration / 60000)} min` : null,
    sport: sportName || null,
    running_index:
      sportType === 'running' &&
      exercise?.runningIndex !== undefined &&
      exercise?.runningIndex !== null
        ? String(exercise.runningIndex)
        : null,
    cadence: cadence !== null ? String(cadence) : null,
    hoehenmeter:
      ascentMeters !== null ? String(Math.round(ascentMeters)) : null,
    gefuehl:
      session?.feeling !== undefined && session?.feeling !== null
        ? String(session.feeling)
        : null,
    training_load:
      trainingLoad !== undefined && trainingLoad !== null
        ? String(trainingLoad)
        : null,
    recovery_time:
      recoveryTimeMillis !== undefined && recoveryTimeMillis !== null
        ? String(Math.round(Number(recoveryTimeMillis) / 60000))
        : null,
    route_waypoints: extractWayPoints(exercise),
    km_splits: extractSplits(exercise),
    run_segments:
      sportType === 'running' ? extractRunSegments(exercise) : null,

    // Neue allgemeine Aktivitätsfelder.
    sport_type: sportType,
    source: 'polar',
    polar_import_version:
      SPORT_IMPORT_VERSIONS[sportType] || 1,
    activity_name:
      typeof title === 'string' && title.trim()
        ? title.trim()
        : buildActivityName(sportType, sportName),
    duration_seconds:
      duration !== null ? Math.round(duration / 1000) : null,
    moving_time_seconds:
      movingTime !== null ? Math.round(movingTime / 1000) : null,
    distance_meters:
      distance !== null ? Math.round(distance * 10) / 10 : null,
    average_speed_kmh: averageSpeedKmh,
    max_speed_kmh: maxSpeedKmh,
    elevation_gain:
      ascentMeters !== null ? Math.round(ascentMeters) : null,
    elevation_loss:
      descentMeters !== null ? Math.round(descentMeters) : null,
  }
}

async function loadTrainingSessions(token) {
  const now = new Date()
  const past = new Date(
    now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  )

  const from = formatPolarLocalDateTime(past)
  const to = formatPolarLocalDateTime(now)

  const data = await polarFetch('/training-sessions/list', token, {
    from,
    to,
  })

  return Array.isArray(data?.trainingSessions)
    ? data.trainingSessions
    : []
}

async function loadDetailedTrainingDay(token, dateString) {
  const nextDate = addUtcDays(dateString, 1)

  const data = await polarFetch('/training-sessions/list', token, {
    from: `${dateString}T00:00:00`,
    to: `${nextDate}T00:00:00`,
    features: [
      'samples',
      'laps',
      'routes',
      'statistics',
    ],
  })

  return Array.isArray(data?.trainingSessions)
    ? data.trainingSessions
    : []
}

function collectExercises(sessions) {
  const result = []

  for (const session of sessions || []) {
    const exercises =
      Array.isArray(session?.exercises) && session.exercises.length
        ? session.exercises
        : [session]

    for (const exercise of exercises) {
      result.push({ session, exercise })
    }
  }

  return result
}

function getSportId(session, exercise) {
  return firstDefined(
    exercise?.sport?.id?.id,
    exercise?.sport?.id,
    session?.sport?.id?.id,
    session?.sport?.id
  )
}

function resolveSportName(sportsMap, session, exercise) {
  const sportId = getSportId(session, exercise)

  const catalogueName =
    sportId !== undefined && sportId !== null
      ? sportsMap[String(sportId)] || null
      : null

  const directSportName = firstDefined(
    exercise?.sport?.name,
    exercise?.sport?.localizedName,
    exercise?.sportName,
    session?.sport?.name,
    session?.sport?.localizedName,
    session?.sportName,
    typeof session?.sport === 'string' ? session.sport : null
  )

  return firstDefined(
    catalogueName,
    typeof directSportName === 'string' ? directSportName : null
  )
}


function getTargetId(reference) {
  const value = reference?.id ?? reference
  return value === undefined || value === null ? null : String(value)
}

function normalizeCalendarTargets(payload) {
  return Array.isArray(payload?.trainingTarget)
    ? payload.trainingTarget
    : Array.isArray(payload)
      ? payload
      : []
}

function normalizeFavoriteTargets(payload) {
  return Array.isArray(payload?.favoriteTarget)
    ? payload.favoriteTarget
    : Array.isArray(payload)
      ? payload
      : []
}

async function loadCalendarTargetsForDate(token, dateString) {
  const nextDate = addUtcDays(dateString, 1)

  try {
   const payload = await polarFetch(
  '/training-target/calendar-targets',
  token,
  {
    from: dateString,
    to: nextDate,
  }
)

    return normalizeCalendarTargets(payload)
  } catch (error) {
    if (error.status === 403) {
      console.warn(
        '[Polar V4] Trainingsziele sind nicht freigegeben. ' +
        'Der OAuth-Scope "training_targets:read" fehlt.'
      )
      return []
    }

    throw error
  }
}

async function loadFavoriteTargets(token) {
  try {
    const payload = await polarFetch(
      '/training-target/favorites',
      token
    )

    return normalizeFavoriteTargets(payload)
  } catch (error) {
    if (error.status === 403) {
      console.warn(
        '[Polar V4] Favoriten-Ziele sind nicht freigegeben. ' +
        'Der OAuth-Scope "training_targets:read" fehlt.'
      )
      return []
    }

    throw error
  }
}

function findTrainingTarget(session, calendarTargets, favoriteTargets) {
  const trainingTargetId = getTargetId(session?.trainingTarget)
  const favoriteTargetId = getTargetId(session?.favoriteTarget)

  if (trainingTargetId) {
    const calendarTarget = calendarTargets.find(
      target => getTargetId(target?.session?.id) === trainingTargetId
    )

    if (calendarTarget) return calendarTarget
  }

  if (favoriteTargetId) {
    const favoriteTarget = favoriteTargets.find(
      target => getTargetId(target?.favorite?.id) === favoriteTargetId
    )

    if (favoriteTarget) return favoriteTarget
  }

  return null
}

function flattenPhaseOrRepeat(items, result = []) {
  for (const item of Array.isArray(items) ? items : []) {
    const children = Array.isArray(item?.phaseOrRepeat)
      ? item.phaseOrRepeat
      : []

    const repeatCount = numberOrNull(item?.repeatCount)

    if (children.length && repeatCount && repeatCount >= 2) {
      for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
        flattenPhaseOrRepeat(children, result)
      }
      continue
    }

    if (children.length && !item?.goal) {
      flattenPhaseOrRepeat(children, result)
      continue
    }

    result.push({
      name: item?.name || 'Phase',
      changeType: item?.changeType || null,
      goalType: item?.goal?.type || null,
      plannedDurationSeconds:
        item?.goal?.duration !== undefined &&
        item?.goal?.duration !== null
          ? Math.round(Number(item.goal.duration) / 1000)
          : null,
      plannedDistanceMeters: numberOrNull(item?.goal?.distance),
      intensityType: item?.intensity?.type || null,
      lowerZone: numberOrNull(item?.intensity?.lowerZone),
      upperZone: numberOrNull(item?.intensity?.upperZone),
    })
  }

  return result
}

function getSampleByType(exercise, type) {
  const samples = Array.isArray(exercise?.samples?.samples)
    ? exercise.samples.samples
    : []

  return samples.find(sample => sample?.type === type) || null
}

function numericSampleValues(sample) {
  return Array.isArray(sample?.values)
    ? sample.values.map(numberOrNull)
    : []
}

function averageRange(values, startIndex, endIndex) {
  const selected = values
    .slice(startIndex, endIndex)
    .filter(value => value !== null)

  if (!selected.length) return null

  return selected.reduce((sum, value) => sum + value, 0) /
    selected.length
}

function maxRange(values, startIndex, endIndex) {
  const selected = values
    .slice(startIndex, endIndex)
    .filter(value => value !== null)

  return selected.length ? Math.max(...selected) : null
}

function findDistanceEndIndex(
  distanceValues,
  startIndex,
  targetDistanceMeters
) {
  const startDistance = distanceValues[startIndex] ?? 0

  for (
    let index = startIndex + 1;
    index < distanceValues.length;
    index += 1
  ) {
    const value = distanceValues[index]

    if (
      value !== null &&
      value - startDistance >= targetDistanceMeters
    ) {
      return index
    }
  }

  return distanceValues.length - 1
}

function enrichPlannedPhasesWithSamples(phases, exercise) {
  if (!Array.isArray(phases) || !phases.length) return null

  const distanceSample = getSampleByType(exercise, 'DISTANCE')
  const heartRateSample = getSampleByType(exercise, 'HEART_RATE')
  const cadenceSample = getSampleByType(exercise, 'CADENCE')
  const speedSample = getSampleByType(exercise, 'SPEED')

  const referenceSample =
    distanceSample ||
    heartRateSample ||
    cadenceSample ||
    speedSample

  const intervalMillis = numberOrNull(
    referenceSample?.intervalMillis
  )

  const totalSampleCount = Math.max(
    numericSampleValues(distanceSample).length,
    numericSampleValues(heartRateSample).length,
    numericSampleValues(cadenceSample).length,
    numericSampleValues(speedSample).length
  )

  if (!intervalMillis || !totalSampleCount) {
    return phases.map((phase, index) => ({
      type: 'planned_phase',
      index: index + 1,
      ...phase,
    }))
  }

  const distanceValues = numericSampleValues(distanceSample)
  const heartRateValues = numericSampleValues(heartRateSample)
  const cadenceValues = numericSampleValues(cadenceSample)
  const speedValues = numericSampleValues(speedSample)

  let startIndex = 0

  return phases.map((phase, index) => {
    let endIndex = startIndex

    if (
      phase.plannedDurationSeconds !== null &&
      phase.plannedDurationSeconds > 0
    ) {
      endIndex = Math.min(
        totalSampleCount,
        startIndex +
          Math.max(
            1,
            Math.round(
              phase.plannedDurationSeconds * 1000 / intervalMillis
            )
          )
      )
    } else if (
      phase.plannedDistanceMeters !== null &&
      phase.plannedDistanceMeters > 0 &&
      distanceValues.length
    ) {
      endIndex = Math.min(
        totalSampleCount,
        findDistanceEndIndex(
          distanceValues,
          startIndex,
          phase.plannedDistanceMeters
        ) + 1
      )
    } else {
      // Manuell beendete Phasen lassen sich ohne ausgeführte Phasenmarker
      // nicht zuverlässig zeitlich abgrenzen. Die Planstruktur bleibt
      // trotzdem erhalten.
      endIndex = startIndex
    }

    const actualDurationSeconds =
      endIndex > startIndex
        ? Math.round(
            (endIndex - startIndex) * intervalMillis / 1000
          )
        : null

    const startDistance =
      distanceValues[startIndex] ?? null
    const endDistance =
      endIndex > startIndex
        ? distanceValues[Math.min(
            endIndex - 1,
            distanceValues.length - 1
          )]
        : null

    const actualDistanceMeters =
      startDistance !== null && endDistance !== null
        ? Math.max(0, endDistance - startDistance)
        : null

    const actualPace =
      actualDistanceMeters &&
      actualDurationSeconds
        ? calculatePace(
            actualDistanceMeters,
            actualDurationSeconds * 1000
          )
        : null

    const avgHeartRate = averageRange(
      heartRateValues,
      startIndex,
      endIndex
    )
    const maxHeartRate = maxRange(
      heartRateValues,
      startIndex,
      endIndex
    )
    const avgCadence = averageRange(
      cadenceValues,
      startIndex,
      endIndex
    )
    const avgSpeed = averageRange(
      speedValues,
      startIndex,
      endIndex
    )

    const segment = {
      type: 'planned_phase',
      index: index + 1,
      ...phase,
      actualDurationSeconds,
      actualDistanceMeters:
        actualDistanceMeters !== null
          ? Math.round(actualDistanceMeters * 10) / 10
          : null,
      pace: actualPace,
      avgHeartRate:
        avgHeartRate !== null
          ? Math.round(avgHeartRate)
          : null,
      maxHeartRate:
        maxHeartRate !== null
          ? Math.round(maxHeartRate)
          : null,
      avgCadence:
        avgCadence !== null
          ? Math.round(avgCadence)
          : null,
      avgSpeed:
        avgSpeed !== null
          ? Math.round(avgSpeed * 100) / 100
          : null,
    }

    if (endIndex > startIndex) {
      startIndex = endIndex
    }

    return segment
  })
}

function extractTargetPhases(target, exercise) {
  const targetExercise = Array.isArray(target?.exercise)
    ? target.exercise[0]
    : null

  const flattened = flattenPhaseOrRepeat(
    targetExercise?.phaseOrRepeat
  )

  return enrichPlannedPhasesWithSamples(flattened, exercise)
}

async function loadDetailedSupportedExercises(
  token,
  sessions,
  sportsMap
) {
  const supportedDates = new Set()

  for (const { session, exercise } of collectExercises(sessions)) {
    const sportName = resolveSportName(
      sportsMap,
      session,
      exercise
    )
    const startTime = firstDefined(
      exercise?.startTime,
      session?.startTime
    )

    const sportType = detectSportType(sportName)

    if (sportType && startTime) {
      supportedDates.add(String(startTime).slice(0, 10))
    }
  }

  const detailedById = new Map()
  let favoriteTargets = null
  let targetAccessUnavailable = false

  for (const dateString of supportedDates) {
    let detailedSessions

    // Die eigentlichen Trainingsdetails sind Pflicht für Route, Splits,
    // Kadenz und Höhenmeter.
    try {
      detailedSessions = await loadDetailedTrainingDay(
        token,
        dateString
      )
    } catch (error) {
      console.error(
        `[Polar V4] Detaildaten für ${dateString} ` +
        'konnten nicht geladen werden:',
        error
      )
      continue
    }

    // Trainingsziele sind nur eine optionale Ergänzung. Ein Fehler hier
    // darf niemals Route, km-Splits oder andere Detaildaten verwerfen.
    let calendarTargets = []

    const needsTrainingTargets = detailedSessions.some(
      session =>
        getTargetId(session?.trainingTarget) ||
        getTargetId(session?.favoriteTarget)
    )

    if (needsTrainingTargets && !targetAccessUnavailable) {
      try {
        calendarTargets = await loadCalendarTargetsForDate(
          token,
          dateString
        )

        if (favoriteTargets === null) {
          favoriteTargets = await loadFavoriteTargets(token)
        }
          console.log('[Polar V4] TARGET-PRÜFUNG:', {
  dateString,

  sessionTargets: detailedSessions.map(session => ({
    trainingTargetId: getTargetId(session?.trainingTarget),
    favoriteTargetId: getTargetId(session?.favoriteTarget),
  })),

  calendarTargetCount: calendarTargets.length,
  calendarTargetIds: calendarTargets.map(target =>
    getTargetId(target?.session?.id)
  ),

  calendarPhaseCounts: calendarTargets.map(target =>
    Array.isArray(target?.exercise)
      ? target.exercise.map(exercise =>
          Array.isArray(exercise?.phaseOrRepeat)
            ? exercise.phaseOrRepeat.length
            : 0
        )
      : []
  ),

  favoriteTargetCount: (favoriteTargets || []).length,
  favoriteTargetIds: (favoriteTargets || []).map(target =>
    getTargetId(target?.favorite?.id)
  ),

  favoritePhaseCounts: (favoriteTargets || []).map(target =>
    Array.isArray(target?.exercise)
      ? target.exercise.map(exercise =>
          Array.isArray(exercise?.phaseOrRepeat)
            ? exercise.phaseOrRepeat.length
            : 0
        )
      : []
  ),
})
      } catch (error) {
        console.warn(
          `[Polar V4] Trainingsziele für ${dateString} ` +
          'konnten nicht ergänzt werden. ' +
          'Route und Splits werden trotzdem übernommen:',
          error
        )
      

        // Verhindert, dass derselbe nicht verfügbare Target-Endpunkt
        // für jeden Lauftag erneut aufgerufen wird.
        if (
          error?.status === 400 ||
          error?.status === 401 ||
          error?.status === 403 ||
          error?.status === 404
        ) {
          targetAccessUnavailable = true
        }
      }
    }

    for (const { session, exercise } of collectExercises(
      detailedSessions
    )) {
      const exerciseId =
        exercise?.identifier?.id ||
        session?.identifier?.id ||
        null

      if (!exerciseId) continue

      let targetSegments = null

      const detailedSportName = resolveSportName(
        sportsMap,
        session,
        exercise
      )
      const detailedSportType = detectSportType(detailedSportName)

      if (
        isRunningSportType(detailedSportType) &&
        !targetAccessUnavailable
      ) {
        try {
          const target = findTrainingTarget(
            session,
            calendarTargets,
            favoriteTargets || []
          )

          targetSegments = target
            ? extractTargetPhases(target, exercise)
            : null
            console.log('[Polar V4] PHASEN-ERGEBNIS:', {
  exerciseId,
  targetFound: Boolean(target),

  topLevelPhases:
    target?.exercise?.[0]?.phaseOrRepeat?.map(item => ({
      name: item?.name,
      repeatCount: item?.repeatCount,
      childCount: Array.isArray(item?.phaseOrRepeat)
        ? item.phaseOrRepeat.length
        : 0,
      type: item?.type,
    })) || [],

  extractedCount: targetSegments?.length || 0,

  extractedSegments:
    targetSegments?.map(segment => ({
      name: segment.name,
      distance: segment.plannedDistanceMeters,
      duration: segment.plannedDurationSeconds,
    })) || [],
})
        } catch (error) {
          console.warn(
            '[Polar V4] Trainingsphasen konnten nicht ausgewertet werden:',
            error
          )
        }
      }

      // Immer speichern – auch wenn das optionale Training Target fehlt.
      detailedById.set(String(exerciseId), {
        session,
        exercise,
        targetSegments,
      })
    }
  }

  return detailedById
}

async function savePendingActivity(row) {
  const { error } = await supabase
    .from('polar_pending_activities')
    .upsert(row, {
      onConflict: 'user_id,polar_exercise_id',
    })

  if (error) {
    console.error('[Polar V4] Upsert fehlgeschlagen:', {
      polarExerciseId: row.polar_exercise_id,
      error,
    })

    throw new Error(
      `Polar-Aktivität ${row.polar_exercise_id} konnte nicht gespeichert werden`
    )
  }
}

export async function fetchAndPersistPolarActivitiesV4(userId) {
  if (!userId) throw new Error('userId fehlt')

  const token = await getValidAccessToken(userId)

  const [sportsMap, sessions] = await Promise.all([
    getSportsMap(token),
    loadTrainingSessions(token),
  ])

  const detailedById = await loadDetailedSupportedExercises(
    token,
    sessions,
    sportsMap
  )

  console.log('[Polar V4] Trainingseinheiten geladen:', sessions.length)
  console.log('[Polar V4] Unterstützte Aktivitäten mit Detaildaten:', detailedById.size)

  const stored = []

  const { data: importedRows, error: importedError } = await supabase
    .from('logs')
    .select('polar_exercise_id, sport_type, polar_import_version')
    .eq('user_id', userId)
    .not('polar_exercise_id', 'is', null)

  if (importedError) {
    console.error(
      '[Polar V4] Bereits übernommene Aktivitäten konnten nicht geladen werden:',
      importedError
    )
    throw new Error(
      'Bereits übernommene Polar-Aktivitäten konnten nicht geprüft werden'
    )
  }

  const importedById = new Map(
    (importedRows || []).map(row => [
      String(row.polar_exercise_id),
      {
        sportType: row.sport_type || 'running',
        importVersion: Number(row.polar_import_version) || 1,
      },
    ])
  )

  const { data: ignoredRows, error: ignoredError } = await supabase
    .from('polar_ignored_activities')
    .select('polar_exercise_id')
    .eq('user_id', userId)

  if (ignoredError) {
    console.error(
      '[Polar V4] Ignorierte Aktivitäten konnten nicht geladen werden:',
      ignoredError
    )
    throw new Error('Ignorierte Polar-Aktivitäten konnten nicht geladen werden')
  }

  const ignoredIds = new Set(
    (ignoredRows || []).map(row => String(row.polar_exercise_id))
  )


  for (const session of sessions) {
    const exercises =
      Array.isArray(session?.exercises) && session.exercises.length
        ? session.exercises
        : [session]

    for (const exercise of exercises) {
      const detectedSportName = resolveSportName(
        sportsMap,
        session,
        exercise
      )

      const sportType = detectSportType(detectedSportName)

      if (!sportType) {
        console.log(
          '[Polar V4] Nicht unterstützte Sportart übersprungen:',
          detectedSportName || 'unbekannt'
        )
        continue
      }

      const baseExerciseId =
        exercise?.identifier?.id || session?.identifier?.id || null

      const detailed = baseExerciseId
        ? detailedById.get(String(baseExerciseId))
        : null

      const mappedSession = detailed?.session || session
      const mappedExercise = detailed?.exercise || exercise

      const row = {
        user_id: userId,
        ...mapV4Exercise(
          mappedSession,
          mappedExercise,
          detectedSportName,
          sportType
        ),
      }

      if (
        sportType === 'running' &&
        detailed?.targetSegments &&
        detailed.targetSegments.length
      ) {
        row.run_segments = detailed.targetSegments
      }

      const imported = row.polar_exercise_id
        ? importedById.get(String(row.polar_exercise_id))
        : null

      const currentImportVersion =
        SPORT_IMPORT_VERSIONS[sportType] || 1

      if (
        imported &&
        imported.importVersion >= currentImportVersion
      ) {
        console.log(
          '[Polar V4] Bereits übernommene Aktivität übersprungen:',
          row.polar_exercise_id
        )
        continue
      }

      if (
        imported &&
        imported.importVersion < currentImportVersion
      ) {
        console.log(
          '[Polar V4] Aktivität wird wegen neuer Importversion erneut angeboten:',
          {
            polarExerciseId: row.polar_exercise_id,
            sportType,
            previousVersion: imported.importVersion,
            currentVersion: currentImportVersion,
          }
        )
      }

if (
  row.polar_exercise_id &&
  ignoredIds.has(String(row.polar_exercise_id))
) {
  console.log(
    '[Polar V4] Bereits verworfene Aktivität übersprungen:',
    row.polar_exercise_id
  )
  continue
}

      if (!row.polar_exercise_id) {
        console.warn(
          '[Polar V4] Trainingseinheit ohne eindeutige ID wurde übersprungen.'
        )
        continue
      }

      await savePendingActivity(row)
      stored.push(row)
    }
  }

  console.log('[Polar V4] Gespeicherte Aktivitäten:', stored.length)
  return stored
}

export { supabase }
