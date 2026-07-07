import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { fetchAndPersistPolarActivities } from './_polarSync.js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

// Vercel soll den Body NICHT vorparsen, wir brauchen den Rohtext für die Signaturprüfung
export const config = { api: { bodyParser: false } }

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function isValidSignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return null // null = "konnte nicht geprüft werden" (z.B. Secret noch nicht gesetzt)
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(signatureHeader, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true })
  }

  const rawBody = await readRawBody(req)
  const signatureHeader = req.headers['polar-webhook-signature']
  const secret = process.env.POLAR_WEBHOOK_SECRET

  const valid = isValidSignature(rawBody, signatureHeader, secret)

  if (valid === false) {
    console.error('Polar webhook: ungültige Signatur')
    return res.status(401).json({ error: 'invalid signature' })
  }
  if (valid === null) {
    // Kein Secret konfiguriert (z.B. während der initialen Ping-Prüfung bei der
    // Webhook-Registrierung, bevor POLAR_WEBHOOK_SECRET in Vercel gesetzt wurde).
    console.warn('Polar webhook: Signatur konnte nicht geprüft werden (kein POLAR_WEBHOOK_SECRET gesetzt)')
  }

  // Sofort antworten, danach verarbeiten – Polar erwartet eine schnelle Antwort.
  res.status(200).json({ ok: true })

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return
  }

  if (payload.event !== 'EXERCISE') return

  try {
    // polar_user_id ist Polars interne ID, kann als Zahl oder String gespeichert sein
    const { data: integrations } = await supabase
      .from('integrations')
      .select('user_id, polar_user_id')
      .not('polar_access_token', 'is', null)

    const match = (integrations || []).find(
      i => String(i.polar_user_id) === String(payload.user_id)
    )

    if (!match) {
      console.warn('Polar webhook: kein User für polar_user_id', payload.user_id, 'gefunden')
      return
    }

    await fetchAndPersistPolarActivities(match.user_id)
  } catch (e) {
    console.error('Polar webhook Verarbeitungsfehler:', e)
  }
}
