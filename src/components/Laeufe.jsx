import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import Statistics from './Statistics.jsx'
import MetricDashboard from './MetricDashboard.jsx'
import PhaseTimeline from './PhaseTimeline.jsx'
import PhaseCards from './PhaseCards.jsx'
import SplitAccordion from './SplitAccordion.jsx'
import ElevationPerformanceChart from './ElevationPerformanceChart.jsx'
import StoryShareModal from './StoryShareModal.jsx'

const TAG_OFFSET = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 }
const WEEKDAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const estimateDayKm = (details) => {
  if (!details) return 0
  const clean = details.replace(/\([^)]*\)/g, '')

  // Erkennt ein führendes "NN km: ..." als GESAMT-Distanz des Tages (z.B.
  // "16 km: 12 km Zone 2 + 4 km progressiv..."). Die folgenden km-Angaben sind dann nur
  // eine Aufschlüsselung des Gesamtwerts, keine zusätzliche Distanz - nicht mit aufsummieren.
  const totalMatch = clean.match(/^\s*(\d+(?:[.,]\d+)?)\s*km\s*:/)
  if (totalMatch) return parseFloat(totalMatch[1].replace(',', '.'))

  let km = 0
  const repRegex = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b/gi
  let m
  while ((m = repRegex.exec(clean))) {
    const reps = parseInt(m[1])
    let dist = parseFloat(m[2].replace(',', '.'))
    if (m[3].toLowerCase() === 'm') dist = dist / 1000
    km += reps * dist
  }
  let rest = clean.replace(repRegex, '')
  const kmRegex = /(\d+(?:[.,]\d+)?)\s*km\b/g
  while ((m = kmRegex.exec(rest))) km += parseFloat(m[1].replace(',', '.'))
  rest = rest.replace(kmRegex, '')
  const minRegex = /(\d+)\s*min\b/g
  while ((m = minRegex.exec(rest))) km += parseInt(m[1]) / 8
  return km
}

function getPlanDayDates(plan) {
  const result = []
  if (!plan) return result
  const fallbackYear = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getFullYear() : new Date().getFullYear()
  const startMonth = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getMonth() : null

  for (const phase of plan.phases || []) {
    for (const week of phase.weeks || []) {
      const match = week.dateRange?.match(/(\d{1,2})\.(\d{1,2})\./)
      if (!match) continue
      const day = parseInt(match[1])
      const month = parseInt(match[2]) - 1
      let year = fallbackYear
      if (startMonth !== null && month < startMonth - 6) year = fallbackYear + 1
      const weekStart = new Date(year, month, day)

      ;(week.days || []).forEach((dayObj, di) => {
        if (dayObj.optional) return
        const offset = TAG_OFFSET[dayObj.tag] ?? 0
        const d = new Date(weekStart)
        d.setDate(d.getDate() + offset)
        result.push({
          date: d,
          dateStr: toLocalDateStr(d),
          key: `${phase.id}_w${week.n}_d${di}`,
          tag: dayObj.tag,
          einheit: dayObj.einheit,
          plannedKm: estimateDayKm(dayObj.details),
          weekN: week.n,
        })
      })
    }
  }
  return result
}

const diffDays = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000)

// Baut "YYYY-MM-DD" aus den LOKALEN Datumsteilen statt über toISOString() (das erst
// in UTC umrechnet und dadurch bei positiven Zeitzonen wie Deutschland um einen Tag
// zurückspringen kann).
const toLocalDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const STATUS_COLOR = {
  assigned: '#5BA88A',
  pending: '#C17A3A',
  extra: '#A78BCA',
}
const STATUS_LABEL = {
  assigned: 'Zugeordnet',
  pending: 'Noch offen',
  extra: 'Extra-Lauf',
}

const SPORT_FILTERS = [
  { key: 'all', label: 'Alle', icon: '✨' },
  { key: 'running', label: 'Laufen', icon: '🏃' },
  { key: 'hiking', label: 'Wandern', icon: '🥾' },
  { key: 'cycling', label: 'Radfahren', icon: '🚴' },
  { key: 'mountain_biking', label: 'MTB', icon: '🚵' },
]

const SPORT_CONFIG = {
  running: {
    label: 'Lauf',
    plural: 'Läufe',
    icon: '🏃',
    color: '#FF8C69',
    soft: '#FFF0E6',
  },
  walking: {
    label: 'Walking',
    plural: 'Walking',
    icon: '🚶',
    color: '#76A85B',
    soft: '#F1F8EC',
  },
  hiking: {
    label: 'Wanderung',
    plural: 'Wanderungen',
    icon: '🥾',
    color: '#76A85B',
    soft: '#F1F8EC',
  },
  cycling: {
    label: 'Radtour',
    plural: 'Radtouren',
    icon: '🚴',
    color: '#62A7D6',
    soft: '#EEF7FC',
  },
  mountain_biking: {
    label: 'Mountainbike-Tour',
    plural: 'Mountainbike',
    icon: '🚵',
    color: '#8B6B4A',
    soft: '#F7F0E8',
  },
  swimming: {
    label: 'Schwimmen',
    plural: 'Schwimmen',
    icon: '🏊',
    color: '#4AA8B8',
    soft: '#EAF8FA',
  },
}

