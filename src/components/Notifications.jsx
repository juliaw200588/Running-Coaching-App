import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const relativeTime = value => {
  if (!value) return ''
  const date = new Date(value)
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'gestern'
  return `vor ${days} Tagen`
}

const weekFromMessage = message => {
  const match = String(message || '').match(/Woche\s+(\d+)/i)
  return match ? Number(match[1]) : null
}

export default function Notifications({
  user,
  onClose,
  onOpenWeekAnalysis,
  onOpenTrainingPartners,
}) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, message, read, created_at, week_number, week_start')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!cancelled) {
        if (error) {
          console.error('Benachrichtigungen laden fehlgeschlagen:', error)
          setNotifications([])
        } else {
          setNotifications(data || [])
        }
        setLoading(false)
      }

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.id])

  const removeOne = async (event, id) => {
    event.stopPropagation()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (!error) {
      setNotifications(prev => prev.filter(item => item.id !== id))
    }
  }

  const removeAll = async () => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)

    if (!error) setNotifications([])
  }

  const openNotification = notification => {
    if (notification.type === 'week_analysis') {
      const weekNumber =
        notification.week_number ?? weekFromMessage(notification.message)

      if (
        weekNumber != null &&
        typeof onOpenWeekAnalysis === 'function'
      ) {
        onOpenWeekAnalysis(weekNumber)
      }
      return
    }

    if (
      (notification.type === 'friend_request' ||
       notification.type === 'friend_accepted' ||
       notification.type === 'shared_goal_invite') &&
      typeof onOpenTrainingPartners === 'function'
    ) {
      onOpenTrainingPartners()
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        background: 'rgba(66,42,31,0.38)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 24,
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: 'calc(100% - 28px)',
          maxWidth: 650,
          maxHeight: 'calc(100vh - 24px)',
          background: '#FFFDFC',
          borderRadius: '28px 28px 0 0',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(74,48,34,0.18)',
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 99, background: '#EADFD7', margin: '25px auto 13px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 22px 17px', borderBottom: '1px solid #F1E7E0' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#3D2B1F' }}>
            🔔 Benachrichtigungen
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {notifications.length > 0 && (
              <button type="button" onClick={removeAll}
                style={{ border: 'none', background: 'transparent', color: '#C5A277', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
                Alle löschen
              </button>
            )}
            <button type="button" onClick={onClose}
              style={{ width: 40, height: 40, borderRadius: 13, border: 'none', background: '#F6EFEB', color: '#9A7F6D', cursor: 'pointer', fontSize: 18 }}>
              ×
            </button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 130px)', padding: '14px 22px 32px' }}>
          {loading && (
            <div style={{ padding: 28, textAlign: 'center', color: '#B09A8B', fontSize: 12 }}>
              ⏳ Lade…
            </div>
          )}

          {!loading && notifications.length === 0 && (
            <div style={{ padding: '38px 16px', textAlign: 'center', color: '#A99182', fontSize: 12, lineHeight: 1.6 }}>
              Hier ist gerade alles ruhig. 🌿
            </div>
          )}

          {!loading && notifications.map(notification => {
            const isWeekAnalysis = notification.type === 'week_analysis'
            const isFriend = notification.type === 'friend_request' || notification.type === 'friend_accepted'
            const isGoalInvite = notification.type === 'shared_goal_invite'
            const isSocial = isFriend || isGoalInvite
            const isClickable = isWeekAnalysis || isSocial

            return (
              <div
                key={notification.id}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={() => openNotification(notification)}
                onKeyDown={event => {
                  if (
                    isClickable &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault()
                    openNotification(notification)
                  }
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  gap: 12,
                  padding: '15px 38px 15px 15px',
                  marginBottom: 10,
                  borderRadius: 16,
                  border: isWeekAnalysis ? '1px solid #FFD6C2' : isSocial ? '1px solid #CFE9DA' : '1px solid #EFE5DE',
                  background: isWeekAnalysis ? 'linear-gradient(135deg,#FFF5EE,#FFF9F5)' : isSocial ? 'linear-gradient(135deg,#F2FAF5,#FBFFFC)' : '#FFFFFF',
                  cursor: isClickable ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  flexShrink: 0,
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: isWeekAnalysis ? 'linear-gradient(135deg,#FF8C69,#FF6B9D)' : isSocial ? 'linear-gradient(135deg,#7EC8A4,#5BA88A)' : '#F6EFEB',
                  fontSize: 19,
                }}>
                  {isWeekAnalysis ? '📊' : isGoalInvite ? '🎯' : isFriend ? '👥' : '🔔'}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: '#55443A', fontSize: 12, lineHeight: 1.5, fontFamily: 'sans-serif' }}>
                    {notification.message}
                  </div>

                  {isWeekAnalysis && (
                    <div style={{ marginTop: 7, color: '#C66B43', fontSize: 10.5, fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                      Wochenanalyse ansehen →
                    </div>
                  )}

                  {isSocial && (
                    <div style={{ marginTop: 7, color: '#4F8E73', fontSize: 10.5, fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                      {isGoalInvite ? 'Einladung ansehen →' : 'Trainingspartner ansehen →'}
                    </div>
                  )}

                  <div style={{ marginTop: 4, color: '#C0A28B', fontSize: 9.5, fontFamily: 'sans-serif' }}>
                    {relativeTime(notification.created_at)}
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Benachrichtigung löschen"
                  onClick={event => removeOne(event, notification.id)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 22,
                    height: 22,
                    border: 'none',
                    background: 'transparent',
                    color: '#D7C6BC',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
