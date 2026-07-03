import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'
import Auth from './components/Auth.jsx'
import Onboarding from './components/Onboarding.jsx'
import TrainingPlan from './components/TrainingPlan.jsx'
import Profile from './components/Profile.jsx'

function App() {
  const [user, setUser] = useState(null)
  const [plan, setPlan] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    // Session prüfen
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoadingAuth(false)
    })

    // Auth-Änderungen beobachten
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      // Plan aus localStorage laden (später Supabase)
      try {
        const saved = localStorage.getItem(`runcoaching_plan_${user.id}`)
        setPlan(saved ? JSON.parse(saved) : null)
      } catch { setPlan(null) }
    } else {
      setPlan(null)
    }
  }, [user])

  const handlePlanGenerated = (newPlan) => {
    localStorage.setItem(`runcoaching_plan_${user.id}`, JSON.stringify(newPlan))
    setPlan(newPlan)
  }

  const handleReset = () => {
    localStorage.removeItem(`runcoaching_plan_${user.id}`)
    setPlan(null)
  }

  if (loadingAuth) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', fontFamily: 'sans-serif', color: '#C4A882', fontSize: 14 }}>
      ⏳ Lade…
    </div>
  )

  if (!user) return <Auth />

  return (
    <>
      {/* Profil-Button oben rechts */}
      {!showProfile && (
        <button onClick={() => setShowProfile(true)}
          style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: '1.5px solid #FFE0CC', boxShadow: '0 2px 12px rgba(255,140,105,0.2)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          👤
        </button>
      )}

      {showProfile && <Profile user={user} onClose={() => setShowProfile(false)} />}

      {plan
        ? <TrainingPlan plan={plan} onReset={handleReset} />
        : <Onboarding onPlanGenerated={handlePlanGenerated} />
      }
    </>
  )
}

export default App
