import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'
import Auth from './components/Auth.jsx'
import Onboarding from './components/Onboarding.jsx'
import TrainingPlan from './components/TrainingPlan.jsx'
import Profile from './components/Profile.jsx'
import Notifications from './components/Notifications.jsx'

function App() {
  const [user, setUser] = useState(null)
  const [plan, setPlan] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoadingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      try {
        const saved = localStorage.getItem(`runcoaching_plan_${user.id}`)
        setPlan(saved ? JSON.parse(saved) : null)
      } catch { setPlan(null) }

      // Ungelesene Notifications laden
      loadUnreadCount(user.id)

      // Realtime für neue Notifications
      const channel = supabase
        .channel('unread_notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => {
          setUnreadCount(prev => prev + 1)
        })
        .subscribe()

      return () => supabase.removeChannel(channel)
    } else {
      setPlan(null)
      setUnreadCount(0)
    }
  }, [user])

  const loadUnreadCount = async (userId) => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    setUnreadCount(count || 0)
  }

  const handlePlanGenerated = (newPlan) => {
    localStorage.setItem(`runcoaching_plan_${user.id}`, JSON.stringify(newPlan))
    setPlan(newPlan)
  }

  const handleReset = () => {
    localStorage.removeItem(`runcoaching_plan_${user.id}`)
    setPlan(null)
  }

  const handleOpenNotifications = () => {
    setShowNotifications(true)
    setUnreadCount(0)
  }

  if (loadingAuth) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', fontFamily: 'sans-serif', color: '#C4A882', fontSize: 14 }}>
      ⏳ Lade…
    </div>
  )

  if (!user) return <Auth />

  return (
    <>
      {/* Toolbar oben rechts */}
      {!showProfile && !showNotifications && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, display: 'flex', gap: 8 }}>
          {/* Glocke */}
          <button onClick={handleOpenNotifications}
            style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: '1.5px solid #FFE0CC', boxShadow: '0 2px 12px rgba(255,140,105,0.2)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🔔
            {unreadCount > 0 && (
              <div style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#FF6B9D', color: 'white', fontSize: 10, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', border: '2px solid white' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </button>

          {/* Profil */}
          <button onClick={() => setShowProfile(true)}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: '1.5px solid #FFE0CC', boxShadow: '0 2px 12px rgba(255,140,105,0.2)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            👤
          </button>
        </div>
      )}

      {showNotifications && <Notifications user={user} onClose={() => setShowNotifications(false)} />}
      {showProfile && <Profile user={user} onClose={() => setShowProfile(false)} />}

      {plan
        ? <TrainingPlan plan={plan} onReset={handleReset} user={user} />
        : <Onboarding onPlanGenerated={handlePlanGenerated} />
      }
    </>
  )
}

export default App
