import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Profile({ user, onClose }) {
  const [profile, setProfile] = useState({
    name: '', wohnort: '', geburtsdatum: '', groesse: '', gewicht: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (data) setProfile({
        name: data.name || '',
        wohnort: data.wohnort || '',
        geburtsdatum: data.geburtsdatum || '',
        groesse: data.groesse || '',
        gewicht: data.gewicht || '',
      })
      setLoading(false)
    }
    load()
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    setSuccess(false)
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      name: profile.name || null,
      wohnort: profile.wohnort || null,
      geburtsdatum: profile.geburtsdatum || null,
      groesse: profile.groesse ? parseInt(profile.groesse) : null,
      gewicht: profile.gewicht ? parseFloat(profile.gewicht) : null,
    })
    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const inputStyle = {
    width: '100%', padding: '13px 16px', borderRadius: 14,
    border: '1.5px solid #F0E0D0', fontSize: 15, color: '#3D2B1F',
    outline: 'none', boxSizing: 'border-box', background: '#FFF8F5',
    fontFamily: 'sans-serif',
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 'bold', color: '#B8A090',
    textTransform: 'uppercase', letterSpacing: 1,
    display: 'block', marginBottom: 6, fontFamily: 'sans-serif',
  }

  const optLabel = { fontSize: 10, color: '#D4C4B8', fontWeight: 'normal', letterSpacing: 0, textTransform: 'none', marginLeft: 6 }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 24, padding: 32, fontFamily: 'sans-serif', color: '#B8A090' }}>⏳ Lade Profil…</div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '28px 28px 0 0', padding: '24px 24px 48px', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(255,140,105,0.2)' }}>

        <div style={{ width: 36, height: 4, background: '#F0E8E0', borderRadius: 99, margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#3D2B1F', margin: 0 }}>Mein Profil</h2>
          <button onClick={onClose} style={{ background: '#F5EDE8', border: 'none', borderRadius: 10, padding: '6px 12px', color: '#8B6B5A', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 13 }}>✕ Schließen</button>
        </div>

        {/* Email anzeigen */}
        <div style={{ marginBottom: 18, padding: '12px 16px', background: '#FFF5EE', borderRadius: 14, border: '1px solid #FFE0CC' }}>
          <div style={{ fontSize: 10, color: '#C4A882', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'sans-serif', marginBottom: 4 }}>E-Mail</div>
          <div style={{ fontSize: 15, color: '#5C3D2E', fontFamily: 'sans-serif' }}>{user.email}</div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} placeholder="z.B. Julia Müller" value={profile.name}
            onChange={e => setProfile({ ...profile, name: e.target.value })} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Wohnort <span style={optLabel}>optional</span></label>
          <input style={inputStyle} placeholder="z.B. München" value={profile.wohnort}
            onChange={e => setProfile({ ...profile, wohnort: e.target.value })} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Geburtsdatum <span style={optLabel}>optional</span></label>
          <input style={{ ...inputStyle, cursor: 'pointer' }} type="date" value={profile.geburtsdatum}
            onChange={e => setProfile({ ...profile, geburtsdatum: e.target.value })} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
          <div>
            <label style={labelStyle}>Größe (cm) <span style={optLabel}>optional</span></label>
            <input style={inputStyle} type="number" placeholder="z.B. 168" value={profile.groesse}
              onChange={e => setProfile({ ...profile, groesse: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Gewicht (kg) <span style={optLabel}>optional</span></label>
            <input style={inputStyle} type="number" step="0.1" placeholder="z.B. 62.5" value={profile.gewicht}
              onChange={e => setProfile({ ...profile, gewicht: e.target.value })} />
          </div>
        </div>

        {success && (
          <div style={{ marginBottom: 14, padding: '12px 16px', background: '#F0FAF4', border: '1px solid #B8E4CC', borderRadius: 12, fontSize: 13, color: '#5BA88A', fontFamily: 'sans-serif' }}>
            ✓ Profil gespeichert!
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: '16px', borderRadius: 18, border: 'none', background: saving ? '#F0E8E0' : 'linear-gradient(135deg,#7EC8A4,#5BA88A)', color: saving ? '#C4A882' : 'white', fontSize: 15, fontWeight: 'bold', cursor: saving ? 'default' : 'pointer', fontFamily: 'sans-serif', boxShadow: saving ? 'none' : '0 6px 20px rgba(126,200,164,0.4)', marginBottom: 12, transition: 'all 0.2s' }}>
          {saving ? '⏳ Speichern…' : '✓ Profil speichern'}
        </button>

        <button onClick={handleLogout}
          style={{ width: '100%', padding: '14px', borderRadius: 18, border: '1.5px solid #F0E0D0', background: 'white', color: '#C4A882', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
          Ausloggen
        </button>
      </div>
    </div>
  )
}
