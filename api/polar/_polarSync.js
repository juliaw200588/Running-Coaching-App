import { createClient } from '@supabase/supabase-js'

const POLAR_API_BASE = 'https://www.polaraccesslink.com/v4/data'
const POLAR_TOKEN_URL = 'https://auth.polar.com/oauth/token'
const LOOKBACK_DAYS = 30

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
  return payload.errorMessage || payload.error || payload.message || JSON.stringify(payload)
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

// Die V4-Endpunkte erwarten für "from" und "to" ISO-8601-Datumswerte.
// Für diesen Listen-Endpunkt verwenden wir bewusst YYYY-MM-DD.
// "from" ist inklusive, "to" exklusiv.
function formatPolarDateTime(date) {
return date.toISOString().replace(/Z$/, '')
}

function getDateRange(daysBack = LOOKBACK_DAYS) {
  const to = new Date()

  const from = new Date(
    to.getTime() - daysBack * 24 * 60 * 60 * 1000
  )

  return {
    from: formatPolarDateTime(from),
    to: formatPolarDateTime(to),
  }
}

async function getSportsMap(token) {
  try {
    const data = await polarFetch('/sports/list', token)
    const sports = Array.isArray(data?.sports) ? data.sports : []
    const map = {}

    for (const sport of sports) {
      const id = sport?.id?.id ?? sport?.id
      if (id === undefined || id === null) continue

      const localizedName =
        sport?.localizedNames?.de?.longName ||
        sport?.localizedNames?.en?.longName ||
        null

      map[String(id)] = localizedName || sport?.name || null
    }

    return map
  } catch (error) {
    if (error.status === 403) {
      console.warn(
        '[Polar V4] Sportarten-Katalog nicht freigegeben. In auth.js muss der Scope "sports:read" enthalten sein; danach Polar neu verbinden.'
      )
      return {}
    }
    throw error
  }
}

function isRunningSport(sportName) {
  if (!sportName) return false

  const normalized = String(sportName).trim().toLowerCase()

  return (
    normalized.includes('running') ||
    normalized.includes('run') ||
    normalized.includes('laufen') ||
    normalized.includes('lauf') ||
    normalized.includes('jogging') ||
    normalized.includes('trail')
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

function extractCadence(exercise) {
  const samples = Array.isArray(exercise?.samples?.samples)
    ? exercise.samples.samples
    : []

  const cadenceSample = samples.find(sample =>
    String(sample?.type || '').toUpperCase().includes('CADENCE')
  )

  const values = Array.isArray(cadenceSample?.values)
    ? cadenceSample.values.map(numberOrNull).filter(value => value !== null)
    : []

  if (!values.length) return null

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function extractWayPoints(exercise) {
  const route = exercise?.routes?.route

  if (Array.isArray(route?.wayPoints)) return route.wayPoints
  if (Array.isArray(route?.waypoints)) return route.waypoints

  return null
}

function extractSplits(exercise) {
  const autoLaps = Array.isArray(exercise?.laps?.autoLaps)
    ? exercise.laps.autoLaps
    : []

  if (!autoLaps.length) return null

  return autoLaps.map((lap, index) => ({
    km: index + 1,
    distanzM: numberOrNull(lap?.distanceMeters),
    dauerSek:
      lap?.durationMillis === undefined || lap?.durationMillis === null
        ? null
        : Math.round(Number(lap.durationMillis) / 1000),
  }))
}

function mapV4Exercise(session, exercise, sportName) {
  const distanceMeters = firstDefined(
    exercise?.distanceMeters,
    session?.distanceMeters
  )
  const durationMillis = firstDefined(
    exercise?.durationMillis,
    session?.durationMillis
  )
  const startTime = firstDefined(exercise?.startTime, session?.startTime)
  const recoveryTimeMillis = firstDefined(
    exercise?.recoveryTimeMillis,
    session?.recoveryTimeMillis
  )

  const distance = numberOrNull(distanceMeters)
  const duration = numberOrNull(durationMillis)
  const calories = firstDefined(exercise?.calories, session?.calories)
  const trainingLoad = firstDefined(
    exercise?.trainingLoad,
    session?.trainingLoad
  )

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
    pace: calculatePace(distance, duration),
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
      exercise?.runningIndex !== undefined &&
      exercise?.runningIndex !== null
        ? String(exercise.runningIndex)
        : null,
    cadence: (() => {
      const cadence = extractCadence(exercise)
      return cadence !== null ? String(cadence) : null
    })(),
    hoehenmeter:
      exercise?.ascentMeters !== undefined &&
      exercise?.ascentMeters !== null
        ? String(exercise.ascentMeters)
        : null,
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
  }
}

async function loadTrainingSessions(token) {
  const { from, to } = getDateRange()
  console.log("FROM =", from)
console.log("TO   =", to)

  // Keine "features" anfordern:
  // Dann erlaubt Polar laut V4-Dokumentation einen Zeitraum von bis zu 90 Tagen.
  // Mit Features wäre jeweils nur ein einzelner Tag zulässig.
  const data = await polarFetch('/training-sessions/list', token, {
    from,
    to,
  })

  return Array.isArray(data?.trainingSessions)
    ? data.trainingSessions
    : []
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

  const hasSportsMap = Object.keys(sportsMap).length > 0

  console.log('[Polar V4] Trainingseinheiten geladen:', sessions.length)
  console.log('[Polar V4] Sportarten geladen:', Object.keys(sportsMap).length)

  const stored = []

  for (const session of sessions) {
    const exercises =
      Array.isArray(session?.exercises) && session.exercises.length
        ? session.exercises
        : [session]

    for (const exercise of exercises) {
      const sportId = firstDefined(
        exercise?.sport?.id?.id,
        exercise?.sport?.id,
        session?.sport?.id?.id,
        session?.sport?.id
      )

      const sportName =
        sportId !== undefined && sportId !== null
          ? sportsMap[String(sportId)] || null
          : null

      // Sicheres Verhalten:
      // Nur filtern, wenn der Sportarten-Katalog tatsächlich geladen wurde.
      // Bei fehlendem sports:read werden Einheiten nicht versehentlich verworfen.
      if (hasSportsMap && !isRunningSport(sportName)) continue

      const row = {
        user_id: userId,
        ...mapV4Exercise(session, exercise, sportName),
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
