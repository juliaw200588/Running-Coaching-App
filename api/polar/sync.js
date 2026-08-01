import { fetchAndPersistPolarActivitiesV4 } from './_polarSync.js'

export default async function handler(req, res) {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'userId fehlt' })
  }

  try {
    const activities = await fetchAndPersistPolarActivitiesV4(userId)
    return res.status(200).json({ activities, count: activities.length })
  } catch (e) {
    console.error('[Polar V4 Sync Endpoint] Fehler:', e)
    return res.status(500).json({ error: e.message })
  }
}
