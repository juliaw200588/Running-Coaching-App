import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const { code, state } = req.query

  console.log('Polar callback received:', { code: !!code, state: state?.slice(0, 16) })

  if (!code || !state) {
    return res.redirect('https://running-coaching-app.vercel.app?polar_error=missing_params')
  }

  try {
    const supabase = createClient(
      'https://jgvsbecvgkcfafjyhxvr.supabase.co',
      process.env.SUPABASE_SERVICE_KEY
    )

    // State Format: userId:token
    const [userId, stateToken] = state.split(':')
    console.log('Parsed userId:', userId?.slice(0, 8), 'token:', stateToken?.slice(0, 8))

    if (!userId) {
      return res.redirect('https://running-coaching-app.vercel.app?polar_error=invalid_state')
    }

    const clientId = process.env.POLAR_CLIENT_ID
    const clientSecret = process.env.POLAR_CLIENT_SECRET
    const redirectUri = 'https://running-coaching-app.vercel.app/auth/polar/callback'

    // Token von Polar holen
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
    console.log('Token status:', tokenRes.status, 'has token:', !!tokenData.access_token)

    if (!tokenData.access_token) {
      console.log('Token error:', JSON.stringify(tokenData))
      return res.redirect('https://running-coaching-app.vercel.app?polar_error=token_failed')
    }

    // Polar User registrieren (ignoriere Fehler falls schon registriert)
    await fetch('https://www.polaraccesslink.com/v3/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({ 'member-id': userId })
    })

    // In Supabase speichern
    const { error: updateError } = await supabase
      .from('integrations')
      .update({
        polar_access_token: tokenData.access_token,
        polar_refresh_token: tokenData.refresh_token || null,
        polar_user_id: tokenData.x_user_id?.toString(),
        polar_connected_at: new Date().toISOString(),
        polar_state_token: null,
      })
      .eq('user_id', userId)

    console.log('Update error:', updateError)

    if (updateError) {
      // Falls kein Eintrag existiert, insert
      await supabase.from('integrations').insert({
        user_id: userId,
        polar_access_token: tokenData.access_token,
        polar_refresh_token: tokenData.refresh_token || null,
        polar_user_id: tokenData.x_user_id?.toString(),
        polar_connected_at: new Date().toISOString(),
      })
    }

    res.redirect('https://running-coaching-app.vercel.app?polar_connected=true')
  } catch (e) {
    console.error('Polar callback error:', e.message)
    res.redirect('https://running-coaching-app.vercel.app?polar_error=server_error')
  }
}
