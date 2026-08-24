import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import MetricDashboard from './MetricDashboard.jsx'
import PhaseTimeline from './PhaseTimeline.jsx'
import PhaseCards from './PhaseCards.jsx'
import SplitAccordion from './SplitAccordion.jsx'
import StoryShareModal from './StoryShareModal.jsx'

const dayKey = (phaseId, weekN, dayIdx) => `${phaseId}_w${weekN}_d${dayIdx}`

const WEEKDAY_ORDER = {
  mo:0, montag:0, monday:0, mon:0,
  di:1, dienstag:1, tuesday:1, tue:1,
  mi:2, mittwoch:2, wednesday:2, wed:2,
  do:3, donnerstag:3, thursday:3, thu:3, thur:3, thurs:3,
  fr:4, freitag:4, friday:4, fri:4,
  sa:5, samstag:5, saturday:5, sat:5,
  so:6, sonntag:6, sunday:6, sun:6,
}

const weekdayIndex = value => WEEKDAY_ORDER[String(value || '').trim().toLowerCase()] ?? 99
const sortedWeekDays = week => (week?.days || [])
  .map((day, originalIndex) => ({ day, originalIndex }))
  .sort((a,b) => weekdayIndex(a.day?.tag) - weekdayIndex(b.day?.tag) || a.originalIndex - b.originalIndex)

const formatCyclingDuration = minutes => {
  const total = Number(minutes)
  if (!Number.isFinite(total) || total <= 0) return null

  if (total < 60) return `${Math.round(total)} Min`

  const hours = Math.floor(total / 60)
  const mins = Math.round(total % 60)

  if (mins === 0) return `${hours}:00 h`
  return `${hours}:${String(mins).padStart(2, '0')} h`
}

const formatMtbLoadGuidance = (guidance, intensity) => {
  const text = String(guidance || '').trim()
  if (!text) return null
  if (!/\bRPE\b/i.test(text)) return text

  const match = text.match(/RPE\s*(\d)\s*[-–]\s*(\d)/i)
  const high = match ? Number(match[2]) : null

  if (high != null && high <= 4) return 'Ruhig und entspannt, ohne Anstrengung'
  if (high != null && high <= 5) return 'Gleichmäßig und kontrolliert, angenehm fordernd'
  if (high != null && high <= 7) return 'Deutlich spürbar, aber kontrolliert – nicht maximal'
  if (high != null) return 'Fordernd, aber sauber kontrollierbar – keine Maximalbelastung'

  const normalized = String(intensity || '').toLowerCase()
  if (normalized.includes('locker')) return 'Ruhig und entspannt'
  if (normalized.includes('zügig') || normalized.includes('moderat')) return 'Deutlich spürbar, aber kontrolliert'
  return 'Kontrollierte Belastung, nicht maximal'
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

// Schätzt die Distanz eines Trainingstages aus dem Freitext in `details`.
// Berücksichtigt:
// - Intervall-Wiederholungen wie "5x1 km" oder "4×800m" (Reps × Distanz)
// - übrige km-Angaben (z.B. "14 km" beim langen Lauf)
// - übrige Minutenangaben (Einlaufen, Auslaufen, lockere Läufe) grob mit 8 min/km
// Klammerinhalte wie "(7:41-8:11 min/km, 116-135 bpm)" werden vorher entfernt,
// da sonst Zahlen aus Pace-/HF-Bereichen fälschlich als Minuten gezählt würden.
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
  while ((m = kmRegex.exec(rest))) {
    km += parseFloat(m[1].replace(',', '.'))
  }
  rest = rest.replace(kmRegex, '')

  const minRegex = /(\d+)\s*min\b/g
  while ((m = minRegex.exec(rest))) {
    km += parseInt(m[1]) / 8
  }

  return km
}

const estimateWeekKm = (week) => {
  let km = 0
  week.days?.forEach(day => {
    if (day.optional) return
    km += estimateDayKm(day.details)
  })
  return km
}

const typeStyle = (einheit, optional, isDone) => {
  if (isDone) return { bg: '#F0FAF4', text: '#5BA88A', border: '#B8E4CC', dot: '#7EC8A4' }
  if (optional) return { bg: '#FFF8F5', text: '#C4A882', border: '#F0E8E0', dot: '#D4C4B8' }
  if (einheit.includes('RENNTAG')) return { bg: '#F5F0FF', text: '#A78BCA', border: '#DDD4F0', dot: '#A78BCA' }
  if (einheit.includes('HM-Pace')) return { bg: '#FDECEA', text: '#B85464', border: '#F5C4CC', dot: '#E07B8A' }
  if (einheit.includes('Tempo') || einheit.includes('Lauf mit HM')) return { bg: '#FFF0E6', text: '#C17A3A', border: '#FFD4B0', dot: '#F4A96A' }
  if (einheit.includes('Intervall')) return { bg: '#FFF8E1', text: '#A07830', border: '#FFE8A0', dot: '#D4A840' }
  if (einheit.includes('Langer')) return { bg: '#FDECEA', text: '#B85464', border: '#F5C4CC', dot: '#E07B8A' }
  return { bg: '#E8F5EF', text: '#3D8B6E', border: '#C0DDD0', dot: '#7EC8A4' }
}

const compressImage = (dataUrl) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => {
    const maxW = 800
    const scale = img.width > maxW ? maxW / img.width : 1
    const canvas = document.createElement('canvas')
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    resolve(canvas.toDataURL('image/jpeg', 0.7))
  }
  img.src = dataUrl
})

const dataUrlToBlob = (dataUrl) => {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new Blob([u8arr], { type: mime })
}

// Findet die Phase und Woche, in der "heute" kalendarisch liegt - liest wie überall
// sonst in der App das ECHTE, angezeigte week.dateRange aus, nicht plan.startDate direkt
// (siehe Polar-Integration: startDate und dateRange können sonst auseinanderdriften).
// Liegt heute vor Planbeginn -> erste Woche. Liegt heute nach Planende -> letzte Woche.
function findCurrentPhaseWeek(plan) {
  if (!plan) return { phaseIdx: 0, weekIdx: 0 }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fallbackYear = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getFullYear() : today.getFullYear()
  const startMonth = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getMonth() : null

  const phases = plan.phases || []
  let firstMatch = null
  let firstWeekStart = null
  let lastMatch = null
  let lastWeekEnd = null

  for (let pi = 0; pi < phases.length; pi++) {
    const weeks = phases[pi].weeks || []
    for (let wi = 0; wi < weeks.length; wi++) {
      const match = weeks[wi].dateRange?.match(/(\d{1,2})\.(\d{1,2})\./)
      if (!match) continue
      const day = parseInt(match[1])
      const month = parseInt(match[2]) - 1
      let year = fallbackYear
      if (startMonth !== null && month < startMonth - 6) year = fallbackYear + 1
      const weekStart = new Date(year, month, day)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      if (!firstMatch) { firstMatch = { phaseIdx: pi, weekIdx: wi }; firstWeekStart = weekStart }
      lastMatch = { phaseIdx: pi, weekIdx: wi }
      lastWeekEnd = weekEnd

      if (today >= weekStart && today <= weekEnd) {
        return { phaseIdx: pi, weekIdx: wi }
      }
    }
  }

  if (firstWeekStart && today < firstWeekStart) return firstMatch
  if (lastMatch) return lastMatch
  return { phaseIdx: 0, weekIdx: 0 }
}

