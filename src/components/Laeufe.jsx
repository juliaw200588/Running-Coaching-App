import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import Statistics from './Statistics.jsx'

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
          status: isExtra ? 'extra' : 'assigned',
          source: isPolar ? 'polar' : 'manual',
          planInfo: planDay ? { weekN: planDay.weekN, tag: planDay.tag, einheit: planDay.einheit } : null,
        })
      })

      ;(pendingData || []).forEach(p => {
        normalized.push({
          id: 'pending_' + p.id,
          pendingId: p.id,
          dayKey: null,
          date: p.datum,
          km: p.distanz,
          pace: p.pace,
          bpm: p.herzfrequenz,
          note: null,
          schuhId: null,
          status: 'pending',
          source: 'polar',
          planInfo: null,
        })
      })

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
      .filter(d => Math.abs(d.dist) <= 3)
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
        await supabase.from('polar_pending_activities').delete().eq('id', run.pendingId)
      } else {
        await supabase.from('logs').delete().eq('id', run.logId)
        if (run.status === 'assigned' && run.dayKey) {
          await supabase.from('training_done').upsert({ user_id: user.id, day_key: run.dayKey, done: false }, { onConflict: 'user_id,day_key' })
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

  const RunCard = ({ run }) => {
    const isPending = run.status === 'pending'
    const isReassigning = reassigning === run.id
    const candidates = isReassigning ? getCandidates(run) : []
    const selected = reassignSelections[run.id] ?? (candidates[0]?.key || '')

    // Noch nicht zugeordnete Läufe: Auswahl bleibt direkt auf der Karte, da hier erst
    // die grundlegende Zuordnung passieren muss, bevor es überhaupt Details gibt.
    if (isPending) {
      return (
        <div style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '1.5px solid #F0E8E0', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>
              🏃‍♀️ {run.date ? new Date(run.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Kein Datum'}
            </div>
            <span style={{ fontSize: 10, background: STATUS_COLOR[run.status] + '22', color: STATUS_COLOR[run.status], padding: '3px 10px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>
              {STATUS_LABEL[run.status]}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {run.km && <span style={{ fontSize: 11, background: '#FFF0E6', color: '#C17A3A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>📍 {run.km}</span>}
            {run.pace && <span style={{ fontSize: 11, background: '#E8F0FF', color: '#4060C0', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>⏱ {run.pace}</span>}
            {run.bpm && <span style={{ fontSize: 11, background: '#FDECEA', color: '#B85464', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>❤️ {run.bpm}</span>}
          </div>

          {isReassigning ? (
            <>
              <select
                value={selected}
                onChange={e => setReassignSelections(p => ({ ...p, [run.id]: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 13, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer', marginBottom: 10 }}>
                {candidates.length === 0 && <option value="">Kein passender offener Tag gefunden</option>}
                {candidates.map(c => (
                  <option key={c.key} value={c.key}>{candidateLabel(c)}</option>
                ))}
                <option value="extra">— Als Extra-Lauf speichern (kein Plan-Tag) —</option>
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setReassigning(null)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #F0E8E0', background: 'white', color: '#B8A090', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                  Abbrechen
                </button>
                <button onClick={() => reassignRun(run, selected)} disabled={!selected || saving}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: !selected || saving ? '#F0E8E0' : 'linear-gradient(135deg,#FF8C69,#FFB347)', color: !selected || saving ? '#C4A882' : 'white', fontSize: 12, fontWeight: 'bold', cursor: !selected || saving ? 'default' : 'pointer', fontFamily: 'sans-serif' }}>
                  {saving ? '⏳ Speichere…' : '✓ Bestätigen'}
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => { setReassigning(run.id); setReassignSelections(p => ({ ...p, [run.id]: undefined })) }}
              style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1.5px solid #F0E0D0', background: 'white', color: '#8B7355', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
              Zuordnen
            </button>
          )}
        </div>
      )
    }

    // Bereits zugeordnete/Extra-Läufe: ganze Karte klickbar, öffnet Details.
    // Keine Buttons mehr direkt auf der Karte - das ist eine Browse-Liste, kein
    // Aktions-Panel. "Neu zuordnen" gibt's im Detail-Modal, nicht mehr permanent hier.
    return (
      <div onClick={() => setDetailRun(run)}
        style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '1.5px solid #F0E8E0', marginBottom: 10, cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>
            🏃‍♀️ {run.date ? new Date(run.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Kein Datum'}
          </div>
          <span style={{ fontSize: 10, background: STATUS_COLOR[run.status] + '22', color: STATUS_COLOR[run.status], padding: '3px 10px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>
            {STATUS_LABEL[run.status]}{run.planInfo ? `: Wo.${run.planInfo.weekN} ${run.planInfo.tag}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {run.km && <span style={{ fontSize: 11, background: '#FFF0E6', color: '#C17A3A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>📍 {run.km}</span>}
          {run.pace && <span style={{ fontSize: 11, background: '#E8F0FF', color: '#4060C0', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>⏱ {run.pace}</span>}
          {run.bpm && <span style={{ fontSize: 11, background: '#FDECEA', color: '#B85464', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>❤️ {run.bpm}</span>}
          <span style={{ fontSize: 11, background: '#F5EDE8', color: '#8B6B5A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>{run.source === 'polar' ? '⌚ Polar' : '✏️ Manuell'}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: '#D4C4B8', fontFamily: 'sans-serif', marginTop: 6 }}>Details ansehen ›</div>
      </div>
    )
  }

  // Kalender-Aufbau
  const year = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const runsByDate = {}
  runs.forEach(r => {
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

      {view === 'stats' && <Statistics user={user} plan={plan} />}

      {view === 'list' && (
        runs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B8A090', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏃‍♀️</div>
            <div>Noch keine Läufe vorhanden.</div>
          </div>
        ) : (
          runs.map(run => <RunCard key={run.id} run={run} />)
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

          {selectedRuns.map(run => <RunCard key={run.id} run={run} />)}
        </div>
      )}

      {detailRun && (() => {
        const d = detailRun
        const rows = [
          { icon: '🕐', label: 'Uhrzeit', value: d.uhrzeit },
          { icon: '⏱', label: 'Pace', value: d.pace },
          { icon: '📍', label: 'Distanz', value: d.km },
          { icon: '❤️', label: 'Ø Herzfrequenz', value: d.bpm },
          { icon: '🔥', label: 'Kalorien', value: d.kalorien ? `${d.kalorien} kcal` : null },
          { icon: '💓', label: 'Max. Herzfrequenz', value: d.hfMax ? `${d.hfMax} bpm` : null },
          { icon: '⛰️', label: 'Höhenmeter', value: d.hoehenmeter ? `${d.hoehenmeter} m` : null },
          { icon: '🏃', label: 'Running Index', value: d.runningIndex },
          { icon: '👣', label: 'Kadenz', value: d.cadence ? `${d.cadence} spm` : null },
          { icon: '🙂', label: 'Gefühl', value: d.gefuehl },
          { icon: '📊', label: 'Trainingsbelastung', value: d.trainingLoad },
          { icon: '💤', label: 'Erholungszeit', value: d.recoveryTime },
        ].filter(r => r.value)

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '28px 28px 0 0', padding: '24px 24px 44px', width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(255,140,105,0.2)' }}>
              <div style={{ width: 36, height: 4, background: '#F0E8E0', borderRadius: 99, margin: '0 auto 18px' }} />
              <div style={{ fontSize: 11, color: '#C4A882', marginBottom: 2, fontFamily: 'sans-serif' }}>
                {d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 'bold', color: '#3D2B1F', marginBottom: 18 }}>
                {d.planInfo ? `Wo.${d.planInfo.weekN} ${d.planInfo.tag} · ${d.planInfo.einheit}` : (d.status === 'extra' ? 'Extra-Lauf' : 'Lauf')}
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

              {rows.length === 0 ? (
                <p style={{ fontSize: 13, color: '#B8A090', fontFamily: 'sans-serif' }}>Keine weiteren Details vorhanden.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {rows.map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 4px', borderBottom: '1px solid #F5EDE8' }}>
                      <span style={{ fontSize: 13, color: '#8B6B5A', fontFamily: 'sans-serif' }}>{r.icon} {r.label}</span>
                      <span style={{ fontSize: 13, color: '#3D2B1F', fontFamily: 'sans-serif', fontWeight: 'bold' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {d.note && (
                <div style={{ marginTop: 16, padding: '12px 14px', background: '#F5EDE8', borderRadius: 12, fontSize: 12, color: '#8B6B5A', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
                  💬 {d.note}
                </div>
              )}

              {reassigning === d.id ? (
                (() => {
                  const dCandidates = getCandidates(d)
                  const dSelected = reassignSelections[d.id] ?? (dCandidates[0]?.key || '')
                  return (
                    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #F0E8E0' }}>
                      <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6, fontFamily: 'sans-serif' }}>
                        Neuem Plan-Tag zuordnen
                      </label>
                      <select
                        value={dSelected}
                        onChange={e => setReassignSelections(p => ({ ...p, [d.id]: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 13, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer', marginBottom: 10 }}>
                        {dCandidates.length === 0 && <option value="">Kein passender offener Tag gefunden</option>}
                        {dCandidates.map(c => (
                          <option key={c.key} value={c.key}>{candidateLabel(c)}</option>
                        ))}
                        <option value="extra">— Als Extra-Lauf speichern (kein Plan-Tag) —</option>
                      </select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setReassigning(null)}
                          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #F0E8E0', background: 'white', color: '#B8A090', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                          Abbrechen
                        </button>
                        <button onClick={() => reassignRun(d, dSelected)} disabled={!dSelected || saving}
                          style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: !dSelected || saving ? '#F0E8E0' : 'linear-gradient(135deg,#FF8C69,#FFB347)', color: !dSelected || saving ? '#C4A882' : 'white', fontSize: 12, fontWeight: 'bold', cursor: !dSelected || saving ? 'default' : 'pointer', fontFamily: 'sans-serif' }}>
                          {saving ? '⏳ Speichere…' : '✓ Bestätigen'}
                        </button>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <button onClick={() => { setReassigning(d.id); setReassignSelections(p => ({ ...p, [d.id]: undefined })) }}
                  style={{ width: '100%', marginTop: 18, padding: 12, borderRadius: 14, border: '1.5px solid #F0E0D0', background: 'white', color: '#8B7355', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                  Neu zuordnen
                </button>
              )}

              <button onClick={() => { setDetailRun(null); setReassigning(null) }} style={{ width: '100%', marginTop: 10, padding: 14, borderRadius: 16, border: '1.5px solid #F0E8E0', background: 'white', color: '#B8A090', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                Schließen
              </button>
            </div>
          </div>
        )
      })()}
      </div>
    </div>
  )
}
