import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

const ENRICHMENT_VERSION = 1
const OPEN_METEO_ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'
const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast'

function parseJson(value) {
  if (value == null) return null
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function getRoutePoints(log) {
  const raw = parseJson(log?.route_waypoints)

  if (!Array.isArray(raw)) return []

  return raw
    .map(point => {
      const lat = numberOrNull(
        point?.lat ??
        point?.latitude ??
        point?.position?.latitude ??
        point?.coordinates?.[1]
      )

      const lon = numberOrNull(
        point?.lon ??
        point?.lng ??
        point?.longitude ??
        point?.position?.longitude ??
        point?.coordinates?.[0]
      )

      const altitude = numberOrNull(
        point?.altitude ??
        point?.altitudeMeters ??
        point?.elevation
      )

      if (lat == null || lon == null) return null

      return {
        lat,
        lon,
        altitude,
      }
    })
    .filter(Boolean)
}

function getRepresentativePoint(points) {
  if (!points.length) return null

  return points[Math.floor(points.length / 2)] || points[0]
}

function getStartPoint(points) {
  return points[0] || null
}

function getActivityDate(log) {
  return log?.actual_date || null
}

function normalizeTime(value) {
  if (!value) return '12:00'

  const text = String(value)
  const match = text.match(/(\d{1,2}):(\d{2})/)

  if (!match) return '12:00'

  return `${String(match[1]).padStart(2, '0')}:${match[2]}`
}

function getActivityLocalDateTime(log) {
  const date = getActivityDate(log)
  if (!date) return null

  return `${date}T${normalizeTime(log?.uhrzeit)}`
}

function daysBetweenToday(dateString) {
  const date = new Date(`${dateString}T12:00:00Z`)
  const now = new Date()

  return Math.floor((now - date) / 86400000)
}

function findNearestIndex(times, targetIso) {
  if (!Array.isArray(times) || !times.length || !targetIso) return -1

  const target = new Date(targetIso).getTime()

  let bestIndex = 0
  let bestDistance = Infinity

  times.forEach((value, index) => {
    const time = new Date(value).getTime()
    const distance = Math.abs(time - target)

    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })

  return bestIndex
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function classifyWeather({
  code,
  rain,
  snowfall,
  cloudCover,
  windSpeed,
  visibility,
}) {
  const tags = []

  if (
    code === 45 ||
    code === 48 ||
    (visibility != null && visibility < 1200)
  ) {
    tags.push('fog')
  }

  if (
    snowfall > 0 ||
    (code >= 71 && code <= 77) ||
    code === 85 ||
    code === 86
  ) {
    tags.push('snow')
  }

  if (
    rain > 0.1 ||
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  ) {
    tags.push('rain')
  }

  if (windSpeed != null && windSpeed >= 25) {
    tags.push('wind')
  }

  if (
    (code === 0 || code === 1) &&
    (cloudCover == null || cloudCover <= 35)
  ) {
    tags.push('sun')
  } else if (
    code === 2 ||
    code === 3 ||
    (cloudCover != null && cloudCover >= 65)
  ) {
    tags.push('clouds')
  }

  return unique(tags)
}

function classifySunPhase({
  activityDateTime,
  sunrise,
  sunset,
}) {
  if (!activityDateTime || !sunrise || !sunset) {
    return {
      phase: null,
      tags: [],
    }
  }

  const activity = new Date(activityDateTime).getTime()
  const sunriseTime = new Date(sunrise).getTime()
  const sunsetTime = new Date(sunset).getTime()

  if (![activity, sunriseTime, sunsetTime].every(Number.isFinite)) {
    return {
      phase: null,
      tags: [],
    }
  }

  const minute = 60 * 1000
  const sunriseDiff = Math.abs(activity - sunriseTime)
  const sunsetDiff = Math.abs(activity - sunsetTime)

  if (sunriseDiff <= 45 * minute) {
    return {
      phase: 'sunrise',
      tags: ['sunrise'],
    }
  }

  if (sunsetDiff <= 45 * minute) {
    return {
      phase: 'sunset',
      tags: ['sunset'],
    }
  }

  if (activity < sunriseTime || activity > sunsetTime) {
    return {
      phase: 'night',
      tags: ['night'],
    }
  }

  return {
    phase: 'day',
    tags: ['day'],
  }
}

function classifyAutomaticEnvironment(log, points) {
  const tags = []

  const altitudes = points
    .map(point => point.altitude)
    .filter(value => value != null)

  const maxAltitude = altitudes.length
    ? Math.max(...altitudes)
    : null

  const elevationGain = numberOrNull(
    log?.elevation_gain ?? log?.hoehenmeter
  )

  // Bewusst konservative Heuristik:
  // "mountain" wird nur gesetzt, wenn die Aktivität klar bergig war.
  if (
    (maxAltitude != null && maxAltitude >= 700) ||
    (elevationGain != null && elevationGain >= 1000)
  ) {
    tags.push('mountain')
  }

  return {
    tags,
    maxAltitude,
  }
}

async function loadWeather({
  lat,
  lon,
  date,
  activityDateTime,
}) {
  const recentDays = daysBetweenToday(date)
  const recent = recentDays >= 0 && recentDays <= 7

  const url = new URL(
    recent ? OPEN_METEO_FORECAST : OPEN_METEO_ARCHIVE
  )

  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('temperature_unit', 'celsius')
  url.searchParams.set('wind_speed_unit', 'kmh')
  url.searchParams.set('precipitation_unit', 'mm')

  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'apparent_temperature',
      'precipitation',
      'rain',
      'snowfall',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_gusts_10m',
      'visibility',
    ].join(',')
  )

  url.searchParams.set(
    'daily',
    [
      'sunrise',
      'sunset',
    ].join(',')
  )

  if (recent) {
    url.searchParams.set('past_days', '7')
    url.searchParams.set('forecast_days', '1')
  } else {
    url.searchParams.set('start_date', date)
    url.searchParams.set('end_date', date)
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Wetterdaten konnten nicht geladen werden (${response.status}): ${body.slice(0, 180)}`
    )
  }

  const payload = await response.json()
  const hourly = payload?.hourly || {}
  const index = findNearestIndex(
    hourly.time,
    activityDateTime
  )

  if (index < 0) {
    throw new Error('Keine passenden stündlichen Wetterdaten gefunden.')
  }

  const weather = {
    source: 'open-meteo',
    timezone: payload?.timezone || null,
    time: hourly?.time?.[index] || null,
    temperature_c: numberOrNull(
      hourly?.temperature_2m?.[index]
    ),
    apparent_temperature_c: numberOrNull(
      hourly?.apparent_temperature?.[index]
    ),
    precipitation_mm: numberOrNull(
      hourly?.precipitation?.[index]
    ),
    rain_mm: numberOrNull(
      hourly?.rain?.[index]
    ),
    snowfall_cm: numberOrNull(
      hourly?.snowfall?.[index]
    ),
    weather_code: numberOrNull(
      hourly?.weather_code?.[index]
    ),
    cloud_cover_percent: numberOrNull(
      hourly?.cloud_cover?.[index]
    ),
    wind_speed_kmh: numberOrNull(
      hourly?.wind_speed_10m?.[index]
    ),
    wind_gusts_kmh: numberOrNull(
      hourly?.wind_gusts_10m?.[index]
    ),
    visibility_m: numberOrNull(
      hourly?.visibility?.[index]
    ),
  }

  weather.tags = classifyWeather({
    code: weather.weather_code,
    rain: weather.rain_mm || 0,
    snowfall: weather.snowfall_cm || 0,
    cloudCover: weather.cloud_cover_percent,
    windSpeed: weather.wind_speed_kmh,
    visibility: weather.visibility_m,
  })

  const sunrise = payload?.daily?.sunrise?.[0] || null
  const sunset = payload?.daily?.sunset?.[0] || null

  return {
    weather,
    sun: {
      sunrise,
      sunset,
      ...classifySunPhase({
        activityDateTime,
        sunrise,
        sunset,
      }),
    },
  }
}

function mergeContext(existing, generated) {
  const current =
    existing && typeof existing === 'object'
      ? existing
      : {}

  return {
    ...current,
    version: ENRICHMENT_VERSION,
    enriched_at: new Date().toISOString(),
    weather: {
      ...(current.weather || {}),
      ...(generated.weather || {}),
    },
    sun: {
      ...(current.sun || {}),
      ...(generated.sun || {}),
    },
    environment: {
      ...(current.environment || {}),
      ...(generated.environment || {}),
      manual_tags: Array.isArray(
        current?.environment?.manual_tags
      )
        ? current.environment.manual_tags
        : [],
    },
    location: {
      ...(current.location || {}),
      ...(generated.location || {}),
    },
  }
}

async function findLog({
  userId,
  logId,
  polarExerciseId,
}) {
  let query = supabase
    .from('logs')
    .select(
      [
        'id',
        'user_id',
        'actual_date',
        'uhrzeit',
        'sport_type',
        'polar_exercise_id',
        'route_waypoints',
        'elevation_gain',
        'hoehenmeter',
        'activity_context',
      ].join(',')
    )
    .eq('user_id', userId)

  if (logId) {
    query = query.eq('id', logId)
  } else if (polarExerciseId) {
    query = query.eq(
      'polar_exercise_id',
      String(polarExerciseId)
    )
  } else {
    throw new Error('logId oder polarExerciseId fehlt.')
  }

  const { data, error } = await query
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Aktivität nicht gefunden.')

  return data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }

  try {
    const {
      userId,
      logId,
      polarExerciseId,
      force = false,
    } = req.body || {}

    if (!userId) {
      return res.status(400).json({
        error: 'userId fehlt.',
      })
    }

    const log = await findLog({
      userId,
      logId,
      polarExerciseId,
    })

    const existing = parseJson(log.activity_context) || {}

    if (
      !force &&
      Number(existing?.version) >= ENRICHMENT_VERSION &&
      existing?.weather?.time
    ) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        context: existing,
      })
    }

    const points = getRoutePoints(log)
    const representative = getRepresentativePoint(points)
    const start = getStartPoint(points)

    if (!representative || !getActivityDate(log)) {
      const context = mergeContext(existing, {
        environment: {
          auto_tags: classifyAutomaticEnvironment(
            log,
            points
          ).tags,
        },
        location: start
          ? {
              start: {
                lat: start.lat,
                lon: start.lon,
              },
            }
          : {},
      })

      const { error: updateError } = await supabase
        .from('logs')
        .update({
          activity_context: context,
        })
        .eq('id', log.id)
        .eq('user_id', userId)

      if (updateError) throw updateError

      return res.status(200).json({
        ok: true,
        partial: true,
        reason: 'Keine vollständigen GPS-/Datumsdaten vorhanden.',
        context,
      })
    }

    let weatherPayload = {
      weather: {},
      sun: {},
    }

    try {
      weatherPayload = await loadWeather({
        lat: representative.lat,
        lon: representative.lon,
        date: getActivityDate(log),
        activityDateTime:
          getActivityLocalDateTime(log),
      })
    } catch (weatherError) {
      console.warn(
        '[Activity Context] Wetter konnte nicht ergänzt werden:',
        weatherError
      )
    }

    const environment = classifyAutomaticEnvironment(
      log,
      points
    )

    const context = mergeContext(existing, {
      ...weatherPayload,
      environment: {
        auto_tags: environment.tags,
        max_altitude_m: environment.maxAltitude,
      },
      location: {
        start: start
          ? {
              lat: start.lat,
              lon: start.lon,
            }
          : null,
        representative: {
          lat: representative.lat,
          lon: representative.lon,
        },
      },
    })

    const { error: updateError } = await supabase
      .from('logs')
      .update({
        activity_context: context,
      })
      .eq('id', log.id)
      .eq('user_id', userId)

    if (updateError) throw updateError

    return res.status(200).json({
      ok: true,
      context,
    })
  } catch (error) {
    console.error(
      '[Activity Context] Enrichment fehlgeschlagen:',
      error
    )

    return res.status(500).json({
      error:
        error?.message ||
        'Aktivitätskontext konnte nicht ergänzt werden.',
    })
  }
}