export default function TrainingPlan({ plan, onReset, user }) {
  const [activePhase, setActivePhase] = useState(() => findCurrentPhaseWeek(plan).phaseIdx)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [pauseWeeks, setPauseWeeks] = useState(1)
  const [openWeeks, setOpenWeeks] = useState(() => ({ [findCurrentPhaseWeek(plan).weekIdx]: true }))
  const [openTechniques, setOpenTechniques] = useState({})
  const [openSwimTechniques, setOpenSwimTechniques] = useState({})
  const [done, setDone] = useState({})
  const [logs, setLogs] = useState({})
  const [screenshots, setScreenshots] = useState({})
  const [schuhe, setSchuhe] = useState([])
  const [logModal, setLogModal] = useState(null)
  const [logInput, setLogInput] = useState({ pace: '', km: '', bpm: '', note: '', schuh_id: '', sport_data: {}, hyrox_data: {} })
  const [modalScreenshot, setModalScreenshot] = useState(null)
  const [modalPreview, setModalPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [skipped, setSkipped] = useState({})
  const [skipModal, setSkipModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [routeMapUrl, setRouteMapUrl] = useState(null)
  const [routeMapLoading, setRouteMapLoading] = useState(false)
  const [routeMapError, setRouteMapError] = useState(null)
  const [storyOpen, setStoryOpen] = useState(false)
  const [skipReasonInput, setSkipReasonInput] = useState('')
  const fileRef = useRef()

  const phases = plan.phases || []
  const isHikingPlan = plan?.sport_type === 'hiking' || plan?.plan_type === 'hiking_march'
  const isCyclingPlan = plan?.sport_type === 'cycling' || plan?.plan_type === 'cycling_endurance'
  const isMtbPlan = plan?.sport_type === 'mountain_biking' || plan?.plan_type === 'mtb_endurance'
  const isSwimmingPlan = plan?.sport_type === 'swimming' || plan?.plan_type === 'swimming_endurance'
  const isHyroxPlan = plan?.sport_type === 'hyrox' || plan?.plan_type === 'hyrox'
  const isRunningPlan = !isHikingPlan && !isCyclingPlan && !isMtbPlan && !isSwimmingPlan && !isHyroxPlan && (
    !plan?.sport_type ||
    plan?.sport_type === 'running' ||
    plan?.plan_type === 'running'
  )

  // Einheitliches Hero-Muster für alle Trainingspläne.
  // Neue Sportarten bekommen später nur ihr eigenes Bild in dieser Zuordnung.
  const planHeroImage = isHikingPlan
    ? '/hero/hiking/03.webp'
    : isMtbPlan
      ? '/hero/mtb/03.webp'
      : isSwimmingPlan
        ? '/hero/swimming/03.webp'
        : isCyclingPlan
          ? '/hero/cycling/03.webp'
          : '/hero/running/easy/02.webp'

  const planSportLabel = isHikingPlan
    ? 'Marsch & Wandern'
    : isMtbPlan
      ? 'Mountainbike'
      : isSwimmingPlan
        ? 'Schwimmen'
        : isCyclingPlan
          ? 'Radfahren'
          : isHyroxPlan
            ? 'HYROX'
            : 'Laufen'

  const progressUnitLabel = isRunningPlan ? 'Läufe' : 'Einheiten'

  const handlePausePlan = async () => {
    // Alle Datumsangaben im Plan um pauseWeeks Wochen verschieben
    const shiftDays = pauseWeeks * 7
    const shiftDate = (dateStr) => {
      if (!dateStr) return dateStr
      const d = new Date(dateStr)
      d.setDate(d.getDate() + shiftDays)
      return d.toISOString().split('T')[0]
    }
    const shiftDisplayDate = (str) => {
      if (!str) return str
      // Versuche Datumsangaben im Format "08.06." zu verschieben
      return str.replace(/(\d{2})\.(\d{2})\./g, (match, day, month) => {
        const year = new Date().getFullYear()
        const d = new Date(year, parseInt(month)-1, parseInt(day))
        d.setDate(d.getDate() + shiftDays)
        return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`
      })
    }

    const updatedPlan = JSON.parse(JSON.stringify(plan))
    updatedPlan.startDate = shiftDate(updatedPlan.startDate)

    for (const phase of updatedPlan.phases || []) {
      phase.dateRange = shiftDisplayDate(phase.dateRange)
      for (const week of phase.weeks || []) {
        week.dateRange = shiftDisplayDate(week.dateRange)
      }
    }

    // Speichern
    localStorage.setItem(`runcoaching_plan_${user?.id}`, JSON.stringify(updatedPlan))
    if (user) {
      const { data } = await supabase.from('plans').select('id').eq('user_id', user.id).single()
      if (data) await supabase.from('plans').update({ plan_data: updatedPlan }).eq('id', data.id)
    }

    window.location.reload()
  }

  useEffect(() => {
    const load = async () => {
      // Done-Status aus Supabase laden
      if (user) {
        try {
          const { data: doneData } = await supabase
            .from('training_done')
            .select('day_key, done')
            .eq('user_id', user.id)
          if (doneData && doneData.length > 0) {
            const doneMap = {}
            doneData.forEach(d => { if (d.done) doneMap[d.day_key] = true })
            setDone(doneMap)
          } else {
            try { const d = await window.storage.get('laufplan_done'); if (d) setDone(JSON.parse(d.value)) } catch {}
          }
        } catch {
          try { const d = await window.storage.get('laufplan_done'); if (d) setDone(JSON.parse(d.value)) } catch {}
        }
      } else {
        try { const d = await window.storage.get('laufplan_done'); if (d) setDone(JSON.parse(d.value)) } catch {}
      }

      // Logs aus Supabase laden
      if (user) {
        try {
          const { data: supaLogs } = await supabase.from('logs').select('*').eq('user_id', user.id)
          if (supaLogs && supaLogs.length > 0) {
            const logMap = {}
            supaLogs.forEach(l => {
              logMap[l.day_key] = {
                id: l.id,
                pace: l.pace || '',
                km: l.km || '',
                bpm: l.bpm || '',
                note: l.note || '',
                schuh_id: l.schuh_id || '',
                running_index: l.running_index || '',
                cadence: l.cadence || '',
                uhrzeit: l.uhrzeit || '',
                hf_max: l.hf_max || '',
                hoehenmeter: l.hoehenmeter || '',
                gefuehl: l.gefuehl || '',
                training_load: l.training_load || '',
                recovery_time: l.recovery_time || '',
                polar_exercise_id: l.polar_exercise_id || '',
                route_map_url: l.route_map_url || '',
                kalorien: l.kalorien || '',
                km_splits: parseJsonArray(l.km_splits),
                run_segments: parseJsonArray(l.run_segments),
                sport_data: l.sport_data && typeof l.sport_data === 'object' ? l.sport_data : {},
                hyrox_data: l.hyrox_data && typeof l.hyrox_data === 'object' ? l.hyrox_data : {},
              }
            })
            setLogs(logMap)
            try { await window.storage.set('laufplan_logs', JSON.stringify(logMap)) } catch {}
          } else {
            try { const l = await window.storage.get('laufplan_logs'); if (l) setLogs(JSON.parse(l.value)) } catch {}
          }
        } catch {
          try { const l = await window.storage.get('laufplan_logs'); if (l) setLogs(JSON.parse(l.value)) } catch {}
        }
      } else {
        try { const l = await window.storage.get('laufplan_logs'); if (l) setLogs(JSON.parse(l.value)) } catch {}
      }

      // Screenshots: zuerst aus Supabase, dann localStorage als Fallback
      if (user) {
        try {
          const { data: logScreenshots } = await supabase
            .from('logs')
            .select('day_key, screenshot_url')
            .eq('user_id', user.id)
            .not('screenshot_url', 'is', null)

          if (logScreenshots && logScreenshots.length > 0) {
            const loaded = {}
            logScreenshots.forEach(l => { if (l.screenshot_url) loaded[l.day_key] = l.screenshot_url })
            setScreenshots(loaded)
          } else {
            // Fallback localStorage
            try {
              const skResult = await window.storage.get('laufplan_screenshot_keys')
              if (skResult) {
                const keys = JSON.parse(skResult.value)
                const loaded = {}
                for (const k of keys) {
                  try { const r = await window.storage.get(`screenshot_${k}`); if (r) loaded[k] = r.value } catch {}
                }
                setScreenshots(loaded)
              }
            } catch {}
          }
        } catch {
          try {
            const skResult = await window.storage.get('laufplan_screenshot_keys')
            if (skResult) {
              const keys = JSON.parse(skResult.value)
              const loaded = {}
              for (const k of keys) {
                try { const r = await window.storage.get(`screenshot_${k}`); if (r) loaded[k] = r.value } catch {}
              }
              setScreenshots(loaded)
            }
          } catch {}
        }
      } else {
        try {
          const skResult = await window.storage.get('laufplan_screenshot_keys')
          if (skResult) {
            const keys = JSON.parse(skResult.value)
            const loaded = {}
            for (const k of keys) {
              try { const r = await window.storage.get(`screenshot_${k}`); if (r) loaded[k] = r.value } catch {}
            }
            setScreenshots(loaded)
          }
        } catch {}
      }

      if (user) {
        const { data } = await supabase.from('shoes').select('*').eq('user_id', user.id).order('created_at')
        if (data) setSchuhe(data)

        const { data: skippedData } = await supabase.from('skipped_days').select('day_key, reason').eq('user_id', user.id)
        if (skippedData) {
          const skippedMap = {}
          skippedData.forEach(s => { skippedMap[s.day_key] = { reason: s.reason || '' } })
          setSkipped(skippedMap)
        }
      }
    }
    load()
  }, [user])

  useEffect(() => {
    if (!detailModal) {
      setRouteMapUrl(null)
      setRouteMapError(null)
      return
    }
    const d = logs[detailModal.key] || {}
    if (d.route_map_url) {
      setRouteMapUrl(d.route_map_url)
      return
    }
    if (!d.polar_exercise_id || !user) {
      setRouteMapUrl(null)
      return
    }
    setRouteMapLoading(true)
    setRouteMapError(null)
    fetch('/api/polar/route-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, logId: d.id || null }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.url) setRouteMapUrl(data.url)
        else setRouteMapError(data.error || 'Keine Route verfügbar')
      })
      .catch(() => setRouteMapError('Kartenbild konnte nicht geladen werden'))
      .finally(() => setRouteMapLoading(false))
  }, [detailModal, user])

  const persistDone = async (nd) => {
    setDone(nd)
    try { await window.storage.set('laufplan_done', JSON.stringify(nd)) } catch {}
  }

  const persistLogs = async (nl) => {
    setLogs(nl)
    try { await window.storage.set('laufplan_logs', JSON.stringify(nl)) } catch {}
  }

  const persistScreenshot = async (key, base64OrNull, currentScreenshots) => {
    const next = { ...currentScreenshots }
    if (base64OrNull) {
      next[key] = base64OrNull
      // In Supabase Storage hochladen
      if (user) {
        try {
          const blob = dataUrlToBlob(base64OrNull)
          const path = `${user.id}/${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`
          await supabase.storage.from('screenshots').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
          // URL in logs Tabelle speichern
          const { data: urlData } = supabase.storage.from('screenshots').getPublicUrl(path)
          await supabase.from('logs').upsert({
            user_id: user.id,
            day_key: key,
            screenshot_url: urlData?.publicUrl || null,
          }, { onConflict: 'user_id,day_key' })
        } catch (e) { console.error('Screenshot Upload Fehler:', e) }
      }
      try { await window.storage.set(`screenshot_${key}`, base64OrNull) } catch {}
    } else {
      delete next[key]
      // Aus Supabase Storage löschen
      if (user) {
        try {
          const path = `${user.id}/${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`
          await supabase.storage.from('screenshots').remove([path])
          await supabase.from('logs').upsert({ user_id: user.id, day_key: key, screenshot_url: null }, { onConflict: 'user_id,day_key' })
        } catch (e) { console.error('Screenshot Delete Fehler:', e) }
      }
      try { await window.storage.delete(`screenshot_${key}`) } catch {}
    }
    setScreenshots(next)
    try { await window.storage.set('laufplan_screenshot_keys', JSON.stringify(Object.keys(next))) } catch {}
    return next
  }

  const toggleDone = async (key) => {
    const newValue = !done[key]
    const nd = { ...done, [key]: newValue }
    await persistDone(nd)

    // In Supabase speichern
    if (user) {
      try {
        await supabase.from('training_done').upsert({
          user_id: user.id,
          day_key: key,
          done: newValue,
        }, { onConflict: 'user_id,day_key' })
      } catch (e) { console.error('Done Supabase Fehler:', e) }
    }

    // Falls der Tag zuvor übersprungen war, Skip-Status entfernen (schließen sich gegenseitig aus)
    if (newValue && skipped[key]) {
      await unskipDay(key)
    }
  }

  const openSkip = (key) => {
    setSkipReasonInput(skipped[key]?.reason || '')
    setSkipModal(key)
  }

  const confirmSkip = async () => {
    const key = skipModal
    const reason = skipReasonInput.trim()
    const ns = { ...skipped, [key]: { reason } }
    setSkipped(ns)
    if (user) {
      try {
        await supabase.from('skipped_days').upsert({
          user_id: user.id,
          day_key: key,
          reason: reason || null,
        }, { onConflict: 'user_id,day_key' })
      } catch (e) { console.error('Skip Supabase Fehler:', e) }
    }
    // Falls der Tag zuvor abgehakt war, done zurücksetzen (schließen sich gegenseitig aus)
    if (done[key]) {
      const nd = { ...done, [key]: false }
      await persistDone(nd)
      if (user) {
        try {
          await supabase.from('training_done').upsert({ user_id: user.id, day_key: key, done: false }, { onConflict: 'user_id,day_key' })
        } catch {}
      }
    }
    setSkipModal(null)
    setSkipReasonInput('')
  }

  const unskipDay = async (key) => {
    const ns = { ...skipped }
    delete ns[key]
    setSkipped(ns)
    if (user) {
      try {
        await supabase.from('skipped_days').delete().eq('user_id', user.id).eq('day_key', key)
      } catch (e) { console.error('Unskip Supabase Fehler:', e) }
    }
  }

  const openLog = (key, tag, einheit, day = null) => {
    const ex = logs[key] || {}
    setLogInput({
      pace: ex.pace || '', km: ex.km || '', bpm: ex.bpm || '', note: ex.note || '', schuh_id: ex.schuh_id || '',
      sport_data: ex.sport_data || {}, hyrox_data: ex.hyrox_data || {},
    })
    setModalScreenshot(screenshots[key] || null)
    setModalPreview(screenshots[key] || null)
    setLogModal({ key, tag, einheit, day })
  }

  const setSportField = (field, value) => setLogInput(prev => ({
    ...prev, sport_data: { ...(prev.sport_data || {}), [field]: value }
  }))

  const setHyroxField = (stationId, field, value) => setLogInput(prev => ({
    ...prev, hyrox_data: {
      ...(prev.hyrox_data || {}),
      [stationId]: { ...(prev.hyrox_data?.[stationId] || {}), [field]: value },
    },
  }))

  const HYROX_FIELD_META = {
    weight:{label:'Gewicht gesamt',placeholder:'z. B. 60',unit:'kg'},
    weight_each:{label:'Gewicht je Hand',placeholder:'z. B. 12',unit:'kg'},
    distance:{label:'Distanz',placeholder:'z. B. 50',unit:'m'},
    reps:{label:'Wiederholungen',placeholder:'z. B. 12',unit:''},
    sets:{label:'Sätze / Runden',placeholder:'z. B. 3',unit:''},
    time:{label:'Zeit',placeholder:'z. B. 2:15',unit:''},
    pace:{label:'Pace',placeholder:'z. B. 6:10',unit:'min/km'},
  }

  const manualLogFields = isSwimmingPlan
    ? [
        {key:'swim_distance_m',label:'Distanz',placeholder:'z. B. 1800',unit:'m'},
        {key:'duration',label:'Dauer',placeholder:'z. B. 45:00',unit:''},
        {key:'swim_pace',label:'Ø Tempo',placeholder:'z. B. 2:15',unit:'min/100 m'},
        {key:'bpm',label:'Ø Herzfrequenz',placeholder:'z. B. 128',unit:'bpm',root:true},
        {key:'stroke_rate',label:'Schlagfrequenz',placeholder:'z. B. 28',unit:'/min'},
        {key:'swolf',label:'SWOLF',placeholder:'z. B. 48',unit:''},
      ]
    : isCyclingPlan
      ? [
          {key:'km',label:'Distanz',placeholder:'z. B. 42,5',unit:'km',root:true},
          {key:'duration',label:'Dauer',placeholder:'z. B. 1:45:00',unit:''},
          {key:'avg_speed',label:'Ø Geschwindigkeit',placeholder:'z. B. 24,3',unit:'km/h'},
          {key:'elevation',label:'Höhenmeter',placeholder:'z. B. 420',unit:'m'},
          {key:'bpm',label:'Ø Herzfrequenz',placeholder:'z. B. 138',unit:'bpm',root:true},
          {key:'cadence',label:'Ø Kadenz',placeholder:'z. B. 82',unit:'rpm'},
        ]
      : isMtbPlan
        ? [
            {key:'km',label:'Distanz',placeholder:'z. B. 28,4',unit:'km',root:true},
            {key:'duration',label:'Dauer',placeholder:'z. B. 2:10:00',unit:''},
            {key:'elevation',label:'Höhenmeter',placeholder:'z. B. 690',unit:'m'},
            {key:'bpm',label:'Ø Herzfrequenz',placeholder:'z. B. 142',unit:'bpm',root:true},
            {key:'avg_speed',label:'Ø Geschwindigkeit',placeholder:'z. B. 16,8',unit:'km/h'},
            {key:'cadence',label:'Ø Kadenz',placeholder:'optional',unit:'rpm'},
          ]
        : isHikingPlan
          ? [
              {key:'km',label:'Distanz',placeholder:'z. B. 12,5',unit:'km',root:true},
              {key:'duration',label:'Dauer',placeholder:'z. B. 2:35:00',unit:''},
              {key:'elevation',label:'Höhenmeter',placeholder:'z. B. 280',unit:'m'},
              {key:'pace',label:'Ø Pace',placeholder:'optional',unit:'min/km',root:true},
              {key:'bpm',label:'Ø Herzfrequenz',placeholder:'optional',unit:'bpm',root:true},
              {key:'backpack_kg',label:'Rucksackgewicht',placeholder:'optional',unit:'kg'},
            ]
          : [
              {key:'pace',label:'Ø Pace',placeholder:'6:19',unit:'min/km',root:true},
              {key:'km',label:'Distanz',placeholder:'14,2',unit:'km',root:true},
              {key:'bpm',label:'Ø Herzfrequenz',placeholder:'158',unit:'bpm',root:true},
            ]

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result)
      setModalPreview(compressed)
      setModalScreenshot(compressed)
    }
    reader.readAsDataURL(file)
  }

  const analyzeScreenshot = async () => {
    if (!modalScreenshot) return
    setAnalyzing(true)
    try {
      const base64Data = modalScreenshot.split(',')[1]
      const mediaType = modalScreenshot.split(';')[0].split(':')[1]
      const response = await fetch('/api/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mediaType })
      })
      const data = await response.json()
      if (data.result) {
        setLogInput(prev => ({
          ...prev,
          pace: data.result.pace || prev.pace,
          km: data.result.km || prev.km,
          bpm: data.result.bpm || prev.bpm,
          note: data.result.note || prev.note,
        }))
      }
    } catch (err) { console.error('Analyse fehlgeschlagen', err) }
    setAnalyzing(false)
  }

  const saveLog = async () => {
    const key = logModal.key
    const oldLog = logs[key]
    const nl = { ...logs, [key]: { ...logInput } }
    await persistLogs(nl)
    await persistScreenshot(key, modalScreenshot, screenshots)

    // Done setzen
    const nd = { ...done, [key]: true }
    await persistDone(nd)
    if (user) {
      try {
        await supabase.from('training_done').upsert({ user_id: user.id, day_key: key, done: true }, { onConflict: 'user_id,day_key' })
      } catch {}
    }

    // In Supabase speichern (inkl. schuh_id)
    if (user) {
      try {
        await supabase.from('logs').upsert({
          user_id: user.id,
          day_key: key,
          pace: logInput.pace || null,
          km: logInput.km || null,
          bpm: logInput.bpm || null,
          note: logInput.note || null,
          schuh_id: logInput.schuh_id || null,
          sport_data: logInput.sport_data || {},
          hyrox_data: isHyroxPlan ? (logInput.hyrox_data || {}) : {},
        }, { onConflict: 'user_id,day_key' })
      } catch (e) { console.error('Log Supabase Fehler:', e) }
    }

    // Schuh-km updaten
    if (user && logInput.schuh_id && logInput.km) {
      const neueKm = parseFloat(logInput.km.replace(',', '.')) || 0
      const alteKm = oldLog?.schuh_id === logInput.schuh_id
        ? parseFloat(oldLog.km?.replace(',', '.')) || 0
        : 0

      if (oldLog?.schuh_id && oldLog.schuh_id !== logInput.schuh_id) {
        const alteSchuhKm = parseFloat(oldLog.km?.replace(',', '.')) || 0
        const { data: alterSchuh } = await supabase.from('shoes').select('start_km').eq('id', oldLog.schuh_id).single()
        if (alterSchuh) {
          await supabase.from('shoes').update({ start_km: Math.max(0, (alterSchuh.start_km || 0) - alteSchuhKm) }).eq('id', oldLog.schuh_id)
        }
      }

      const diff = neueKm - alteKm
      const { data: schuh } = await supabase.from('shoes').select('start_km').eq('id', logInput.schuh_id).single()
      if (schuh) {
        const updated = Math.max(0, (schuh.start_km || 0) + diff)
        await supabase.from('shoes').update({ start_km: updated }).eq('id', logInput.schuh_id)
        setSchuhe(prev => prev.map(s => s.id === logInput.schuh_id ? { ...s, start_km: updated } : s))
      }
    }

    setLogModal(null); setModalScreenshot(null); setModalPreview(null)
  }

  const deleteLog = async (key) => {
    // Aus Supabase löschen
    if (user) {
      try {
        await supabase.from('logs').delete().eq('user_id', user.id).eq('day_key', key)
        await supabase.from('training_done').upsert({ user_id: user.id, day_key: key, done: false }, { onConflict: 'user_id,day_key' })
        // Screenshot-Datei direkt aus dem Storage entfernen - OHNE persistScreenshot()/logs.upsert()
        // zu nutzen, da die logs-Zeile gerade gelöscht wurde. Ein Upsert hier würde sonst
        // (ohne passende Konfliktzeile) eine neue, leere Ersatz-Zeile anlegen.
        try {
          const path = `${user.id}/${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`
          await supabase.storage.from('screenshots').remove([path])
        } catch (e) { console.error('Screenshot-Datei löschen fehlgeschlagen:', e) }
      } catch (e) { console.error('Log delete Fehler:', e) }
    }

    const oldLog = logs[key]

    // Schuh-km zurückrechnen
    if (user && oldLog?.schuh_id && oldLog?.km) {
      const alteKm = parseFloat(oldLog.km.replace(',', '.')) || 0
      const { data: schuh } = await supabase.from('shoes').select('start_km').eq('id', oldLog.schuh_id).single()
      if (schuh) {
        const updated = Math.max(0, (schuh.start_km || 0) - alteKm)
        await supabase.from('shoes').update({ start_km: updated }).eq('id', oldLog.schuh_id)
        setSchuhe(prev => prev.map(s => s.id === oldLog.schuh_id ? { ...s, start_km: updated } : s))
      }
    }

    const nl = { ...logs }; delete nl[key]
    await persistLogs(nl)
    // Lokalen Screenshot-State bereinigen, ohne persistScreenshot() (siehe oben)
    const nextScreenshots = { ...screenshots }
    delete nextScreenshots[key]
    setScreenshots(nextScreenshots)
    try { await window.storage.delete(`screenshot_${key}`) } catch {}
    try { await window.storage.set('laufplan_screenshot_keys', JSON.stringify(Object.keys(nextScreenshots))) } catch {}
    const nd = { ...done, [key]: false }
    await persistDone(nd)
    setLogModal(null); setModalScreenshot(null); setModalPreview(null)
  }

  const phase = phases[activePhase] || {}
  const totalDays = phases.flatMap(p => (p.weeks || []).flatMap(w => w.days.filter(d => !d.optional))).length
  const doneDays = Object.values(done).filter(Boolean).length
  const progress = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0
  const phaseTabColors = ['#7EC8A4', '#F4A96A', '#E07B8A', '#A78BCA']

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif", background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', minHeight: '100vh' }}>

      {/* Log Modal */}
      {logModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '28px 28px 0 0', padding: '20px 20px 44px', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(255,140,105,0.2)' }}>
            <div style={{ width: 36, height: 4, background: '#F0E8E0', borderRadius: 99, margin: '0 auto 18px' }} />
            <div style={{ fontSize: 11, color: '#C4A882', marginBottom: 2, fontFamily: 'sans-serif' }}>{logModal.tag}</div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#3D2B1F', marginBottom: 18 }}>{logModal.einheit}</div>

            {/* Screenshot */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8, fontFamily: 'sans-serif' }}>Screenshot</label>
              {modalPreview ? (
                <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #F0E8E0' }}>
                  <img src={modalPreview} alt="Screenshot" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                    <button onClick={analyzeScreenshot} disabled={analyzing} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: analyzing ? '#F0E8E0' : '#5BA88A', color: analyzing ? '#C4A882' : 'white', fontSize: 12, fontWeight: 'bold', cursor: analyzing ? 'default' : 'pointer', fontFamily: 'sans-serif' }}>
                      {analyzing ? '⏳ Analysiere…' : '✨ Auto-ausfüllen'}
                    </button>
                    <button onClick={() => { setModalScreenshot(null); setModalPreview(null) }} style={{ padding: '6px 10px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.9)', color: '#B8A090', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileRef.current.click()} style={{ width: '100%', padding: '18px', borderRadius: 16, border: '2px dashed #F0E0D0', background: '#FFF8F5', color: '#C4A882', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontFamily: 'sans-serif' }}>
                  <span style={{ fontSize: 28 }}>📸</span>
                  <span>Screenshot hochladen</span>
                  <span style={{ fontSize: 11, color: '#D4C4B8', fontWeight: 'normal' }}>Polar · Garmin · Strava</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>

            {isHyroxPlan && logModal.day?.hyrox_log?.stations?.length > 0 ? (
              <div style={{display:'grid',gap:10,marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:900,color:'#8B6B5A',fontFamily:'sans-serif'}}>HYROX · Einheit dokumentieren</div>
                {logModal.day.hyrox_log.stations.map(station => {
                  const values = logInput.hyrox_data?.[station.id] || {}
                  const choices = logModal.day.hyrox_log.choices || ['Zu leicht','Leicht','Passend','Schwer','Zu schwer']
                  const techniqueChoices = logModal.day.hyrox_log.techniqueChoices || ['Sicher','Etwas unsicher','Technik schwierig']
                  return (
                    <div key={station.id} style={{padding:12,borderRadius:14,background:'#FFF8F5',border:'1.5px solid #F0E8E0'}}>
                      <div style={{fontWeight:900,fontSize:13,color:'#4E6F62',marginBottom:9}}>{station.label}</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
                        {(station.fields || []).filter(field => HYROX_FIELD_META[field]).map(field => {
                          const meta = HYROX_FIELD_META[field]
                          return <label key={field} style={{fontFamily:'sans-serif',fontSize:9.5,fontWeight:800,color:'#A88F7E'}}>{meta.label}
                            <div style={{position:'relative',marginTop:4}}>
                              <input value={values[field] || ''} onChange={e=>setHyroxField(station.id,field,e.target.value)} placeholder={meta.placeholder}
                                style={{width:'100%',boxSizing:'border-box',padding:'9px 10px',paddingRight:meta.unit?48:10,borderRadius:10,border:'1px solid #EADDD5',background:'white',fontSize:12}} />
                              {meta.unit && <span style={{position:'absolute',right:9,top:10,fontSize:9,color:'#B8A090'}}>{meta.unit}</span>}
                            </div>
                          </label>
                        })}
                      </div>
                      {(station.fields || []).includes('effort') && <div style={{marginTop:9}}>
                        <div style={{fontFamily:'sans-serif',fontSize:9.5,fontWeight:800,color:'#A88F7E',marginBottom:5}}>Wie war die Belastung?</div>
                        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{choices.map(choice=><button type="button" key={choice} onClick={()=>setHyroxField(station.id,'effort',choice)} style={{border:`1px solid ${values.effort===choice?'#FF8C69':'#EADDD5'}`,background:values.effort===choice?'#FFF0E8':'white',color:values.effort===choice?'#C65E43':'#8B776A',borderRadius:99,padding:'5px 8px',fontSize:9.5,fontWeight:800}}>{choice}</button>)}</div>
                      </div>}
                      {(station.fields || []).includes('technique') && <div style={{marginTop:8}}>
                        <div style={{fontFamily:'sans-serif',fontSize:9.5,fontWeight:800,color:'#A88F7E',marginBottom:5}}>Wie sauber war die Technik?</div>
                        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{techniqueChoices.map(choice=><button type="button" key={choice} onClick={()=>setHyroxField(station.id,'technique',choice)} style={{border:`1px solid ${values.technique===choice?'#5BA88A':'#EADDD5'}`,background:values.technique===choice?'#EEF8F3':'white',color:values.technique===choice?'#3D8B6E':'#8B776A',borderRadius:99,padding:'5px 8px',fontSize:9.5,fontWeight:800}}>{choice}</button>)}</div>
                      </div>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <>
                <div style={{fontSize:11,fontWeight:900,color:'#8B6B5A',fontFamily:'sans-serif',marginBottom:10}}>
                  {isSwimmingPlan ? 'Schwimmen dokumentieren' : isCyclingPlan ? 'Radtour dokumentieren' : isMtbPlan ? 'MTB-Einheit dokumentieren' : isHikingPlan ? 'Marsch / Wanderung dokumentieren' : isHyroxPlan ? 'HYROX-Laufeinheit dokumentieren' : 'Lauf dokumentieren'}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginBottom:10}}>
                  {manualLogFields.map(field => {
                    const value = field.root ? (logInput[field.key] || '') : (logInput.sport_data?.[field.key] || '')
                    const change = value => field.root
                      ? setLogInput(prev => ({...prev,[field.key]:value}))
                      : setSportField(field.key,value)
                    return <label key={field.key} style={{fontSize:10,fontWeight:'bold',color:'#B8A090',textTransform:'uppercase',letterSpacing:.6,fontFamily:'sans-serif'}}>
                      {field.label}
                      <div style={{position:'relative',marginTop:4}}>
                        <input value={value} onChange={e=>change(e.target.value)} placeholder={field.placeholder}
                          style={{width:'100%',padding:'10px 12px',paddingRight:field.unit?58:12,borderRadius:12,border:'1.5px solid #F0E8E0',fontSize:14,color:'#3D2B1F',outline:'none',boxSizing:'border-box',background:'#FFF8F5',fontFamily:'sans-serif'}} />
                        {field.unit && <span style={{position:'absolute',right:10,top:11,fontSize:9,color:'#B8A090',fontFamily:'sans-serif'}}>{field.unit}</span>}
                      </div>
                    </label>
                  })}
                </div>

                {schuhe.length > 0 && (isRunningPlan || (isHyroxPlan && /run|lauf/i.test(logModal.einheit || ''))) && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>Laufschuhe</label>
                    <select value={logInput.schuh_id} onChange={e => setLogInput(p => ({ ...p, schuh_id: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 14, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer' }}>
                      <option value="">Kein Schuh ausgewählt</option>
                      {schuhe.map(s => <option key={s.id} value={s.id}>{s.marke} {s.modell} ({Math.round(s.start_km || 0)} km)</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>Notiz</label>
              <textarea value={logInput.note} onChange={e => setLogInput(p => ({ ...p, note: e.target.value }))} placeholder="Wie hat es sich angefühlt?" rows={2}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 14, color: '#3D2B1F', resize: 'none', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setLogModal(null); setModalScreenshot(null); setModalPreview(null) }} style={{ flex: 1, padding: 14, borderRadius: 16, border: '1.5px solid #F0E8E0', background: 'white', color: '#B8A090', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>Abbrechen</button>
              {logs[logModal.key] && (
                <button onClick={() => deleteLog(logModal.key)} style={{ padding: '14px 16px', borderRadius: 16, border: '1.5px solid #F5C4CC', background: '#FDECEA', color: '#B85464', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>🗑</button>
              )}
              <button onClick={saveLog} style={{ flex: 2, padding: 14, borderRadius: 16, border: 'none', background: '#5BA88A', color: 'white', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                Speichern ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip Modal */}
      {skipModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '28px 28px 0 0', padding: '24px 24px 44px', width: '100%', maxWidth: 520, boxShadow: '0 -8px 40px rgba(255,140,105,0.2)' }}>
            <div style={{ width: 36, height: 4, background: '#F0E8E0', borderRadius: 99, margin: '0 auto 18px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 'bold', color: '#3D2B1F', marginBottom: 8 }}>⏭ Einheit überspringen</h3>
            <p style={{ fontSize: 13, color: '#8B6B5A', fontFamily: 'sans-serif', marginBottom: 16, lineHeight: 1.6 }}>
              Diese Einheit wird als bewusst ausgelassen markiert. Deine Wochenanalyse wartet dann nicht mehr darauf.
            </p>
            <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>
              Grund <span style={{ fontWeight: 'normal', color: '#D4C4B8', textTransform: 'none' }}>optional</span>
            </label>
            <textarea value={skipReasonInput} onChange={e => setSkipReasonInput(e.target.value)} placeholder="z.B. Erkältung, keine Zeit, Verletzung…" rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 14, color: '#3D2B1F', resize: 'none', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', marginBottom: 12 }} />

            {/(krank|erkält|erkalt|schnupfen|fieber|husten|grippe|infekt|hals)/i.test(skipReasonInput) && (
              <div style={{ padding: '10px 14px', background: '#F0FAF4', border: '1px solid #B8E4CC', borderRadius: 12, fontSize: 12, color: '#5BA88A', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 12 }}>
                💡 <strong>Faustregel bei Erkältung:</strong> Nur Symptome oberhalb des Halses (Schnupfen, leichtes Halskratzen)? Lockeres Laufen ist meist okay – bei Verschlechterung sofort abbrechen. Symptome unterhalb des Halses (Fieber, Gliederschmerzen, Husten, Brustschmerzen)? Dann lieber ganz pausieren, bis es abklingt.
              </div>
            )}

            {/(verletz|schmerz|zerrung|umgeknickt|knie|sehne|muskel|zerrissen|gerissen)/i.test(skipReasonInput) && (
              <div style={{ padding: '10px 14px', background: '#FFF5EE', border: '1px solid #FFE0CC', borderRadius: 12, fontSize: 12, color: '#C17A3A', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 12 }}>
                💡 <strong>Bei einer Verletzung:</strong> Falls schmerzfrei möglich, kann Alternativtraining die Fitness erhalten, ohne die Stelle zu belasten – z.B. Schwimmen, Radfahren, Aquajogging (kein Aufprall). Bei akuten oder starken Schmerzen hat Ruhe und ggf. eine ärztliche Abklärung aber immer Vorrang.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setSkipModal(null); setSkipReasonInput('') }} style={{ flex: 1, padding: 14, borderRadius: 16, border: '1.5px solid #F0E8E0', background: 'white', color: '#B8A090', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>Abbrechen</button>
              <button onClick={confirmSkip} style={{ flex: 2, padding: 14, borderRadius: 16, border: 'none', background: '#A89A88', color: 'white', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                ⏭ Überspringen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (() => {
        const d = logs[detailModal.key] || {}
        const loggedShoe = d.schuh_id
          ? schuhe.find(shoe => shoe.id === d.schuh_id)
          : null

        const shoeName = loggedShoe
          ? `${loggedShoe.marke} ${loggedShoe.modell}`
          : null

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{
              background: 'white',
              borderRadius: '28px 28px 0 0',
              padding: '24px 24px max(118px, calc(env(safe-area-inset-bottom) + 104px))',
              width: '100%',
              maxWidth: 520,
              maxHeight: 'calc(100dvh - 72px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              boxShadow: '0 -8px 40px rgba(255,140,105,0.2)',
              boxSizing: 'border-box',
            }}>
              <div style={{ width: 36, height: 4, background: '#F0E8E0', borderRadius: 99, margin: '0 auto 18px' }} />
              <div style={{ fontSize: 11, color: '#C4A882', marginBottom: 2, fontFamily: 'sans-serif' }}>{detailModal.tag}</div>
              <h3 style={{ fontSize: 18, fontWeight: 'bold', color: '#3D2B1F', marginBottom: 18 }}>{detailModal.einheit}</h3>

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

              <MetricDashboard
                time={d.uhrzeit}
                distance={d.km}
                pace={d.pace}
                averageHeartRate={d.bpm}
                calories={d.kalorien ? `${d.kalorien} kcal` : null}
                maxHeartRate={d.hf_max ? `${d.hf_max} bpm` : null}
                elevation={d.hoehenmeter ? `${d.hoehenmeter} m` : null}
                cadence={d.cadence ? `${d.cadence} spm` : null}
                runningIndex={d.running_index}
                shoe={shoeName}
              />

              <PhaseTimeline phases={d.run_segments} />

              <PhaseCards phases={d.run_segments} />

              <SplitAccordion
                splits={d.km_splits}
                defaultOpen={!Array.isArray(d.run_segments) || d.run_segments.length === 0}
              />

              {d.note && (
                <div style={{ marginTop: 16, padding: '12px 14px', background: '#F5EDE8', borderRadius: 12, fontSize: 12, color: '#8B6B5A', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
                  💬 {d.note}
                </div>
              )}

              <div
                style={{
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 5,
                  display: 'flex',
                  gap: 8,
                  margin: '20px -24px -90px',
                  padding: '12px 24px max(16px, env(safe-area-inset-bottom))',
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.82), white 24%)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderTop: '1px solid #F5EDE8',
                }}
              >
                <button
                  onClick={() => {
                    setDetailModal(null)
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
                    flex: 1.4,
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
                  📸 Story erstellen
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      <StoryShareModal
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        title={detailModal ? `${detailModal.tag} · ${detailModal.einheit}` : 'Laufeinheit'}
        date={null}
        routeMapUrl={routeMapUrl}
        distance={detailModal ? logs[detailModal.key]?.km : null}
        pace={detailModal ? logs[detailModal.key]?.pace : null}
        heartRate={detailModal ? logs[detailModal.key]?.bpm : null}
        calories={detailModal && logs[detailModal.key]?.kalorien ? `${logs[detailModal.key].kalorien} kcal` : null}
        phases={detailModal ? logs[detailModal.key]?.run_segments || [] : []}
        runningIndex={detailModal ? logs[detailModal.key]?.running_index : null}
        elevation={detailModal && logs[detailModal.key]?.hoehenmeter ? `${logs[detailModal.key].hoehenmeter} m` : null}
        logoSrc="/route-icon.png"
      />

      {/* Einheitlicher Trainingsplan-Hero */}
      <div style={{ position:'relative', overflow:'hidden', minHeight:300, boxShadow:'0 8px 32px rgba(55,45,35,.18)' }}>
        <div
          aria-hidden="true"
          style={{
            position:'absolute',
            inset:0,
            backgroundImage:`url("${planHeroImage}")`,
            backgroundSize:'cover',
            backgroundPosition: isRunningPlan ? 'center 56%' : 'center 52%',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position:'absolute',
            inset:0,
            background:'linear-gradient(90deg,rgba(20,24,18,.80) 0%,rgba(20,24,18,.58) 48%,rgba(20,24,18,.24) 100%)',
          }}
        />

        <div style={{position:'relative',zIndex:2,maxWidth:580,margin:'0 auto',padding:'42px 20px 30px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <div
              style={{
                width:46,
                height:46,
                borderRadius:'50%',
                background:'rgba(255,248,240,.94)',
                border:'3px solid rgba(255,255,255,.7)',
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                boxShadow:'0 5px 18px rgba(0,0,0,.18)',
              }}
            >
              <img src="/route-icon.png" alt="" style={{width:31,height:31,borderRadius:'50%'}} />
            </div>
            <div
              style={{
                fontFamily:'sans-serif',
                fontSize:11,
                fontWeight:900,
                letterSpacing:1.8,
                color:'rgba(255,255,255,.9)',
                textTransform:'uppercase',
              }}
            >
              Dein Trainingsplan
            </div>
          </div>

          <p
            style={{
              color:'rgba(255,255,255,.82)',
              fontSize:11,
              letterSpacing:3,
              textTransform:'uppercase',
              margin:'0 0 5px',
              fontFamily:'sans-serif',
            }}
          >
            {plan.goal ? `Ziel: ${plan.goal}` : planSportLabel}
          </p>

          <h1
            style={{
              color:'white',
              fontSize:30,
              lineHeight:1.08,
              fontWeight:'bold',
              margin:'0 0 4px',
              textShadow:'0 2px 12px rgba(0,0,0,.28)',
            }}
          >
            {plan.title || `${planSportLabel}-Trainingsplan`}
          </h1>

          {plan.name && !String(plan.title || '').toLowerCase().includes(String(plan.name).toLowerCase()) && (
            <p
              style={{
                color:'rgba(255,255,255,.84)',
                fontSize:12,
                margin:'0 0 20px',
                fontFamily:'sans-serif',
              }}
            >
              Für {plan.name}
            </p>
          )}

          <div
            style={{
              background:'rgba(255,255,255,.16)',
              border:'1px solid rgba(255,255,255,.22)',
              borderRadius:18,
              padding:'14px 18px',
              backdropFilter:'blur(10px)',
            }}
          >
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{color:'white',fontSize:13,fontFamily:'sans-serif'}}>Fortschritt</span>
              <span style={{color:'white',fontWeight:'bold',fontSize:20}}>{progress}%</span>
            </div>
            <div style={{background:'rgba(255,255,255,.3)',borderRadius:8,height:8,overflow:'hidden'}}>
              <div
                style={{
                  height:'100%',
                  width:`${progress}%`,
                  background:'white',
                  borderRadius:8,
                  transition:'width .5s ease',
                }}
              />
            </div>
            <p
              style={{
                color:'rgba(255,255,255,.82)',
                fontSize:11,
                margin:'6px 0 0',
                fontFamily:'sans-serif',
              }}
            >
              {doneDays}/{totalDays} {progressUnitLabel} erledigt
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: '0 auto' }}>
        {/* Phase Tabs */}
        <div style={{ padding: '20px 16px 8px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
            {phases.map((p, i) => {
              const color = p.accent || phaseTabColors[i] || '#FF8C69'
              return (
                <button key={p.id} onClick={() => { setActivePhase(i); setOpenWeeks({ 0: true }) }}
                  style={{ background: activePhase === i ? color : 'white', border: `2px solid ${activePhase === i ? color : '#F0E8E0'}`, borderRadius: 16, padding: '10px 16px', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: activePhase === i ? `0 4px 16px ${color}60` : '0 2px 8px rgba(0,0,0,0.06)', transform: activePhase === i ? 'translateY(-2px)' : 'none' }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{p.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 'bold', color: activePhase === i ? 'white' : '#8B7355', fontFamily: 'sans-serif', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{p.label}</div>
                  <div style={{ fontSize: 9, color: activePhase === i ? 'rgba(255,255,255,0.8)' : '#B8A898', fontFamily: 'sans-serif' }}>{p.sub}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Phase Info */}
        <div style={{ margin: '0 16px 16px', background: '#FFF5EE', borderRadius: 18, padding: '16px 18px', border: '1px solid #FFE0CC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#FFB347,#FF8C69)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{phase.icon}</div>
            <div>
              <div style={{ fontWeight: 'bold', color: '#5C3D2E', fontSize: 15 }}>{phase.label}</div>
              <div style={{ color: '#8B6B5A', fontSize: 12, fontFamily: 'sans-serif', fontStyle: 'italic', marginTop: 2 }}>{phase.description}</div>
            </div>
          </div>
        </div>

        {/* Wochen */}
        <div style={{ padding: '0 16px' }}>
          {(phase.weeks || []).map((week, wi) => {
            const weekDone = week.days.filter((d, di) => !d.optional && done[dayKey(phase.id, week.n, di)]).length
            const weekTotal = week.days.filter(d => !d.optional).length
            const allDone = weekDone === weekTotal && weekTotal > 0
            const isOpen = !!openWeeks[wi]
            const phaseColor = phase.accent || phaseTabColors[activePhase] || '#FF8C69'
            const weekKm = (isCyclingPlan || isMtbPlan || isSwimmingPlan || isHyroxPlan) ? 0 : estimateWeekKm(week)
            const weekMinutes = isHyroxPlan ? week.days.filter(d => !d.optional).reduce((sum,d) => sum + (Number(d.durationMinutes) || 0), 0) : 0
            const weekRunKm = isHyroxPlan ? week.days.filter(d => !d.optional).reduce((sum,d) => sum + (/run|lauf/i.test(`${d.einheit || ''} ${d.details || ''}`) ? estimateDayKm(d.details) : 0), 0) : 0

            return (
              <div key={week.n} style={{ background: 'white', borderRadius: 20, marginBottom: 12, overflow: 'hidden', boxShadow: isOpen ? '0 8px 32px rgba(255,140,105,0.15)' : '0 2px 12px rgba(0,0,0,0.06)', border: isOpen ? '2px solid #FFD4C0' : '2px solid transparent', transition: 'all 0.3s ease' }}>
                <button onClick={() => setOpenWeeks(p => ({ ...p, [wi]: !p[wi] }))}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: allDone ? '#5BA88A' : isOpen ? `linear-gradient(135deg,${phaseColor},#FFB347)` : '#F5EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: allDone || isOpen ? 'white' : '#C4A882', fontWeight: 'bold', fontSize: 14, flexShrink: 0, transition: 'all 0.3s ease' }}>
                    {allDone ? '✓' : week.n}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'bold', color: '#3D2B1F', fontSize: 15 }}>Woche {week.n}</span>
                      {week.regen && <span style={{ fontSize: 10, color: '#B8A090', background: '#F5EDE8', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>Regeneration</span>}
                      {week.race && <span style={{ fontSize: 10, color: '#A78BCA', background: '#F5F0FF', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>Rennwoche 🏁</span>}
                      {weekKm > 0 && <span style={{ fontSize: 10, color: '#FF8C69', background: '#FFF5EE', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif', border: '1px solid #FFE0CC' }}>ca. {Math.round(weekKm)} km</span>}
                      {isHyroxPlan && <span style={{ fontSize: 10, color: '#FF8C69', background: '#FFF5EE', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif', border: '1px solid #FFE0CC' }}>{weekTotal} Einheiten · ~{weekMinutes} Min{weekRunKm > 0 ? ` · ~${Math.round(weekRunKm)} km Laufanteil` : ''}</span>}
                    </div>
                    <div style={{ color: '#B8A090', fontSize: 11, fontFamily: 'sans-serif', marginTop: 2 }}>{week.dateRange} · {weekDone}/{weekTotal} erledigt</div>
                  </div>
                  <span style={{ color: '#C4A882', fontSize: 16, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>▾</span>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 16px 16px' }}>
                    {sortedWeekDays(week).map(({ day, originalIndex: di }) => {
                      const key = dayKey(phase.id, week.n, di)
                      const isDone = !!done[key]
                      const hasLog = !!logs[key]
                      const hasShot = !!screenshots[key]
                      const isSkipped = !isDone && !!skipped[key]
                      const s = isSkipped
                        ? { bg: '#F5F0EA', text: '#A89A88', border: '#E0D8CC', dot: '#C4BCAE' }
                        : typeStyle(day.einheit, day.optional, isDone)
                      const loggedSchuh = hasLog && logs[key]?.schuh_id ? schuhe.find(sh => sh.id === logs[key].schuh_id) : null
                      const displayLoadGuidance = isMtbPlan
                        ? formatMtbLoadGuidance(day.loadGuidance, day.intensity)
                        : day.loadGuidance
                      const techniqueOpen = Boolean(openTechniques[key])

                      return (
                        <div key={di} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, marginBottom: 8, background: s.bg, border: `1px solid ${isDone ? '#B8E4CC' : isSkipped ? '#E0D8CC' : 'transparent'}`, transition: 'all 0.2s ease', opacity: day.optional ? 0.7 : isSkipped ? 0.85 : 1 }}>
                          {!day.optional ? (
                            <button onClick={() => toggleDone(key)} style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${isDone ? '#5BA88A' : isSkipped ? '#C4BCAE' : '#D4C4B8'}`, background: isDone ? '#5BA88A' : isSkipped ? '#C4BCAE' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, flexShrink: 0, transition: 'all 0.2s ease' }}>
                              {isDone ? '✓' : isSkipped ? '⏭' : ''}
                            </button>
                          ) : <div style={{ width: 24, flexShrink: 0 }} />}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', fontFamily: 'sans-serif', minWidth: 20 }}>{day.tag}</span>
                              <span style={{ fontSize: 13, fontWeight: 'bold', color: isDone ? '#5BA88A' : isSkipped ? '#A89A88' : s.text, textDecoration: isDone || isSkipped ? 'line-through' : 'none' }}>
                                {day.optional ? 'Optional · ' : ''}{day.einheit}
                              </span>
                              {hasLog && <span style={{ fontSize: 9, background: '#E8F5EF', color: '#5BA88A', padding: '2px 7px', borderRadius: 99, fontWeight: 'bold', border: '1px solid #B8E4CC', fontFamily: 'sans-serif' }}>📊 Geloggt</span>}
                              {isSkipped && <span style={{ fontSize: 9, background: '#EFE9E1', color: '#A89A88', padding: '2px 7px', borderRadius: 99, fontWeight: 'bold', border: '1px solid #E0D8CC', fontFamily: 'sans-serif' }}>⏭ Übersprungen</span>}
                              {day.adjusted && <span style={{ fontSize: 9, background: '#FFF5EE', color: '#FF8C69', padding: '2px 7px', borderRadius: 99, fontWeight: 'bold', border: '1px solid #FFE0CC', fontFamily: 'sans-serif' }}>✏️ Angepasst</span>}
                            </div>
                            <div style={{ color: isDone ? '#A8D8C0' : isSkipped ? '#B8AC9E' : '#B8A090', fontSize: 11, fontFamily: 'sans-serif', marginTop: 3, lineHeight: 1.5 }}>{day.details}</div>
                            {isHikingPlan && !day.strengthPrescription && (day.intensity || day.paceGuidance) && (
                              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:7}}>
                                {day.intensity && <span style={{fontSize:9.5,background:'#F3F8F5',color:'#4F806B',padding:'3px 8px',borderRadius:99,fontWeight:800,fontFamily:'sans-serif',border:'1px solid #D7E8DF'}}>Tempo: {day.intensity}</span>}
                                {day.paceGuidance && <span style={{fontSize:9.5,background:'#FFF7EF',color:'#A46C43',padding:'3px 8px',borderRadius:99,fontWeight:800,fontFamily:'sans-serif',border:'1px solid #F1DDCC'}}>Orientierung: {day.paceGuidance}</span>}
                              </div>
                            )}
                            {isHikingPlan && day.nutritionTip && (
                              <div style={{marginTop:8,padding:'9px 10px',borderRadius:11,background:'#FFF9E9',border:'1px solid #F0E2B9',fontSize:10.5,lineHeight:1.45,color:'#806A3D',fontFamily:'sans-serif'}}>
                                🍌 <strong>Verpflegung testen:</strong> {day.nutritionTip}
                              </div>
                            )}
                            {isHikingPlan && day.strengthPrescription && (
                              <div style={{marginTop:8,padding:'9px 10px',borderRadius:11,background:'#F5F1FA',border:'1px solid #E2D8EC',fontSize:10.5,lineHeight:1.5,color:'#705E7D',fontFamily:'sans-serif',whiteSpace:'pre-line'}}>
                                💪 <strong>Kraft & Stabilität:</strong> {day.strengthPrescription}
                              </div>
                            )}
                            {(isCyclingPlan || isMtbPlan) && !day.strengthPrescription && (
                              <>
                                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:7}}>
                                  {formatCyclingDuration(day.durationMinutes) && (
                                    <span style={{fontSize:9.8,background:'#EEF6F2',color:'#356E5E',padding:'4px 9px',borderRadius:99,fontWeight:900,fontFamily:'sans-serif',border:'1px solid #CFE3DA'}}>
                                      ⏱️ {formatCyclingDuration(day.durationMinutes)}
                                    </span>
                                  )}
                                  {day.intensity && (
                                    <span style={{fontSize:9.5,background:'#F0F7F4',color:'#4E7C6D',padding:'3px 8px',borderRadius:99,fontWeight:800,fontFamily:'sans-serif',border:'1px solid #D7E7DF'}}>
                                      Belastung: {day.intensity}
                                    </span>
                                  )}
                                  {displayLoadGuidance && (
                                    <span style={{fontSize:9.5,background:'#F5F2FA',color:'#6F6384',padding:'3px 8px',borderRadius:99,fontWeight:800,fontFamily:'sans-serif',border:'1px solid #E2DAEC'}}>
                                      {displayLoadGuidance}
                                    </span>
                                  )}
                                </div>
                                {day.distanceGuidance && (
                                  <div style={{marginTop:7,fontSize:10.2,lineHeight:1.45,color:'#9A765F',fontFamily:'sans-serif',background:'#FFF8F1',border:'1px solid #F0E0D2',borderRadius:10,padding:'7px 9px'}}>
                                    🚴 {isMtbPlan && !/orientierung/i.test(String(day.distanceGuidance)) ? `Orientierung: ${day.distanceGuidance}` : day.distanceGuidance}
                                  </div>
                                )}
                                {isMtbPlan && day.elevationGuidance && (
                                  <div style={{marginTop:7,fontSize:10.2,lineHeight:1.45,color:'#61745F',fontFamily:'sans-serif',background:'#F2F7F1',border:'1px solid #DCE7D9',borderRadius:10,padding:'7px 9px'}}>
                                    ⛰️ {day.elevationGuidance}
                                  </div>
                                )}
                              </>
                            )}
                            {isMtbPlan && day.techniqueTitle && day.techniqueInstructions && (
                              <div style={{marginTop:8,borderRadius:11,background:'#EEF5EA',border:'1px solid #D4E3CF',fontSize:10.5,lineHeight:1.55,color:'#53664F',fontFamily:'sans-serif',overflow:'hidden'}}>
                                <button
                                  type="button"
                                  onClick={() => setOpenTechniques(prev => ({ ...prev, [key]: !prev[key] }))}
                                  style={{width:'100%',border:'none',background:'transparent',padding:'10px 11px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,textAlign:'left',color:'#53664F',cursor:'pointer',fontFamily:'sans-serif'}}
                                >
                                  <span>
                                    🚵 <strong>Technikübung{day.techniqueMinutes ? ` · ${day.techniqueMinutes} Min` : ''}: {day.techniqueTitle}</strong>
                                    <span style={{display:'block',marginTop:3,fontSize:9.6,color:'#73816D',fontWeight:700}}>
                                      {techniqueOpen ? 'Anleitung ausblenden' : 'Schritt-für-Schritt-Anleitung anzeigen'}
                                    </span>
                                  </span>
                                  <span style={{fontSize:13,transform:techniqueOpen?'rotate(180deg)':'none',transition:'transform .2s ease',flexShrink:0}}>⌄</span>
                                </button>
                                {techniqueOpen && (
                                  <div style={{padding:'9px 11px 11px',whiteSpace:'pre-line',borderTop:'1px solid #DCE8D8'}}>
                                    {day.techniqueInstructions}
                                  </div>
                                )}
                              </div>
                            )}
                            {(isCyclingPlan || isMtbPlan) && day.nutritionTip && (!isMtbPlan || Number(day.durationMinutes) >= 60) && (
                              <div style={{marginTop:8,padding:'9px 10px',borderRadius:11,background:'#FFF9E9',border:'1px solid #F0E2B9',fontSize:10.5,lineHeight:1.45,color:'#806A3D',fontFamily:'sans-serif'}}>
                                🍌 <strong>Verpflegung testen:</strong> {day.nutritionTip}
                              </div>
                            )}
                            {isSwimmingPlan && (
                              <div style={{marginTop:8,display:'grid',gap:7,fontFamily:'sans-serif'}}>
                                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                                  {day.durationMinutes && <span style={{fontSize:9.5,background:'#EDF7F7',color:'#4F8580',padding:'3px 8px',borderRadius:99,fontWeight:800,border:'1px solid #D5E9E7'}}>⏱ {day.durationMinutes} Min</span>}
                                  {day.totalDistanceM && <span style={{fontSize:9.5,background:'#EEF3FA',color:'#58738F',padding:'3px 8px',borderRadius:99,fontWeight:800,border:'1px solid #DCE5F0'}}>🏊 {Number(day.totalDistanceM).toLocaleString('de-DE')} m gesamt</span>}
                                   {day.targetSegmentM && <span style={{fontSize:9.5,background:'#FFF5EE',color:'#A46C43',padding:'3px 8px',borderRadius:99,fontWeight:800,border:'1px solid #F1DDCC'}}>🎯 {Number(day.targetSegmentM).toLocaleString('de-DE')} m am Stück</span>}
                                  {day.intensity && <span style={{fontSize:9.5,background:'#F5F2FA',color:'#6F6384',padding:'3px 8px',borderRadius:99,fontWeight:800,border:'1px solid #E2DAEC'}}>{day.intensity}</span>}
                                </div>
                                {day.loadGuidance && <div style={{fontSize:10.2,color:'#756C78',lineHeight:1.45}}>{day.loadGuidance}</div>}
                                {day.warmup && <div style={{padding:'8px 10px',borderRadius:10,background:'#F7FAFC',border:'1px solid #E5ECF2',fontSize:10.3,lineHeight:1.5,color:'#586A78'}}><strong>Einschwimmen</strong><div>{day.warmup}</div></div>}
                                {day.mainSet && <div style={{padding:'8px 10px',borderRadius:10,background:'#F1F8F7',border:'1px solid #DCEBE8',fontSize:10.3,lineHeight:1.5,color:'#4F6F6B'}}><strong>Hauptserie</strong><div>{day.mainSet}</div></div>}
                                {day.restGuidance && <div style={{fontSize:10,color:'#8A7B72'}}>⏸️ <strong>Pausen:</strong> {day.restGuidance}</div>}
                                {day.cooldown && <div style={{padding:'8px 10px',borderRadius:10,background:'#FAF8F5',border:'1px solid #ECE5DE',fontSize:10.3,lineHeight:1.5,color:'#74675F'}}><strong>Ausschwimmen</strong><div>{day.cooldown}</div></div>}
                                {Array.isArray(day.equipment) && day.equipment.length>0 && <div style={{fontSize:10,color:'#8A7B72'}}>🧰 {day.equipment.join(' · ')}</div>}
                                {day.openWaterTip && <div style={{padding:'8px 10px',borderRadius:10,background:'#EEF7FA',border:'1px solid #D7E9EE',fontSize:10.3,lineHeight:1.5,color:'#52737C'}}>🌊 <strong>Freiwasser:</strong> {day.openWaterTip}</div>}
                                {day.techniqueTitle && day.techniqueInstructions && (
                                  <div style={{borderRadius:11,background:'#EDF7F5',border:'1px solid #D3E8E3',fontSize:10.5,lineHeight:1.55,color:'#4E716B',overflow:'hidden'}}>
                                    <button type="button" onClick={()=>setOpenSwimTechniques(prev=>({...prev,[key]:!prev[key]}))}
                                      style={{width:'100%',border:'none',background:'transparent',padding:'10px 11px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,textAlign:'left',color:'#4E716B',cursor:'pointer',fontFamily:'sans-serif'}}>
                                      <span>🏊 <strong>Technik{day.techniqueDistanceM ? ` · ${Number(day.techniqueDistanceM).toLocaleString('de-DE')} m` : ''}: {day.techniqueTitle}</strong>
                                        <span style={{display:'block',marginTop:3,fontSize:9.6,color:'#718B86',fontWeight:700}}>{openSwimTechniques[key]?'Anleitung ausblenden':'Schritt-für-Schritt-Anleitung anzeigen'}</span>
                                      </span><span style={{fontSize:13,transform:openSwimTechniques[key]?'rotate(180deg)':'none'}}>⌄</span>
                                    </button>
                                    {openSwimTechniques[key]&&<div style={{padding:'9px 11px 11px',whiteSpace:'pre-line',borderTop:'1px solid #DCEAE7'}}>{day.techniqueInstructions}</div>}
                                  </div>
                                )}
                              </div>
                            )}

                            {(isCyclingPlan || isMtbPlan) && day.strengthPrescription && (
                              <>
                                {formatCyclingDuration(day.durationMinutes) && (
                                  <div style={{marginTop:7}}>
                                    <span style={{fontSize:9.8,background:'#EEF6F2',color:'#356E5E',padding:'4px 9px',borderRadius:99,fontWeight:900,fontFamily:'sans-serif',border:'1px solid #CFE3DA'}}>
                                      ⏱️ {formatCyclingDuration(day.durationMinutes)}
                                    </span>
                                  </div>
                                )}
                                <div style={{marginTop:8,padding:'9px 10px',borderRadius:11,background:'#F5F1FA',border:'1px solid #E2D8EC',fontSize:10.5,lineHeight:1.5,color:'#705E7D',fontFamily:'sans-serif',whiteSpace:'pre-line'}}>
                                  💪 <strong>Kraft & Stabilität:</strong> {day.strengthPrescription}
                                </div>
                              </>
                            )}
                            {day.adjusted && day.adjustmentReason && (
                              <div style={{ fontSize: 10, color: '#FF8C69', fontFamily: 'sans-serif', marginTop: 3, fontStyle: 'italic' }}>
                                Grund: {day.adjustmentReason}
                              </div>
                            )}
                            {isSkipped && skipped[key]?.reason && (
                              <div style={{ fontSize: 10, color: '#A89A88', fontFamily: 'sans-serif', marginTop: 3, fontStyle: 'italic' }}>
                                Grund: {skipped[key].reason}
                              </div>
                            )}
                            {hasLog && (
                              <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {hasShot && <img src={screenshots[key]} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #F0E8E0', flexShrink: 0 }} />}
                                {logs[key]?.pace && <span style={{ fontSize: 10, background: '#E8F0FF', color: '#4060C0', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>⏱ {logs[key].pace}</span>}
                                {logs[key]?.km && <span style={{ fontSize: 10, background: '#FFF0E6', color: '#C17A3A', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>📍 {logs[key].km}</span>}
                                {logs[key]?.bpm && <span style={{ fontSize: 10, background: '#FDECEA', color: '#B85464', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>❤️ {logs[key].bpm}</span>}
                                {logs[key]?.running_index && <span style={{ fontSize: 10, background: '#F5F0FF', color: '#A78BCA', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>🏃 RI {logs[key].running_index}</span>}
                                {logs[key]?.cadence && <span style={{ fontSize: 10, background: '#E8F5EF', color: '#3D8B6E', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>👣 {logs[key].cadence} spm</span>}
                                {logs[key]?.sport_data?.duration && <span style={{ fontSize: 10, background: '#EEF3FA', color: '#58738F', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>⏱ {logs[key].sport_data.duration}</span>}
                                {logs[key]?.sport_data?.elevation && <span style={{ fontSize: 10, background: '#F2F7F1', color: '#61745F', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>⛰ {logs[key].sport_data.elevation} m</span>}
                                {logs[key]?.sport_data?.swim_distance_m && <span style={{ fontSize: 10, background: '#EDF7F7', color: '#4F8580', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>🏊 {logs[key].sport_data.swim_distance_m} m</span>}
                                {isHyroxPlan && logs[key]?.hyrox_data && Object.keys(logs[key].hyrox_data).length > 0 && <span style={{ fontSize: 10, background: '#EEF8F3', color: '#3D8B6E', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>🏋️ HYROX-Daten</span>}
                                {loggedSchuh && <span style={{ fontSize: 10, background: '#FFF5EE', color: '#C17A3A', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>👟 {loggedSchuh.marke} {loggedSchuh.modell}</span>}
                                {logs[key]?.note && <span style={{ fontSize: 10, background: '#F5EDE8', color: '#8B6B5A', padding: '2px 8px', borderRadius: 99, fontWeight: 'bold', fontFamily: 'sans-serif' }}>💬 {logs[key].note.slice(0, 30)}{logs[key].note.length > 30 ? '…' : ''}</span>}
                                <button onClick={() => setDetailModal({ key, tag: day.tag, einheit: day.einheit })} style={{ fontSize: 10, background: 'none', border: 'none', color: '#B8A090', fontWeight: 'bold', fontFamily: 'sans-serif', cursor: 'pointer', textDecoration: 'underline', padding: '2px 4px' }}>
                                  Details →
                                </button>
                              </div>
                            )}
                          </div>

                          {!day.optional && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                              <button onClick={() => openLog(key, day.tag, day.einheit, day)} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: hasLog ? '#E8F5EF' : 'linear-gradient(135deg,#FF8C69,#FFB347)', color: hasLog ? '#5BA88A' : 'white', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', boxShadow: hasLog ? 'none' : '0 2px 8px rgba(255,140,105,0.4)' }}>
                                {hasLog ? '✏️' : '+ Log'}
                              </button>
                              {!hasLog && (
                                isSkipped ? (
                                  <button onClick={() => unskipDay(key)} style={{ padding: '3px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#A89A88', fontSize: 10, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', textDecoration: 'underline' }}>
                                    Rückgängig
                                  </button>
                                ) : (
                                  <button onClick={() => openSkip(key)} style={{ padding: '3px 8px', borderRadius: 8, border: 'none', background: 'none', color: '#C4A882', fontSize: 10, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', textDecoration: 'underline' }}>
                                    Überspringen
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {(isHikingPlan || isCyclingPlan || isMtbPlan || isSwimmingPlan) && plan.event && (
          <div style={{margin:'8px 16px 16px',padding:'18px',borderRadius:20,background:'linear-gradient(135deg,#FFF7EF,#F7F2FA)',border:'1.5px solid #E8D8CF',boxShadow:'0 5px 22px rgba(70,50,40,.07)'}}>
            <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,letterSpacing:1.4,textTransform:'uppercase',color:'#A77B5D',marginBottom:7}}>Dein Ziel</div>
            <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{fontSize:27}}>🏁</div>
              <div>
                <div style={{fontSize:17,fontWeight:'bold',color:'#4B3528'}}>{plan.event.title}</div>
                <div style={{fontFamily:'sans-serif',fontSize:11,color:'#9B8273',marginTop:3}}>
                  {[plan.event.date, plan.event.distanceKm ? `${plan.event.distanceKm} km` : null].filter(Boolean).join(' · ')}
                </div>
                {plan.event.details && <div style={{fontFamily:'sans-serif',fontSize:11,lineHeight:1.5,color:'#806E63',marginTop:8}}>{plan.event.details}</div>}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '8px 16px' }}>
          <button onClick={() => setShowPauseModal(true)}
            style={{ width: '100%', background: 'white', border: '1.5px solid #F0E0D0', borderRadius: 20, padding: '14px', fontSize: 14, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold', color: '#C4A882', marginBottom: 10 }}>
            ⏸ Plan pausieren
          </button>
          <button onClick={onReset} style={{ width: '100%', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: 'white', border: 'none', borderRadius: 20, padding: '16px', fontSize: 15, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold', boxShadow: '0 8px 24px rgba(255,107,157,0.4)', letterSpacing: 0.5 }}>
            {isHikingPlan
              ? '🥾 Neuen Plan erstellen'
              : isMtbPlan
                ? '🚵 Neuen Plan erstellen'
                : isSwimmingPlan
                  ? '🏊 Neuen Plan erstellen'
                  : isCyclingPlan
                  ? '🚴 Neuen Plan erstellen'
                  : '🏃‍♀️ Neuen Plan erstellen'}
          </button>
        </div>

        {/* Pause Modal */}
        {showPauseModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '28px 28px 0 0', padding: '24px 24px 48px', width: '100%', maxWidth: 520, boxShadow: '0 -8px 40px rgba(255,140,105,0.2)' }}>
              <div style={{ width: 36, height: 4, background: '#F0E8E0', borderRadius: 99, margin: '0 auto 20px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 'bold', color: '#3D2B1F', marginBottom: 8 }}>⏸ Plan pausieren</h3>
              <p style={{ fontSize: 13, color: '#8B6B5A', fontFamily: 'sans-serif', marginBottom: 20, lineHeight: 1.6 }}>
                Verletzt, krank oder im Urlaub? Verschiebe deinen Plan um die gewünschte Anzahl Wochen – alle Termine passen sich automatisch an.
              </p>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8, fontFamily: 'sans-serif' }}>
                  Wie viele Wochen pausieren?
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4].map(w => (
                    <button key={w} onClick={() => setPauseWeeks(w)}
                      style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `2px solid ${pauseWeeks === w ? '#FF8C69' : '#F0E0D0'}`, background: pauseWeeks === w ? 'linear-gradient(135deg,#FF8C69,#FFB347)' : 'white', color: pauseWeeks === w ? 'white' : '#C4A882', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all 0.2s' }}>
                      {w} {w === 1 ? 'Woche' : 'Wochen'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowPauseModal(false)}
                  style={{ flex: 1, padding: '15px', borderRadius: 16, border: '1.5px solid #F0E0D0', background: 'white', color: '#C4A882', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                  Abbrechen
                </button>
                <button onClick={() => { setShowPauseModal(false); handlePausePlan() }}
                  style={{ flex: 2, padding: '15px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: 'white', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', boxShadow: '0 6px 20px rgba(255,107,157,0.4)' }}>
                  Plan um {pauseWeeks} {pauseWeeks === 1 ? 'Woche' : 'Wochen'} verschieben
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
