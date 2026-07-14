import { createClient } from '@supabase/supabase-js'
import { fetchExerciseRoute, encodePolyline } from './_polarSync.js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { userId, logId } = req.body

  try {
    const { data: log } = await supabase
      .from('logs')
      .select('id, polar_exercise_id, route_map_url')
      .eq('id', logId)
      .eq('user_id', userId)
      .single()

    if (!log) return res.status(404).json({ error: 'Log nicht gefunden' })

    // Bereits gecached - nichts neu generieren
    if (log.route_map_url) {
      return res.status(200).json({ url: log.route_map_url, cached: true })
    }

    if (!log.polar_exercise_id) {
      return res.status(400).json({ error: 'Kein Polar-Lauf (keine Route verfügbar)' })
    }

    const points = await fetchExerciseRoute(userId, log.polar_exercise_id)
    const polyline = encodePolyline(points)
    const encodedPolyline = encodeURIComponent(polyline)

    const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/path-4+ff8c69-1(${encodedPolyline})/auto/640x400@2x?padding=30&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`

    const imgRes = await fetch(mapUrl)
    if (!imgRes.ok) {
      const errText = await imgRes.text().catch(() => '')
      console.log('[Route Map] Mapbox-Antwort Fehler:', imgRes.status, errText.slice(0, 500))
      return res.status(500).json({ error: `Kartenbild konnte nicht erstellt werden (${imgRes.status})` })
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
    const path = `${userId}/${log.polar_exercise_id}.png`

    await supabase.storage.from('route-maps').upload(path, imgBuffer, {
      upsert: true,
      contentType: 'image/png',
    })

    const { data: urlData } = supabase.storage.from('route-maps').getPublicUrl(path)
    const publicUrl = urlData?.publicUrl

    await supabase.from('logs').update({ route_map_url: publicUrl }).eq('id', logId)

    res.status(200).json({ url: publicUrl, cached: false })
  } catch (e) {
    console.error('Route-Map Fehler:', e)
    res.status(500).json({ error: e.message })
  }
}
