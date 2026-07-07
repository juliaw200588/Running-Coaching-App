import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

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

    if (ex.sport?.toLowerCase().includes('running') || ex.sport?.toLowerCase().includes('lauf')) {
      const distanceKm = ex.distance ? (ex.distance / 1000).toFixed(2) : null
      const durationMin = ex.duration ? Math.round(ex.duration / 60) : null
      const pace = distanceKm && durationMin
        ? (() => {
            const paceMin = durationMin / parseFloat(distanceKm)
            const paceM = Math.floor(paceMin)
            const paceS = Math.round((paceMin - paceM) * 60).toString().padStart(2, '0')
            return `${paceM}:${paceS} min/km`
          })()
        : null

      const exerciseId = exerciseUrl.split('/').filter(Boolean).pop()

      const row = {
        user_id: userId,
        polar_exercise_id: exerciseId,
        datum: ex['start-time']?.split('T')[0] || null,
        distanz: distanceKm ? `${distanceKm} km` : null,
        pace,
        herzfrequenz: ex['heart-rate']?.average ? `${ex['heart-rate'].average} bpm` : null,
        kalorien: ex.calories != null ? String(ex.calories) : null,
        dauer: durationMin ? `${durationMin} min` : null,
        sport: ex.sport || null,
      }

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

export { supabase }
