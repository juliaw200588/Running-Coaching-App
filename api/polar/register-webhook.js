// Einmalig aufrufen, NACH dem Deploy, per Browser oder curl:
// https://running-coaching-app.vercel.app/api/polar/register-webhook?key=DEIN_SETUP_KEY
//
// Voraussetzung: POLAR_WEBHOOK_SETUP_KEY als Vercel Env Var gesetzt (ein selbst
// gewählter geheimer String, verhindert dass Fremde diesen Endpoint aufrufen).
//
// Die Antwort enthält "signature_secret_key" - diesen Wert SOFORT als
// POLAR_WEBHOOK_SECRET in Vercel speichern und neu deployen. Er wird danach
// nie wieder angezeigt.

export default async function handler(req, res) {
  if (!process.env.POLAR_WEBHOOK_SETUP_KEY || req.query.key !== process.env.POLAR_WEBHOOK_SETUP_KEY) {
    return res.status(403).json({ error: 'Unauthorized. ?key=... fehlt oder falsch.' })
  }

  const auth = Buffer.from(`${process.env.POLAR_CLIENT_ID}:${process.env.POLAR_CLIENT_SECRET}`).toString('base64')
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const webhookUrl = `${proto}://${req.headers.host}/api/polar/webhook`

  try {
    const r = await fetch('https://www.polaraccesslink.com/v3/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: ['EXERCISE'], url: webhookUrl })
    })

    const data = await r.json().catch(() => null)

    if (!r.ok) {
      return res.status(r.status).json({ error: 'Polar hat die Registrierung abgelehnt', details: data })
    }

    return res.status(200).json({
      message: '✅ Webhook erstellt! WICHTIG: signature_secret_key JETZT sichern und als POLAR_WEBHOOK_SECRET in Vercel speichern (danach neu deployen) - der Wert wird nie wieder angezeigt.',
      webhookUrl,
      data,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
