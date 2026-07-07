import { fetchAndPersistPolarActivities } from './_polarSync.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { userId } = req.body

  try {
    const activities = await fetchAndPersistPolarActivities(userId)
    res.status(200).json({ activities, count: activities.length })
  } catch (e) {
    console.error('Polar sync error:', e)
    res.status(500).json({ error: e.message })
  }
}
