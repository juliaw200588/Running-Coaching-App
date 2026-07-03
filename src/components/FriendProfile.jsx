import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function FriendProfile({ friendId, currentUser, onClose }) {
  const [profile, setProfile] = useState(null)
  const [plan, setPlan] = useState(null)
  const [logs, setLogs] = useState({})
  const [schuhe, setSchuhe] = useState([])
  const [loading, setLoading] = useState(true)
  const [isFriend, setIsFriend] = useState(false)

  useEffect(() => {
    const load = async () => {
      // Freundschaft prüfen
      const { data: friendship } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
        .eq('status', 'accepted')
        .single()
      
      setIsFriend(!!friendship)

      // Profil laden
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', friendId)
        .single()
      setProfile(prof)

      if (friendship && prof) {
        // Plan laden wenn erlaubt
        if (prof.privacy_plan !== 'niemand') {
          const saved = localStorage.getItem(`runcoaching_plan_${friendId}`)
          if (saved) setPlan(JSON.parse(saved))
        }

        // Logs laden wenn erlaubt
        if (prof.privacy_logs !== 'niemand') {
          try {
            const { data: logData } = await supabase
              .from('friend_logs')
              .select('*')
              .eq('user_id', friendId)
            if (logData) {
              const logMap = {}
              logData.forEach(l => { logMap[l.day_key] = l })
              setLogs(logMap)
            }
          } catch {}
        }

        // Schuhe laden wenn erlaubt
        if (prof.privacy_schuhe !== 'niemand') {
          const { data: schuhData } = await supabase
            .from('shoes')
            .select('*')
            .eq('user_id', friendId)
          setSchuhe(schuhData || [])
        }
      }

      setLoading(false)
    }
    load()
  }, [friendId, currentUser])

  const Avatar = ({ size = 70 }) => (
    profile?.avatar_url ? (
      <img src={profile.avatar_url} alt={profile.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid #FFE0CC' }} />
    ) : (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, color: 'white', border: '3px solid #FFE0CC' }}>
        {profile?.name?.[0]?.toUpperCase() || '👤'}
      </div>
    )
  )

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 24, padding: 32, fontFamily: 'sans-serif', color: '#B8A090' }}>⏳ Lade…</div>
    </div>
  )

  // Fortschritt berechnen falls Plan vorhanden
  const totalDays = plan ? plan.phases?.flatMap(p => p.weeks?.flatMap(w => w.days?.filter(d => !d.optional)) || []).length || 0 : 0
  const doneDays = Object.keys(logs).length
  const progress = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(255,140,105,0.2)', paddingBottom: 48 }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#FF8C69,#FFB347,#FF6B9D)', padding: '32px 24px 24px', borderRadius: '28px 28px 0 0', position: 'relative', textAlign: 'center' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 10, padding: '6px 12px', color: 'white', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 13, fontWeight: 'bold' }}>✕</button>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Avatar size={72} />
          </div>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 'bold', margin: '0 0 4px', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>{profile?.name || 'Kein Name'}</h2>
          {profile?.wohnort && <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, margin: 0, fontFamily: 'sans-serif' }}>📍 {profile.wohnort}</p>}
        </div>

        <div style={{ padding: '20px 24px' }}>

          {!isFriend && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#B8A090', fontFamily: 'sans-serif' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
              <div style={{ fontSize: 14 }}>Ihr seid keine Freunde</div>
            </div>
          )}

          {isFriend && (
            <>
              {/* Fortschritt */}
              {profile?.privacy_fortschritt !== 'niemand' && plan && (
                <div style={{ marginBottom: 20, background: '#FFF5EE', borderRadius: 16, padding: '16px 18px', border: '1px solid #FFE0CC' }}>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color: '#5C3D2E', fontFamily: 'sans-serif', marginBottom: 12 }}>📊 Trainingsfortschritt</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#8B6B5A', fontFamily: 'sans-serif' }}>{plan.title}</span>
                    <span style={{ fontSize: 18, fontWeight: 'bold', color: '#FF8C69' }}>{progress}%</span>
                  </div>
                  <div style={{ background: '#F0E8E0', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#FF8C69,#FF6B9D)', borderRadius: 8, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#C4A882', fontFamily: 'sans-serif', marginTop: 6 }}>{doneDays}/{totalDays} Läufe erledigt</div>
                </div>
              )}

              {profile?.privacy_fortschritt === 'niemand' && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#F5EDE8', borderRadius: 12, fontSize: 13, color: '#B8A090', fontFamily: 'sans-serif', textAlign: 'center' }}>
                  🔒 Fortschritt ist privat
                </div>
              )}

              {/* Plan */}
              {profile?.privacy_plan !== 'niemand' && plan && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color: '#5C3D2E', fontFamily: 'sans-serif', marginBottom: 10 }}>🏃‍♀️ Aktueller Plan</div>
                  <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '1.5px solid #F0E8E0' }}>
                    <div style={{ fontSize: 14, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif', marginBottom: 4 }}>{plan.title}</div>
                    <div style={{ fontSize: 12, color: '#B8A090', fontFamily: 'sans-serif' }}>Ziel: {plan.goal}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {plan.phases?.map(p => (
                        <span key={p.id} style={{ fontSize: 11, background: '#FFF5EE', color: '#FF8C69', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold', border: '1px solid #FFE0CC' }}>
                          {p.icon} {p.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Schuhe */}
              {profile?.privacy_schuhe !== 'niemand' && schuhe.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color: '#5C3D2E', fontFamily: 'sans-serif', marginBottom: 10 }}>👟 Laufschuhe</div>
                  {schuhe.map(s => {
                    const prozent = Math.min(Math.round(((s.start_km || 0) / (s.max_km || 700)) * 100), 100)
                    const farbe = prozent >= 95 ? '#B85464' : prozent >= 80 ? '#C17A3A' : '#5BA88A'
                    return (
                      <div key={s.id} style={{ background: 'white', borderRadius: 14, padding: '12px 16px', border: '1.5px solid #F0E8E0', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>{s.marke} {s.modell}</span>
                          <span style={{ fontSize: 12, color: farbe, fontWeight: 'bold', fontFamily: 'sans-serif' }}>{Math.round(s.start_km || 0)} km</span>
                        </div>
                        <div style={{ background: '#F5EDE8', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${prozent}%`, height: '100%', background: farbe, borderRadius: 6 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {profile?.privacy_schuhe === 'niemand' && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#F5EDE8', borderRadius: 12, fontSize: 13, color: '#B8A090', fontFamily: 'sans-serif', textAlign: 'center' }}>
                  🔒 Schuhe sind privat
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
