import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Notifications({ user, onClose }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()

    // Realtime Updates
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifications(data || [])
    setLoading(false)

    // Alle als gelesen markieren
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
  }

  const deleteNotification = async (id) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = async () => {
    await supabase.from('notifications').delete().eq('user_id', user.id)
    setNotifications([])
  }

  const typeIcon = (type) => {
    switch (type) {
      case 'friend_request': return '👥'
      case 'friend_accepted': return '🎉'
      case 'friend_logged': return '🏃‍♀️'
      case 'friend_plan': return '📋'
      default: return '🔔'
    }
  }

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (min < 1) return 'gerade eben'
    if (min < 60) return `vor ${min} Min.`
    if (h < 24) return `vor ${h} Std.`
    return `vor ${d} Tag${d > 1 ? 'en' : ''}`
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(255,140,105,0.2)' }}>

        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0E8E0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: '#F0E8E0', borderRadius: 99, margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#3D2B1F', margin: 0 }}>🔔 Benachrichtigungen</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {notifications.length > 0 && (
                <button onClick={clearAll} style={{ fontSize: 12, color: '#C4A882', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'sans-serif' }}>Alle löschen</button>
              )}
              <button onClick={onClose} style={{ background: '#F5EDE8', border: 'none', borderRadius: 10, padding: '6px 12px', color: '#8B6B5A', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 13 }}>✕</button>
            </div>
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 24px 40px' }}>
          {loading && <div style={{ textAlign: 'center', padding: 30, color: '#B8A090', fontFamily: 'sans-serif' }}>⏳ Lade…</div>}

          {!loading && notifications.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B8A090', fontFamily: 'sans-serif' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔔</div>
              <div style={{ fontSize: 14 }}>Keine Benachrichtigungen</div>
            </div>
          )}

          {notifications.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: n.read ? 'white' : '#FFF5EE', borderRadius: 14, border: `1.5px solid ${n.read ? '#F0E8E0' : '#FFE0CC'}`, marginBottom: 8, transition: 'all 0.2s' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: n.read ? '#F5EDE8' : 'linear-gradient(135deg,#FF8C69,#FF6B9D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {typeIcon(n.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#3D2B1F', fontFamily: 'sans-serif', lineHeight: 1.5 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: '#C4A882', fontFamily: 'sans-serif', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
              <button onClick={() => deleteNotification(n.id)} style={{ background: 'none', border: 'none', color: '#D4C4B8', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