const getSportConfig = (sportType) =>
  SPORT_CONFIG[sportType] || {
    label: 'Aktivität',
    plural: 'Aktivitäten',
    icon: '🏅',
    color: '#A78BCA',
    soft: '#F7F2FF',
  }

const isRunningActivity = (activity) =>
  (activity?.sportType || 'running') === 'running'

const formatDuration = (seconds, fallback = null) => {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return fallback

  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const secs = Math.round(value % 60)

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')} h`
  return `${minutes}:${String(secs).padStart(2, '0')} min`
}

const MultisportDashboard = ({ activity }) => {
  const running = isRunningActivity(activity)
  const sport = getSportConfig(activity.sportType)

  const metrics = running
    ? [
        ['🕐', 'Uhrzeit', activity.uhrzeit],
        ['📍', 'Distanz', activity.km],
        ['⏱', 'Pace', activity.pace],
        ['❤️', 'Ø Herzfrequenz', activity.bpm],
        ['🔥', 'Kalorien', activity.kalorien ? `${activity.kalorien} kcal` : null],
        ['💗', 'Max. Herzfrequenz', activity.hfMax ? `${activity.hfMax} bpm` : null],
        ['⛰️', 'Höhenmeter', activity.elevationGain != null ? `${Math.round(Number(activity.elevationGain))} hm` : activity.hoehenmeter ? `${activity.hoehenmeter} m` : null],
        ['👣', 'Kadenz', activity.cadence ? `${activity.cadence} spm` : null],
        ['🏃', 'Running Index', activity.runningIndex],
      ]
    : activity.sportType === 'mountain_biking'
      ? [
          ['📍', 'Distanz', activity.km],
          ['⏱', 'Dauer', formatDuration(activity.durationSeconds, activity.duration)],
          ['⛰️', 'Aufstieg', activity.elevationGain != null ? `${Math.round(Number(activity.elevationGain))} hm` : activity.hoehenmeter ? `${activity.hoehenmeter} hm` : null],
          ['⚡', 'Ø Geschwindigkeit', activity.averageSpeedKmh != null ? `${Number(activity.averageSpeedKmh).toFixed(1)} km/h` : null],
          ['🚀', 'Max. Geschwindigkeit', activity.maxSpeedKmh != null ? `${Number(activity.maxSpeedKmh).toFixed(1)} km/h` : null],
          ['↘️', 'Abstieg', activity.elevationLoss != null ? `${Math.round(Number(activity.elevationLoss))} hm` : null],
          ['❤️', 'Ø Herzfrequenz', activity.bpm],
          ['💗', 'Max. Herzfrequenz', activity.hfMax ? `${activity.hfMax} bpm` : null],
          ['🔥', 'Kalorien', activity.kalorien ? `${activity.kalorien} kcal` : null],
        ]
      : [
          ['⏱', 'Dauer', formatDuration(activity.durationSeconds, activity.duration)],
          ['📍', 'Distanz', activity.km],
          ['⚡', 'Ø Geschwindigkeit', activity.averageSpeedKmh != null ? `${Number(activity.averageSpeedKmh).toFixed(1)} km/h` : null],
          ['🚀', 'Max. Geschwindigkeit', activity.maxSpeedKmh != null ? `${Number(activity.maxSpeedKmh).toFixed(1)} km/h` : null],
          ['⛰️', 'Aufstieg', activity.elevationGain != null ? `${Math.round(Number(activity.elevationGain))} hm` : activity.hoehenmeter ? `${activity.hoehenmeter} hm` : null],
          ['↘️', 'Abstieg', activity.elevationLoss != null ? `${Math.round(Number(activity.elevationLoss))} hm` : null],
          ['❤️', 'Ø Herzfrequenz', activity.bpm],
          ['💗', 'Max. Herzfrequenz', activity.hfMax ? `${activity.hfMax} bpm` : null],
          ['🔥', 'Kalorien', activity.kalorien ? `${activity.kalorien} kcal` : null],
        ]

  const visible = metrics.filter(([, , value]) => value !== null && value !== undefined && value !== '')

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontFamily: 'sans-serif' }}>
        {sport.label}-Daten
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {visible.map(([icon, label, value]) => (
          <div
            key={label}
            style={{
              minWidth: 0,
              minHeight: 88,
              padding: '11px 9px',
              borderRadius: 14,
              border: '1.5px solid #F0E8E0',
              background: '#FFF9F6',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontFamily: 'sans-serif',
            }}
          >
            <div style={{ fontSize: 9, color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.6, lineHeight: 1.25 }}>
              {label}
            </div>
            <div style={{ fontSize: 14, color: '#3D2B1F', fontWeight: 'bold', lineHeight: 1.2, wordBreak: 'break-word' }}>
              {icon} {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value
  if (!value) return []

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.warn('JSON-Feld konnte nicht gelesen werden:', error)
      return []
    }
  }

  return []
}

const formatDate = (dateString) => {
  if (!dateString) return null

  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString

  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function Laeufe({ user, plan }) {
  const [view, setView] = useState('list')
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [reassigning, setReassigning] = useState(null)
  const [reassignSelections, setReassignSelections] = useState({})
  const [saving, setSaving] = useState(false)
  const [calMonth, setCalMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [detailRun, setDetailRun] = useState(null)
  const [routeMapUrl, setRouteMapUrl] = useState(null)
  const [routeMapLoading, setRouteMapLoading] = useState(false)
  const [routeMapError, setRouteMapError] = useState(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const [sportFilter, setSportFilter] = useState('all')

  const planDays = plan ? getPlanDayDates(plan) : []
  const planDayByKey = (key) => planDays.find(d => d.key === key)

  useEffect(() => { loadAll() }, [user, plan])

  useEffect(() => {
    if (!detailRun) {
      setRouteMapUrl(null)
      setRouteMapError(null)
      return
    }
    if (detailRun.routeMapUrl) {
      setRouteMapUrl(detailRun.routeMapUrl)
      return
    }
    if (!detailRun.polarExerciseId || !detailRun.logId || !user) {
      setRouteMapUrl(null)
      return
    }
    setRouteMapLoading(true)
    setRouteMapError(null)
    fetch('/api/polar/route-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, logId: detailRun.logId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.url) setRouteMapUrl(data.url)
        else setRouteMapError(data.error || 'Keine Route verfügbar')
      })
      .catch(() => setRouteMapError('Kartenbild konnte nicht geladen werden'))
      .finally(() => setRouteMapLoading(false))
  }, [detailRun, user])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [{ data: logsData }, { data: pendingData }] = await Promise.all([
        supabase.from('logs').select('*').eq('user_id', user.id),
        supabase.from('polar_pending_activities').select('*').eq('user_id', user.id),
      ])

      const normalized = []

      ;(logsData || []).forEach(l => {
        const isExtra = l.day_key.startsWith('extra_polar_')
        const planDay = !isExtra ? planDayByKey(l.day_key) : null
        const isPolar = l.note?.toLowerCase().includes('polar')
        let date = l.actual_date
        if (!date) {
          if (isExtra) {
            const m = l.day_key.match(/extra_polar_(\d{4}-\d{2}-\d{2})_/)
            date = m ? m[1] : null
          } else if (planDay) {
            date = planDay.dateStr
          }
        }
        normalized.push({
          id: 'log_' + l.id,
          logId: l.id,
          dayKey: l.day_key,
          date,
          km: l.km,
          pace: l.pace,
          bpm: l.bpm,
          note: l.note,
          schuhId: l.schuh_id,
          runningIndex: l.running_index,
          cadence: l.cadence,
          uhrzeit: l.uhrzeit,
          hfMax: l.hf_max,
          hoehenmeter: l.hoehenmeter,
          gefuehl: l.gefuehl,
          trainingLoad: l.training_load,
          recoveryTime: l.recovery_time,
          polarExerciseId: l.polar_exercise_id,
          routeMapUrl: l.route_map_url,
          kalorien: l.kalorien,
          routeWaypoints: parseJsonArray(l.route_waypoints),
          kmSplits: parseJsonArray(l.km_splits),
          runSegments: parseJsonArray(l.run_segments),
          sportType: l.sport_type || 'running',
          activityName: l.activity_name || null,
          durationSeconds: l.duration_seconds,
          movingTimeSeconds: l.moving_time_seconds,
          distanceMeters: l.distance_meters,
          averageSpeedKmh: l.average_speed_kmh,
          maxSpeedKmh: l.max_speed_kmh,
          elevationGain: l.elevation_gain,
          elevationLoss: l.elevation_loss,
          duration: l.duration_seconds ? formatDuration(l.duration_seconds) : null,
          status: isExtra ? 'extra' : 'assigned',
          source: l.source || (isPolar ? 'polar' : 'manual'),
          planInfo: planDay ? { weekN: planDay.weekN, tag: planDay.tag, einheit: planDay.einheit } : null,
        })
      })

      // Offene Polar-Aktivitäten werden hier bewusst nicht ergänzt.
      // Sie bleiben im Profil unter „Geräte“ sichtbar, bis der Nutzer sie
      // dort ausdrücklich übernimmt. Erst danach stehen sie in `logs`
      // und erscheinen in der Aktivitätenübersicht.

      normalized.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      setRuns(normalized)
    } catch (e) {
      console.error('Läufe laden fehlgeschlagen:', e)
    }
    setLoading(false)
  }

  const getCandidates = (run) => {
    if (!run.date) return []
    const occupied = new Set(runs.filter(r => r.dayKey && r.id !== run.id).map(r => r.dayKey))
    const actualKm = run.km ? parseFloat(String(run.km).replace(',', '.')) : null
    return planDays
      .filter(d => !occupied.has(d.key))
      .map(d => {
        const dist = diffDays(d.dateStr, run.date)
        const kmDiff = (actualKm != null && d.plannedKm > 0) ? Math.abs(d.plannedKm - actualKm) : 0
        const score = Math.abs(dist) * 1.5 + kmDiff
        return { ...d, dist, kmDiff, score }
      })
      .filter(d => Math.abs(d.dist) <= 4)
      .sort((a, b) => a.score - b.score)
  }

  const weekdayLabel = (d) => d.date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
  const candidateLabel = (c) => {
    const dayPart = c.dist !== 0 ? `${c.dist > 0 ? '+' : ''}${c.dist} Tag${Math.abs(c.dist) !== 1 ? 'e' : ''}` : 'genau passend'
    const kmPart = c.kmDiff > 0.5 ? `, Δ${c.kmDiff.toFixed(1)} km` : ''
    return `Wo. ${c.weekN} · ${weekdayLabel(c)} · ${c.einheit} (${dayPart}${kmPart})`
  }

  const reassignRun = async (run, chosenKey) => {
    setSaving(true)
    setMessage(null)
    try {
if (run.status === 'pending') {
  const { error: ignoreError } = await supabase
    .from('polar_ignored_activities')
    .upsert(
      {
        user_id: user.id,
        polar_exercise_id: run.polarExerciseId,
      },
      {
        onConflict: 'user_id,polar_exercise_id',
      }
    )

  if (ignoreError) {
    console.error('Polar-Lauf konnte nicht dauerhaft verworfen werden:', ignoreError)
    throw ignoreError
  }

  const { error: deleteError } = await supabase
    .from('polar_pending_activities')
    .delete()
    .eq('id', run.pendingId)

  if (deleteError) {
    console.error('Pending-Lauf konnte nicht gelöscht werden:', deleteError)
    throw deleteError
  }
} else {
  await supabase
    .from('logs')
    .delete()
    .eq('id', run.logId)

  if (run.status === 'assigned' && run.dayKey) {
    await supabase
      .from('training_done')
      .upsert(
        {
          user_id: user.id,
          day_key: run.dayKey,
          done: false,
        },
        {
          onConflict: 'user_id,day_key',
        }
      )
  }
}

      if (chosenKey === 'extra') {
        const extraKey = `extra_polar_${run.date}_${crypto.randomUUID().slice(0, 8)}`
        await supabase.from('logs').upsert({
          user_id: user.id,
          day_key: extraKey,
          pace: run.pace,
          km: run.km,
          bpm: run.bpm,
          note: run.note || 'Extra-Lauf',
          schuh_id: run.schuhId,
          actual_date: run.date,
          running_index: run.runningIndex,
          cadence: run.cadence,
          uhrzeit: run.uhrzeit,
          hf_max: run.hfMax,
          hoehenmeter: run.hoehenmeter,
          gefuehl: run.gefuehl,
          training_load: run.trainingLoad,
          recovery_time: run.recoveryTime,
          polar_exercise_id: run.polarExerciseId,
          kalorien: run.kalorien,
          route_waypoints: run.routeWaypoints,
          km_splits: run.kmSplits,
          run_segments: run.runSegments,
        }, { onConflict: 'user_id,day_key' })
      } else {
        await supabase.from('logs').upsert({
          user_id: user.id,
          day_key: chosenKey,
          pace: run.pace,
          km: run.km,
          bpm: run.bpm,
          note: run.note || 'Neu zugeordnet',
          schuh_id: run.schuhId,
          actual_date: run.date,
          running_index: run.runningIndex,
          cadence: run.cadence,
          uhrzeit: run.uhrzeit,
          hf_max: run.hfMax,
          hoehenmeter: run.hoehenmeter,
          gefuehl: run.gefuehl,
          training_load: run.trainingLoad,
          recovery_time: run.recoveryTime,
          polar_exercise_id: run.polarExerciseId,
          kalorien: run.kalorien,
          route_waypoints: run.routeWaypoints,
          km_splits: run.kmSplits,
          run_segments: run.runSegments,
        }, { onConflict: 'user_id,day_key' })
        await supabase.from('training_done').upsert({ user_id: user.id, day_key: chosenKey, done: true }, { onConflict: 'user_id,day_key' })
      }

      setMessage({ type: 'success', text: '✅ Neu zugeordnet!' })
      setReassigning(null)
      await loadAll()
    } catch (e) {
      console.error('Neu-Zuordnen fehlgeschlagen:', e)
      setMessage({ type: 'error', text: 'Fehler beim Neu-Zuordnen. Bitte erneut versuchen.' })
    }
    setSaving(false)
  }

  const msgStyle = (type) => ({
    padding: '10px 14px', borderRadius: 12, fontSize: 13, fontFamily: 'sans-serif', marginBottom: 16,
    background: type === 'success' ? '#F0FAF4' : '#FDECEA',
    color: type === 'success' ? '#5BA88A' : '#B85464',
    border: `1px solid ${type === 'success' ? '#B8E4CC' : '#F5C4CC'}`,
  })

  const ActivityCard = ({ run }) => {
    const isPending = run.status === 'pending'
    const running = isRunningActivity(run)
    const sport = getSportConfig(run.sportType)
    const isReassigning = reassigning === run.id
    const candidates = running && isReassigning ? getCandidates(run) : []
    const selected = reassignSelections[run.id] ?? (candidates[0]?.key || '')

    const dateLabel = run.date
      ? new Date(`${run.date}T00:00:00`).toLocaleDateString('de-DE', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      : 'Kein Datum'

    const title = run.planInfo
      ? run.planInfo.einheit
      : run.activityName || sport.label

    const MetricChips = () => (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {run.km && (
          <span style={{ fontSize: 11, background: '#FFF0E6', color: '#C17A3A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            📍 {run.km}
          </span>
        )}

        {running && run.pace && (
          <span style={{ fontSize: 11, background: '#E8F0FF', color: '#4060C0', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            ⏱ {run.pace}
          </span>
        )}

        {!running && run.averageSpeedKmh != null && (
          <span style={{ fontSize: 11, background: '#E8F0FF', color: '#4060C0', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            ⚡ {Number(run.averageSpeedKmh).toFixed(1)} km/h
          </span>
        )}

        {!running && run.elevationGain != null && (
          <span style={{ fontSize: 11, background: '#FFF8E1', color: '#A07830', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            ⛰️ {Math.round(Number(run.elevationGain))} hm
          </span>
        )}

        {run.bpm && (
          <span style={{ fontSize: 11, background: '#FDECEA', color: '#B85464', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            ❤️ {run.bpm}
          </span>
        )}

        {!running && run.duration && (
          <span style={{ fontSize: 11, background: '#F5EDE8', color: '#8B6B5A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            ⏱ {run.duration}
          </span>
        )}

        {!isPending && (
          <span style={{ fontSize: 11, background: '#F5EDE8', color: '#8B6B5A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
            {run.source === 'polar' ? '⌚ Polar' : '✏️ Manuell'}
          </span>
        )}
      </div>
    )

    if (isPending) {
      return (
        <div
          style={{
            background: 'white',
            borderRadius: 14,
            padding: '14px 16px',
            border: `1.5px solid ${sport.color}33`,
            borderLeft: `4px solid ${sport.color}`,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>
                {sport.icon} {title}
              </div>
              <div style={{ fontSize: 11, color: '#B8A090', fontFamily: 'sans-serif', marginTop: 2 }}>
                {dateLabel}
              </div>
            </div>

            <span style={{ fontSize: 10, background: STATUS_COLOR.pending + '22', color: STATUS_COLOR.pending, padding: '3px 10px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
              Noch offen
            </span>
          </div>

          <div style={{ marginBottom: 10 }}>
            <MetricChips />
          </div>

          {running ? (
            isReassigning ? (
              <>
                <select
                  value={selected}
                  onChange={event =>
                    setReassignSelections(previous => ({
                      ...previous,
                      [run.id]: event.target.value,
                    }))
                  }
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 13, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer', marginBottom: 10 }}
                >
                  {candidates.length === 0 && (
                    <option value="">Kein passender offener Tag gefunden</option>
                  )}
                  {candidates.map(candidate => (
                    <option key={candidate.key} value={candidate.key}>
                      {candidateLabel(candidate)}
                    </option>
                  ))}
                  <option value="extra">
                    — Als Extra-Lauf speichern (kein Plan-Tag) —
                  </option>
                </select>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setReassigning(null)}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #F0E8E0', background: 'white', color: '#B8A090', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}
                  >
                    Abbrechen
                  </button>

                  <button
                    onClick={() => reassignRun(run, selected)}
                    disabled={!selected || saving}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: !selected || saving ? '#F0E8E0' : 'linear-gradient(135deg,#FF8C69,#FFB347)', color: !selected || saving ? '#C4A882' : 'white', fontSize: 12, fontWeight: 'bold', cursor: !selected || saving ? 'default' : 'pointer', fontFamily: 'sans-serif' }}
                  >
                    {saving ? '⏳ Speichere…' : '✓ Bestätigen'}
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => {
                  setReassigning(run.id)
                  setReassignSelections(previous => ({
                    ...previous,
                    [run.id]: undefined,
                  }))
                }}
                style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1.5px solid #F0E0D0', background: 'white', color: '#8B7355', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}
              >
                Lauf zuordnen
              </button>
            )
          ) : (
            <div style={{ fontSize: 11, color: '#8B6B5A', background: sport.soft, borderRadius: 10, padding: '9px 10px', fontFamily: 'sans-serif', lineHeight: 1.4 }}>
              Noch nicht übernommen. Öffne im Profil unter „Geräte“ die Polar-Synchronisation.
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        onClick={() => setDetailRun(run)}
        style={{
          background: 'white',
          borderRadius: 14,
          padding: '14px 16px',
          border: `1.5px solid ${sport.color}33`,
          borderLeft: `4px solid ${sport.color}`,
          marginBottom: 10,
          cursor: 'pointer',
          boxShadow: '0 3px 12px rgba(61,43,31,0.035)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>
              {sport.icon} {title}
            </div>
            <div style={{ fontSize: 11, color: '#B8A090', fontFamily: 'sans-serif', marginTop: 3 }}>
              {dateLabel}
            </div>
          </div>

          {running && run.planInfo ? (
            <span style={{ fontSize: 10, background: '#EAF7F0', color: '#5BA88A', padding: '3px 9px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
              Wo.{run.planInfo.weekN} {run.planInfo.tag}
            </span>
          ) : (
            <span style={{ fontSize: 10, background: sport.soft, color: sport.color, padding: '3px 9px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
              {sport.label}
            </span>
          )}
        </div>

        <MetricChips />

        <div style={{ textAlign: 'right', fontSize: 10, color: '#D4C4B8', fontFamily: 'sans-serif', marginTop: 7 }}>
          Details ansehen ›
        </div>
      </div>
    )
  }

  const filteredRuns =
    sportFilter === 'all'
      ? runs
      : sportFilter === 'hiking'
        ? runs.filter(run =>
            run.sportType === 'hiking' || run.sportType === 'walking'
          )
        : runs.filter(run => run.sportType === sportFilter)

  // Kalender-Aufbau
  const year = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const runsByDate = {}
  filteredRuns.forEach(r => {
    if (!r.date) return
    if (!runsByDate[r.date]) runsByDate[r.date] = []
    runsByDate[r.date].push(r)
  })
  const monthLabel = calMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const selectedRuns = selectedDate ? (runsByDate[selectedDate] || []) : []

  if (loading) return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#B8A090', fontFamily: 'sans-serif' }}>⏳ Lade…</div>
    </div>
  )

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', maxWidth: 580, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 'bold', color: '#3D2B1F', margin: '0 0 16px' }}>Aktivitäten</h2>
      {message && <div style={msgStyle(message.type)}>{message.text}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView('list')}
          style={{ flex: 1, padding: '10px', borderRadius: 12, border: `2px solid ${view === 'list' ? '#FF8C69' : '#F0E0D0'}`, background: view === 'list' ? '#FF8C69' : 'white', color: view === 'list' ? 'white' : '#C4A882', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
          Liste
        </button>
        <button onClick={() => setView('cal')}
          style={{ flex: 1, padding: '10px', borderRadius: 12, border: `2px solid ${view === 'cal' ? '#FF8C69' : '#F0E0D0'}`, background: view === 'cal' ? '#FF8C69' : 'white', color: view === 'cal' ? 'white' : '#C4A882', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
          Kalender
        </button>
        <button onClick={() => setView('stats')}
          style={{ flex: 1, padding: '10px', borderRadius: 12, border: `2px solid ${view === 'stats' ? '#FF8C69' : '#F0E0D0'}`, background: view === 'stats' ? '#FF8C69' : 'white', color: view === 'stats' ? 'white' : '#C4A882', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
          Statistik
        </button>
      </div>

      {(view === 'list' || view === 'cal') && (
        <div
          style={{
            display: 'flex',
            gap: 7,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 5,
            marginBottom: 14,
            scrollbarWidth: 'none',
          }}
        >
          {SPORT_FILTERS.map(filter => {
            const active = sportFilter === filter.key

            return (
              <button
                key={filter.key}
                onClick={() => {
                  setSportFilter(filter.key)
                  setSelectedDate(null)
                }}
                style={{
                  flex: '0 0 auto',
                  padding: '8px 12px',
                  borderRadius: 99,
                  border: active
                    ? '2px solid #FF8C69'
                    : '1.5px solid #F0E0D0',
                  background: active ? '#FFF3EC' : 'white',
                  color: active ? '#C16045' : '#8B6B5A',
                  fontSize: 11,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'sans-serif',
                  whiteSpace: 'nowrap',
                }}
              >
                {filter.icon} {filter.label}
              </button>
            )
          })}
        </div>
      )}

      {view === 'stats' && <Statistics user={user} plan={plan} />}

      {view === 'list' && (
        filteredRuns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B8A090', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>
              {sportFilter === 'all'
                ? '🏅'
                : SPORT_FILTERS.find(filter => filter.key === sportFilter)?.icon || '🏅'}
            </div>
            <div>
              In dieser Kategorie sind noch keine Aktivitäten vorhanden.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9, fontFamily: 'sans-serif' }}>
              <div style={{ fontSize: 12, color: '#8B6B5A', fontWeight: 'bold' }}>
                {sportFilter === 'all'
                  ? 'Alle Aktivitäten'
                  : SPORT_FILTERS.find(filter => filter.key === sportFilter)?.label}
              </div>
              <div style={{ fontSize: 11, color: '#B8A090' }}>
                {filteredRuns.length} {filteredRuns.length === 1 ? 'Aktivität' : 'Aktivitäten'}
              </div>
            </div>

            {filteredRuns.map(run => (
              <ActivityCard key={run.id} run={run} />
            ))}
          </>
        )
      )}

      {view === 'cal' && (
        <div>
          <div style={{ background: 'white', borderRadius: 16, padding: 16, border: '1.5px solid #F0E8E0', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => { setCalMonth(new Date(year, month - 1, 1)); setSelectedDate(null) }}
                style={{ background: 'none', border: 'none', color: '#C4A882', fontSize: 16, cursor: 'pointer' }}>‹</button>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#5C3D2E', fontFamily: 'sans-serif', textTransform: 'capitalize' }}>{monthLabel}</div>
              <button onClick={() => { setCalMonth(new Date(year, month + 1, 1)); setSelectedDate(null) }}
                style={{ background: 'none', border: 'none', color: '#C4A882', fontSize: 16, cursor: 'pointer' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, fontSize: 10, color: '#B8A090', textAlign: 'center', marginBottom: 6, fontFamily: 'sans-serif' }}>
              {WEEKDAY_NAMES.map(w => <div key={w}>{w}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {Array.from({ length: firstWeekday }).map((_, i) => <div key={'e' + i} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                const dayRuns = runsByDate[dateStr] || []
                const primaryStatus = dayRuns[0]?.status
                const isSelected = selectedDate === dateStr
                return (
                  <div key={dayNum} onClick={() => dayRuns.length > 0 && setSelectedDate(isSelected ? null : dateStr)}
                    style={{
                      aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 10, fontSize: 11, fontFamily: 'sans-serif', cursor: dayRuns.length > 0 ? 'pointer' : 'default',
                      background: isSelected ? '#FFF0E6' : dayRuns.length > 0 ? STATUS_COLOR[primaryStatus] + '18' : 'transparent',
                      color: dayRuns.length > 0 ? STATUS_COLOR[primaryStatus] : '#D4C4B8',
                      fontWeight: dayRuns.length > 0 ? 'bold' : 'normal',
                      border: isSelected ? '1.5px solid #FF8C69' : '1.5px solid transparent',
                    }}>
                    {dayNum}
                    {dayRuns.length > 0 && <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[primaryStatus], marginTop: 2 }} />}
                  </div>
                )
              })}
            </div>
          </div>

          {selectedRuns.map(run => <ActivityCard key={run.id} run={run} />)}
        </div>
      )}

      {detailRun && (() => {
        const d = detailRun
        const shoeName = null
        const running = isRunningActivity(d)
        const sport = getSportConfig(d.sportType)

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(60,30,20,0.45)',
              zIndex: 300,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '28px 28px 0 0',
                width: '100%',
                maxWidth: 520,
                height: 'min(88dvh, 880px)',
                maxHeight: 'calc(100dvh - 72px)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 -8px 40px rgba(255,140,105,0.2)',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  padding: '24px 24px 28px',
                }}
              >
              <div style={{ width: 36, height: 4, background: '#F0E8E0', borderRadius: 99, margin: '0 auto 18px' }} />
              <div style={{ fontSize: 11, color: '#C4A882', marginBottom: 2, fontFamily: 'sans-serif' }}>
                {d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 'bold', color: '#3D2B1F', marginBottom: 18 }}>
                {sport.icon}{' '}
                {d.planInfo
                  ? `Wo.${d.planInfo.weekN} ${d.planInfo.tag} · ${d.planInfo.einheit}`
                  : d.activityName || (d.status === 'extra' && running ? 'Extra-Lauf' : sport.label)}
              </h3>

              {(routeMapLoading || routeMapUrl || routeMapError) && (
                <div style={{ marginBottom: 18, borderRadius: 14, overflow: 'hidden', border: '1.5px solid #F0E8E0' }}>
                  {routeMapLoading && (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#B8A090', fontSize: 12, fontFamily: 'sans-serif', background: '#FFF8F5' }}>⏳ Karte wird geladen…</div>
                  )}
                  {!routeMapLoading && routeMapUrl && (
                    <img src={routeMapUrl} alt="Laufstrecke" style={{ width: '100%', display: 'block' }} />
                  )}
                  {!routeMapLoading && !routeMapUrl && routeMapError && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#D4C4B8', fontSize: 11, fontFamily: 'sans-serif', background: '#FFF8F5' }}>Keine Route verfügbar</div>
                  )}
                </div>
              )}

              {running ? (
                <>
                  <MetricDashboard
                    time={d.uhrzeit}
                    distance={d.km}
                    pace={d.pace}
                    averageHeartRate={d.bpm}
                    calories={d.kalorien ? `${d.kalorien} kcal` : null}
                    maxHeartRate={d.hfMax ? `${d.hfMax} bpm` : null}
                    elevation={d.elevationGain != null ? `${Math.round(Number(d.elevationGain))} hm` : d.hoehenmeter ? `${d.hoehenmeter} m` : null}
                    cadence={d.cadence ? `${d.cadence} spm` : null}
                    runningIndex={d.runningIndex}
                    shoe={shoeName}
                  />

                  <ElevationPerformanceChart
                    routeWaypoints={d.routeWaypoints}
                    splits={d.kmSplits}
                    sportType={d.sportType}
                    elevationGain={d.elevationGain ?? d.hoehenmeter}
                    elevationLoss={d.elevationLoss}
                    defaultOpen={false}
                  />

                  <PhaseTimeline phases={d.runSegments} />

                  <PhaseCards phases={d.runSegments} />

                  <SplitAccordion
                    splits={d.kmSplits}
                    defaultOpen={!Array.isArray(d.runSegments) || d.runSegments.length === 0}
                  />
                </>
              ) : (
                <>
                  <MultisportDashboard activity={d} />

                  <ElevationPerformanceChart
                    routeWaypoints={d.routeWaypoints}
                    splits={d.kmSplits}
                    sportType={d.sportType}
                    elevationGain={d.elevationGain ?? d.hoehenmeter}
                    elevationLoss={d.elevationLoss}
                    defaultOpen={
                      d.sportType === 'mountain_biking' ||
                      d.sportType === 'hiking' ||
                      d.sportType === 'walking' ||
                      d.sportType === 'cycling'
                    }
                  />

                  {Array.isArray(d.kmSplits) && d.kmSplits.length > 0 && (
                    <SplitAccordion
                      splits={d.kmSplits}
                      defaultOpen={false}
                    />
                  )}
                </>
              )}

              {d.note && (
                <div style={{ marginTop: 16, padding: '12px 14px', background: '#F5EDE8', borderRadius: 12, fontSize: 12, color: '#8B6B5A', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
                  💬 {d.note}
                </div>
              )}



              </div>

              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  gap: 10,
                  padding: '12px 24px max(16px, calc(env(safe-area-inset-bottom) + 8px))',
                  background: 'rgba(255,255,255,0.98)',
                  borderTop: '1px solid #F0E8E0',
                  boxShadow: '0 -8px 24px rgba(61,43,31,0.08)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                }}
              >
                <button
                  onClick={() => {
                    setDetailRun(null)
                    setReassigning(null)
                    setStoryOpen(false)
                  }}
                  style={{
                    flex: 1,
                    padding: 14,
                    borderRadius: 16,
                    border: '1.5px solid #F0E8E0',
                    background: 'white',
                    color: '#B8A090',
                    fontSize: 14,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontFamily: 'sans-serif',
                  }}
                >
                  Schließen
                </button>

                <button
                  onClick={() => setStoryOpen(true)}
                  style={{
                    flex: 1.45,
                    padding: 14,
                    borderRadius: 16,
                    border: 'none',
                    background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontFamily: 'sans-serif',
                  }}
                >
                  ↗️ Aktivität teilen
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      <StoryShareModal
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        title={
          detailRun?.planInfo
            ? `Wo.${detailRun.planInfo.weekN} ${detailRun.planInfo.tag} · ${detailRun.planInfo.einheit}`
            : detailRun?.activityName || getSportConfig(detailRun?.sportType).label
        }
        date={detailRun?.date ? formatDate(detailRun.date) : null}
        routeMapUrl={routeMapUrl}
        distance={detailRun?.km}
        pace={
          isRunningActivity(detailRun)
            ? detailRun?.pace
            : detailRun?.averageSpeedKmh != null
              ? `${Number(detailRun.averageSpeedKmh).toFixed(1)} km/h`
              : null
        }
        heartRate={detailRun?.bpm}
        calories={detailRun?.kalorien ? `${detailRun.kalorien} kcal` : null}
        phases={detailRun?.runSegments || []}
        runningIndex={detailRun?.runningIndex}
        elevation={detailRun?.hoehenmeter ? `${detailRun.hoehenmeter} m` : null}
        logoSrc="/route-icon.png"
      />
      </div>
    </div>
  )
}
