import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Statistics({ user, plan }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && plan) calculateStats()
  }, [user, plan])

  const parseKm = (str) => {
    if (!str) return 0
    const match = str.replace(',', '.').match(/[\d.]+/)
    return match ? parseFloat(match[0]) : 0
  }

  const parsePace = (str) => {
    if (!str) return null
    const match = str.match(/(\d+):(\d+)/)
    if (!match) return null
    return parseInt(match[1]) + parseInt(match[2]) / 60
  }

  const calculateStats = async () => {
    try {
      const { data: logData } = await supabase
        .from('logs')
        .select('*')
        .eq('user_id', user.id)

      const logs = logData || []
      const totalKm = logs.reduce((s, l) => s + parseKm(l.km), 0)
      const totalLaufe = logs.filter(l => l.km).length

      // Pace Durchschnitt
      const paces = logs.map(l => parsePace(l.pace)).filter(Boolean)
      const avgPace = paces.length > 0 ? paces.reduce((a, b) => a + b, 0) / paces.length : null

      // Schnellste Pace
      const fastestPace = paces.length > 0 ? Math.min(...paces) : null

      // Längster Lauf
      const maxKm = logs.length > 0 ? Math.max(...logs.map(l => parseKm(l.km))) : 0

      // Niedrigste HF locker
      const hfValues = logs.map(l => parseInt(l.bpm)).filter(v => !isNaN(v) && v > 0)
      const minHF = hfValues.length > 0 ? Math.min(...hfValues) : null

      // Wöchentliche km aus Plan berechnen
      const weeklyKm = []
      if (plan?.phases) {
        for (const phase of plan.phases) {
          for (const week of phase.weeks || []) {
            let km = 0
            for (const day of week.days || []) {
              if (!day.optional) {
                // Geschätzte km aus Details
                const kmMatch = day.details?.match(/(\d+(?:[.,]\d+)?)\s*km/)
                if (kmMatch) {
                  km += parseFloat(kmMatch[1].replace(',', '.'))
                } else {
                  // Minuten → geschätzte km (Pace ~8 min/km)
                  const minMatch = day.details?.match(/(\d+)\s*min/)
                  if (minMatch) km += parseInt(minMatch[1]) / 8
                }
              }
            }
            weeklyKm.push({ n: week.n, km: Math.round(km * 10) / 10 })
          }
        }
      }

      // Geloggte km pro Woche
      const loggedWeeklyKm = []
      if (plan?.phases) {
        for (const phase of plan.phases) {
          for (const week of phase.weeks || []) {
            let km = 0
            for (let di = 0; di < (week.days || []).length; di++) {
              const key = `${phase.id}_w${week.n}_d${di}`
              const log = logs.find(l => l.day_key === key)
              if (log) km += parseKm(log.km)
            }
            if (km > 0) loggedWeeklyKm.push({ n: week.n, km: Math.round(km * 10) / 10 })
          }
        }
      }

      // Längste Serie komplett absolvierter Wochen
      let maxSerie = 0
      let currentSerie = 0
      if (plan?.phases) {
        for (const phase of plan.phases) {
          for (const week of phase.weeks || []) {
            const pflicht = week.days?.filter(d => !d.optional) || []
            const erledigt = pflicht.filter((d, di) => {
              const key = `${phase.id}_w${week.n}_d${di}`
              return logs.some(l => l.day_key === key)
            })
            if (erledigt.length === pflicht.length && pflicht.length > 0) {
              currentSerie++
              maxSerie = Math.max(maxSerie, currentSerie)
            } else {
              currentSerie = 0
            }
          }
        }
      }

      // Trainingszeit (geschätzt)
      const totalMin = logs.reduce((s, l) => {
        if (l.km && avgPace) return s + parseKm(l.km) * avgPace
        return s + 40 // Standardwert
      }, 0)

      const fmtPace = (p) => {
        if (!p) return '–'
        const m = Math.floor(p)
        const s = Math.round((p - m) * 60).toString().padStart(2, '0')
        return `${m}:${s}`
      }

      setStats({
        totalKm: Math.round(totalKm * 10) / 10,
        totalLaufe,
        avgPace: fmtPace(avgPace),
        fastestPace: fmtPace(fastestPace),
        maxKm: Math.round(maxKm * 10) / 10,
        minHF,
        maxSerie,
        totalStunden: Math.round(totalMin / 60 * 10) / 10,
        weeklyKm: loggedWeeklyKm.slice(-7),
        plannedWeeklyKm: weeklyKm,
      })
    } catch (e) {
      console.error('Statistik Fehler:', e)
    }
    setLoading(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#B8A090', fontFamily: 'sans-serif' }}>⏳ Lade…</div>

  if (!stats || stats.totalLaufe === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B8A090', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14, marginBottom: 6 }}>Noch keine Daten</div>
      <div style={{ fontSize: 12, color: '#D4C4B8' }}>Logge deine ersten Läufe um Statistiken zu sehen</div>
    </div>
  )

  const maxWeekKm = Math.max(...(stats.weeklyKm.map(w => w.km) || [1]))

  return (
    <div>
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Gesamt gelaufen', value: `${stats.totalKm} km`, sub: `${stats.totalLaufe} Läufe` },
          { label: 'Trainingszeit', value: `${stats.totalStunden}h`, sub: 'gesamt' },
          { label: 'Ø Pace', value: stats.avgPace, sub: 'min/km Durchschnitt' },
          { label: 'Schnellste Pace', value: stats.fastestPace, sub: 'min/km' },
        ].map((m, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid #F0E8E0' }}>
            <div style={{ fontSize: 11, color: '#B8A090', marginBottom: 4, fontFamily: 'sans-serif' }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#3D2B1F' }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#C4A882', fontFamily: 'sans-serif', marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Wöchentliche km */}
      {stats.weeklyKm.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid #F0E8E0', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#5C3D2E', marginBottom: 12, fontFamily: 'sans-serif' }}>Gelaufene km pro Woche</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 70 }}>
            {stats.weeklyKm.map((w, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 9, color: '#FF8C69', fontFamily: 'sans-serif', fontWeight: 'bold' }}>{w.km}</div>
                <div style={{ width: '100%', background: i === stats.weeklyKm.length - 1 ? 'linear-gradient(180deg,#FF8C69,#FF6B9D)' : '#FFD4C0', borderRadius: 4, height: `${Math.max(4, Math.round((w.km / maxWeekKm) * 50))}px` }} />
                <div style={{ fontSize: 9, color: '#C4A882', fontFamily: 'sans-serif' }}>W{w.n}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bestleistungen */}
      <div style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid #F0E8E0' }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#5C3D2E', marginBottom: 10, fontFamily: 'sans-serif' }}>Persönliche Bestleistungen</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '🏅', label: 'Längster Lauf', value: `${stats.maxKm} km` },
            { icon: '⚡', label: 'Schnellste Pace', value: `${stats.fastestPace} min/km` },
            { icon: '🔥', label: 'Längste Serie', value: `${stats.maxSerie} ${stats.maxSerie === 1 ? 'Woche' : 'Wochen'} komplett` },
            stats.minHF ? { icon: '❤️', label: 'Niedrigste HF', value: `${stats.minHF} bpm` } : null,
          ].filter(Boolean).map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 3 ? '0.5px solid #F5EDE8' : 'none' }}>
              <span style={{ fontSize: 12, color: '#8B6B5A', fontFamily: 'sans-serif' }}>{item.icon} {item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
