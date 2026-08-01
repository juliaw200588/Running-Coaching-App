// Webhook vorübergehend deaktiviert im Zuge der Umstellung auf Polar AccessLink V4 -
// V4s Webhook-Format/Signatur wurde noch nicht untersucht. Antwortet einfach mit 200,
// damit Polar (falls es hierher noch sendet) keine Fehler häuft, tut aber nichts.
// Automatischer Sync über Webhook ist bis auf Weiteres außer Betrieb - der manuelle
// "🔄 Synchronisieren"-Button funktioniert unverändert.

export default async function handler(req, res) {
  console.log('[Polar Webhook] Aufgerufen, aber deaktiviert (V4-Umstellung). Body:', JSON.stringify(req.body || {}).slice(0, 500))
  res.status(200).json({ received: true, note: 'webhook currently disabled pending V4 migration' })
}
