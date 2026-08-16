import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { loadAndEvaluateAchievements } from '../lib/achievementService.js'
import { getHeroImageForDashboard } from '../lib/heroImages.js'
import TrainingFeedbackModal from './TrainingFeedbackModal.jsx'
import { getDailyCoaching } from '../lib/dailyCoaching.js'
import { encodeTrainingFeedback, hasStructuredTrainingFeedback } from '../lib/trainingFeedback.js'

const DAY_MS = 86400000
const dayKey = (phaseId, weekN, dayIdx) => `${phaseId}_w${weekN}_d${dayIdx}`

const localDate = value => {
  if (!value) return null
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const dateString = value => {
  const date = localDate(value)
  if (!date) return null
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

const formatDay = value => {
  const date = localDate(value)
  if (!date) return ''
  return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

const num = value => {
  if (value == null || value === '') return null
  const parsed = Number(String(value).replace(',', '.').match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

const kmText = value => {
  const n = num(value)
  return n == null ? null : `${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`
}

const durationText = seconds => {
  const s = num(seconds)
  if (!s) return null
  const mins = Math.round(s / 60)
  if (mins < 60) return `${mins} Min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} Min` : `${h} h`
}

const sportMeta = value => {
  const s = String(value || 'running').toLowerCase()
  if (/mountain|mtb/.test(s)) return { icon: '🚵', label: 'Mountainbike' }
  if (/bike|cycling|rad/.test(s)) return { icon: '🚴', label: 'Rad' }
  if (/swim|schwimm/.test(s)) return { icon: '🏊', label: 'Schwimmen' }
  if (/walk|hike|wander|marsch/.test(s)) return { icon: '🥾', label: 'Marsch' }
  return { icon: '🏃', label: 'Laufen' }
}

const parsePlannedKm = details => {
  if (!details) return 0

  // Klammern enthalten meist Pace-/HF-Bereiche, nicht Trainingsdistanz.
  let clean = String(details).replace(/\([^)]*\)/g, '')

  // Beginnt der Text mit einer Gesamtdistanz ("16 km Zone 2 ..."),
  // ist diese Zahl maßgeblich. Spätere "km 8-10"-Hinweise werden nicht addiert.
  const leadingTotalKm = clean.match(
    /^\s*(\d+(?:[.,]\d+)?)\s*km\b/i
  )
  if (leadingTotalKm) {
    return parseFloat(leadingTotalKm[1].replace(',', '.'))
  }

  // Pace-Angaben entfernen, bevor Minuten ausgewertet werden.
  // "6:30 min/km" darf niemals als "30 min" zählen.
  clean = clean
    .replace(
      /\b\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\s*min\/km\b/gi,
      ''
    )
    .replace(
      /\b\d{1,2}:\d{2}\s*min\/km\b/gi,
      ''
    )

  let km = 0

  // Wiederholungen wie 5x800 m / 4×1 km.
  const repRegex =
    /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b/gi

  let match
  while ((match = repRegex.exec(clean))) {
    const reps = parseInt(match[1], 10)
    let distance = parseFloat(match[2].replace(',', '.'))

    if (match[3].toLowerCase() === 'm') {
      distance /= 1000
    }

    km += reps * distance
  }

  let rest = clean.replace(repRegex, '')

  // Positions-/Progressionshinweise entfernen.
  rest = rest
    .replace(
      /\b(?:ab\s+)?km\s*\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?\b/gi,
      ''
    )
    .replace(
      /\b(?:ab\s+)?\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?\s*km\b/gi,
      ''
    )

  // Verbleibende echte Distanzen addieren.
  const kmRegex = /(\d+(?:[.,]\d+)?)\s*km\b/gi
  while ((match = kmRegex.exec(rest))) {
    km += parseFloat(match[1].replace(',', '.'))
  }
  rest = rest.replace(kmRegex, '')

  // Echte Dauerblöcke schätzen wir konservativ mit 8:00 min/km.
  const minRegex = /(\d+(?:[.,]\d+)?)\s*min\b/gi
  while ((match = minRegex.exec(rest))) {
    km += parseFloat(match[1].replace(',', '.')) / 8
  }

  return km
}

const normalizeSport = value => {
  const text = String(value || '').toLowerCase()

  if (/mountain|mtb/.test(text)) return 'mountain_biking'
  if (/bike|cycling|rad|velo/.test(text)) return 'cycling'
  if (/walk|hike|wander|marsch/.test(text)) return 'hiking'
  if (/swim|schwimm/.test(text)) return 'swimming'
  if (/run|running|jog|lauf/.test(text)) return 'running'
  return 'other'
}

const SPORT_SUMMARY_META = {
  running: { icon: '🏃', label: 'Laufen' },
  cycling: { icon: '🚴', label: 'Rad' },
  mountain_biking: { icon: '🚵', label: 'MTB' },
  hiking: { icon: '🥾', label: 'Wandern' },
  swimming: { icon: '🏊', label: 'Schwimmen' },
  other: { icon: '✨', label: 'Weitere' },
}

const tagIndex = tag => ({ mo:0, montag:0, di:1, dienstag:1, mi:2, mittwoch:2, do:3, donnerstag:3, fr:4, freitag:4, sa:5, samstag:5, so:6, sonntag:6 }[String(tag || '').trim().toLowerCase()] ?? null)

const getPlanWeeks = plan => {
  const result = []
  for (const phase of plan?.phases || []) {
    for (const week of phase.weeks || []) result.push({ phase, week })
  }
  return result
}

const getCurrentPlanContext = plan => {
  if (!plan?.startDate) return null
  const start = localDate(plan.startDate)
  const today = localDate(new Date())
  if (!start || !today) return null
  const days = Math.floor((today - start) / DAY_MS)
  if (days < 0) return { beforeStart: true, start }
  const weeks = getPlanWeeks(plan)
  const index = Math.floor(days / 7)
  if (index >= weeks.length) return { completed: true, weeks, start }
  const { phase, week } = weeks[index]
  const weekStart = new Date(start)
  weekStart.setDate(weekStart.getDate() + index * 7)
  return { index, phase, week, weekStart, dayIndex: days % 7, weeks, start }
}

const card = {
  background: '#FFFFFF', border: '1px solid #EEE3DC', borderRadius: 20,
  boxShadow: '0 8px 24px rgba(74,52,39,0.055)', boxSizing: 'border-box'
}

function Dashboard({ user, plan, onOpenTraining, onOpenActivities, onOpenProfile, onOpenWeekAnalysis }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [logs, setLogs] = useState([])
  const [skipped, setSkipped] = useState([])
  const [analyses, setAnalyses] = useState([])
  const [achievement, setAchievement] = useState(null)
  const [feedbackModal, setFeedbackModal] = useState(null)
  const [feedbackSaving, setFeedbackSaving] = useState(false)

  const loadAchievements = async () => {
    if (!user?.id) return

    try {
      const result = await loadAndEvaluateAchievements({
        supabase,
        userId: user.id,
      })
      const unlocked = [...(result?.unlocked || [])]
        .filter(item => item?.unlocked)
        .sort(
          (a, b) =>
            new Date(b.unlockedAt || 0) - new Date(a.unlockedAt || 0)
        )
      setAchievement(unlocked[0] || null)
    } catch (error) {
      console.warn('[Dashboard] Erfolge konnten nicht geladen werden:', error)
    }
  }

  const load = async ({
    showLoader = false,
    refreshAchievements = false,
  } = {}) => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    if (showLoader) setLoading(true)

    try {
      const [profileRes, logsRes, skippedRes, analysisRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('name,sportarten')
          .eq('id', user.id)
          .single(),
        supabase
          .from('logs')
          .select(
            'id,day_key,actual_date,km,pace,bpm,note,running_index,sport_type,duration_seconds,moving_time_seconds,polar_exercise_id,gefuehl'
          )
          .eq('user_id', user.id)
          .order('actual_date', { ascending: false }),
        supabase
          .from('skipped_days')
          .select('day_key, reason')
          .eq('user_id', user.id),
        supabase
          .from('week_analyses')
          .select('*')
          .eq('user_id', user.id)
          .order('week_start', { ascending: false })
          .limit(6),
      ])

      if (profileRes.error) throw profileRes.error
      if (logsRes.error) throw logsRes.error
      if (skippedRes.error) throw skippedRes.error
      if (analysisRes.error) throw analysisRes.error

      setProfile(profileRes.data || null)
      setLogs(logsRes.data || [])
      setSkipped(skippedRes.data || [])
      setAnalyses(analysisRes.data || [])

      // Die Erfolgsprüfung ist für die sichtbaren Dashboard-Daten nicht nötig.
      // Sie läuft deshalb nachgelagert und blockiert den Seitenaufbau nicht.
      if (refreshAchievements) {
        void loadAchievements()
      }
    } catch (error) {
      console.error(
        '[Dashboard] Dashboard-Daten konnten nicht geladen werden:',
        error
      )
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    load({ showLoader: true, refreshAchievements: true })
    if (!user?.id) return undefined

    const channel = supabase
      .channel(`dashboard_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'logs',
          filter: `user_id=eq.${user.id}`,
        },
        () => load({ showLoader: false, refreshAchievements: true })
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'week_analyses',
          filter: `user_id=eq.${user.id}`,
        },
        () => load({ showLoader: false, refreshAchievements: false })
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id, plan])

  const context = useMemo(() => getCurrentPlanContext(plan), [plan])
  const todayStr = dateString(new Date())
  const logsByKey = useMemo(() => Object.fromEntries(logs.filter(l => l.day_key).map(l => [l.day_key, l])), [logs])
  const skippedKeys = useMemo(() => new Set(skipped.map(s => s.day_key)), [skipped])
  const todayActivities = useMemo(() => logs.filter(l => dateString(l.actual_date) === todayStr), [logs, todayStr])
  const latestActivity = logs[0] || null

  const weekData = useMemo(() => {
    if (!context?.week || !context?.phase) return null
    const weekStart = context.weekStart
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6)
    const planned = (context.week.days || []).map((day, i) => ({ ...day, key: dayKey(context.phase.id, context.week.n, i), index: i, scheduleIndex: tagIndex(day.tag) ?? i })).filter(d => !d.optional)
    const completed = planned.filter(d => logsByKey[d.key])
    const skippedDays = planned.filter(d => !logsByKey[d.key] && skippedKeys.has(d.key))
    const open = planned.filter(d => !logsByKey[d.key] && !skippedKeys.has(d.key))
    const actualWeekLogs = logs.filter(l => {
      const d = localDate(l.actual_date)
      return d && d >= weekStart && d <= weekEnd
    })

    const currentPlanKeys = new Set(
      planned.map(day => day.key)
    )

    // Hauptwert: nur Aktivitäten, die einer Planeinheit DIESER Woche
    // zugeordnet wurden. Der tatsächliche Durchführungstag ist egal.
    const planLogs = actualWeekLogs.filter(
      log => log.day_key && currentPlanKeys.has(log.day_key)
    )

    const actualPlanKm = planLogs.reduce(
      (sum, log) => sum + (num(log.km) || 0),
      0
    )

    // Alles Weitere bleibt sichtbar, aber getrennt vom Trainingsplan.
    // Mehrere Aktivitäten derselben Sportart werden zusammengefasst.
    const extraLogs = actualWeekLogs.filter(
      log => !(log.day_key && currentPlanKeys.has(log.day_key))
    )

    const additionalBySport = Object.values(
      extraLogs.reduce((acc, log) => {
        const sport = normalizeSport(log.sport_type)

        if (!acc[sport]) {
          acc[sport] = {
            sport,
            count: 0,
            km: 0,
          }
        }

        acc[sport].count += 1
        acc[sport].km += num(log.km) || 0
        return acc
      }, {})
    )
      .filter(item => item.count > 0)
      .sort((a, b) => b.km - a.km)

    const plannedKm = planned.reduce(
      (sum,d) => sum + parsePlannedKm(d.details),
      0
    )

    return {
      planned,
      completed,
      skippedDays,
      open,
      actualWeekLogs,
      planLogs,
      actualPlanKm,
      additionalBySport,
      plannedKm,
      weekStart,
      weekEnd,
    }
  }, [context, logs, logsByKey, skippedKeys])

  const hero = useMemo(() => {
    if (!plan) {
      if (latestActivity) return { type:'free', eyebrow:'DU TRAINIERST FREI', title:'Dein Training läuft weiter.', text:'Aktivitäten, Entwicklung und Erfolge bleiben für dich im Blick.', icon:'✨' }
      return { type:'new', eyebrow:'WILLKOMMEN', title:'Wie möchtest du starten?', text:'Du entscheidest: mit Trainingsplan, verbundenen Aktivitäten oder erst einmal ganz in Ruhe.', icon:'👋' }
    }
    if (context?.beforeStart) return { type:'before', eyebrow:'DEIN PLAN STARTET BALD', title:`Start am ${formatDay(context.start)}`, text:'Bis dahin kannst du Aktivitäten synchronisieren und dich in Ruhe umsehen.', icon:'🌱' }
    if (context?.completed) return { type:'completedPlan', eyebrow:'PLAN ABGESCHLOSSEN', title:'Stark – dieser Trainingsblock ist geschafft.', text:'Schau auf deinen Weg zurück oder plane dein nächstes Ziel.', icon:'🏁' }
    if (!weekData) return null

    const todayLinked = todayActivities.find(
      l => l.day_key && weekData.planned.some(d => d.key === l.day_key)
    )
    if (todayLinked) {
      const plannedDay = weekData.planned.find(d => d.key === todayLinked.day_key)
      const moved = plannedDay && plannedDay.scheduleIndex !== context.dayIndex
      return {
        type:'trained',
        eyebrow:'HEUTE TRAINIERT',
        title: plannedDay?.einheit || sportMeta(todayLinked.sport_type).label,
        text: moved
          ? `Ursprünglich für ${plannedDay.tag} geplant – heute absolviert.`
          : 'Deine heutige Planeinheit ist geschafft.',
        icon:'✓',
        log:todayLinked,
        plannedDay
      }
    }

    const todayExtra = todayActivities.find(
      l => !l.day_key || !weekData.planned.some(d => d.key === l.day_key)
    )
    if (todayExtra) {
      return {
        type:'extra',
        eyebrow:'HEUTE TRAINIERT',
        title:sportMeta(todayExtra.sport_type).label,
        text:'Heute warst du zusätzlich aktiv.',
        icon:sportMeta(todayExtra.sport_type).icon,
        log:todayExtra
      }
    }

    const analysis = analyses.find(a => Number(a.week_number) === Number(context.week.n))
    if (weekData.open.length === 0 && analysis) return { type:'analysis', eyebrow:'DEIN WOCHEN-COACH IST BEREIT', title:`Woche ${context.week.n} ist ausgewertet.`, text:'Schau zurück, was sich entwickelt hat und worauf es als Nächstes ankommt.', icon:'🧠', analysis }
    if (weekData.open.length === 0) return { type:'weekDone', eyebrow:'TRAININGSWOCHE GESCHAFFT', title:`${weekData.completed.length} von ${weekData.planned.length} Einheiten erledigt`, text:'Dein Wochen-Coach wertet die Woche aus, sobald die Analyse bereit ist.', icon:'🎉' }

    const todayPlan = weekData.planned.find(d => d.scheduleIndex === context.dayIndex)
    if (todayPlan) {
      const already = logsByKey[todayPlan.key]
      if (already) return { type:'already', eyebrow:'HEUTE SCHON ERLEDIGT', title:todayPlan.einheit, text:`Diese Einheit hast du bereits am ${formatDay(already.actual_date)} absolviert.`, icon:'✓', log:already, plannedDay:todayPlan }
      if (!skippedKeys.has(todayPlan.key)) return { type:'today', eyebrow:'HEUTE STEHT AN', title:todayPlan.einheit, text:todayPlan.details, icon:sportMeta(todayPlan.sport_type).icon, plannedDay:todayPlan }
    }

    const overdue = weekData.open.find(d => d.scheduleIndex < context.dayIndex)
    if (overdue) return { type:'open', eyebrow:'NOCH OFFEN', title:overdue.einheit, text:`Ursprünglich für ${overdue.tag} geplant. Du kannst sie noch zuordnen oder bewusst überspringen.`, icon:'↗', plannedDay:overdue }

    const next = weekData.open.find(d => d.scheduleIndex > context.dayIndex)
    return { type:'rest', eyebrow:'HEUTE IST RUHETAG', title:'Erholung gehört zum Training.', text:next ? `Als Nächstes: ${next.tag} · ${next.einheit}` : 'Für diese Woche ist keine weitere Einheit offen.', icon:'🌿', plannedDay:next }
  }, [plan, context, weekData, todayActivities, latestActivity, analyses, logsByKey, skippedKeys])

  // Bei einem Planwechsel können Plan und Wochenkontext für einen kurzen Render-Zyklus
  // auseinanderlaufen. Die Hero-Karte bekommt deshalb immer einen sichtbaren Fallback.
  const displayHero = hero || (
    !plan
      ? latestActivity
        ? { type:'free', eyebrow:'DU TRAINIERST FREI', title:'Dein Training läuft weiter.', text:'Aktivitäten, Entwicklung und Erfolge bleiben für dich im Blick.', icon:'✨' }
        : { type:'new', eyebrow:'WILLKOMMEN', title:'Wie möchtest du starten?', text:'Du entscheidest: mit Trainingsplan, verbundenen Aktivitäten oder erst einmal ganz in Ruhe.', icon:'👋' }
      : { type:'before', eyebrow:'DEIN TRAININGSPLAN', title:'Dein Plan ist bereit.', text:'Öffne deinen Trainingsplan und sieh dir deine nächsten Einheiten an.', icon:'🌱' }
  )

  const dailyCoaching = useMemo(
    () => getDailyCoaching({ context, weekData, logs, todayStr, hero: displayHero }),
    [context, weekData, logs, todayStr, displayHero]
  )

  const needsTodayFeedback = Boolean(
    displayHero?.type === 'trained' &&
    displayHero?.log?.day_key &&
    !hasStructuredTrainingFeedback(displayHero.log.gefuehl)
  )

  const saveDashboardFeedback = async ({ effort, recovery, note }) => {
    if (!feedbackModal?.log?.day_key || !user?.id) return

    const log = feedbackModal.log
    const gefuehl = encodeTrainingFeedback(
      { effort, recovery },
      log.gefuehl || null
    )

    setFeedbackSaving(true)
    try {
      const { error } = await supabase.from('logs').upsert({
        user_id: user.id,
        day_key: log.day_key,
        gefuehl,
        note: note || null,
      }, { onConflict: 'user_id,day_key' })

      if (error) throw error

      setLogs(current => current.map(item =>
        item.day_key === log.day_key
          ? { ...item, gefuehl, note: note || null }
          : item
      ))
      setFeedbackModal(null)
    } catch (error) {
      console.error('[Dashboard] Trainingsfeedback konnte nicht gespeichert werden:', error)
    } finally {
      setFeedbackSaving(false)
    }
  }

  const latestAnalysis = analyses[0] || null
  const focus =
    latestAnalysis?.analysis_data?.nextWeekFocus ||
    latestAnalysis?.analysis_data?.next_week_focus ||
    null
  const runningIndexes = logs.map(l => num(l.running_index)).filter(v => v != null).slice(0,5)
  const currentRI = runningIndexes[0] || null
  const previousRI = runningIndexes[1] || null
  const riDelta = currentRI != null && previousRI != null ? currentRI - previousRI : null

  const name = profile?.name || plan?.name || user?.user_metadata?.name || ''
  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend'

  const openHero = () => {
    if (displayHero?.type === 'analysis' && displayHero.analysis?.week_number) onOpenWeekAnalysis?.(displayHero.analysis.week_number)
    else if (['today','open','already','rest','before','completedPlan'].includes(displayHero?.type)) onOpenTraining?.()
    else if (['trained','extra'].includes(displayHero?.type) && displayHero.log) onOpenActivities?.()
    else if (displayHero?.type === 'new') onOpenTraining?.()
    else if (displayHero?.type === 'free') onOpenActivities?.()
  }

  const heroMeta = displayHero?.log ? [kmText(displayHero.log.km), durationText(displayHero.log.moving_time_seconds || displayHero.log.duration_seconds), displayHero.log.bpm ? `Ø HF ${displayHero.log.bpm}` : null].filter(Boolean).join(' · ') : null

  const heroImage = useMemo(
    () => {
      if (displayHero?.type === 'new') {
        const selectedSports = Array.isArray(profile?.sportarten)
          ? profile.sportarten.filter(sport =>
              ['running', 'cycling', 'mountain_biking', 'hiking', 'swimming'].includes(sport)
            )
          : []

        const fallbackSports = ['running', 'cycling', 'hiking', 'swimming', 'mountain_biking']
        const availableSports = selectedSports.length ? selectedSports : fallbackSports

        const seedText = `${user?.id || 'anonymous'}|${todayStr || 'today'}`
        let hash = 0
        for (let i = 0; i < seedText.length; i += 1) {
          hash = ((hash << 5) - hash + seedText.charCodeAt(i)) | 0
        }

        const index = Math.abs(hash) % availableSports.length
        const selectedSport = availableSports[index]

        return getHeroImageForDashboard({
          hero: {
            ...displayHero,
            plannedDay: {
              ...(displayHero?.plannedDay || {}),
              sport_type: selectedSport,
            },
          },
          userId: user?.id,
          dateKey: todayStr,
          weekNumber: context?.week?.n,
        })
      }

      return getHeroImageForDashboard({
        hero: displayHero,
        userId: user?.id,
        dateKey: todayStr,
        weekNumber: context?.week?.n,
      })
    },
    [
      displayHero?.type,
      displayHero?.title,
      displayHero?.log?.id,
      displayHero?.log?.polar_exercise_id,
      displayHero?.log?.sport_type,
      displayHero?.plannedDay?.key,
      displayHero?.plannedDay?.einheit,
      profile?.sportarten,
      user?.id,
      todayStr,
      context?.week?.n,
    ]
  )

  if (loading) {
    return (
      <div
        style={{
          minHeight:'80vh',
          display:'grid',
          placeItems:'center',
          fontFamily:'sans-serif',
          color:'#A88F80'
        }}
      >
        Dashboard wird vorbereitet…
      </div>
    )
  }

  return (
    <>
      <TrainingFeedbackModal
        open={feedbackModal}
        feeling={feedbackModal?.log?.gefuehl}
        note={feedbackModal?.log?.note || ''}
        saving={feedbackSaving}
        onClose={() => setFeedbackModal(null)}
        onSave={saveDashboardFeedback}
      />

      <div style={{ minHeight:'100vh', background:'linear-gradient(180deg,#FFF9F4 0%,#FBF8F6 45%,#F6FAF7 100%)', fontFamily:'sans-serif', color:'#3D2B1F' }}>
      <div style={{ maxWidth:720, margin:'0 auto', padding:'24px 16px 30px' }}>
        <div style={{ padding:'4px 2px 16px', display:'flex', alignItems:'center', gap:11 }}>
          <div style={{width:42,height:42,borderRadius:'50%',background:'#FFF7F0',border:'1px solid #F1DDD0',boxShadow:'0 5px 14px rgba(74,52,39,.08)',display:'grid',placeItems:'center',flexShrink:0}}>
            <img src="/route-icon.png" alt="" aria-hidden="true" style={{width:32,height:32,borderRadius:'50%',display:'block'}} />
          </div>
          <div>
            <div style={{fontSize:22,fontWeight:800}}>{greeting}{name ? `, ${name}` : ''} 👋</div>
            <div style={{fontSize:11,color:'#9B8578',marginTop:5}}>Das ist heute für dein Training wichtig.</div>
          </div>
        </div>

        <button type="button" onClick={openHero} style={{...card,width:'100%',padding:0,overflow:'hidden',textAlign:'left',cursor:'pointer',border:'none',position:'relative',minHeight:displayHero?.type === 'new' ? 285 : 245,background:'linear-gradient(135deg,#6F8F7B 0%,#A7BCA8 42%,#E7B79B 100%)'}}>
          {heroImage && (
            <div
              aria-hidden="true"
              style={{
                position:'absolute',
                inset:0,
                backgroundImage:`url("${heroImage}")`,
                backgroundSize:'cover',
                backgroundPosition:displayHero?.type === 'new' ? '58% center' : 'center',
                backgroundRepeat:'no-repeat',
              }}
            />
          )}
          <div
            style={{
              position:'absolute',
              inset:0,
              background: heroImage
                ? displayHero?.type === 'new'
                  ? 'linear-gradient(90deg,rgba(18,22,19,.72) 0%,rgba(20,22,19,.48) 43%,rgba(20,20,18,.12) 72%), linear-gradient(180deg,rgba(15,18,16,.04) 0%,rgba(22,20,18,.18) 52%,rgba(24,21,19,.62) 100%)'
                  : 'linear-gradient(180deg,rgba(20,24,21,.07) 0%,rgba(26,24,21,.20) 40%,rgba(27,23,20,.72) 100%)'
                : "linear-gradient(180deg,rgba(25,35,30,.08),rgba(35,27,23,.58)), radial-gradient(circle at 78% 24%,rgba(255,244,215,.72),transparent 22%), linear-gradient(155deg,transparent 0 45%,rgba(55,83,61,.45) 46% 62%,rgba(38,61,45,.58) 63% 100%)"
            }}
          />
          <div style={{position:'relative',zIndex:1,minHeight:displayHero?.type === 'new' ? 285 : 245,padding:displayHero?.type === 'new' ? '28px 22px' : '22px 20px',display:'flex',flexDirection:'column',justifyContent:'flex-end',color:'#fff'}}>
            <div style={{fontSize:10,fontWeight:900,letterSpacing:1.4,opacity:.9}}>{displayHero?.eyebrow}</div>
            <div style={{fontSize:displayHero?.type === 'new' ? 30 : 26,fontWeight:850,lineHeight:1.08,marginTop:7,maxWidth:displayHero?.type === 'new' ? 470 : 520}}>{displayHero?.title}</div>
            {heroMeta && <div style={{fontSize:12,fontWeight:750,marginTop:8}}>{heroMeta}</div>}
            <div style={{fontSize:11,lineHeight:1.45,marginTop:8,maxWidth:540,opacity:.92}}>{displayHero?.text}</div>
            <div style={{marginTop:16,display:'inline-flex',alignSelf:'flex-start',padding:'9px 13px',borderRadius:999,background:'rgba(255,255,255,.92)',color:'#5B493E',fontSize:10.5,fontWeight:800}}>
              {displayHero?.type === 'analysis' ? 'Wochenanalyse ansehen' : displayHero?.type === 'new' ? 'Möglichkeiten ansehen' : displayHero?.type === 'free' ? 'Aktivitäten ansehen' : 'Mehr ansehen'} →
            </div>
          </div>
        </button>

        {plan && dailyCoaching && (
          <section style={{...card,marginTop:12,padding:'13px 14px',background:dailyCoaching.tone === 'attention' ? '#FFF8EE' : dailyCoaching.tone === 'rest' ? '#F3F8F4' : '#F5FAF7',border:dailyCoaching.tone === 'attention' ? '1px solid #F3D9B4' : '1px solid #DDE9E2'}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
              <div style={{fontSize:18,lineHeight:1}}>{dailyCoaching.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11.5,fontWeight:850,color:dailyCoaching.tone === 'attention' ? '#9C6B2E' : '#527E67'}}>{dailyCoaching.title}</div>
                <div style={{fontSize:10.2,lineHeight:1.45,color:'#806D63',marginTop:3}}>{dailyCoaching.text}</div>
              </div>
            </div>

            {needsTodayFeedback && (
              <button
                type="button"
                onClick={() => setFeedbackModal({ log: hero.log })}
                style={{width:'100%',marginTop:10,padding:'9px 11px',borderRadius:12,border:'1px solid #FFD8C7',background:'#FFF3EC',color:'#B8674E',fontSize:10.5,fontWeight:850,cursor:'pointer',textAlign:'left'}}
              >
                🙂 Training kurz einschätzen · 2 Angaben
              </button>
            )}
          </section>
        )}

        {!plan && !latestActivity && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,marginTop:12}}>
            {[
              ['🎯','Mit Ziel trainieren','Persönlichen Plan erstellen',onOpenTraining],
              ['⌚','Aktivitäten verbinden','Training automatisch erfassen',onOpenProfile],
              ['✨','Erst entdecken','Ohne Plan loslegen',onOpenActivities],
            ].map(([icon,title,text,action]) => <button key={title} onClick={action} style={{...card,padding:'13px 9px',cursor:'pointer',textAlign:'left'}}><div style={{fontSize:20}}>{icon}</div><div style={{fontSize:10.5,fontWeight:800,marginTop:7}}>{title}</div><div style={{fontSize:8.8,color:'#9A8477',lineHeight:1.35,marginTop:4}}>{text}</div></button>)}
          </div>
        )}

        {plan && weekData && (
          <section style={{...card,padding:16,marginTop:14}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}>
              <div><div style={{fontSize:10,fontWeight:900,color:'#A17662',letterSpacing:.7}}>DIESE WOCHE</div><div style={{fontSize:18,fontWeight:850,marginTop:4}}>{weekData.completed.length} von {weekData.planned.length} Einheiten</div></div>
              <button onClick={onOpenTraining} style={{border:'none',background:'transparent',color:'#C56D52',fontSize:10,fontWeight:800,cursor:'pointer'}}>Woche ansehen →</button>
            </div>
            <div style={{height:8,borderRadius:99,background:'#F2E9E3',overflow:'hidden',marginTop:13}}><div style={{height:'100%',width:`${weekData.planned.length ? Math.round(((weekData.completed.length+weekData.skippedDays.length)/weekData.planned.length)*100) : 0}%`,background:'linear-gradient(90deg,#FF9C75,#E77A77)',borderRadius:99}} /></div>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,marginTop:9,fontSize:10,color:'#8F7A6E'}}>
              <span>
                {weekData.skippedDays.length
                  ? `${weekData.skippedDays.length} bewusst übersprungen`
                  : `${weekData.open.length} noch offen`}
              </span>
              <strong style={{color:'#5F4B40',textAlign:'right'}}>
                {weekData.actualPlanKm.toLocaleString('de-DE',{maximumFractionDigits:1})}
                {weekData.plannedKm
                  ? ` / ca. ${weekData.plannedKm.toLocaleString('de-DE',{maximumFractionDigits:1})}`
                  : ''} km im Plan
              </strong>
            </div>

            {weekData.additionalBySport.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: '1px solid #F0E4DC',
                }}
              >
                <div
                  style={{
                    fontSize: 8.8,
                    fontWeight: 900,
                    color: '#A58472',
                    letterSpacing: .6,
                    marginBottom: 7,
                  }}
                >
                  ZUSÄTZLICH AKTIV
                </div>

                <div style={{display:'grid',gap:6}}>
                  {weekData.additionalBySport.map(item => {
                    const meta =
                      SPORT_SUMMARY_META[item.sport] ||
                      SPORT_SUMMARY_META.other

                    return (
                      <div
                        key={item.sport}
                        style={{
                          display:'flex',
                          justifyContent:'space-between',
                          alignItems:'center',
                          gap:10,
                          fontSize:10,
                          color:'#7F6B60',
                        }}
                      >
                        <span>
                          {meta.icon} {item.count}× {meta.label}
                        </span>

                        {item.km > 0 && (
                          <strong style={{color:'#5F4B40'}}>
                            {item.km.toLocaleString('de-DE',{
                              maximumFractionDigits:1
                            })} km
                          </strong>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {latestActivity && dateString(latestActivity.actual_date) !== todayStr && (
          <button onClick={onOpenActivities} style={{...card,width:'100%',padding:'13px 15px',marginTop:12,display:'flex',alignItems:'center',gap:11,cursor:'pointer',textAlign:'left'}}>
            <div style={{width:38,height:38,borderRadius:13,background:'#F3F7F4',display:'grid',placeItems:'center',fontSize:19}}>{sportMeta(latestActivity.sport_type).icon}</div>
            <div style={{minWidth:0,flex:1}}><div style={{fontSize:9,fontWeight:850,color:'#A08A7D',letterSpacing:.5}}>ZULETZT · {formatDay(latestActivity.actual_date)}</div><div style={{fontSize:12.5,fontWeight:800,marginTop:3}}>{kmText(latestActivity.km) || sportMeta(latestActivity.sport_type).label}{latestActivity.pace ? ` · ${latestActivity.pace}` : ''}</div></div>
            <span style={{color:'#B98B77'}}>→</span>
          </button>
        )}

        {plan && latestAnalysis && (
          <button onClick={() => onOpenWeekAnalysis?.(latestAnalysis.week_number)} style={{...card,width:'100%',padding:16,marginTop:12,textAlign:'left',cursor:'pointer',background:'linear-gradient(135deg,#FFF7F1,#F8F2FB)'}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <div style={{fontSize:22}}>🧠</div>
              <div>
                <div style={{fontSize:10,fontWeight:900,color:'#8E6A9E',letterSpacing:.6}}>DEIN COACH</div>
                <div style={{fontSize:13.5,fontWeight:850,marginTop:2}}>
                  {focus?.title ? 'Fokus für deine nächste Woche' : 'Deine Wochenanalyse ist bereit'}
                </div>
              </div>
            </div>
            <div style={{fontSize:12,lineHeight:1.5,color:'#6F5A50',marginTop:11}}>
              {focus?.title ? (
                <>
                  <strong>{focus.title}.</strong>{' '}
                  {focus.text || ''}
                </>
              ) : (
                'Schau dir an, was deine Trainingswoche gezeigt hat und worauf es in der nächsten Woche ankommt.'
              )}
            </div>
            <div style={{fontSize:10,fontWeight:800,color:'#8E6A9E',marginTop:10}}>Wochen-Coach ansehen →</div>
          </button>
        )}

        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginTop:12}}>
          <button onClick={onOpenActivities} style={{...card,padding:15,textAlign:'left',cursor:'pointer',minHeight:132}}>
            <div style={{fontSize:10,fontWeight:900,color:'#6C8D78',letterSpacing:.6}}>DEINE ENTWICKLUNG</div>
            <div style={{fontSize:24,fontWeight:850,marginTop:10}}>{currentRI ?? '–'} {riDelta != null && <span style={{fontSize:12,color:riDelta >= 0 ? '#5D9A72' : '#B8796B'}}>{riDelta > 0 ? `↗ +${riDelta}` : riDelta < 0 ? `↘ ${riDelta}` : '→'}</span>}</div>
            <div style={{fontSize:9.5,color:'#9B877B',marginTop:4}}>{currentRI != null ? 'Running Index' : 'Entwicklung ansehen'}</div>
            <div style={{fontSize:9.5,fontWeight:800,color:'#6C8D78',marginTop:12}}>Mehr Entwicklung →</div>
          </button>

          <button onClick={onOpenActivities} style={{...card,padding:15,textAlign:'left',cursor:'pointer',minHeight:132,background:'linear-gradient(145deg,#FFFFFF,#FFF9F2)'}}>
            <div style={{fontSize:10,fontWeight:900,color:'#C18B4E',letterSpacing:.6}}>LETZTER ERFOLG</div>
            <div style={{fontSize:24,marginTop:9}}>{achievement?.icon || '🏆'}</div>
            <div style={{fontSize:11.5,fontWeight:850,marginTop:4}}>{achievement?.title || 'Deine Erfolge warten'}</div>
            <div style={{fontSize:9.5,color:'#A18C7F',marginTop:5}}>{achievement?.unlockedAt ? `Erreicht am ${new Date(achievement.unlockedAt).toLocaleDateString('de-DE')}` : 'Entdecke deine Meilensteine'}</div>
          </button>
        </div>

        <button onClick={onOpenActivities} style={{...card,width:'100%',padding:16,marginTop:12,textAlign:'left',cursor:'pointer',background:'linear-gradient(135deg,#F5F1FA,#FFF8F2)'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><div style={{fontSize:10,fontWeight:900,color:'#80699A',letterSpacing:.6}}>MEIN SPORTLICHER WEG</div><div style={{fontSize:14,fontWeight:850,marginTop:5}}>Dein Training wird zu deiner Geschichte.</div><div style={{fontSize:10,color:'#907E88',lineHeight:1.4,marginTop:5}}>Meilensteine, Sammlungen und besondere Momente an einem Ort.</div></div><div style={{fontSize:28}}>🛤️</div></div>
          <div style={{fontSize:10,fontWeight:800,color:'#80699A',marginTop:11}}>Meinen Weg ansehen →</div>
        </button>

        {!plan && latestActivity && (
          <button onClick={onOpenTraining} style={{...card,width:'100%',padding:16,marginTop:12,textAlign:'left',cursor:'pointer',background:'#FFF7F0'}}><div style={{fontSize:10,fontWeight:900,color:'#B97459'}}>DU TRAINIERST GERADE FREI</div><div style={{fontSize:13,fontWeight:800,marginTop:5}}>Möchtest du auf ein bestimmtes Ziel hinarbeiten?</div><div style={{fontSize:10,color:'#9A8174',marginTop:5}}>Trainingspläne entdecken →</div></button>
        )}
      </div>
      </div>
    </>
  )
}

export default Dashboard
