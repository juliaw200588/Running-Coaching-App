import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect('/?polar_error=' + encodeURIComponent(String(error)))
  }
  if (!code || !state) {
    return res.redirect('/?polar_error=missing_params')
  }

  const [userId, stateToken] = String(state).split(':')

  try {
    const { data: integration } = await supabase
      .from('integrations')
      .select('polar_state_token')
      .eq('user_id', userId)
      .single()

    if (!integration || integration.polar_state_token !== stateToken) {
      return res.redirect('/?polar_error=invalid_state')
    }

    const proto = req.headers['x-forwarded-proto'] || 'https'
    const redirectUri = `${proto}://${req.headers.host}/auth/polar/callback`
    const auth = Buffer.from(`${process.env.POLAR_CLIENT_ID}:${process.env.POLAR_CLIENT_SECRET}`).toString('base64')

    const tokenRes = await fetch('https://auth.polar.com/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '')
      console.error('[Polar V4 Callback] Token-Austausch fehlgeschlagen:', tokenRes.status, errText.slice(0, 500))
      return res.redirect('/?polar_error=token_exchange_failed')
    }

    const tokenData = await tokenRes.json()
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 43199) * 1000).toISOString()

    await supabase.from('integrations').update({
      polar_access_token: tokenData.access_token,
      polar_refresh_token: tokenData.refresh_token,
      polar_token_expires_at: expiresAt,
      polar_connected_at: new Date().toISOString(),
      polar_state_token: null,
    }).eq('user_id', userId)

    return res.redirect('/?polar_connected=true')
  } catch (e) {
    console.error('[Polar V4 Callback] Ausnahme:', e)
    return res.redirect('/?polar_error=callback_exception')
  }
}
