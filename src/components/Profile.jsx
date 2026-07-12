import { useState, useEffect, useRef } from 'react'
import Friends from './Friends.jsx'
import PolarConnect from './PolarConnect.jsx'
import Laeufe from './Laeufe.jsx'
import Statistics from './Statistics.jsx'
import { supabase } from '../lib/supabase.js'

const TABS = [
  { id: 'profil', label: 'Profil', icon: '👤' },
  { id: 'stats', label: 'Statistik', icon: '📊' },
  { id: 'laeufe', label: 'Läufe', icon: '🏃‍♀️' },
  { id: 'schuhe', label: 'Schuhe', icon: '👟' },
  { id: 'freunde', label: 'Freunde', icon: '👥' },
  { id: 'geraete', label: 'Geräte', icon: '⌚' },
]

function SchuhCard({ schuh, onEdit, onDelete }) {
  const gelaufen = parseFloat(schuh.start_km) || 0
  const maxKm = parseFloat(schuh.max_km) || 700
  const prozent = Math.min(Math.round((gelaufen / maxKm) * 100), 100)
  const warnung = prozent >= 80
  const kritisch = prozent >= 95

  const farbe = kritisch ? '#B85464' : warnung ? '#C17A3A' : '#5BA88A'

  return (
    <div style={{ background: 'white', border: `1.5px solid ${kritisch ? '#F5C4CC' : warnung ? '#FFD4B0' : '#F0E8E0'}`, borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>{schuh.marke} {schuh.modell}</div>
          {schuh.farbe && <div style={{ fontSize: 11, color: '#B8A090', fontFamily: 'sans-serif', marginTop: 2 }}>{schuh.farbe}</div>}
          {schuh.kaufdatum && <div style={{ fontSize: 11, color: '#B8A090', fontFamily: 'sans-serif', marginTop: 1 }}>seit {new Date(schuh.kaufdatum).toLocaleDateString('de-DE')}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(schuh)} style={{ background: '#FFF5EE', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#FF8C69', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold' }}>✏️</button>
          <button onClick={() => onDelete(schuh.id)} style={{ background: '#FDECEA', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#B85464', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold' }}>🗑</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: 'sans-serif', color: farbe, fontWeight: 'bold' }}>{gelaufen} km gelaufen</span>
        <span style={{ fontSize: 11, fontFamily: 'sans-serif', color: '#B8A090' }}>max. {maxKm} km</span>
      </div>

      <div style={{ background: '#F5EDE8', borderRadius: 6, height: 8, overflow: 'hidden' }}>
        <div style={{ width: `${prozent}%`, height: '100%', background: farbe, borderRadius: 6, transition: 'width 0.4s ease' }} />
      </div>

      {warnung && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: kritisch ? '#FDECEA' : '#FFF0E6', borderRadius: 8, fontSize: 11, color: farbe, fontFamily: 'sans-serif' }}>
          {kritisch ? '⚠️ Schuhe sollten bald ersetzt werden!' : '💡 Über 80% – langsam an neue Schuhe denken.'}
        </div>
      )}
    </div>
  )
}

function SchuhForm({ schuh, onSave, onCancel }) {
  const [form, setForm] = useState({
    marke: schuh?.marke || '',
    modell: schuh?.modell || '',
    farbe: schuh?.farbe || '',
    kaufdatum: schuh?.kaufdatum || '',
    start_km: schuh?.start_km || 0,
    max_km: schuh?.max_km || 700,
  })

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 12,
    border: '1.5px solid #F0E0D0', fontSize: 15, color: '#3D2B1F',
    outline: 'none', boxSizing: 'border-box', background: '#FFF8F5',
    fontFamily: 'sans-serif',
  }
  const labelStyle = {
    fontSize: 11, fontWeight: 'bold', color: '#B8A090',
    textTransform: 'uppercase', letterSpacing: 1,
    display: 'block', marginBottom: 5, fontFamily: 'sans-serif',
  }

  return (
    <div style={{ background: '#FFF5EE', borderRadius: 16, padding: 16, marginBottom: 12, border: '1.5px solid #FFE0CC' }}>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: '#FF8C69', marginBottom: 14, fontFamily: 'sans-serif' }}>
        {schuh ? 'Schuh bearbeiten' : 'Neuen Schuh hinzufügen'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Marke</label>
          <input style={inputStyle} placeholder="z.B. Nike" value={form.marke}
            onChange={e => setForm({ ...form, marke: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Modell</label>
          <input style={inputStyle} placeholder="z.B. Pegasus 40" value={form.modell}
            onChange={e => setForm({ ...form, modell: e.target.value })} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Farbe <span style={{ fontSize: 10, color: '#D4C4B8', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}>optional</span></label>
        <input style={inputStyle} placeholder="z.B. Blau/Weiß" value={form.farbe}
          onChange={e => setForm({ ...form, farbe: e.target.value })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Kaufdatum <span style={{ fontSize: 10, color: '#D4C4B8', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}>optional</span></label>
          <input style={{ ...inputStyle, cursor: 'pointer' }} type="date" value={form.kaufdatum}
            onChange={e => setForm({ ...form, kaufdatum: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Bereits gelaufen (km)</label>
          <input style={inputStyle} type="number" placeholder="0" value={form.start_km}
            onChange={e => setForm({ ...form, start_km: e.target.value })} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Max. km (Standard: 700)</label>
        <input style={inputStyle} type="number" placeholder="700" value={form.max_km}
          onChange={e => setForm({ ...form, max_km: e.target.value })} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #F0E0D0', background: 'white', color: '#B8A090', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>Abbrechen</button>
        <button onClick={() => onSave({ ...form, start_km: parseFloat(form.start_km) || 0, max_km: parseFloat(form.max_km) || 700, kaufdatum: form.kaufdatum || null })} disabled={!form.marke || !form.modell}
          style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: !form.marke || !form.modell ? '#F0E8E0' : 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: !form.marke || !form.modell ? '#C4A882' : 'white', fontSize: 14, fontWeight: 'bold', cursor: !form.marke || !form.modell ? 'default' : 'pointer', fontFamily: 'sans-serif' }}>
          Speichern ✓
        </button>
      </div>
    </div>
  )
}

export default function Profile({ user, onClose, plan }) {
  const [activeTab, setActiveTab] = useState('profil')
  const [profile, setProfile] = useState({ name: '', wohnort: '', geburtsdatum: '', groesse: '', gewicht: '', max_hf: '', ruhe_hf: '', wochen_km: '' })
  const [privacy, setPrivacy] = useState({ plan: 'freunde', fortschritt: 'freunde', logs: 'freunde', schuhe: 'freunde' })
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [schuhe, setSchuhe] = useState([])
  const [showSchuhForm, setShowSchuhForm] = useState(false)
  const [editSchuh, setEditSchuh] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [success, setSuccess] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile({ name: data.name || '', wohnort: data.wohnort || '', geburtsdatum: data.geburtsdatum || '', groesse: data.groesse || '', gewicht: data.gewicht || '', max_hf: data.max_hf || '', ruhe_hf: data.ruhe_hf || '', wochen_km: data.wochen_km || '' })
        if (data.avatar_url) setAvatarUrl(data.avatar_url)
        setPrivacy({ plan: data.privacy_plan || 'freunde', fortschritt: data.privacy_fortschritt || 'freunde', logs: data.privacy_logs || 'freunde', schuhe: data.privacy_schuhe || 'freunde' })
      }
      const { data: schuhData } = await supabase.from('shoes').select('*').eq('user_id', user.id).order('created_at')
      if (schuhData) setSchuhe(schuhData)
      setLoading(false)
    }
    load()
  }, [user])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      setAvatarUrl(url)
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: url })
    }
    setUploadingAvatar(false)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setSuccess(false)
    await supabase.from('profiles').upsert({
      id: user.id, email: user.email,
      name: profile.name || null, wohnort: profile.wohnort || null,
      geburtsdatum: profile.geburtsdatum || null,
      groesse: profile.groesse ? parseInt(profile.groesse) : null,
      gewicht: profile.gewicht ? parseFloat(profile.gewicht) : null,
      max_hf: profile.max_hf ? parseInt(profile.max_hf) : null,
      ruhe_hf: profile.ruhe_hf ? parseInt(profile.ruhe_hf) : null,
      wochen_km: profile.wochen_km ? parseFloat(profile.wochen_km) : null,
      avatar_url: avatarUrl || null,
      privacy_plan: privacy.plan,
      privacy_fortschritt: privacy.fortschritt,
      privacy_logs: privacy.logs,
      privacy_schuhe: privacy.schuhe,
    })
    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const handleSaveSchuh = async (form) => {
    if (editSchuh) {
      const { data, error } = await supabase.from('shoes').update({ ...form }).eq('id', editSchuh.id).select().single()
      if (error) { console.error('Update Fehler:', error); return }
      setSchuhe(prev => prev.map(s => s.id === editSchuh.id ? data : s))
    } else {
      const { data, error } = await supabase.from('shoes').insert({ ...form, user_id: user.id }).select().single()
      if (error) { console.error('Insert Fehler:', error); return }
      if (data) setSchuhe(prev => [...prev, data])
    }
    setShowSchuhForm(false)
    setEditSchuh(null)
  }

  const handleDeleteSchuh = async (id) => {
    await supabase.from('shoes').delete().eq('id', id)
    setSchuhe(prev => prev.filter(s => s.id !== id))
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
      <div style={{ background: 'white', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(255,140,105,0.2)' }}>

        {/* Handle + Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: '#F0E8E0', borderRadius: 99, margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#3D2B1F', margin: 0 }}>Mein Profil</h2>
            <button onClick={onClose} style={{ background: '#F5EDE8', border: 'none', borderRadius: 10, padding: '6px 12px', color: '#8B6B5A', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 13 }}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ overflowX: 'auto', marginBottom: 4, WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', gap: 6, minWidth: 'max-content' }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ padding: '10px 14px', borderRadius: 12, border: activeTab === tab.id ? '2px solid #FF8C69' : '1.5px solid #F0E8E0', background: activeTab === tab.id ? '#FFF5F0' : 'white', color: activeTab === tab.id ? '#FF8C69' : '#B8A090', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

        {/* Scrollbarer Inhalt */}
        <div style={{ overflowY: 'auto', padding: '16px 24px 40px', flex: 1 }}>

          {/* ── PROFIL TAB ── */}
          {activeTab === 'profil' && (
            <>
              {/* Avatar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profilbild" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #FFE0CC' }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, border: '3px solid #FFE0CC' }}>
                      {profile.name ? profile.name[0].toUpperCase() : '👤'}
                    </div>
                  )}
                  <button onClick={() => fileRef.current.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', border: '2px solid white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {uploadingAvatar ? '⏳' : '📷'}
                  </button>
                </div>
                <button onClick={() => fileRef.current.click()} disabled={uploadingAvatar} style={{ fontSize: 12, color: '#FF8C69', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                  {uploadingAvatar ? 'Wird hochgeladen…' : 'Foto ändern'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              </div>

              <div style={{ marginBottom: 16, padding: '12px 16px', background: '#FFF5EE', borderRadius: 14, border: '1px solid #FFE0CC' }}>
                <div style={{ fontSize: 10, color: '#C4A882', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'sans-serif', marginBottom: 4 }}>E-Mail</div>
                <div style={{ fontSize: 14, color: '#5C3D2E', fontFamily: 'sans-serif' }}>{user.email}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} placeholder="z.B. Julia Müller" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Wohnort <span style={optLabel}>optional</span></label>
                <input style={inputStyle} placeholder="z.B. München" value={profile.wohnort} onChange={e => setProfile({ ...profile, wohnort: e.target.value })} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Geburtsdatum <span style={optLabel}>optional</span></label>
                <input style={{ ...inputStyle, cursor: 'pointer' }} type="date" value={profile.geburtsdatum} onChange={e => setProfile({ ...profile, geburtsdatum: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Größe (cm) <span style={optLabel}>optional</span></label>
                  <input style={inputStyle} type="number" placeholder="168" value={profile.groesse} onChange={e => setProfile({ ...profile, groesse: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Gewicht (kg) <span style={optLabel}>optional</span></label>
                  <input style={inputStyle} type="number" step="0.1" placeholder="62.5" value={profile.gewicht} onChange={e => setProfile({ ...profile, gewicht: e.target.value })} />
                </div>
              </div>


              {/* Laufwerte */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'sans-serif', marginBottom: 12 }}>
                  🏃‍♀️ Laufwerte
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={labelStyle}>Max. Herzfrequenz <span style={optLabel}>optional</span></label>
                    <input style={inputStyle} type="number" placeholder="z.B. 185 bpm" value={profile.max_hf}
                      onChange={e => setProfile({ ...profile, max_hf: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Ruhe-HF <span style={optLabel}>optional</span></label>
                    <input style={inputStyle} type="number" placeholder="z.B. 52 bpm" value={profile.ruhe_hf}
                      onChange={e => setProfile({ ...profile, ruhe_hf: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Aktuelle Wochenkilometer <span style={optLabel}>optional</span></label>
                  <input style={inputStyle} type="number" placeholder="z.B. 30 km" value={profile.wochen_km}
                    onChange={e => setProfile({ ...profile, wochen_km: e.target.value })} />
                </div>
                <div style={{ padding: '10px 14px', background: '#F0FAF4', border: '1px solid #B8E4CC', borderRadius: 12, fontSize: 12, color: '#5BA88A', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
                  💡 Aktualisierte Werte fließen automatisch in die nächste Wochenanalyse ein.
                </div>
              </div>

              {/* Privatsphäre */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'sans-serif', marginBottom: 12 }}>
                  🔒 Privatsphäre – Was dürfen Freunde sehen?
                </div>
                {[
                  { key: 'plan', label: 'Trainingsplan' },
                  { key: 'fortschritt', label: 'Fortschritt & Läufe' },
                  { key: 'logs', label: 'Logs & Zeiten' },
                  { key: 'schuhe', label: 'Laufschuhe' },
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFF8F5', borderRadius: 12, marginBottom: 8, border: '1px solid #F0E0D0' }}>
                    <span style={{ fontSize: 13, color: '#5C3D2E', fontFamily: 'sans-serif', fontWeight: 'bold' }}>{item.label}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['freunde', 'niemand'].map(opt => (
                        <button key={opt} onClick={() => setPrivacy(p => ({ ...p, [item.key]: opt }))}
                          style={{ padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${privacy[item.key] === opt ? '#FF8C69' : '#F0E0D0'}`, background: privacy[item.key] === opt ? '#FFF0EB' : 'white', color: privacy[item.key] === opt ? '#FF8C69' : '#C4A882', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all 0.2s' }}>
                          {opt === 'freunde' ? '👥 Freunde' : '🔒 Niemand'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {success && <div style={{ marginBottom: 14, padding: '12px 16px', background: '#F0FAF4', border: '1px solid #B8E4CC', borderRadius: 12, fontSize: 13, color: '#5BA88A', fontFamily: 'sans-serif' }}>✓ Profil gespeichert!</div>}

              <button onClick={handleSaveProfile} disabled={saving}
                style={{ width: '100%', padding: '16px', borderRadius: 18, border: 'none', background: saving ? '#F0E8E0' : 'linear-gradient(135deg,#7EC8A4,#5BA88A)', color: saving ? '#C4A882' : 'white', fontSize: 15, fontWeight: 'bold', cursor: saving ? 'default' : 'pointer', fontFamily: 'sans-serif', marginBottom: 12 }}>
                {saving ? '⏳ Speichern…' : '✓ Profil speichern'}
              </button>
              <button onClick={() => supabase.auth.signOut()}
                style={{ width: '100%', padding: '14px', borderRadius: 18, border: '1.5px solid #F0E0D0', background: 'white', color: '#C4A882', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                Ausloggen
              </button>
            </>
          )}

          {/* ── SCHUHE TAB ── */}
          {activeTab === 'schuhe' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: '#B8A090', fontFamily: 'sans-serif' }}>
                  {schuhe.length === 0 ? 'Noch keine Schuhe eingetragen' : `${schuhe.length} Paar eingetragen`}
                </div>
                {!showSchuhForm && (
                  <button onClick={() => { setShowSchuhForm(true); setEditSchuh(null) }}
                    style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: 'white', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                    + Hinzufügen
                  </button>
                )}
              </div>

              {(showSchuhForm || editSchuh) && (
                <SchuhForm
                  schuh={editSchuh}
                  onSave={handleSaveSchuh}
                  onCancel={() => { setShowSchuhForm(false); setEditSchuh(null) }}
                />
              )}

              {schuhe.length === 0 && !showSchuhForm && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B8A090', fontFamily: 'sans-serif' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>👟</div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>Trag deine Laufschuhe ein</div>
                  <div style={{ fontSize: 12, color: '#D4C4B8' }}>Verfolge die gelaufenen km pro Schuh</div>
                </div>
              )}

              {schuhe.map(schuh => (
                <SchuhCard key={schuh.id} schuh={schuh}
                  onEdit={(s) => { setEditSchuh(s); setShowSchuhForm(false) }}
                  onDelete={handleDeleteSchuh}
                />
              ))}

              <div style={{ marginTop: 16, padding: '12px 16px', background: '#F0FAF4', border: '1px solid #B8E4CC', borderRadius: 12, fontSize: 12, color: '#5BA88A', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
                💡 Laufschuhe halten ca. 600–800 km. Wir empfehlen einen Wechsel spätestens bei 700 km.
              </div>
            </>
          )}

          {/* ── STATISTIK TAB ── */}
          {activeTab === 'stats' && (
            <Statistics user={user} plan={plan} />
          )}

          {/* ── FREUNDE TAB ── */}
          {activeTab === 'freunde' && (
            <Friends user={user} />
          )}

          {/* ── LÄUFE TAB ── */}
          {activeTab === 'laeufe' && (
            <Laeufe user={user} plan={plan} />
          )}

          {/* ── GERÄTE TAB ── */}
          {activeTab === 'geraete' && (
            <PolarConnect user={user} plan={plan} />
          )}
        </div>
      </div>
    </div>
  )
}
