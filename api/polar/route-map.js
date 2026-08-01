import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

// Google's Encoded Polyline Algorithm Format (Standardalgorithmus, von Mapbox erwartet).
// Gegen Googles offizielles Testbeispiel geprüft und korrekt.
function encodeNumber(num) {
  let sgnNum = num << 1
  if (num < 0) sgnNum = ~sgnNum
  let output = ''
  while (sgnNum >= 0x20) {
    output += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63)
    sgnNum >>= 5
  }
  output += String.fromCharCode(sgnNum + 63)
  return output
}

function encodePolyline(points) {
  let output = ''
  let prevLat = 0
  let prevLon = 0
  for (const [lat, lon] of points) {
    const lat5 = Math.round(lat * 1e5)
    const lon5 = Math.round(lon * 1e5)
    output += encodeNumber(lat5 - prevLat)
    output += encodeNumber(lon5 - prevLon)
    prevLat = lat5
    prevLon = lon5
  }
  return output
}

function simplifyPoints(points, maxPoints = 300) {
  if (points.length <= maxPoints) return points
  const step = points.length / maxPoints
  const result = []
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.floor(i * step)])
  }
  result.push(points[points.length - 1])
  return result
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { userId, logId } = req.body

  try {
    const { data: log } = await supabase
      .from('logs')
      .select('id, route_waypoints, route_map_url')
      .eq('id', logId)
      .eq('user_id', userId)
      .single()

    if (!log) return res.status(404).json({ error: 'Log nicht gefunden' })

    if (log.route_map_url) {
      return res.status(200).json({ url: log.route_map_url, cached: true })
    }

    if (!log.route_waypoints || !Array.isArray(log.route_waypoints) || log.route_waypoints.length === 0) {
      return res.status(400).json({ error: 'Keine Route für diesen Lauf gespeichert' })
    }

    // V4 liefert { longitude, latitude, altitude, elapsedMillis } pro Punkt.
    const points = log.route_waypoints
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => [p.latitude, p.longitude])

    if (points.length === 0) {
      return res.status(400).json({ error: 'Route enthält keine gültigen Koordinaten' })
    }

    const simplified = simplifyPoints(points)
    const polyline = encodePolyline(simplified)
    const encodedPolyline = encodeURIComponent(polyline)

    const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/path-4+ff8c69-1(${encodedPolyline})/auto/640x400@2x?padding=30&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`

    const imgRes = await fetch(mapUrl)
    if (!imgRes.ok) {
      const errText = await imgRes.text().catch(() => '')
      console.log('[Route Map] Mapbox-Antwort Fehler:', imgRes.status, errText.slice(0, 500))
      return res.status(500).json({ error: `Kartenbild konnte nicht erstellt werden (${imgRes.status})` })
    }

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
    const path = `${userId}/${logId}.png`

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
