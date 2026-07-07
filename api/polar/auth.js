export default async function handler(req, res) {
  const { state } = req.query

  if (!state) {
    return res.redirect('https://running-coaching-app.vercel.app?polar_error=missing_state')
  }

  const clientId = process.env.POLAR_CLIENT_ID
  const redirectUri = 'https://running-coaching-app.vercel.app/auth/polar/callback'

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'accesslink.read_all',
    state: state,
  })

  const authUrl = `https://flow.polar.com/oauth2/authorization?${params.toString()}`

  console.log('Redirecting to Polar with state:', state?.slice(0, 8))
  res.redirect(302, authUrl)
}