// Startet den Polar-AccessLink-V4-Autorisierungsablauf.
// Anders als V3: eigener Autorisierungs-Server (auth.polar.com), explizite Scopes,
// kein separater "User-Registrierungs"-Schritt mehr nötig (Bearer-Token identifiziert
// den Nutzer direkt).

export default function handler(req, res) {
  const { state } = req.query

  if (!state) {
    return res.status(400).json({ error: 'state fehlt' })
  }

  const proto = req.headers['x-forwarded-proto'] || 'https'
  const redirectUri = `${proto}://${req.headers.host}/auth/polar/callback`

  // Nur der Scope, den wir aktuell brauchen (Prinzip der minimalen Berechtigung).
  // Kann später erweitert werden (z.B. nightly_recharge:read), falls gewünscht.
  const scope = 'training_sessions:read sports:read'

  const authUrl = `https://auth.polar.com/oauth/authorize?client_id=${process.env.POLAR_CLIENT_ID}&response_type=code&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`

  res.redirect(authUrl)
}
