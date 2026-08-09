import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase.js'
import Auth from './components/Auth.jsx'
import Onboarding from './components/Onboarding.jsx'
import TrainingPlan from './components/TrainingPlan.jsx'
import Profile from './components/Profile.jsx'
import Laeufe from './components/Laeufe.jsx'
import Notifications from './components/Notifications.jsx'
import BottomNav from './components/BottomNav.jsx'

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

function App() {
  const [user, setUser] = useState(null)
  const [plan, setPlan] = useState(null)
  const [planId, setPlanId] = useState(null)
  const [activeTab, setActiveTab] = useState('training')
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const weeklyCheckKeyRef = useRef(null)

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

  const loadProfileName = async (userId) => {
    const { data } = await supabase.from('profiles').select('name').eq('id', userId).single()
    return data?.name || ''
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
}, [user, plan])

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
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
      try {
        const { data: supaLogs } = await supabase.from('logs').select('*').eq('user_id', user.id)
        if (supaLogs && supaLogs.length > 0) {
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
        `Lauf${unloggedCount > 1 ? 'e' : ''} nicht eingetragen – ` +
        `trag ${unloggedCount > 1 ? 'sie' : 'ihn'} ein oder markiere ` +
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
          plan,
          nextWeekDays,
          previousAnalyses: previousAnalyses || [],
          historyLogs,
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
        })
      })

      const result = await response.json()

      if (!response.ok || result?.error) {
        console.error(
          'Wochen-Coach API Fehler:',
          result?.error || response.status
        )
        return
      }

      if (!result.analyse) {
        console.error(
          'Wochen-Coach hat keine verwertbare Analyse geliefert.',
          { triggerReason, result }
        )
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
        return
      }

      coachDebug('Wochenanalyse gespeichert.', {
        weekNumber: currentWeek.n,
        weekStart: weekStartStr,
      })

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

      {showNotifications && <Notifications user={user} onClose={() => setShowNotifications(false)} />}

      <div style={{ paddingBottom: 78 }}>
        {activeTab === 'training' && (
          plan
            ? <TrainingPlan plan={plan} onReset={handleReset} user={user} />
            : <Onboarding onPlanGenerated={handlePlanGenerated} />
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
