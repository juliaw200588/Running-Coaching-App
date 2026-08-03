import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const SPORT_FILTERS = [
  { key: 'all', label: 'Alle', icon: '✨' },
  { key: 'running', label: 'Laufen', icon: '🏃' },
  { key: 'hiking', label: 'Wandern', icon: '🥾' },
  { key: 'cycling', label: 'Radfahren', icon: '🚴' },
  { key: 'mountain_biking', label: 'MTB', icon: '🚵' },
]

const SPORT_CONFIG = {
  running: {
    label: 'Laufen',
    singular: 'Lauf',
    icon: '🏃',
    color: '#FF8C69',
    soft: '#FFF0E6',
  },
  walking: {
    label: 'Wandern',
    singular: 'Walking',
    icon: '🚶',
    color: '#76A85B',
    soft: '#F1F8EC',
  },
  hiking: {
    label: 'Wandern',
    singular: 'Wanderung',
    icon: '🥾',
    color: '#76A85B',
    soft: '#F1F8EC',
  },
  cycling: {
    label: 'Radfahren',
    singular: 'Radtour',
    icon: '🚴',
    color: '#62A7D6',
    soft: '#EEF7FC',
  },
  mountain_biking: {
    label: 'Mountainbike',
    singular: 'MTB-Tour',
    icon: '🚵',
    color: '#8B6B4A',
    soft: '#F7F0E8',
  },
}

