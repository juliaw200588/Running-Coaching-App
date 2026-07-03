export default async function handler(req, res) {
  const clientId = process.env.POLAR_CLIENT_ID
  const redirectUri = 'https://running-coaching-app.vercel.app/auth/polar/callback'

  const authUrl = `https://flow.polar.com/oauth2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=accesslink.read_all`

  res.redirect(302, authUrl)
}
