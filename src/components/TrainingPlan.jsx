import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

const dayKey = (phaseId, weekN, dayIdx) => `${phaseId}_w${weekN}_d${dayIdx}`

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
  const [done, setDone] = useState({})
  const [logs, setLogs] = useState({})
  const [screenshots, setScreenshots] = useState({})
  const [schuhe, setSchuhe] = useState([])
  const [logModal, setLogModal] = useState(null)
  const [logInput, setLogInput] = useState({ pace: '', km: '', bpm: '', note: '', schuh_id: '' })
  const [modalScreenshot, setModalScreenshot] = useState(null)
  const [modalPreview, setModalPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [skipped, setSkipped] = useState({})
  const [skipModal, setSkipModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [routeMapUrl, setRouteMapUrl] = useState(null)
  const [routeMapLoading, setRouteMapLoading] = useState(false)
  const [routeMapError, setRouteMapError] = useState(null)
  const [skipReasonInput, setSkipReasonInput] = useState('')
  const fileRef = useRef()

  const phases = plan.phases || []

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

  const openLog = (key, tag, einheit) => {
    const ex = logs[key] || {}
    setLogInput({ pace: ex.pace || '', km: ex.km || '', bpm: ex.bpm || '', note: ex.note || '', schuh_id: ex.schuh_id || '' })
    setModalScreenshot(screenshots[key] || null)
    setModalPreview(screenshots[key] || null)
    setLogModal({ key, tag, einheit })
  }

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

            {/* Felder */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {[{ key: 'pace', label: 'Ø Pace', placeholder: '6:19 min/km' }, { key: 'km', label: 'Distanz', placeholder: '14,2 km' }].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>{f.label}</label>
                  <input value={logInput[f.key]} onChange={e => setLogInput(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 14, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif' }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>Ø Herzfrequenz</label>
              <input value={logInput.bpm} onChange={e => setLogInput(p => ({ ...p, bpm: e.target.value }))} placeholder="158 bpm"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 14, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif' }} />
            </div>

            {/* Schuh-Auswahl */}
            {schuhe.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>Laufschuhe</label>
                <select value={logInput.schuh_id} onChange={e => setLogInput(p => ({ ...p, schuh_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 14, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer' }}>
                  <option value="">Kein Schuh ausgewählt</option>
                  {schuhe.map(s => (
                    <option key={s.id} value={s.id}>{s.marke} {s.modell} ({Math.round(s.start_km || 0)} km)</option>
                  ))}
                </select>
              </div>
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
        const rows = [
          { icon: '🕐', label: 'Uhrzeit', value: d.uhrzeit },
          { icon: '⏱', label: 'Pace', value: d.pace },
          { icon: '📍', label: 'Distanz', value: d.km },
          { icon: '❤️', label: 'Ø Herzfrequenz', value: d.bpm },
          { icon: '🔥', label: 'Kalorien', value: d.kalorien ? `${d.kalorien} kcal` : null },
          { icon: '💓', label: 'Max. Herzfrequenz', value: d.hf_max ? `${d.hf_max} bpm` : null },
          { icon: '⛰️', label: 'Höhenmeter', value: d.hoehenmeter ? `${d.hoehenmeter} m` : null },
          { icon: '🏃', label: 'Running Index', value: d.running_index },
          { icon: '👣', label: 'Kadenz', value: d.cadence ? `${d.cadence} spm` : null },
          { icon: '🙂', label: 'Gefühl', value: d.gefuehl },
          { icon: '📊', label: 'Trainingsbelastung', value: d.training_load },
          { icon: '💤', label: 'Erholungszeit', value: d.recovery_time },
          { icon: '👟', label: 'Schuh', value: d.schuh_id ? (schuhe.find(s => s.id === d.schuh_id) ? `${schuhe.find(s => s.id === d.schuh_id).marke} ${schuhe.find(s => s.id === d.schuh_id).modell}` : null) : null },
        ].filter(r => r.value)

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(60,30,20,0.45)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '28px 28px 0 0', padding: '24px 24px 44px', width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(255,140,105,0.2)' }}>
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

              <button onClick={() => setDetailModal(null)} style={{ width: '100%', marginTop: 20, padding: 14, borderRadius: 16, border: '1.5px solid #F0E8E0', background: 'white', color: '#B8A090', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                Schließen
              </button>
            </div>
          </div>
        )
      })()}

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #FF8C69 0%, #FFB347 50%, #FF6B9D 100%)', padding: '36px 20px 28px', borderRadius: '0 0 32px 32px', boxShadow: '0 8px 32px rgba(255,140,105,0.3)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -30, left: 40, width: 80, height: 80, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', margin: '0 0 4px', fontFamily: 'sans-serif' }}>
            {plan.goal ? `Ziel: ${plan.goal}` : 'Trainingsplan'}
          </p>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 'bold', margin: '0 0 4px' }}>
            {plan.title || 'Trainingsplan'}
          </h1>
          {plan.name && <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: '0 0 20px', fontFamily: 'sans-serif' }}>Für {plan.name}</p>}

          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '14px 18px', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: 'white', fontSize: 13, fontFamily: 'sans-serif' }}>Fortschritt</span>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>{progress}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'white', borderRadius: 8, transition: 'width 0.5s ease' }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, margin: '6px 0 0', fontFamily: 'sans-serif' }}>
              {doneDays}/{totalDays} Läufe erledigt
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
            const weekKm = estimateWeekKm(week)

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
                    </div>
                    <div style={{ color: '#B8A090', fontSize: 11, fontFamily: 'sans-serif', marginTop: 2 }}>{week.dateRange} · {weekDone}/{weekTotal} erledigt</div>
                  </div>
                  <span style={{ color: '#C4A882', fontSize: 16, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>▾</span>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 16px 16px' }}>
                    {week.days.map((day, di) => {
                      const key = dayKey(phase.id, week.n, di)
                      const isDone = !!done[key]
                      const hasLog = !!logs[key]
                      const hasShot = !!screenshots[key]
                      const isSkipped = !isDone && !!skipped[key]
                      const s = isSkipped
                        ? { bg: '#F5F0EA', text: '#A89A88', border: '#E0D8CC', dot: '#C4BCAE' }
                        : typeStyle(day.einheit, day.optional, isDone)
                      const loggedSchuh = hasLog && logs[key]?.schuh_id ? schuhe.find(sh => sh.id === logs[key].schuh_id) : null

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
                              <button onClick={() => openLog(key, day.tag, day.einheit)} style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: hasLog ? '#E8F5EF' : 'linear-gradient(135deg,#FF8C69,#FFB347)', color: hasLog ? '#5BA88A' : 'white', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', boxShadow: hasLog ? 'none' : '0 2px 8px rgba(255,140,105,0.4)' }}>
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

        <div style={{ padding: '8px 16px' }}>
          <button onClick={() => setShowPauseModal(true)}
            style={{ width: '100%', background: 'white', border: '1.5px solid #F0E0D0', borderRadius: 20, padding: '14px', fontSize: 14, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold', color: '#C4A882', marginBottom: 10 }}>
            ⏸ Plan pausieren
          </button>
          <button onClick={onReset} style={{ width: '100%', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: 'white', border: 'none', borderRadius: 20, padding: '16px', fontSize: 15, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 'bold', boxShadow: '0 8px 24px rgba(255,107,157,0.4)', letterSpacing: 0.5 }}>
            🏃‍♀️ Neuen Plan erstellen
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
