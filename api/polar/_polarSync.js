import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

// V4-Access-Token gilt nur 12 Std. (anders als V3) - vor jedem Sync prüfen und bei
// Bedarf per Refresh-Token erneuern.
async function getValidAccessToken(userId) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!integration?.polar_access_token) {
    throw new Error('Polar nicht verbunden')
  }

  const expiresAt = integration.polar_token_expires_at ? new Date(integration.polar_token_expires_at) : null
  const needsRefresh = !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000

  if (!needsRefresh) return integration.polar_access_token

  if (!integration.polar_refresh_token) {
    throw new Error('Zugriff abgelaufen und kein Refresh-Token vorhanden - bitte Polar neu verbinden')
  }

  const auth = Buffer.from(`${process.env.POLAR_CLIENT_ID}:${process.env.POLAR_CLIENT_SECRET}`).toString('base64')
  const tokenRes = await fetch('https://auth.polar.com/oauth/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: integration.polar_refresh_token }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '')
    console.error('[Polar V4] Token-Refresh fehlgeschlagen:', tokenRes.status, errText.slice(0, 500))
    throw new Error('Token-Refresh fehlgeschlagen - bitte Polar neu verbinden')
  }

  const tokenData = await tokenRes.json()
  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 43199) * 1000).toISOString()

  await supabase.from('integrations').update({
    polar_access_token: tokenData.access_token,
    polar_refresh_token: tokenData.refresh_token || integration.polar_refresh_token,
    polar_token_expires_at: newExpiresAt,
  }).eq('user_id', userId)

  return tokenData.access_token
}

// V4 identifiziert Sportarten nur noch über eine Zahlen-ID, nicht mehr als Klartext wie
// V3 ("RUNNING"). Katalog einmal abrufen, um ID -> Name aufzulösen.
async function getSportsMap(token) {
  try {
    const res = await fetch('https://www.polaraccesslink.com/v4/data/sports/list', {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    })
    if (!res.ok) {
      console.log('[Polar V4] Sportarten-Katalog nicht abrufbar, Status:', res.status)
      return {}
    }
    const data = await res.json()
    const map = {}
    ;(data.sports || []).forEach(s => {
      const id = s.id?.id ?? s.id
      if (id != null) map[id] = s.name
    })
    return map
  } catch (e) {
    console.log('[Polar V4] Sportarten-Katalog Fehler:', e.message)
    return {}
  }
}

function isRunningSport(sportName) {
  if (!sportName) return false
  const n = sportName.toLowerCase()
  return n.includes('running') || n.includes('run') || n.includes('lauf')
}

