import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

// Polar liefert "duration" als ISO-8601-Dauer (z.B. "PT47M36S" = 47 Min 36 Sek),
// nicht als einfache Sekundenzahl. Reines "/60" auf einen solchen String ergibt NaN,
// wodurch die Pace-Berechnung bisher stillschweigend übersprungen wurde.
function parseIsoDurationToSeconds(duration) {
  if (duration == null) return null
  if (typeof duration === 'number') return duration // falls doch mal eine reine Zahl kommt
  const match = String(duration).match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/)
  if (!match) return null
  const hours = parseFloat(match[1] || '0')
  const minutes = parseFloat(match[2] || '0')
  const seconds = parseFloat(match[3] || '0')
  return hours * 3600 + minutes * 60 + seconds
}

// Wandelt ein rohes Polar-Exercise-Objekt in unser einheitliches Aktivitäts-Format um.
// Wird sowohl vom Transaktions-Sync als auch vom History-Endpunkt genutzt.
function mapExercise(ex, exerciseId) {
  const distanceKm = ex.distance ? (ex.distance / 1000).toFixed(2) : null
  const durationSeconds = parseIsoDurationToSeconds(ex.duration)
  const durationMin = durationSeconds != null ? Math.round(durationSeconds / 60) : null
  const pace = distanceKm && durationSeconds != null
    ? (() => {
        const paceMin = (durationSeconds / 60) / parseFloat(distanceKm)
        const paceM = Math.floor(paceMin)
        const paceS = Math.round((paceMin - paceM) * 60).toString().padStart(2, '0')
        return `${paceM}:${paceS} min/km`
      })()
    : null

  return {
    polar_exercise_id: exerciseId,
    datum: ex['start-time']?.split('T')[0] || null,
    distanz: distanceKm ? `${distanceKm} km` : null,
    pace,
    herzfrequenz: ex['heart-rate']?.average ? `${ex['heart-rate'].average} bpm` : null,
    kalorien: ex.calories != null ? String(ex.calories) : null,
    dauer: durationMin ? `${durationMin} min` : null,
    sport: ex.sport || null,
  }
}

function isRunning(ex) {
  return ex.sport?.toLowerCase().includes('running') || ex.sport?.toLowerCase().includes('lauf')
}

// Holt neue Läufe von Polar für einen User und speichert sie in polar_pending_activities.
// Wird sowohl vom manuellen Sync-Button als auch vom Webhook aufgerufen.
export async function fetchAndPersistPolarActivities(userId) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!integration?.polar_access_token) {
    throw new Error('Polar nicht verbunden')
  }

  const token = integration.polar_access_token
  const polarUserId = integration.polar_user_id

  const txRes = await fetch(`https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  })

  if (txRes.status === 204 || !txRes.ok) return []

  const txData = await txRes.json()
  const transactionId = txData['transaction-id']

  const activitiesRes = await fetch(
    `https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions/${transactionId}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
  )
  const activitiesData = await activitiesRes.json()
  const exercises = activitiesData['exercises'] || []

  const stored = []

  for (const exerciseUrl of exercises) {
    const exRes = await fetch(exerciseUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    })
    const ex = await exRes.json()

    if (isRunning(ex)) {
      const exerciseId = exerciseUrl.split('/').filter(Boolean).pop()
      const row = { user_id: userId, ...mapExercise(ex, exerciseId) }

      const { error } = await supabase
        .from('polar_pending_activities')
        .upsert(row, { onConflict: 'user_id,polar_exercise_id' })

      if (!error) stored.push(row)
      else console.error('Polar activity upsert error:', error)
    }
  }

  // Transaktion bestätigen, damit Polar die Aktivitäten als abgeholt markiert
  await fetch(
    `https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions/${transactionId}`,
    { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }
  )

  return stored
}

// Holt Läufe über den NICHT-transaktionalen Endpunkt (/v3/exercises) - liefert die
// Verlaufsdaten wiederholbar, ohne sie als "abgeholt" zu markieren. Dient als manueller
// Wiederherstellungsweg, falls ein Lauf über den Transaktions-Sync bereits verbraucht
// wurde (z.B. nach einer falschen Zuordnung), aber erneut zugeordnet werden muss.
export async function fetchPolarHistory(userId) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!integration?.polar_access_token) {
    throw new Error('Polar nicht verbunden')
  }

  const token = integration.polar_access_token

  const res = await fetch('https://www.polaraccesslink.com/v3/exercises', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  })

  if (!res.ok) throw new Error(`Polar API Fehler (${res.status})`)

  const data = await res.json()
  const exercises = data.exercises || data || []

  return exercises
    .filter(isRunning)
    .map(ex => mapExercise(ex, String(ex.id ?? ex['start-time'])))
    .filter(a => a.datum)
    .sort((a, b) => (a.datum < b.datum ? 1 : -1))
}

export { supabase }
