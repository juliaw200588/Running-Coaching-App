import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase.js'
import Auth from './components/Auth.jsx'
import LandingPage from './components/LandingPage.jsx'
import Onboarding from './components/Onboarding.jsx'
import HikingOnboarding from './components/HikingOnboarding.jsx'
import CyclingOnboarding from './components/CyclingOnboarding.jsx'
import MtbOnboarding from './components/MtbOnboarding.jsx'
import HikingWeeklyCheckIn from './components/HikingWeeklyCheckIn.jsx'
import WelcomeOnboarding from './components/WelcomeOnboarding.jsx'
import TrainingPlan from './components/TrainingPlan.jsx'
import Profile from './components/Profile.jsx'
import Laeufe from './components/Laeufe.jsx'
import Notifications from './components/Notifications.jsx'
import BottomNav from './components/BottomNav.jsx'
import Dashboard from './components/Dashboard.jsx'

const dayKey = (phaseId, weekN, dayIdx) => `${phaseId}_w${weekN}_d${dayIdx}`

const WEEK_REMINDER_HOUR = 18

const coachDebug = (...args) => {
  console.log('[WochenCoach]', ...args)
}

const parseLocalPlanDate = (value) => {
  if (!value) return new Date()

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        0,
        0,
        0,
        0
      )
    }
  }

  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`


function PlanSportSelection({ onSelect }) {
  const sports = [
    { id: 'running', icon: '🏃', title: 'Laufen', text: 'Trainiere strukturiert auf deine Laufziele hin.', available: true },
    { id: 'hiking', icon: '🥾', title: 'Marsch & Wandern', text: 'Baue Distanz und Ausdauer Schritt für Schritt auf.', available: true },
    { id: 'cycling', icon: '🚴', title: 'Radfahren', text: 'Mehr Ausdauer für längere Touren und persönliche Ziele.', available: true },
    { id: 'mountain_biking', icon: '🚵', title: 'Mountainbike', text: 'Trainiere Ausdauer, Fahrtechnik und Belastbarkeit fürs Gelände.', available: true },
    { id: 'swimming', icon: '🏊', title: 'Schwimmen', text: 'Entwickle Ausdauer, Technik und längere Distanzen.', available: false },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 52%, #FFF0F5 100%)', padding:'30px 16px 110px', boxSizing:'border-box' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:'sans-serif', fontSize:10, fontWeight:900, letterSpacing:1.25, color:'#C77861', marginBottom:7 }}>TRAININGSPLAN</div>
          <h1 style={{ margin:0, color:'#3D2B1F', fontFamily:"'Georgia', 'Times New Roman', serif", fontSize:'clamp(27px, 6vw, 38px)', lineHeight:1.08 }}>
            Wofür möchtest du trainieren?
          </h1>
          <p style={{ margin:'10px 0 0', maxWidth:560, color:'#8B7467', fontFamily:'sans-serif', fontSize:13, lineHeight:1.6 }}>
            Wähle die Sportart für deinen Trainingsplan. Weitere Pläne kommen Schritt für Schritt dazu.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(230px, 1fr))', gap:12 }}>
          {sports.map(sport => (
            <button
              key={sport.id}
              type="button"
              disabled={!sport.available}
              onClick={() => sport.available && onSelect(sport.id)}
              style={{
                position:'relative', minHeight:150, textAlign:'left', borderRadius:22,
                border:sport.available ? '2px solid #F0D9CC' : '1.5px solid #E8E1DC',
                background:sport.available ? '#FFFFFF' : '#FAF8F6', padding:18,
                cursor:sport.available ? 'pointer' : 'default', opacity:sport.available ? 1 : 0.72,
                boxShadow:sport.available ? '0 10px 30px rgba(78,54,40,0.08)' : 'none'
              }}
            >
              {!sport.available && (
                <span style={{ position:'absolute', top:13, right:13, padding:'5px 8px', borderRadius:999, background:'#F0EAE5', color:'#9B887C', fontFamily:'sans-serif', fontSize:9, fontWeight:900, letterSpacing:.5 }}>
                  IN VORBEREITUNG
                </span>
              )}
              <div style={{ fontSize:32, marginBottom:14 }}>{sport.icon}</div>
              <div style={{ color:'#463328', fontFamily:'sans-serif', fontSize:16, fontWeight:900, marginBottom:6 }}>{sport.title}</div>
              <div style={{ color:'#9A8477', fontFamily:'sans-serif', fontSize:11.5, lineHeight:1.5, paddingRight:8 }}>{sport.text}</div>
              {sport.available && (
                <div style={{ marginTop:15, color:'#D66D53', fontFamily:'sans-serif', fontSize:11, fontWeight:900 }}>Plan erstellen →</div>
              )}
            </button>
          ))}
        </div>

        <p style={{ margin:'18px 4px 0', color:'#B09C91', fontFamily:'sans-serif', fontSize:10.5, lineHeight:1.5 }}>
          Du kannst die App weiterhin ohne Trainingsplan nutzen und jederzeit später hierher zurückkehren.
        </p>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [plan, setPlan] = useState(null)
  const [planId, setPlanId] = useState(null)
  const [activeTab, setActiveTab] = useState('training')
  const [showTrainingPlan, setShowTrainingPlan] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [openWeekAnalysisWeek, setOpenWeekAnalysisWeek] = useState(null)
  const [authEntryMode, setAuthEntryMode] = useState(null)
  const [profileSetupLoading, setProfileSetupLoading] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(null)
  const [selectedPlanSport, setSelectedPlanSport] = useState(null)
  const [pendingHikingCheckIn, setPendingHikingCheckIn] = useState(null)
  const [weeklyCheckInRefresh, setWeeklyCheckInRefresh] = useState(0)
  const weeklyCheckKeyRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoadingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_OUT') setAuthEntryMode(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadPlan(user.id)
      loadUnreadCount(user.id)
      loadOnboardingStatus(user)

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
      setOnboardingCompleted(null)
      setProfileSetupLoading(false)
      setSelectedPlanSport(null)
      setPendingHikingCheckIn(null)
    }
  }, [user])

  const loadProfileName = async (userId) => {
    const { data } = await supabase.from('profiles').select('name').eq('id', userId).single()
    return data?.name || ''
  }

  const loadOnboardingStatus = async (currentUser) => {
    if (!currentUser?.id) {
      setOnboardingCompleted(null)
      setProfileSetupLoading(false)
      return
    }

    setProfileSetupLoading(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (error) throw error

      setOnboardingCompleted(data?.onboarding_completed === true)
    } catch (error) {
      console.error(
        '[App] Onboarding-Status konnte nicht geladen werden:',
        error
      )
      // Bei einem Lesefehler nicht versehentlich die App freigeben.
      setOnboardingCompleted(false)
    } finally {
      setProfileSetupLoading(false)
    }
  }

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
//
// Die Datenbank entscheidet, ob eine Woche bereits analysiert wurde.
// localStorage ist KEINE Sperre mehr. Dadurch funktioniert der Coach
// zuverlässig nach Login, Gerätewechsel und später synchronisierten Läufen.
useEffect(() => {
  if (!user || !plan) return undefined

  let disposed = false
  let retryTimer = null
  let sundayEveningTimer = null

  const getCheckContext = (today) => {
    const startDate = parseLocalPlanDate(plan.startDate || today)
    const todayLocal = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )

    const daysSinceStart = Math.floor(
      (todayLocal - startDate) / 86400000
    )

    if (daysSinceStart < 0) {
      coachDebug('Noch vor Planstart.', {
        planStart: formatLocalDate(startDate),
        today: formatLocalDate(todayLocal),
      })
      return null
    }

    const dayInWeek = daysSinceStart % 7
    const isLastDay = dayInWeek === 6
    const isFirstDaysNextWeek =
      (dayInWeek === 0 || dayInWeek === 1 || dayInWeek === 2) &&
      daysSinceStart > 0

    if (!isLastDay && !isFirstDaysNextWeek) {
      coachDebug('Außerhalb des Analysefensters.', {
        dayInWeek,
        daysSinceStart,
      })
      return null
    }

    const currentWeekInPlan = Math.floor(daysSinceStart / 7)
    const analyzeWeek = isLastDay
      ? currentWeekInPlan
      : currentWeekInPlan - 1

    if (analyzeWeek < 0) {
      coachDebug('Noch keine abgeschlossene Trainingswoche verfügbar.')
      return null
    }

    const weekStartDate = new Date(startDate)
    weekStartDate.setDate(
      weekStartDate.getDate() + (analyzeWeek * 7)
    )

    return {
      startDate,
      planStartStr: formatLocalDate(startDate),
      weekStartStr: formatLocalDate(weekStartDate),
      currentWeekInPlan,
      analyzeWeek,
      isLastDay,
      isFirstDaysNextWeek,
      lastAnalysisKey: `last_week_analysis_${user.id}`,
    }
  }

  const runCheck = (reason = 'app') => {
    if (disposed) return

    const today = new Date()
    const context = getCheckContext(today)

    if (!context) {
      coachDebug('Keine prüfbare Woche für Trigger:', reason)
      return
    }

    coachDebug('Prüfung gestartet.', {
      trigger: reason,
      analyzeWeekIndex: context.analyzeWeek,
      weekStart: context.weekStartStr,
      isLastDay: context.isLastDay,
      isCatchup: context.isFirstDaysNextWeek,
    })

    // Nur eine GLEICHZEITIGE Prüfung derselben Woche zulassen.
    // Nach Abschluss oder Fehler wird die Sperre wieder freigegeben.
    const runKey =
      `${user.id}_${context.weekStartStr}_` +
      `${context.isLastDay ? 'last' : 'catchup'}`

    if (weeklyCheckKeyRef.current === runKey) {
      coachDebug(
        'Prüfung läuft bereits, paralleler Start wird übersprungen.',
        runKey
      )
      return
    }

    weeklyCheckKeyRef.current = runKey

    Promise.resolve(
      runWeeklyCheck(
        user,
        plan,
        today,
        context.currentWeekInPlan,
        context.lastAnalysisKey,
        context.isLastDay,
        context.weekStartStr,
        context.planStartStr,
        reason
      )
    ).finally(() => {
      if (weeklyCheckKeyRef.current === runKey) {
        weeklyCheckKeyRef.current = null
      }
    })
  }

  const queueCheck = (reason) => {
    if (disposed) return

    if (retryTimer) clearTimeout(retryTimer)

    // Supabase-Events kommen teilweise unmittelbar hintereinander.
    // Kurz bündeln, damit nicht für denselben Import mehrfach geprüft wird.
    retryTimer = setTimeout(() => runCheck(reason), 700)
  }

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      runCheck('visible')
    }
  }

  const handleFocus = () => runCheck('focus')

  // Direkt beim Laden / Login / Planwechsel prüfen.
  runCheck('startup')

  // Wenn die App am Sonntag schon vor dem Abend geöffnet ist,
  // um 18 Uhr erneut prüfen. Fehlt dann noch eine Einheit, kommt
  // die gewohnte Erinnerung. Sind alle Einheiten vollständig,
  // startet die Analyse.
  const now = new Date()
  const initialContext = getCheckContext(now)

  if (
    initialContext?.isLastDay &&
    now.getHours() < WEEK_REMINDER_HOUR
  ) {
    const evening = new Date(now)
    evening.setHours(WEEK_REMINDER_HOUR, 0, 0, 0)

    sundayEveningTimer = setTimeout(
      () => runCheck('sunday-evening'),
      Math.max(1000, evening.getTime() - now.getTime())
    )
  }

  window.addEventListener('focus', handleFocus)
  document.addEventListener(
    'visibilitychange',
    handleVisibility
  )

  // Neue/aktualisierte Logs (z.B. Polar-Zuordnung oder manueller Log)
  // lösen eine erneute Vollständigkeitsprüfung aus.
  const logsChannel = supabase
    .channel(`weekly_check_logs_${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'logs',
        filter: `user_id=eq.${user.id}`,
      },
      () => queueCheck('log-change')
    )
    .subscribe()

  // Auch bewusstes Überspringen kann eine Woche vollständig machen.
  const skippedChannel = supabase
    .channel(`weekly_check_skipped_${user.id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'skipped_days',
        filter: `user_id=eq.${user.id}`,
      },
      () => queueCheck('skip-change')
    )
    .subscribe()

  return () => {
    disposed = true

    if (retryTimer) clearTimeout(retryTimer)
    if (sundayEveningTimer) {
      clearTimeout(sundayEveningTimer)
    }

    window.removeEventListener('focus', handleFocus)
    document.removeEventListener(
      'visibilitychange',
      handleVisibility
    )

    supabase.removeChannel(logsChannel)
    supabase.removeChannel(skippedChannel)

    // Ein User-/Planwechsel darf niemals durch eine alte In-Flight-Sperre
    // blockiert werden.
    weeklyCheckKeyRef.current = null
  }
}, [user, plan, weeklyCheckInRefresh])

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  }


const releaseWeekAnalysisClaim = async (userId, weekStart) => {
  try {
    await supabase
      .from('week_analysis_claims')
      .delete()
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .eq('status', 'running')
  } catch (error) {
    console.warn('[WochenCoach] Claim konnte nicht freigegeben werden:', error)
  }
}

const claimWeekAnalysis = async ({ userId, weekNumber, weekStart }) => {
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  try {
    await supabase
      .from('week_analysis_claims')
      .delete()
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .eq('status', 'running')
      .lt('claimed_at', staleBefore)
  } catch (error) {
    console.warn('[WochenCoach] Veralteter Claim konnte nicht bereinigt werden:', error)
  }

  const { error } = await supabase
    .from('week_analysis_claims')
    .insert({
      user_id: userId,
      week_number: weekNumber,
      week_start: weekStart,
      status: 'running',
    })

  if (!error) {
    coachDebug('Analyse-Claim erfolgreich gesetzt.', { weekNumber, weekStart })
    return true
  }

  if (error.code === '23505') {
    coachDebug(
      'Analyse-Claim bereits vorhanden – kein zweiter Claude-Aufruf.',
      { weekNumber, weekStart }
    )
    return false
  }

  console.error('[WochenCoach] Analyse-Claim konnte nicht gesetzt werden:', error)
  return false
}

  const runWeeklyCheck = async (
    user,
    plan,
    today,
    currentWeekInPlan,
    lastAnalysisKey,
    isLastDay,
    weekStartStr,
    planStartStr,
    triggerReason = 'unknown'
  ) => {
    try {
      coachDebug('runWeeklyCheck()', {
        triggerReason,
        currentWeekInPlan,
        isLastDay,
        weekStartStr,
      })

      // Logs aus Supabase laden für genaue Analyse
      let logs = {}
      let activityHistory = []
      try {
        const { data: supaLogs } = await supabase
          .from('logs')
          .select('*')
          .eq('user_id', user.id)

        if (supaLogs && supaLogs.length > 0) {
          activityHistory = supaLogs
            .filter(log => log.actual_date)
            .map(log => ({
              id: log.id,
              day_key: log.day_key || null,
              actual_date: log.actual_date || null,
              uhrzeit: log.uhrzeit || null,
              sport_type: log.sport_type || 'running',
              km: log.km || null,
              pace: log.pace || null,
              bpm: log.bpm || null,
              hf_max: log.hf_max || null,
              duration_seconds: log.duration_seconds || null,
              moving_time_seconds: log.moving_time_seconds || null,
              training_load: log.training_load || null,
              recovery_time: log.recovery_time || null,
              note: log.note || null,
              gefuehl: log.gefuehl || null,
              elevation_gain: log.elevation_gain || log.hoehenmeter || null,
              activity_context: log.activity_context || null,
            }))

          supaLogs.forEach(l => {
            logs[l.day_key] = {
              id: l.id,
              day_key: l.day_key,
              pace: l.pace || '',
              km: l.km || '',
              bpm: l.bpm || '',
              note: l.note || '',
              running_index: l.running_index || '',
              cadence: l.cadence || '',
              actual_date: l.actual_date || '',
              uhrzeit: l.uhrzeit || '',
              hf_max: l.hf_max || '',
              hoehenmeter: l.hoehenmeter || '',
              elevation_gain: l.elevation_gain || '',
              gefuehl: l.gefuehl || '',
              training_load: l.training_load || '',
              recovery_time: l.recovery_time || '',
              duration_seconds: l.duration_seconds || null,
              moving_time_seconds: l.moving_time_seconds || null,
              km_splits: l.km_splits || null,
              run_segments: l.run_segments || null,
              activity_context: l.activity_context || null,
              sport_type: l.sport_type || 'running',
              source: l.source || null,
            }
          })
        } else {
          logs = JSON.parse(localStorage.getItem('laufplan_logs') || '{}')
        }
      } catch {
        logs = JSON.parse(localStorage.getItem('laufplan_logs') || '{}')
      }

      // Übersprungene Tage laden (bewusst ausgelassen, sollen die Analyse nicht blockieren)
      let skipped = {}
      try {
        const { data: skippedData } = await supabase.from('skipped_days').select('day_key, reason').eq('user_id', user.id)
        if (skippedData) {
          skippedData.forEach(s => { skipped[s.day_key] = s.reason || '' })
        }
      } catch (e) { console.error('Skipped Days laden fehlgeschlagen:', e) }

      const startDate = parseLocalPlanDate(plan.startDate || today)
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

      if (!currentPhase || !currentWeek) {
        coachDebug('Abbruch: Trainingswoche im Plan nicht gefunden.', {
          analyzeWeek,
          phases: (plan.phases || []).map(phase => ({
            id: phase.id,
            weeks: (phase.weeks || []).map(week => week.n),
          })),
        })
        return
      }

      coachDebug('Trainingswoche gefunden.', {
        phase: currentPhase.id,
        phaseLabel: currentPhase.label,
        weekNumber: currentWeek.n,
      })

      // Geräteübergreifende Prüfung: läuft die App auf mehreren Geräten/Browsern (z.B.
      // Handy + PC), hat jedes sein EIGENES localStorage - eines "weiß" nicht, dass das
      // andere schon analysiert hat. Die Datenbank ist die einzige gemeinsame, verlässliche
      // Quelle. Diese Prüfung ist der eigentliche Fix für wiederholte Analysen derselben Woche.
      const { data: existingAnalyses, error: existingAnalysisError } =
        await supabase
          .from('week_analyses')
          .select('id, week_start')
          .eq('user_id', user.id)
          .eq('week_number', currentWeek.n)

      if (existingAnalysisError) {
        console.error(
          'Wochenanalyse-Status konnte nicht geprüft werden:',
          existingAnalysisError
        )
        return
      }

      // Neue Analysen speichern den echten Wochenstart.
      // Alte Analysen speicherten an dieser Stelle versehentlich den
      // Planstart. Beides wird für den aktuellen Plan akzeptiert,
      // damit alte Wochen nicht erneut analysiert werden.
      const rowsForWeek = existingAnalyses || []

      const exactWeekMatch = rowsForWeek.some(
        row => row.week_start === weekStartStr
      )

      const legacyFirstWeekMatch =
        analyzeWeek === 0 &&
        rowsForWeek.some(row => row.week_start === planStartStr)

      coachDebug('DB-Prüfung week_analyses.', {
        weekNumber: currentWeek.n,
        expectedWeekStart: weekStartStr,
        planStart: planStartStr,
        rows: rowsForWeek,
        exactWeekMatch,
        legacyFirstWeekMatch,
      })

      if (exactWeekMatch || legacyFirstWeekMatch) {
        coachDebug('Abbruch: Diese Trainingswoche ist bereits analysiert.')
        localStorage.setItem(lastAnalysisKey, String(analyzeWeek))
        return
      }

      const plannedDays = currentWeek.days
        .map((d, di) => ({ ...d, key: dayKey(currentPhase.id, currentWeek.n, di) }))
        .filter(d => !d.optional)

      const weekLogs = plannedDays.map(d => ({
        ...d,
        logged: !!logs[d.key],
        skipped: !logs[d.key] && skipped[d.key] !== undefined,
        skipReason: skipped[d.key] || '',
        ...(logs[d.key] || {}),
      }))

      // Frühere echte Einheiten aus dem Plan als Vergleichsbasis laden.
      // So kann die Analyse z.B. Intervall mit Intervall und Long Run mit Long Run vergleichen.
      const historyLogs = []
      for (const phase of plan.phases || []) {
        for (const week of phase.weeks || []) {
          for (let di = 0; di < (week.days || []).length; di += 1) {
            const day = week.days[di]
            if (day.optional) continue

            const key = dayKey(phase.id, week.n, di)
            const log = logs[key]

            if (!log || !log.actual_date) continue

            historyLogs.push({
              ...day,
              key,
              phaseId: phase.id,
              phaseLabel: phase.label,
              weekNumber: week.n,
              logged: true,
              skipped: false,
              ...log,
            })
          }
        }
      }

      // Nur Tage, die WEDER geloggt NOCH bewusst übersprungen wurden, blockieren die Analyse.
      const unloggedCount = weekLogs.filter(l => !l.logged && !l.skipped).length

      coachDebug('Vollständigkeitsprüfung.', {
        plannedCount: plannedDays.length,
        loggedCount: weekLogs.filter(item => item.logged).length,
        skippedCount: weekLogs.filter(item => item.skipped).length,
        unloggedCount,
        days: weekLogs.map(item => ({
          key: item.key,
          tag: item.tag,
          einheit: item.einheit,
          logged: item.logged,
          skipped: item.skipped,
          actual_date: item.actual_date || null,
        })),
      })

// Erinnerung bleibt erhalten:
// - Am letzten Tag der Trainingswoche erst ab 18:00 Uhr.
//   So kann ein für Sonntag geplanter Lauf tagsüber noch normal stattfinden.
// - Im Nachholfenster (die ersten drei Tage der Folgewoche) weiterhin
//   höchstens einmal pro Tag, falls noch etwas ungeklärt ist.
if (unloggedCount > 0) {
  const isSundayEvening =
    isLastDay && today.getHours() >= WEEK_REMINDER_HOUR

  const isCatchupDay = !isLastDay

  // Sonntag vor 18 Uhr: noch keine Erinnerung.
  if (!isSundayEvening && !isCatchupDay) {
    coachDebug('Offene Einheit vorhanden, Sonntag noch vor Erinnerungszeit.', {
      hour: today.getHours(),
      reminderHour: WEEK_REMINDER_HOUR,
    })
    return
  }

  const reminderDedupKey =
    `last_week_reminder_${user.id}_${weekStartStr}`

  const todayLocalStr = formatLocalDate(today)
  const lastReminderDate =
    localStorage.getItem(reminderDedupKey)

  if (lastReminderDate === todayLocalStr) {
    coachDebug('Erinnerung wurde heute bereits gesendet.')
    return
  }

  const { error: reminderError } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      type: 'week_reminder',
      message:
        `⏰ Woche ${currentWeek.n}: Noch ${unloggedCount} ` +
        `Einheit${unloggedCount > 1 ? 'en' : ''} nicht eingetragen – ` +
        `trag ${unloggedCount > 1 ? 'sie' : 'sie'} ein oder markiere ` +
        `die Einheit als übersprungen, damit dein Wochen-Coach starten kann.`,
      from_user_id: user.id,
    })

  if (!reminderError) {
    coachDebug('Wochen-Erinnerung gesendet.', {
      weekNumber: currentWeek.n,
      unloggedCount,
    })
    localStorage.setItem(
      reminderDedupKey,
      todayLocalStr
    )
    setUnreadCount(prev => prev + 1)
  } else {
    console.error(
      'Wochen-Erinnerung konnte nicht gespeichert werden:',
      reminderError
    )
  }

  return
}


// Bei Marsch-/Wanderplänen kommt vor der Analyse ein kurzer Wochen-Check.
let weekCheckIn = null
if (String(plan?.sport_type || plan?.plan_type || '').includes('hiking')) {
  const { data: checkInData, error: checkInError } = await supabase
    .from('week_checkins')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStartStr)
    .maybeSingle()

  if (checkInError) {
    console.error('[WochenCoach] Hiking Wochen-Check konnte nicht geladen werden:', checkInError)
    return
  }

  if (!checkInData) {
    setPendingHikingCheckIn({
      weekNumber: currentWeek.n,
      weekStart: weekStartStr,
    })
    coachDebug('Warte auf Marsch-/Wander-Wochen-Check.', {
      weekNumber: currentWeek.n,
      weekStart: weekStartStr,
    })
    return
  }

  weekCheckIn = checkInData
}

// Die Woche ist vollständig. Noch VOR dem Analyse-Aufruf
// gewinnt genau EIN Trigger/Tab/Gerät den atomaren Wochen-Claim.
const claimAcquired = await claimWeekAnalysis({
  userId: user.id,
  weekNumber: currentWeek.n,
  weekStart: weekStartStr,
})

if (!claimAcquired) return

// Aktuelle Profilwerte laden (HFmax könnte aktualisiert worden sein)
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('max_hf, ruhe_hf, wochen_km, geburtsdatum, geschlecht')
        .eq('id', user.id)
        .single()

      // HFmax aktuell berechnen
      let currentHFMax = null
      if (currentProfile?.max_hf) {
        currentHFMax = currentProfile.max_hf
      } else if (currentProfile?.geburtsdatum) {
        const age = new Date().getFullYear() - new Date(currentProfile.geburtsdatum).getFullYear()
        currentHFMax = Math.round(208 - 0.7 * age)
      }

      // Vorherige Analysen laden für Kontext
      const { data: previousAnalyses } = await supabase
        .from('week_analyses')
        .select('week_number, analysis, recommendation, next_week_adjustment, analysis_data')
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

      coachDebug('Starte /api/analyze-week.', {
        weekNumber: currentWeek.n,
        historyLogs: historyLogs.length,
        nextWeek: nextWeek?.n || null,
        isRegenWeek,
        nextIsRegenWeek,
      })

      const response = await fetch('/api/analyze-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          weekLogs,
          plannedDays,
          weekNumber: currentWeek.n,
          weekStart: weekStartStr,
          plan,
          nextWeekDays,
          previousAnalyses: previousAnalyses || [],
          historyLogs,
          activityHistory,
          schuhWarnung: schuhWarnung || null,
          currentHFMax: currentHFMax || null,
          currentRuheHF: currentProfile?.ruhe_hf || null,
          aktuelleWochenKm: currentProfile?.wochen_km || null,
          isRegenWeek,
          nextIsRegenWeek,
          currentPhase: {
            id: currentPhase.id,
            label: currentPhase.label,
            description: currentPhase.description,
          },
          weekCheckIn: weekCheckIn || null,
        })
      })

      const result = await response.json()

      if (!response.ok || result?.error) {
        console.error(
          'Wochen-Coach API Fehler:',
          result?.error || response.status
        )
        await releaseWeekAnalysisClaim(user.id, weekStartStr)
        return
      }

      if (!result.analyse) {
        console.error(
          'Wochen-Coach hat keine verwertbare Analyse geliefert.',
          { triggerReason, result }
        )
        await releaseWeekAnalysisClaim(user.id, weekStartStr)
        return
      }

      coachDebug('API-Analyse erfolgreich empfangen.', {
        weekNumber: currentWeek.n,
        verdict: result?.weekVerdict?.status || null,
        hasAnalysisData: Boolean(result.analysisData),
      })

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
                // Auch bei unveränderten Einheiten den von der KI zurückgegebenen Text
                // übernehmen, aber NUR wenn HF-Zonen berechnet wurden - dann könnte die KI
                // hier lediglich den HF-Bereich ergänzt haben, ohne das Training inhaltlich
                // zu ändern. Kein "Angepasst"-Badge dafür, am Training selbst ändert sich nichts.
                if (currentHFMax && adjustedDay?.details) {
                  return { ...day, details: adjustedDay.details }
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

      // Analyse in Supabase speichern.
      // week_start ist jetzt der tatsächliche Start dieser Trainingswoche
      // und nicht mehr versehentlich der Start des gesamten Plans.
      const { error: analysisInsertError } = await supabase
        .from('week_analyses')
        .insert({
          user_id: user.id,
          week_number: currentWeek.n,
          week_start: weekStartStr,
          analysis: result.analyse,
          recommendation: result.empfehlung,
          next_week_adjustment: result.anpassung,
          analysis_data: result.analysisData || null,
        })

      if (analysisInsertError) {
        console.error(
          'Wochenanalyse konnte nicht gespeichert werden:',
          analysisInsertError
        )
        await releaseWeekAnalysisClaim(user.id, weekStartStr)
        return
      }

      coachDebug('Wochenanalyse gespeichert.', {
        weekNumber: currentWeek.n,
        weekStart: weekStartStr,
      })

      await supabase
        .from('week_analysis_claims')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)

      // Glocke = Hinweis. Die vollständige Analyse bleibt dauerhaft bei der Woche im Trainingsplan.
      const message =
        `📊 Deine Analyse für Woche ${currentWeek.n} ist fertig. ` +
        `Öffne die Woche im Trainingsplan, um deinen Wochen-Coach anzusehen.`

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'week_analysis',
          message,
          from_user_id: user.id,
          week_number: currentWeek.n,
          week_start: weekStartStr,
        })

      if (notificationError) {
        console.error(
          'Wochenanalyse-Benachrichtigung konnte nicht gespeichert werden:',
          notificationError
        )
      } else {
        setUnreadCount(prev => prev + 1)
      }

      // Nur noch Cache/Kompatibilität. Dieser Wert blockiert keine Analyse mehr.
      localStorage.setItem(lastAnalysisKey, String(analyzeWeek))

    } catch (e) {
      console.error('Wochenanalyse Fehler:', e)
      if (weekStartStr) {
        await releaseWeekAnalysisClaim(user.id, weekStartStr)
      }
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
    // Name aus Profil holen und in Plan eintragen
    const profileName = await loadProfileName(user.id)
    if (profileName) newPlan.name = profileName
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
    setSelectedPlanSport(null)
    setShowTrainingPlan(false)
  }

  const handleReset = async () => {
    if (planId) await supabase.from('plans').delete().eq('id', planId)
    localStorage.removeItem(`runcoaching_plan_${user.id}`)
    setPlan(null)
    setPlanId(null)
    setShowTrainingPlan(false)
  }

  const handleOpenNotifications = () => {
    setShowNotifications(true)
    setUnreadCount(0)
  }


const handleOpenWeekAnalysisFromNotification = (weekNumber) => {
  const parsedWeek = Number(weekNumber)
  if (!Number.isFinite(parsedWeek)) return

  setShowNotifications(false)
  setActiveTab('training')
  setShowTrainingPlan(true)
  setOpenWeekAnalysisWeek(parsedWeek)
}

  if (loadingAuth) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', fontFamily: 'sans-serif', color: '#C4A882', fontSize: 14 }}>
      ⏳ Lade…
    </div>
  )

  if (!user) {
    if (authEntryMode) {
      return (
        <Auth
          initialMode={authEntryMode}
          onBack={() => setAuthEntryMode(null)}
        />
      )
    }

    return (
      <LandingPage
        onLogin={() => setAuthEntryMode('login')}
        onRegister={() => setAuthEntryMode('register')}
      />
    )
  }

  if (profileSetupLoading || onboardingCompleted === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', fontFamily: 'sans-serif', color: '#C4A882', fontSize: 14 }}>
        ⏳ Profil wird vorbereitet…
      </div>
    )
  }

  if (!onboardingCompleted) {
    return (
      <WelcomeOnboarding
        user={user}
        onCompleted={() => setOnboardingCompleted(true)}
      />
    )
  }

  return (
    <>
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 110 }}>
        <button onClick={handleOpenNotifications}
          style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: '1.5px solid #FFE0CC', boxShadow: '0 2px 12px rgba(255,140,105,0.2)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          🔔
          {unreadCount > 0 && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#FF6B9D', color: 'white', fontSize: 10, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', border: '2px solid white' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      </div>

      {showNotifications && (
        <Notifications
          user={user}
          onClose={() => setShowNotifications(false)}
          onOpenWeekAnalysis={handleOpenWeekAnalysisFromNotification}
        />
      )}

      <HikingWeeklyCheckIn
        open={Boolean(pendingHikingCheckIn)}
        user={user}
        weekNumber={pendingHikingCheckIn?.weekNumber}
        weekStart={pendingHikingCheckIn?.weekStart}
        onClose={() => setPendingHikingCheckIn(null)}
        onSaved={() => {
          setPendingHikingCheckIn(null)
          setWeeklyCheckInRefresh(value => value + 1)
        }}
      />

      <div style={{ paddingBottom: 78 }}>
        {activeTab === 'training' && (
          showTrainingPlan
            ? (
              <div>
                <div style={{ position: 'sticky', top: 0, zIndex: 90, padding: '10px 14px 0', maxWidth: 720, margin: '0 auto' }}>
                  <button
                    type="button"
                    onClick={() => { setShowTrainingPlan(false); setOpenWeekAnalysisWeek(null) }}
                    style={{ border: '1px solid #EADFD8', background: 'rgba(255,255,255,0.94)', color: '#765F52', borderRadius: 999, padding: '8px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(75,52,39,0.07)' }}
                  >
                    ← Dashboard
                  </button>
                </div>
                {plan ? (
                  <TrainingPlan
                    plan={plan}
                    onReset={handleReset}
                    user={user}
                    openWeekAnalysis={openWeekAnalysisWeek}
                    onWeekAnalysisOpened={() => setOpenWeekAnalysisWeek(null)}
                  />
                ) : selectedPlanSport === 'running' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}
                      >
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <Onboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : selectedPlanSport === 'hiking' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}
                      >
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <HikingOnboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : selectedPlanSport === 'cycling' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}
                      >
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <CyclingOnboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : selectedPlanSport === 'mountain_biking' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}
                      >
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <MtbOnboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : (
                  <PlanSportSelection onSelect={setSelectedPlanSport} />
                )}
              </div>
            )
            : (
              <Dashboard
                user={user}
                plan={plan}
                onOpenTraining={() => setShowTrainingPlan(true)}
                onOpenActivities={() => setActiveTab('activities')}
                onOpenProfile={() => setActiveTab('profile')}
                onOpenWeekAnalysis={(weekNumber) => {
                  setOpenWeekAnalysisWeek(Number(weekNumber))
                  setShowTrainingPlan(true)
                }}
              />
            )
        )}
        {activeTab === 'activities' && <Laeufe user={user} plan={plan} />}
        {activeTab === 'profile' && (
          <Profile
            user={user}
            plan={plan}
            onOpenActivities={() => setActiveTab('activities')}
          />
        )}
      </div>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </>
  )
}

export default App
