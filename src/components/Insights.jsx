import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const SPORT_FILTERS = [
  { key: 'all', label: 'Alle', icon: '✨' },
  { key: 'running', label: 'Laufen', icon: '🏃' },
  { key: 'hiking', label: 'Wandern', icon: '🥾' },
  { key: 'cycling', label: 'Radfahren', icon: '🚴' },
  { key: 'mountain_biking', label: 'MTB', icon: '🚵' },
]

const SPORT_META = {
  running: { label: 'Laufen', icon: '🏃', color: '#FF8C69', soft: '#FFF0E6' },
  walking: { label: 'Wandern', icon: '🚶', color: '#76A85B', soft: '#F1F8EC' },
  hiking: { label: 'Wandern', icon: '🥾', color: '#76A85B', soft: '#F1F8EC' },
  cycling: { label: 'Radfahren', icon: '🚴', color: '#62A7D6', soft: '#EEF7FC' },
  mountain_biking: { label: 'Mountainbike', icon: '🚵', color: '#8B6B4A', soft: '#F7F0E8' },
}

const getMeta = type =>
  SPORT_META[type] || {
    label: 'Aktivität',
    icon: '🏅',
    color: '#A78BCA',
    soft: '#F7F2FF',
  }

const parseKm = value => {
  if (value == null) return 0
  if (typeof value === 'number') return value
  const match = String(value).replace(',', '.').match(/[\d.]+/)
  return match ? Number(match[0]) : 0
}

const distanceKm = log =>
  Number(log?.distance_meters) > 0
    ? Number(log.distance_meters) / 1000
    : parseKm(log?.km)

const parsePaceSeconds = value => {
  if (!value) return null
  const match = String(value).match(/(\d+):(\d{2})/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const durationSeconds = log => {
  const direct = Number(log?.moving_time_seconds || log?.duration_seconds)
  if (Number.isFinite(direct) && direct > 0) return direct

  const km = distanceKm(log)
  const pace = parsePaceSeconds(log?.pace)
  return km > 0 && pace ? km * pace : 0
}

const formatKm = value =>
  `${Number(value || 0).toLocaleString('de-DE', {
    maximumFractionDigits: 1,
  })} km`

const formatHm = value =>
  `${Math.round(Number(value || 0)).toLocaleString('de-DE')} hm`

const formatHours = seconds => {
  const minutes = Math.round(Number(seconds || 0) / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours}:${String(rest).padStart(2, '0')} h`
}

const formatPace = seconds => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '–'
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} min/km`
}

const localDate = value => {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const monthKey = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const normalizeSport = type => (type === 'walking' ? 'hiking' : type || 'running')

const InsightCard = ({ insight }) => {
  const meta = getMeta(insight.sportType)

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        border: `1.5px solid ${meta.color}33`,
        borderLeft: `4px solid ${meta.color}`,
        padding: '14px 15px',
        boxShadow: '0 4px 16px rgba(61,43,31,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'flex-start',
          marginBottom: 7,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 'bold',
            color: '#3D2B1F',
            fontFamily: 'sans-serif',
          }}
        >
          {insight.icon} {insight.title}
        </div>

        {insight.sportType !== 'all' && (
          <span
            style={{
              flexShrink: 0,
              borderRadius: 99,
              padding: '3px 8px',
              background: meta.soft,
              color: meta.color,
              fontSize: 9,
              fontWeight: 'bold',
              fontFamily: 'sans-serif',
            }}
          >
            {meta.icon} {meta.label}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 19,
          color: '#3D2B1F',
          fontWeight: 'bold',
          marginBottom: 5,
        }}
      >
        {insight.value}
      </div>

      <div
        style={{
          fontSize: 11,
          lineHeight: 1.5,
          color: '#8B6B5A',
          fontFamily: 'sans-serif',
        }}
      >
        {insight.description}
      </div>
    </div>
  )
}