const getSportConfig = sportType =>
  SPORT_CONFIG[sportType] || {
    label: 'Aktivitäten',
    singular: 'Aktivität',
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

const parsePace = value => {
  if (!value) return null
  const match = String(value).match(/(\d+):(\d+)/)
  if (!match) return null
  return Number(match[1]) + Number(match[2]) / 60
}

const formatPace = value => {
  if (!Number.isFinite(value) || value <= 0) return '–'
  const minutes = Math.floor(value)
  const seconds = Math.round((value - minutes) * 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const formatHours = seconds => {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return '0 h'
  return `${Math.round((value / 3600) * 10) / 10} h`
}

const formatNumber = value =>
  new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 1,
  }).format(Number(value) || 0)

const toLocalDate = dateString => {
  if (!dateString) return null
  const date = new Date(`${dateString}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const startOfMonth = date => new Date(date.getFullYear(), date.getMonth(), 1)
const endOfMonth = date => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
const startOfYear = date => new Date(date.getFullYear(), 0, 1)
const endOfYear = date => new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999)

const getIsoWeekKey = date => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const getMonthKey = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export default function Statistics({ user, plan }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [sportFilter, setSportFilter] = useState('all')
  const [period, setPeriod] = useState('month')
  const [referenceDate, setReferenceDate] = useState(new Date())
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

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
        console.error('Statistik Fehler:', error)
        setLogs([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  const periodBounds = useMemo(() => {
    if (period === 'month') {
      return {
        from: startOfMonth(referenceDate),
        to: endOfMonth(referenceDate),
      }
    }

    if (period === 'year') {
      return {
        from: startOfYear(referenceDate),
        to: endOfYear(referenceDate),
      }
    }

    if (period === 'custom') {
      return {
        from: customFrom ? toLocalDate(customFrom) : null,
        to: customTo
          ? new Date(`${customTo}T23:59:59`)
          : null,
      }
    }

    return { from: null, to: null }
  }, [period, referenceDate, customFrom, customTo])

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const sportType = log.sport_type || 'running'

      const sportMatches =
        sportFilter === 'all'
          ? true
          : sportFilter === 'hiking'
            ? sportType === 'hiking' || sportType === 'walking'
            : sportType === sportFilter

      if (!sportMatches) return false

      const date = toLocalDate(log.actual_date)
      if (!date) return period === 'all'

      if (periodBounds.from && date < periodBounds.from) return false
      if (periodBounds.to && date > periodBounds.to) return false

      return true
    })
  }, [logs, sportFilter, period, periodBounds])

  const stats = useMemo(() => {
    const totalActivities = filteredLogs.length
    const totalKm = filteredLogs.reduce(
      (sum, log) =>
        sum +
        (Number(log.distance_meters) > 0
          ? Number(log.distance_meters) / 1000
          : parseKm(log.km)),
      0
    )

    const totalSeconds = filteredLogs.reduce((sum, log) => {
      const duration = Number(log.moving_time_seconds || log.duration_seconds)
      if (Number.isFinite(duration) && duration > 0) return sum + duration

      const km = parseKm(log.km)
      const pace = parsePace(log.pace)
      if (km > 0 && pace) return sum + km * pace * 60

      return sum
    }, 0)

    const elevationGain = filteredLogs.reduce(
      (sum, log) =>
        sum +
        (Number(log.elevation_gain) ||
          Number(log.hoehenmeter) ||
          0),
      0
    )

    const elevationLoss = filteredLogs.reduce(
      (sum, log) => sum + (Number(log.elevation_loss) || 0),
      0
    )

    const heartRates = filteredLogs
      .map(log => Number.parseInt(log.bpm, 10))
      .filter(value => Number.isFinite(value) && value > 0)

    const averageHeartRate = heartRates.length
      ? heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length
      : null

    const sportType = sportFilter === 'all' ? null : sportFilter
    const isRunning = sportType === 'running'
    const isHiking = sportType === 'hiking'
    const isCycling = sportType === 'cycling'
    const isMtb = sportType === 'mountain_biking'

    const paces = filteredLogs
      .map(log => parsePace(log.pace))
      .filter(value => Number.isFinite(value) && value > 0)

    const averagePace = paces.length
      ? paces.reduce((sum, value) => sum + value, 0) / paces.length
      : null

    const fastestPace = paces.length ? Math.min(...paces) : null

    const speeds = filteredLogs
      .map(log => Number(log.average_speed_kmh))
      .filter(value => Number.isFinite(value) && value > 0)

    const weightedSpeedNumerator = filteredLogs.reduce((sum, log) => {
      const speed = Number(log.average_speed_kmh)
      const duration = Number(log.moving_time_seconds || log.duration_seconds)

      if (
        Number.isFinite(speed) &&
        speed > 0 &&
        Number.isFinite(duration) &&
        duration > 0
      ) {
        return sum + speed * duration
      }

      return sum
    }, 0)

    const weightedSpeedDenominator = filteredLogs.reduce((sum, log) => {
      const speed = Number(log.average_speed_kmh)
      const duration = Number(log.moving_time_seconds || log.duration_seconds)

      if (
        Number.isFinite(speed) &&
        speed > 0 &&
        Number.isFinite(duration) &&
        duration > 0
      ) {
        return sum + duration
      }

      return sum
    }, 0)

    const averageSpeed =
      weightedSpeedDenominator > 0
        ? weightedSpeedNumerator / weightedSpeedDenominator
        : speeds.length
          ? speeds.reduce((sum, value) => sum + value, 0) / speeds.length
          : null

    const maxSpeedValues = filteredLogs
      .map(log => Number(log.max_speed_kmh))
      .filter(value => Number.isFinite(value) && value > 0)

    const maxSpeed = maxSpeedValues.length
      ? Math.max(...maxSpeedValues)
      : null

    const longestDistance = filteredLogs.length
      ? Math.max(
          ...filteredLogs.map(log =>
            Number(log.distance_meters) > 0
              ? Number(log.distance_meters) / 1000
              : parseKm(log.km)
          )
        )
      : 0

    const longestDuration = filteredLogs.length
      ? Math.max(
          ...filteredLogs.map(log =>
            Number(log.moving_time_seconds || log.duration_seconds) || 0
          )
        )
      : 0

    const mostElevation = filteredLogs.length
      ? Math.max(
          ...filteredLogs.map(log =>
            Number(log.elevation_gain) ||
            Number(log.hoehenmeter) ||
            0
          )
        )
      : 0

    const highestHmPer10Km = filteredLogs.reduce((best, log) => {
      const distance =
        Number(log.distance_meters) > 0
          ? Number(log.distance_meters) / 1000
          : parseKm(log.km)

      const gain =
        Number(log.elevation_gain) ||
        Number(log.hoehenmeter) ||
        0

      if (distance <= 0 || gain <= 0) return best
      return Math.max(best, (gain / distance) * 10)
    }, 0)

    const distribution = Object.entries(
      filteredLogs.reduce((acc, log) => {
        const type = log.sport_type || 'running'
        const key = type === 'walking' ? 'hiking' : type

        if (!acc[key]) {
          acc[key] = {
            count: 0,
            km: 0,
            seconds: 0,
            elevation: 0,
          }
        }

        acc[key].count += 1
        acc[key].km +=
          Number(log.distance_meters) > 0
            ? Number(log.distance_meters) / 1000
            : parseKm(log.km)

        acc[key].seconds +=
          Number(log.moving_time_seconds || log.duration_seconds) || 0

        acc[key].elevation +=
          Number(log.elevation_gain) ||
          Number(log.hoehenmeter) ||
          0

        return acc
      }, {})
    )
      .map(([type, values]) => ({
        type,
        ...values,
      }))
      .sort((a, b) => b.count - a.count)

    const activityDays = new Set(
      filteredLogs
        .map(log => log.actual_date)
        .filter(Boolean)
    ).size

    const timeSeriesMap = new Map()

    filteredLogs.forEach(log => {
      const date = toLocalDate(log.actual_date)
      if (!date) return

      const key = period === 'year' ? getMonthKey(date) : getIsoWeekKey(date)

      if (!timeSeriesMap.has(key)) {
        timeSeriesMap.set(key, {
          key,
          km: 0,
          count: 0,
          seconds: 0,
          elevation: 0,
        })
      }

      const item = timeSeriesMap.get(key)
      item.count += 1
      item.km +=
        Number(log.distance_meters) > 0
          ? Number(log.distance_meters) / 1000
          : parseKm(log.km)
      item.seconds +=
        Number(log.moving_time_seconds || log.duration_seconds) || 0
      item.elevation +=
        Number(log.elevation_gain) ||
        Number(log.hoehenmeter) ||
        0
    })

    const timeSeries = [...timeSeriesMap.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(period === 'year' ? -12 : -8)

    let maxSerie = 0
    let currentSerie = 0

    if (isRunning && plan?.phases) {
      for (const phase of plan.phases) {
        for (const week of phase.weeks || []) {
          const requiredDays = week.days?.filter(day => !day.optional) || []

          const completed = requiredDays.filter((day, index) => {
            const key = `${phase.id}_w${week.n}_d${index}`
            return filteredLogs.some(log => log.day_key === key)
          })

          if (
            requiredDays.length > 0 &&
            completed.length === requiredDays.length
          ) {
            currentSerie += 1
            maxSerie = Math.max(maxSerie, currentSerie)
          } else {
            currentSerie = 0
          }
        }
      }
    }

    return {
      totalActivities,
      totalKm,
      totalSeconds,
      elevationGain,
      elevationLoss,
      averageHeartRate,
      averagePace,
      fastestPace,
      averageSpeed,
      maxSpeed,
      longestDistance,
      longestDuration,
      mostElevation,
      highestHmPer10Km,
      distribution,
      activityDays,
      timeSeries,
      maxSerie,
      isRunning,
      isHiking,
      isCycling,
      isMtb,
    }
  }, [filteredLogs, sportFilter, period, plan])

  const periodLabel = useMemo(() => {
    if (period === 'month') {
      return referenceDate.toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      })
    }

    if (period === 'year') {
      return `Sportjahr ${referenceDate.getFullYear()}`
    }

    if (period === 'all') return 'Gesamter Zeitraum'

    if (customFrom || customTo) {
      return `${customFrom || '…'} bis ${customTo || '…'}`
    }

    return 'Eigener Zeitraum'
  }, [period, referenceDate, customFrom, customTo])

  const shiftPeriod = direction => {
    const next = new Date(referenceDate)

    if (period === 'month') {
      next.setMonth(next.getMonth() + direction)
    } else if (period === 'year') {
      next.setFullYear(next.getFullYear() + direction)
    }

    setReferenceDate(next)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#B8A090', fontFamily: 'sans-serif' }}>
        ⏳ Lade…
      </div>
    )
  }

  const selectedSport = getSportConfig(sportFilter)
  const maxSeriesValue = Math.max(
    1,
    ...stats.timeSeries.map(item =>
      sportFilter === 'mountain_biking'
        ? item.elevation
        : item.km
    )
  )

  const summaryCards =
    sportFilter === 'all'
      ? [
          {
            label: 'Aktivitäten',
            value: stats.totalActivities,
            sub: `${stats.activityDays} aktive Tage`,
          },
          {
            label: 'Trainingszeit',
            value: formatHours(stats.totalSeconds),
            sub: 'gesamt',
          },
          {
            label: 'Gesamtstrecke',
            value: `${formatNumber(stats.totalKm)} km`,
            sub: 'alle Sportarten',
          },
          {
            label: 'Aufstieg',
            value: `${formatNumber(stats.elevationGain)} hm`,
            sub: 'gesamt',
          },
        ]
      : stats.isRunning
        ? [
            {
              label: 'Gesamt gelaufen',
              value: `${formatNumber(stats.totalKm)} km`,
              sub: `${stats.totalActivities} ${stats.totalActivities === 1 ? 'Lauf' : 'Läufe'}`,
            },
            {
              label: 'Trainingszeit',
              value: formatHours(stats.totalSeconds),
              sub: 'gesamt',
            },
            {
              label: 'Ø Pace',
              value: formatPace(stats.averagePace),
              sub: 'min/km Durchschnitt',
            },
            {
              label: 'Schnellste Pace',
              value: formatPace(stats.fastestPace),
              sub: 'min/km',
            },
          ]
        : stats.isHiking
          ? [
              {
                label: 'Gesamt gewandert',
                value: `${formatNumber(stats.totalKm)} km`,
                sub: `${stats.totalActivities} ${stats.totalActivities === 1 ? 'Wanderung' : 'Wanderungen'}`,
              },
              {
                label: 'Gesamtdauer',
                value: formatHours(stats.totalSeconds),
                sub: 'unterwegs',
              },
              {
                label: 'Ø Geschwindigkeit',
                value: stats.averageSpeed
                  ? `${formatNumber(stats.averageSpeed)} km/h`
                  : '–',
                sub: 'Durchschnitt',
              },
              {
                label: 'Aufstieg',
                value: `${formatNumber(stats.elevationGain)} hm`,
                sub: 'gesamt',
              },
            ]
          : stats.isCycling
            ? [
                {
                  label: 'Gesamt gefahren',
                  value: `${formatNumber(stats.totalKm)} km`,
                  sub: `${stats.totalActivities} ${stats.totalActivities === 1 ? 'Radtour' : 'Radtouren'}`,
                },
                {
                  label: 'Gesamtdauer',
                  value: formatHours(stats.totalSeconds),
                  sub: 'unterwegs',
                },
                {
                  label: 'Ø Geschwindigkeit',
                  value: stats.averageSpeed
                    ? `${formatNumber(stats.averageSpeed)} km/h`
                    : '–',
                  sub: 'Durchschnitt',
                },
                {
                  label: 'Höchste Geschwindigkeit',
                  value: stats.maxSpeed
                    ? `${formatNumber(stats.maxSpeed)} km/h`
                    : '–',
                  sub: 'Maximum',
                },
              ]
            : [
                {
                  label: 'Gesamt gefahren',
                  value: `${formatNumber(stats.totalKm)} km`,
                  sub: `${stats.totalActivities} MTB-${stats.totalActivities === 1 ? 'Tour' : 'Touren'}`,
                },
                {
                  label: 'Gesamtdauer',
                  value: formatHours(stats.totalSeconds),
                  sub: 'unterwegs',
                },
                {
                  label: 'Aufstieg',
                  value: `${formatNumber(stats.elevationGain)} hm`,
                  sub: 'gesamt',
                },
                {
                  label: 'Ø Geschwindigkeit',
                  value: stats.averageSpeed
                    ? `${formatNumber(stats.averageSpeed)} km/h`
                    : '–',
                  sub: 'Durchschnitt',
                },
              ]

  const bestPerformances =
    sportFilter === 'all'
      ? [
          {
            icon: '🏅',
            label: 'Aktivste Sportart',
            value:
              stats.distribution.length > 0
                ? getSportConfig(stats.distribution[0].type).label
                : '–',
          },
          {
            icon: '📅',
            label: 'Aktive Tage',
            value: stats.activityDays,
          },
          {
            icon: '⛰️',
            label: 'Gesamter Aufstieg',
            value: `${formatNumber(stats.elevationGain)} hm`,
          },
          stats.averageHeartRate
            ? {
                icon: '❤️',
                label: 'Ø Herzfrequenz',
                value: `${Math.round(stats.averageHeartRate)} bpm`,
              }
            : null,
        ]
      : stats.isRunning
        ? [
            {
              icon: '🏅',
              label: 'Längster Lauf',
              value: `${formatNumber(stats.longestDistance)} km`,
            },
            {
              icon: '⚡',
              label: 'Schnellste Pace',
              value: `${formatPace(stats.fastestPace)} min/km`,
            },
            {
              icon: '🔥',
              label: 'Längste Serie',
              value: `${stats.maxSerie} ${stats.maxSerie === 1 ? 'Woche' : 'Wochen'} komplett`,
            },
            stats.averageHeartRate
              ? {
                  icon: '❤️',
                  label: 'Ø Herzfrequenz',
                  value: `${Math.round(stats.averageHeartRate)} bpm`,
                }
              : null,
          ]
        : stats.isHiking
          ? [
              {
                icon: '🏅',
                label: 'Längste Wanderung',
                value: `${formatNumber(stats.longestDistance)} km`,
              },
              {
                icon: '⏱',
                label: 'Längste Dauer',
                value: formatHours(stats.longestDuration),
              },
              {
                icon: '⛰️',
                label: 'Höchster Aufstieg',
                value: `${formatNumber(stats.mostElevation)} hm`,
              },
              stats.averageHeartRate
                ? {
                    icon: '❤️',
                    label: 'Ø Herzfrequenz',
                    value: `${Math.round(stats.averageHeartRate)} bpm`,
                  }
                : null,
            ]
          : stats.isCycling
            ? [
                {
                  icon: '🏅',
                  label: 'Längste Radtour',
                  value: `${formatNumber(stats.longestDistance)} km`,
                },
                {
                  icon: '⚡',
                  label: 'Höchste Geschwindigkeit',
                  value: stats.maxSpeed
                    ? `${formatNumber(stats.maxSpeed)} km/h`
                    : '–',
                },
                {
                  icon: '⛰️',
                  label: 'Höchster Aufstieg',
                  value: `${formatNumber(stats.mostElevation)} hm`,
                },
                stats.averageHeartRate
                  ? {
                      icon: '❤️',
                      label: 'Ø Herzfrequenz',
                      value: `${Math.round(stats.averageHeartRate)} bpm`,
                    }
                  : null,
              ]
            : [
                {
                  icon: '🏅',
                  label: 'Längste MTB-Tour',
                  value: `${formatNumber(stats.longestDistance)} km`,
                },
                {
                  icon: '⛰️',
                  label: 'Höchster Aufstieg',
                  value: `${formatNumber(stats.mostElevation)} hm`,
                },
                {
                  icon: '📈',
                  label: 'Meiste hm pro 10 km',
                  value: `${formatNumber(stats.highestHmPer10Km)} hm`,
                },
                stats.maxSpeed
                  ? {
                      icon: '⚡',
                      label: 'Höchste Geschwindigkeit',
                      value: `${formatNumber(stats.maxSpeed)} km/h`,
                    }
                  : null,
              ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 5,
          marginBottom: 12,
          scrollbarWidth: 'none',
        }}
      >
        {SPORT_FILTERS.map(filter => {
          const active = sportFilter === filter.key

          return (
            <button
              key={filter.key}
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
          background: 'white',
          borderRadius: 14,
          padding: 12,
          border: '1px solid #F0E8E0',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 7,
            overflowX: 'auto',
            paddingBottom: 7,
            scrollbarWidth: 'none',
          }}
        >
          {[
            ['month', 'Monat'],
            ['year', 'Jahr'],
            ['all', 'Gesamt'],
            ['custom', 'Zeitraum'],
          ].map(([key, label]) => {
            const active = period === key

            return (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                style={{
                  flex: '0 0 auto',
                  padding: '7px 12px',
                  borderRadius: 10,
                  border: active
                    ? '1.5px solid #FF8C69'
                    : '1px solid #F0E0D0',
                  background: active ? '#FFF3EC' : '#FFFDFC',
                  color: active ? '#C16045' : '#8B6B5A',
                  fontSize: 11,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'sans-serif',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {(period === 'month' || period === 'year') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              paddingTop: 7,
            }}
          >
            <button
              onClick={() => shiftPeriod(-1)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: '1px solid #F0E0D0',
                background: '#FFF8F5',
                color: '#8B6B5A',
                cursor: 'pointer',
              }}
            >
              ‹
            </button>

            <div
              style={{
                fontSize: 13,
                fontWeight: 'bold',
                color: '#3D2B1F',
                fontFamily: 'sans-serif',
                textAlign: 'center',
              }}
            >
              {periodLabel}
            </div>

            <button
              onClick={() => shiftPeriod(1)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: '1px solid #F0E0D0',
                background: '#FFF8F5',
                color: '#8B6B5A',
                cursor: 'pointer',
              }}
            >
              ›
            </button>
          </div>
        )}

        {period === 'all' && (
          <div
            style={{
              paddingTop: 7,
              fontSize: 13,
              fontWeight: 'bold',
              color: '#3D2B1F',
              fontFamily: 'sans-serif',
              textAlign: 'center',
            }}
          >
            {periodLabel}
          </div>
        )}

        {period === 'custom' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              paddingTop: 7,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 9,
                  textTransform: 'uppercase',
                  color: '#B8A090',
                  marginBottom: 4,
                  fontFamily: 'sans-serif',
                  fontWeight: 'bold',
                }}
              >
                Von
              </div>
              <input
                type="date"
                value={customFrom}
                onChange={event => setCustomFrom(event.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: '1px solid #F0E0D0',
                  background: '#FFF8F5',
                  color: '#3D2B1F',
                  fontFamily: 'sans-serif',
                }}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 9,
                  textTransform: 'uppercase',
                  color: '#B8A090',
                  marginBottom: 4,
                  fontFamily: 'sans-serif',
                  fontWeight: 'bold',
                }}
              >
                Bis
              </div>
              <input
                type="date"
                value={customTo}
                onChange={event => setCustomTo(event.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: '1px solid #F0E0D0',
                  background: '#FFF8F5',
                  color: '#3D2B1F',
                  fontFamily: 'sans-serif',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {stats.totalActivities === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#B8A090',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>
            {sportFilter === 'all' ? '📊' : selectedSport.icon}
          </div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            Keine Aktivitäten im gewählten Zeitraum
          </div>
          <div style={{ fontSize: 12, color: '#D4C4B8' }}>
            Wähle einen anderen Zeitraum oder eine andere Sportart.
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 16,
            }}
          >
            {summaryCards.map((metric, index) => (
              <div
                key={index}
                style={{
                  background: 'white',
                  borderRadius: 14,
                  padding: 14,
                  border: '1px solid #F0E8E0',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: '#B8A090',
                    marginBottom: 4,
                    fontFamily: 'sans-serif',
                  }}
                >
                  {metric.label}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 'bold',
                    color: '#3D2B1F',
                  }}
                >
                  {metric.value}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#C4A882',
                    fontFamily: 'sans-serif',
                    marginTop: 2,
                  }}
                >
                  {metric.sub}
                </div>
              </div>
            ))}
          </div>

          {sportFilter === 'all' && stats.distribution.length > 0 && (
            <div
              style={{
                background: 'white',
                borderRadius: 14,
                padding: 14,
                border: '1px solid #F0E8E0',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: '#5C3D2E',
                  marginBottom: 10,
                  fontFamily: 'sans-serif',
                }}
              >
                Verteilung nach Sportarten
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {stats.distribution.map(item => {
                  const config = getSportConfig(item.type)

                  return (
                    <div
                      key={item.type}
                      style={{
                        padding: '10px 11px',
                        borderRadius: 12,
                        background: config.soft,
                        border: `1px solid ${config.color}33`,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          alignItems: 'center',
                          fontFamily: 'sans-serif',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: '#3D2B1F',
                            fontWeight: 'bold',
                          }}
                        >
                          {config.icon} {config.label}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: config.color,
                            fontWeight: 'bold',
                            textAlign: 'right',
                          }}
                        >
                          {item.count} · {formatNumber(item.km)} km
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 10,
                          color: '#8B6B5A',
                          marginTop: 4,
                          fontFamily: 'sans-serif',
                        }}
                      >
                        {formatHours(item.seconds)}
                        {item.elevation > 0
                          ? ` · ${formatNumber(item.elevation)} hm`
                          : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {stats.timeSeries.length > 0 && (
            <div
              style={{
                background: 'white',
                borderRadius: 14,
                padding: 14,
                border: '1px solid #F0E8E0',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: '#5C3D2E',
                  marginBottom: 12,
                  fontFamily: 'sans-serif',
                }}
              >
                {period === 'year'
                  ? 'Aktivitäten pro Monat'
                  : sportFilter === 'mountain_biking'
                    ? 'Höhenmeter pro Woche'
                    : 'Kilometer pro Woche'}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 6,
                  height: 88,
                }}
              >
                {stats.timeSeries.map((item, index) => {
                  const value =
                    sportFilter === 'mountain_biking'
                      ? item.elevation
                      : item.km

                  const label =
                    period === 'year'
                      ? new Date(`${item.key}-01T00:00:00`).toLocaleDateString(
                          'de-DE',
                          { month: 'short' }
                        )
                      : item.key.split('-W')[1]

                  return (
                    <div
                      key={item.key}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 8,
                          color: selectedSport.color,
                          fontFamily: 'sans-serif',
                          fontWeight: 'bold',
                        }}
                      >
                        {formatNumber(value)}
                      </div>

                      <div
                        style={{
                          width: '100%',
                          background:
                            index === stats.timeSeries.length - 1
                              ? 'linear-gradient(180deg,#FF8C69,#FF6B9D)'
                              : selectedSport.soft,
                          border: `1px solid ${selectedSport.color}22`,
                          borderRadius: 4,
                          height: `${Math.max(
                            5,
                            Math.round((value / maxSeriesValue) * 54)
                          )}px`,
                          boxSizing: 'border-box',
                        }}
                      />

                      <div
                        style={{
                          fontSize: 8,
                          color: '#C4A882',
                          fontFamily: 'sans-serif',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {period === 'year' ? label : `W${label}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div
            style={{
              background: 'white',
              borderRadius: 14,
              padding: 14,
              border: '1px solid #F0E8E0',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 'bold',
                color: '#5C3D2E',
                marginBottom: 10,
                fontFamily: 'sans-serif',
              }}
            >
              {sportFilter === 'all'
                ? 'Zusammenfassung'
                : 'Persönliche Bestleistungen'}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {bestPerformances
                .filter(Boolean)
                .map((item, index, items) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 14,
                      alignItems: 'center',
                      padding: '6px 0',
                      borderBottom:
                        index < items.length - 1
                          ? '0.5px solid #F5EDE8'
                          : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: '#8B6B5A',
                        fontFamily: 'sans-serif',
                      }}
                    >
                      {item.icon} {item.label}
                    </span>

                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 'bold',
                        color: '#3D2B1F',
                        fontFamily: 'sans-serif',
                        textAlign: 'right',
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
