import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'
import Auth from './components/Auth.jsx'
import Onboarding from './components/Onboarding.jsx'
import TrainingPlan from './components/TrainingPlan.jsx'
import Profile from './components/Profile.jsx'
import Notifications from './components/Notifications.jsx'

const dayKey = (phaseId, weekN, dayIdx) => `${phaseId}_w${weekN}_d${dayIdx}`

function App() {
  const [user, setUser] = useState(null)
  const [plan, setPlan] = useState(null)
  const [planId, setPlanId] = useState(null)
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
      loadPlan(user.id)
      loadUnreadCount(user.id)

      const channel = supabase
        .channel('unread_notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => setUnreadCount(prev => prev + 1))
        .subscribe()

      return () => supabase.removeChannel(channel)
    } else {
      setPlan(null)
      setPlanId(null)
      setUnreadCount(0)
    }
  }, [user])

  const loadPlan = async (userId) => {
    // Zuerst aus Supabase laden
    const { data } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      setPlan(data.plan_data)
      setPlanId(data.id)
      // Auch in localStorage cachen
      localStorage.setItem(`runcoaching_plan_${userId}`, JSON.stringify(data.plan_data))
    } else {
      // Fallback: localStorage
      try {
        const saved = localStorage.getItem(`runcoaching_plan_${userId}`)
        if (saved) setPlan(JSON.parse(saved))
      } catch { setPlan(null) }
    }
  }

  // Wöchentliche Analyse
  useEffect(() => {
    if (!user || !plan) return

    const today = new Date()
    const startDate = new Date(plan.startDate || today)
    const daysSinceStart = Math.floor((today - startDate) / 86400000)
    if (daysSinceStart < 0) return

    const dayInWeek = daysSinceStart % 7
    const isLastDay = dayInWeek === 6
    // Analyse-Fenster: erster, zweiter oder dritter Tag der neuen Woche (falls App nicht täglich geöffnet)
    const isFirstDaysNextWeek = (dayInWeek === 0 || dayInWeek === 1 || dayInWeek === 2) && daysSinceStart > 0

    if (!isLastDay && !isFirstDaysNextWeek) return

    const lastAnalysisKey = `last_week_analysis_${user.id}`
    const currentWeekInPlan = Math.floor(daysSinceStart / 7)
    const lastAnalysis = localStorage.getItem(lastAnalysisKey)

    if (lastAnalysis === String(currentWeekInPlan)) return

    runWeeklyCheck(user, plan, today, currentWeekInPlan, lastAnalysisKey, isLastDay)
  }, [user, plan])

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  }

  const runWeeklyCheck = async (user, plan, today, currentWeekInPlan, lastAnalysisKey, isLastDay) => {
    try {
      const logs = JSON.parse(localStorage.getItem('laufplan_logs') || '{}')

      const startDate = new Date(plan.startDate || today)
      const daysSinceStart = Math.floor((today - startDate) / 86400000)
      const analyzeWeek = isLastDay ? currentWeekInPlan : currentWeekInPlan - 1

      let currentPhase = null
      let currentWeek = null
      let nextPhase = null
      let nextWeek = null
      let weekIndex = 0

      for (const phase of plan.phases || []) {
        for (const week of phase.weeks || []) {
          if (weekIndex === analyzeWeek) { currentPhase = phase; currentWeek = week }
          if (weekIndex === analyzeWeek + 1) { nextPhase = phase; nextWeek = week }
          weekIndex++
        }
      }

      if (!currentPhase || !currentWeek) return

      const plannedDays = currentWeek.days
        .map((d, di) => ({ ...d, key: dayKey(currentPhase.id, currentWeek.n, di) }))
        .filter(d => !d.optional)

      const weekLogs = plannedDays.map(d => ({
        ...d,
        logged: !!logs[d.key],
        pace: logs[d.key]?.pace,
        km: logs[d.key]?.km,
        bpm: logs[d.key]?.bpm,
        note: logs[d.key]?.note,
      }))

      const unloggedCount = weekLogs.filter(l => !l.logged).length

      // Reminder am letzten Tag
      if (isLastDay && unloggedCount > 0) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'week_reminder',
          message: `⏰ Woche ${currentWeek.n}: Noch ${unloggedCount} Lauf${unloggedCount > 1 ? 'e' : ''} nicht eingetragen – trag sie ein für deine Wochenanalyse!`,
          from_user_id: user.id,
        })
        setUnreadCount(prev => prev + 1)
        return
      }

      // Vorherige Analysen laden für Kontext
      const { data: previousAnalyses } = await supabase
        .from('week_analyses')
        .select('week_number, analysis, recommendation, next_week_adjustment')
        .eq('user_id', user.id)
        .order('week_number', { ascending: false })
        .limit(3)

      // Schuhzustand laden
      const { data: schuhe } = await supabase
        .from('shoes')
        .select('marke, modell, start_km, max_km')
        .eq('user_id', user.id)

      const schuhWarnung = schuhe
        ?.filter(s => (s.start_km / s.max_km) >= 0.8)
        .map(s => `${s.marke} ${s.modell}: ${Math.round(s.start_km)}/${s.max_km} km (${Math.round((s.start_km/s.max_km)*100)}%)`)
        .join(', ')

      const nextWeekDays = nextWeek
        ? nextWeek.days.map((d, di) => ({ ...d, key: dayKey(nextPhase.id, nextWeek.n, di) })).filter(d => !d.optional)
        : null

      const isRegenWeek = !!currentWeek.regen
      const nextIsRegenWeek = !!nextWeek?.regen

      const response = await fetch('/api/analyze-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          weekLogs,
          plannedDays,
          weekNumber: currentWeek.n,
          plan,
          nextWeekDays,
          previousAnalyses: previousAnalyses || [],
          schuhWarnung: schuhWarnung || null,
        })
      })

      const result = await response.json()
      if (!result.analyse) return

      // Plan anpassen
      if (nextWeek && result.nextWeekAdjusted?.length > 0) {
        const currentPlan = JSON.parse(localStorage.getItem(`runcoaching_plan_${user.id}`) || '{}')
        let adjusted = false

        for (const phase of currentPlan.phases || []) {
          for (const week of phase.weeks || []) {
            if (week.n === nextWeek.n) {
              week.days = week.days.map((day) => {
                if (day.optional) return day
                const adjustedDay = result.nextWeekAdjusted.find(a => a.tag === day.tag)
                if (adjustedDay?.adjusted) {
                  adjusted = true
                  return { ...day, details: adjustedDay.details, adjusted: true, adjustmentReason: adjustedDay.adjustmentReason }
                }
                return day
              })
            }
          }
        }

        if (adjusted) {
          // In Supabase speichern
          if (planId) {
            await supabase.from('plans').update({ plan_data: currentPlan }).eq('id', planId)
          }
          localStorage.setItem(`runcoaching_plan_${user.id}`, JSON.stringify(currentPlan))
          setPlan(currentPlan)
        }
      }

      // Analyse in Supabase speichern
      await supabase.from('week_analyses').insert({
        user_id: user.id,
        week_number: currentWeek.n,
        week_start: startDate.toISOString().split('T')[0],
        analysis: result.analyse,
        recommendation: result.empfehlung,
        next_week_adjustment: result.anpassung,
      })

      // Schuhwarnung hinzufügen falls nötig
      const schuhText = schuhWarnung ? ` 👟 Achtung: ${schuhWarnung} – neue Schuhe empfohlen!` : ''
      const anpassungText = result.nextWeekAdjusted?.some(d => d.adjusted)
        ? ` 📋 ${result.anpassung}`
        : ' Plan bleibt wie geplant.'

      const message = `${result.emoji} Woche ${currentWeek.n}: ${result.analyse} ${result.empfehlung}${anpassungText}${schuhText}`

      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'week_analysis',
        message,
        from_user_id: user.id,
      })

      setUnreadCount(prev => prev + 1)
      localStorage.setItem(lastAnalysisKey, String(currentWeekInPlan))

    } catch (e) {
      console.error('Wochenanalyse Fehler:', e)
    }
  }

  const loadUnreadCount = async (userId) => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    setUnreadCount(count || 0)
  }

  const handlePlanGenerated = async (newPlan) => {
    // In Supabase speichern
    const { data } = await supabase
      .from('plans')
      .insert({ user_id: user.id, plan_data: newPlan })
      .select()
      .single()

    if (data) setPlanId(data.id)

    // Alten Plan löschen falls vorhanden
    if (planId) {
      await supabase.from('plans').delete().eq('id', planId)
    }

    localStorage.setItem(`runcoaching_plan_${user.id}`, JSON.stringify(newPlan))
    setPlan(newPlan)
  }

  const handleReset = async () => {
    if (planId) await supabase.from('plans').delete().eq('id', planId)
    localStorage.removeItem(`runcoaching_plan_${user.id}`)
    setPlan(null)
    setPlanId(null)
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
      {!showProfile && !showNotifications && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, display: 'flex', gap: 8 }}>
          <button onClick={handleOpenNotifications}
            style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: '1.5px solid #FFE0CC', boxShadow: '0 2px 12px rgba(255,140,105,0.2)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🔔
            {unreadCount > 0 && (
              <div style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#FF6B9D', color: 'white', fontSize: 10, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', border: '2px solid white' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </button>
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