export default function Insights({ user }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [sportFilter, setSportFilter] = useState('all')

  useEffect(() => {
    if (!user) return

    const load = async () => {
      setLoading(true)

      try {
        const { data, error } = await supabase
          .from('logs')
          .select('*')
          .eq('user_id', user.id)
          .order('actual_date', { ascending: true })

        if (error) throw error
        setLogs(data || [])
      } catch (error) {
        console.error('Insights konnten nicht geladen werden:', error)
        setLogs([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  const insights = useMemo(() => {
    const valid = logs
      .map(log => ({
        ...log,
        sportType: normalizeSport(log.sport_type),
        date: localDate(log.actual_date),
        kmValue: distanceKm(log),
        secondsValue: durationSeconds(log),
        elevationValue:
          Number(log.elevation_gain) ||
          Number(log.hoehenmeter) ||
          0,
        speedValue: Number(log.average_speed_kmh) || 0,
        paceSeconds: parsePaceSeconds(log.pace),
      }))
      .filter(log => log.date)

    if (!valid.length) return []

    const result = []
    const currentYear = new Date().getFullYear()
    const thisYear = valid.filter(log => log.date.getFullYear() === currentYear)
    const basis = thisYear.length ? thisYear : valid

    const byMonth = basis.reduce((acc, log) => {
      const key = monthKey(log.date)
      if (!acc[key]) acc[key] = { count: 0, km: 0, seconds: 0, elevation: 0 }
      acc[key].count += 1
      acc[key].km += log.kmValue
      acc[key].seconds += log.secondsValue
      acc[key].elevation += log.elevationValue
      return acc
    }, {})

    const activeMonthEntry = Object.entries(byMonth).sort(
      (a, b) => b[1].count - a[1].count
    )[0]

    if (activeMonthEntry) {
      const [key, values] = activeMonthEntry
      const label = new Date(`${key}-01T00:00:00`).toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      })

      result.push({
        sportType: 'all',
        icon: '📅',
        title: 'Aktivster Monat',
        value: label,
        description: `${values.count} Aktivitäten, ${formatKm(values.km)} und ${formatHours(values.seconds)} Trainingszeit.`,
      })
    }

    const weekdays = basis.reduce((acc, log) => {
      const key = log.date.getDay()
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const favoriteDay = Object.entries(weekdays).sort((a, b) => b[1] - a[1])[0]
    if (favoriteDay) {
      const dayName = new Date(2026, 0, 4 + Number(favoriteDay[0])).toLocaleDateString(
        'de-DE',
        { weekday: 'long' }
      )

      result.push({
        sportType: 'all',
        icon: '🔥',
        title: 'Dein aktivster Wochentag',
        value: dayName,
        description: `${favoriteDay[1]} deiner Aktivitäten fanden an diesem Wochentag statt.`,
      })
    }

    const sportCounts = basis.reduce((acc, log) => {
      acc[log.sportType] = (acc[log.sportType] || 0) + 1
      return acc
    }, {})

    const favoriteSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0]
    if (favoriteSport) {
      const meta = getMeta(favoriteSport[0])
      result.push({
        sportType: favoriteSport[0],
        icon: '💚',
        title: 'Häufigste Sportart',
        value: meta.label,
        description: `${favoriteSport[1]} Aktivitäten im ausgewerteten Zeitraum.`,
      })
    }

    const addLongest = (type, title) => {
      const items = basis.filter(log => log.sportType === type && log.kmValue > 0)
      if (!items.length) return

      const longest = [...items].sort((a, b) => b.kmValue - a.kmValue)[0]
      result.push({
        sportType: type,
        icon: '🏅',
        title,
        value: formatKm(longest.kmValue),
        description: `Am ${longest.date.toLocaleDateString('de-DE')} – ${formatHours(longest.secondsValue)} unterwegs${longest.elevationValue ? ` und ${formatHm(longest.elevationValue)} Aufstieg` : ''}.`,
      })
    }

    addLongest('running', 'Längster Lauf')
    addLongest('hiking', 'Längste Wanderung')
    addLongest('cycling', 'Längste Radtour')
    addLongest('mountain_biking', 'Längste Mountainbike-Tour')

    const mtb = basis.filter(log => log.sportType === 'mountain_biking')
    if (mtb.length) {
      const highest = [...mtb].sort(
        (a, b) => b.elevationValue - a.elevationValue
      )[0]

      if (highest.elevationValue > 0) {
        result.push({
          sportType: 'mountain_biking',
          icon: '⛰️',
          title: 'Höhenmeterreichste MTB-Tour',
          value: formatHm(highest.elevationValue),
          description: `${formatKm(highest.kmValue)} am ${highest.date.toLocaleDateString('de-DE')}.`,
        })
      }
    }

    const cycling = basis.filter(log => log.sportType === 'cycling')
    if (cycling.length) {
      const fastest = [...cycling]
        .filter(log => log.speedValue > 0)
        .sort((a, b) => b.speedValue - a.speedValue)[0]

      if (fastest) {
        result.push({
          sportType: 'cycling',
          icon: '⚡',
          title: 'Schnellste Radtour',
          value: `${fastest.speedValue.toLocaleString('de-DE', {
            maximumFractionDigits: 1,
          })} km/h`,
          description: `${formatKm(fastest.kmValue)} am ${fastest.date.toLocaleDateString('de-DE')}.`,
        })
      }
    }

    const running = basis
      .filter(
        log =>
          log.sportType === 'running' &&
          log.paceSeconds &&
          log.kmValue >= 3
      )
      .sort((a, b) => a.date - b.date)

    if (running.length >= 6) {
      const split = Math.floor(running.length / 2)
      const older = running.slice(0, split)
      const newer = running.slice(split)

      const weightedPace = items => {
        const distance = items.reduce((sum, item) => sum + item.kmValue, 0)
        const seconds = items.reduce(
          (sum, item) => sum + item.paceSeconds * item.kmValue,
          0
        )
        return distance > 0 ? seconds / distance : null
      }

      const oldPace = weightedPace(older)
      const newPace = weightedPace(newer)

      if (oldPace && newPace && newPace < oldPace) {
        const improvement = oldPace - newPace

        result.push({
          sportType: 'running',
          icon: '📈',
          title: 'Pace verbessert',
          value: `${Math.round(improvement)} Sek./km`,
          description: `Deine neueren Läufe waren im gewichteten Durchschnitt schneller (${formatPace(newPace)} statt ${formatPace(oldPace)}).`,
        })
      }
    }

    const sortedDays = [...new Set(basis.map(log => log.actual_date))].sort()
    let bestStreak = 0
    let currentStreak = 0
    let previous = null

    sortedDays.forEach(value => {
      const date = localDate(value)
      if (!previous) {
        currentStreak = 1
      } else {
        const difference = Math.round((date - previous) / 86400000)
        currentStreak = difference === 1 ? currentStreak + 1 : 1
      }

      bestStreak = Math.max(bestStreak, currentStreak)
      previous = date
    })

    if (bestStreak >= 2) {
      result.push({
        sportType: 'all',
        icon: '🔥',
        title: 'Längste Aktivitätsserie',
        value: `${bestStreak} Tage`,
        description: 'An so vielen aufeinanderfolgenden Tagen warst du aktiv.',
      })
    }

    return result
  }, [logs])

  const visibleInsights =
    sportFilter === 'all'
      ? insights
      : insights.filter(insight => insight.sportType === sportFilter)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#B8A090', fontFamily: 'sans-serif' }}>
        ⏳ Lade Insights…
      </div>
    )
  }

  return (
    <div>
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
              type="button"
              onClick={() => setSportFilter(filter.key)}
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

      <div
        style={{
          padding: '12px 13px',
          borderRadius: 14,
          background: '#FFF8F0',
          border: '1px solid #FFE0CC',
          color: '#8B6B5A',
          fontSize: 11,
          lineHeight: 1.5,
          fontFamily: 'sans-serif',
          marginBottom: 12,
        }}
      >
        💡 Insights werden automatisch aus deinen vorhandenen Aktivitäten berechnet. Dafür entstehen keine API-Kosten.
      </div>

      {visibleInsights.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#B8A090',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 10 }}>💡</div>
          <div style={{ fontSize: 14, color: '#5C3D2E', fontWeight: 'bold' }}>
            Noch nicht genügend Daten
          </div>
          <div style={{ fontSize: 12, marginTop: 5 }}>
            Mit weiteren Aktivitäten entstehen automatisch neue Insights.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleInsights.map((insight, index) => (
            <InsightCard
              key={`${insight.sportType}-${insight.title}-${index}`}
              insight={insight}
            />
          ))}
        </div>
      )}
    </div>
  )
}
