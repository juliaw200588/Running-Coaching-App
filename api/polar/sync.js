import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { userId } = req.body

  try {
    // Token aus Supabase holen
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!integration?.polar_access_token) {
      return res.status(400).json({ error: 'Polar nicht verbunden' })
    }

    const token = integration.polar_access_token
    const polarUserId = integration.polar_user_id

    // Neue Trainings-Transaktionen erstellen
    const txRes = await fetch(`https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      }
    })

    if (txRes.status === 204) {
      return res.status(200).json({ message: 'Keine neuen Läufe', activities: [] })
    }

    if (!txRes.ok) {
      return res.status(200).json({ message: 'Keine neuen Daten verfügbar', activities: [] })
    }

    const txData = await txRes.json()
    const transactionId = txData['transaction-id']

    // Aktivitäten aus Transaktion laden
    const activitiesRes = await fetch(
      `https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      }
    )

    const activitiesData = await activitiesRes.json()
    const exercises = activitiesData['exercises'] || []

    const activities = []

    for (const exerciseUrl of exercises) {
      const exRes = await fetch(exerciseUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      })
      const ex = await exRes.json()

      // Nur Läufe
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

        activities.push({
          datum: ex['start-time']?.split('T')[0],
          distanz: distanceKm ? `${distanceKm} km` : null,
          pace,
          herzfrequenz: ex['heart-rate']?.average ? `${ex['heart-rate'].average} bpm` : null,
          kalorien: ex.calories || null,
          sport: ex.sport,
          dauer: durationMin ? `${durationMin} min` : null,
        })
      }
    }

    // Transaktion bestätigen
    await fetch(
      `https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions/${transactionId}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    res.status(200).json({ activities, count: activities.length })
  } catch (e) {
    console.error('Polar sync error:', e)
    res.status(500).json({ error: e.message })
  }
}
