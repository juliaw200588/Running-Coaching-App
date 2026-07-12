export default async function handler(req, res) {
  if (!process.env.POLAR_WEBHOOK_SETUP_KEY || req.query.key !== process.env.POLAR_WEBHOOK_SETUP_KEY) {
    return res.status(403).json({ error: 'Unauthorized. ?key=... fehlt oder falsch.' })
  }

  const auth = Buffer.from(`${process.env.POLAR_CLIENT_ID}:${process.env.POLAR_CLIENT_SECRET}`).toString('base64')

  try {
    const r = await fetch('https://www.polaraccesslink.com/v3/webhooks', {
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}` }
    })

    const data = await r.json().catch(() => null)

    if (!r.ok) {
      return res.status(r.status).json({ error: 'Polar hat die Anfrage abgelehnt', status: r.status, details: data })
    }

    return res.status(200).json({
      message: data?.data?.length > 0 || (Array.isArray(data) && data.length > 0)
        ? '✅ Es existiert eine Webhook-Registrierung.'
        : '⚠️ KEINE Webhook-Registrierung gefunden - das erklärt, warum nichts automatisch ankommt.',
      raw: data,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
