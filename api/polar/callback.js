import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  const { code, state } = req.query

  if (!code) {
    return res.redirect('https://running-coaching-app.vercel.app?polar_error=no_code')
  }

  try {
    const clientId = process.env.POLAR_CLIENT_ID
    const clientSecret = process.env.POLAR_CLIENT_SECRET
    const redirectUri = 'https://running-coaching-app.vercel.app/auth/polar/callback'

    // Token holen
    const tokenRes = await fetch('https://polarremote.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      })
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      return res.redirect('https://running-coaching-app.vercel.app?polar_error=token_failed')
    }

    // Polar User registrieren
    await fetch('https://www.polaraccesslink.com/v3/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({ 'member-id': tokenData.x_user_id?.toString() || 'user' })
    })

    // In Supabase speichern – user_id aus state Parameter
    const userId = state
    if (userId) {
      await supabase.from('integrations').upsert({
        user_id: userId,
        polar_access_token: tokenData.access_token,
        polar_refresh_token: tokenData.refresh_token || null,
        polar_user_id: tokenData.x_user_id?.toString(),
        polar_connected_at: new Date().toISOString(),
      })
    }

    res.redirect('https://running-coaching-app.vercel.app?polar_connected=true')
  } catch (e) {
    console.error('Polar callback error:', e)
    res.redirect('https://running-coaching-app.vercel.app?polar_error=server_error')
  }
}
