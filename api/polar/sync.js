import { fetchAndPersistPolarActivitiesV4 } from './_polarSync.js'

export default async function handler(req, res) {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'userId fehlt' })
  }

  try {
    const result = await fetchAndPersistPolarActivitiesV4(userId)
    const activities = result?.activities || []

    return res.status(200).json({
      activities,
      count: activities.length,
      updatedCount: result?.updatedCount || 0,
    })
  } catch (error) {
    console.error('[Polar V4 Sync Endpoint] Fehler:', error)
    return res.status(500).json({ error: error.message })
  }
}