// Wandelt eine V4-Exercise (+ übergeordnete Session, für Felder die nur dort stehen wie
// hrAvg/hrMax/feeling) in unser einheitliches Format um. Nutzt durchgängig Fallback-Ketten
// (exercise.X ?? session.X), da noch nicht 100% verifiziert ist, auf welcher Ebene ein
// Feld bei einem echten (nicht dem Doku-Beispiel-)Datensatz tatsächlich liegt.
function mapV4Exercise(session, exercise, sportName) {
  const distanceMeters = exercise.distanceMeters ?? session.distanceMeters
  const durationMillis = exercise.durationMillis ?? session.durationMillis
  const distanceKm = distanceMeters ? (distanceMeters / 1000).toFixed(2) : null
  const durationSeconds = durationMillis ? durationMillis / 1000 : null

  const pace = distanceKm && durationSeconds
    ? (() => {
        const paceMin = (durationSeconds / 60) / parseFloat(distanceKm)
        const paceM = Math.floor(paceMin)
        const paceS = Math.round((paceMin - paceM) * 60).toString().padStart(2, '0')
        return `${paceM}:${paceS} min/km`
      })()
    : null

  // Route: direkt eingebettet, kein separater GPX-Abruf mehr nötig.
  const wayPoints = exercise.routes?.route?.wayPoints || null

  // Kadenz: aus den Samples nach type "CADENCE" suchen (Feldname nicht zu 100% verifiziert,
  // da im Doku-Beispiel nur HEART_RATE als type gezeigt wurde).
  const samplesList = exercise.samples?.samples || []
  const cadenceSample = samplesList.find(s => s.type && String(s.type).toUpperCase().includes('CADENCE'))
  const avgCadence = cadenceSample?.values?.length
    ? Math.round(cadenceSample.values.reduce((a, b) => a + b, 0) / cadenceSample.values.length)
    : null

  // km-Splits aus den Auto-Runden der Uhr (meist automatisch bei jedem km).
  const autoLaps = exercise.laps?.autoLaps || []
  const splits = autoLaps.length
    ? autoLaps.map((lap, i) => ({
        km: i + 1,
        distanzM: lap.distanceMeters ?? null,
        dauerSek: lap.durationMillis != null ? Math.round(lap.durationMillis / 1000) : null,
      }))
    : null

  const startTime = exercise.startTime ?? session.startTime
  const recoveryTimeMillis = exercise.recoveryTimeMillis ?? session.recoveryTimeMillis

  return {
    polar_exercise_id: exercise.identifier?.id || session.identifier?.id || null,
    datum: startTime?.split('T')[0] || null,
    uhrzeit: startTime?.split('T')[1]?.slice(0, 5) || null,
    distanz: distanceKm ? `${distanceKm} km` : null,
    pace,
    herzfrequenz: session.hrAvg != null ? `${session.hrAvg} bpm` : null,
    hf_max: session.hrMax != null ? String(session.hrMax) : null,
    kalorien: (exercise.calories ?? session.calories) != null ? String(exercise.calories ?? session.calories) : null,
    dauer: durationSeconds != null ? `${Math.round(durationSeconds / 60)} min` : null,
    sport: sportName || null,
    running_index: exercise.runningIndex != null ? String(exercise.runningIndex) : null,
    cadence: avgCadence != null ? String(avgCadence) : null,
    hoehenmeter: exercise.ascentMeters != null ? String(exercise.ascentMeters) : null,
    gefuehl: session.feeling != null ? String(session.feeling) : null,
    training_load: (exercise.trainingLoad ?? session.trainingLoad) != null ? String(exercise.trainingLoad ?? session.trainingLoad) : null,
    recovery_time: recoveryTimeMillis != null ? String(Math.round(recoveryTimeMillis / 60000)) : null,
    route_waypoints: wayPoints,
    km_splits: splits,
  }
}

// Holt Trainingseinheiten der letzten 30 Tage und speichert Laufeinheiten in
// polar_pending_activities. V4 arbeitet mit Datumsbereich statt Transaktionen - Duplikate
// werden über den onConflict-Upsert vermieden, kein "einmal abgeholt, nie wieder"-Problem
// wie bei V3s transaktionalem Modell.
export async function fetchAndPersistPolarActivitiesV4(userId) {
  const token = await getValidAccessToken(userId)
  const sportsMap = await getSportsMap(token)
  const sportsMapEmpty = Object.keys(sportsMap).length === 0
  if (sportsMapEmpty) {
    console.log('[Polar V4 Sync] Sportarten-Katalog leer/nicht abrufbar - filtere NICHT nach Sportart, um nicht versehentlich alles zu verwerfen.')
  }

  const url = `https://www.polaraccesslink.com/v4/data/training-sessions/list`
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.log('[Polar V4 Sync] Trainingseinheiten-Abruf fehlgeschlagen, Status:', res.status, 'Antwort:', errText.slice(0, 1000))
    throw new Error(`Polar V4 API Fehler (${res.status})`)
  }

  const data = await res.json()
  console.log('[Polar V4 Sync] Schlüssel der Antwort:', Object.keys(data).join(', '))
  const sessions = data.trainingSessions || []
  console.log('[Polar V4 Sync] Anzahl Trainingseinheiten:', sessions.length)
  if (sessions[0]) console.log('[Polar V4 Sync] Erste Session (roh, gekürzt):', JSON.stringify(sessions[0]).slice(0, 4000))

  const stored = []

  for (const session of sessions) {
    const exercisesToProcess = (session.exercises && session.exercises.length > 0) ? session.exercises : [session]

    for (const exercise of exercisesToProcess) {
      const sportId = exercise.sport?.id ?? session.sport?.id
      const sportName = sportsMap[sportId] || null

      if (!sportsMapEmpty && !isRunningSport(sportName)) continue

      const row = { user_id: userId, ...mapV4Exercise(session, exercise, sportName) }

      if (!row.polar_exercise_id) {
        console.log('[Polar V4 Sync] Übung ohne ID übersprungen (kann nicht eindeutig gespeichert werden).')
        continue
      }

      const { error } = await supabase
        .from('polar_pending_activities')
        .upsert(row, { onConflict: 'user_id,polar_exercise_id' })

      if (!error) stored.push(row)
      else console.error('[Polar V4 Sync] Upsert-Fehler:', error)
    }
  }

  return stored
}

export { supabase }
