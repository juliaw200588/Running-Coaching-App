import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Auth({ initialMode = 'login', onBack }) {
  const [mode, setMode] = useState(initialMode) // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    setMode(initialMode)
    setError(null)
    setSuccess(null)
  }, [initialMode])

  const handleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handlePasswordReset = async () => {
    if (!form.email) {
      setError('Bitte zuerst deine E-Mail-Adresse eingeben.')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: 'https://running-coaching-app.vercel.app/reset-password',
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess('E-Mail zum Zurücksetzen des Passworts wurde gesendet!')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name }
      }
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Bitte bestätige deine E-Mail-Adresse – wir haben dir eine Mail geschickt!')
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '13px 16px', borderRadius: 14,
    border: '1.5px solid #F0E0D0', fontSize: 16, color: '#3D2B1F',
    outline: 'none', boxSizing: 'border-box', background: '#FFF8F5',
    fontFamily: 'sans-serif',
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 'bold', color: '#B8A090',
    textTransform: 'uppercase', letterSpacing: 1,
    display: 'block', marginBottom: 6, fontFamily: 'sans-serif',
  }

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', minHeight: '100vh', position:'relative' }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{ position:'absolute', top:16, left:16, zIndex:20, border:'1px solid rgba(255,255,255,.5)', background:'rgba(255,255,255,.18)', backdropFilter:'blur(8px)', color:'#fff', borderRadius:999, padding:'9px 13px', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'sans-serif' }}
        >
          ← Zur Startseite
        </button>
      )}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #FF8C69 0%, #FFB347 50%, #FF6B9D 100%)', padding: '56px 24px 48px', borderRadius: '0 0 40px 40px', boxShadow: '0 8px 32px rgba(255,140,105,0.3)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -40, left: 20, width: 100, height: 100, background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />
        <img src="/route-icon.png" alt="Route" style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 12 }} />
        <h1 style={{ color: 'white', fontSize: 28, fontWeight: 'bold', margin: '0 0 6px', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>Run Coaching</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: 0, fontFamily: 'sans-serif' }}>Dein persönlicher Trainingsplan</p>
      </div>

      <div style={{ maxWidth: 420, margin: '0 auto', padding: '28px 20px 40px' }}>

        {/* Tab Switch */}
        <div style={{ display: 'flex', background: 'white', borderRadius: 16, padding: 4, marginBottom: 20, boxShadow: '0 2px 12px rgba(255,140,105,0.1)', border: '1px solid #FFE8D8' }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null) }}
              style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: mode === m ? 'linear-gradient(135deg,#FF8C69,#FF6B9D)' : 'transparent', color: mode === m ? 'white' : '#B8A090', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all 0.2s' }}>
              {m === 'login' ? 'Einloggen' : 'Registrieren'}
            </button>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 4px 32px rgba(255,140,105,0.12)', border: '1px solid #FFE8D8' }}>

          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
              <h2 style={{ color: '#3D2B1F', fontSize: 20, marginBottom: 10 }}>Fast geschafft!</h2>
              <p style={{ color: '#8B6B5A', fontSize: 14, fontFamily: 'sans-serif', lineHeight: 1.6 }}>{success}</p>
              <button onClick={() => { setMode('login'); setSuccess(null) }}
                style={{ marginTop: 20, padding: '12px 24px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: 'white', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                Zum Login
              </button>
            </div>
          ) : (
            <>
              {mode === 'register' && (
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Dein Name</label>
                  <input style={inputStyle} placeholder="Dein Name" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>E-Mail</label>
                <input style={inputStyle} type="email" placeholder="E-Mail Adresse" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Passwort</label>
                <input style={inputStyle} type="password" placeholder={mode === 'register' ? 'Mindestens 6 Zeichen' : '••••••••'} value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>

              {error && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#FDECEA', border: '1px solid #F5C4CC', borderRadius: 12, fontSize: 13, color: '#B85464', fontFamily: 'sans-serif' }}>
                  {error}
                </div>
              )}

              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginBottom: 16, marginTop: -8 }}>
                  <button onClick={handlePasswordReset} disabled={loading}
                    style={{ background: 'none', border: 'none', color: '#FF8C69', fontSize: 12, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                    Passwort vergessen?
                  </button>
                </div>
              )}

              <button onClick={mode === 'login' ? handleLogin : handleRegister} disabled={loading}
                style={{ width: '100%', padding: '17px', borderRadius: 18, border: 'none', background: loading ? '#F0E8E0' : 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: loading ? '#C4A882' : 'white', fontSize: 16, fontWeight: 'bold', cursor: loading ? 'default' : 'pointer', fontFamily: 'sans-serif', boxShadow: loading ? 'none' : '0 8px 24px rgba(255,107,157,0.4)', transition: 'all 0.2s' }}>
                {loading ? '⏳ Bitte warten…' : mode === 'login' ? '→ Einloggen' : '🏃‍♀️ Konto erstellen'}
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#D4C4B8', marginTop: 20, fontFamily: 'sans-serif' }}>
          Run Coaching App
        </p>
      </div>
    </div>
  )
}
