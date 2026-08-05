import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { selectActivityHighlight } from '../lib/activityHighlights.js'

const SPORT_META = {
  running: { icon: '🏃', label: 'Laufen' },
  hiking: { icon: '🥾', label: 'Wandern' },
  walking: { icon: '🚶', label: 'Walking' },
  cycling: { icon: '🚴', label: 'Radfahren' },
  mountain_biking: { icon: '🚵', label: 'Mountainbike' },
  swimming: { icon: '🏊', label: 'Schwimmen' },
}

const classifyPhase = (name = '') => {
  const normalized = String(name).toLowerCase()

  if (
    normalized.includes('intervall') ||
    normalized.includes('tempo') ||
    normalized.includes('schnell')
  ) {
    return {
      key: 'interval',
      icon: '🔥',
      color: '#E56B6F',
      background: '#FFF3F2',
    }
  }

  if (
    normalized.includes('locker') ||
    normalized.includes('pause') ||
    normalized.includes('erholung')
  ) {
    return {
      key: 'recovery',
      icon: '🌿',
      color: '#E3B341',
      background: '#FFF9E8',
    }
  }

  if (normalized.includes('einlaufen') || normalized.includes('warm')) {
    return {
      key: 'warmup',
      icon: '🟢',
      color: '#5BA88A',
      background: '#F2FBF6',
    }
  }

  if (normalized.includes('auslaufen') || normalized.includes('cool')) {
    return {
      key: 'cooldown',
      icon: '🏁',
      color: '#5BA88A',
      background: '#F2FBF6',
    }
  }

  return {
    key: 'other',
    icon: '🏃',
    color: '#A78BCA',
    background: '#F7F2FF',
  }
}

const shortPhaseLabel = phase => {
  if (phase?.plannedDistanceMeters != null) {
    const value = Number(phase.plannedDistanceMeters)
    return value >= 1000
      ? `${(value / 1000).toFixed(1)} km`
      : `${Math.round(value)} m`
  }

  if (phase?.plannedDurationSeconds != null) {
    return `${Math.round(Number(phase.plannedDurationSeconds) / 60)} min`
  }

  return '–'
}

const paceToSeconds = pace => {
  const match = String(pace || '').match(/(\d+):(\d{2})/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const averagePace = (phases, type) => {
  const values = phases
    .filter(phase => classifyPhase(phase?.name).key === type)
    .map(phase => paceToSeconds(phase?.pace))
    .filter(value => value != null)

  if (!values.length) return null

  const average = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  )

  return `${Math.floor(average / 60)}:${String(average % 60).padStart(2, '0')}/km`
}

const numberOrNull = value => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const getLatitude = point =>
  numberOrNull(
    point?.latitude ??
      point?.lat ??
      point?.position?.latitude ??
      point?.position?.lat
  )

const getLongitude = point =>
  numberOrNull(
    point?.longitude ??
      point?.lon ??
      point?.lng ??
      point?.position?.longitude ??
      point?.position?.lon ??
      point?.position?.lng
  )

const getAltitude = point =>
  numberOrNull(
    point?.altitude ??
      point?.altitudeMeters ??
      point?.elevation ??
      point?.elevationMeters
  )

const buildRouteOverlay = routeWaypoints => {
  const points = (Array.isArray(routeWaypoints) ? routeWaypoints : [])
    .map(point => ({
      lat: getLatitude(point),
      lon: getLongitude(point),
    }))
    .filter(point => point.lat !== null && point.lon !== null)

  if (points.length < 2) return null

  const minLat = Math.min(...points.map(point => point.lat))
  const maxLat = Math.max(...points.map(point => point.lat))
  const minLon = Math.min(...points.map(point => point.lon))
  const maxLon = Math.max(...points.map(point => point.lon))

  const middleLatitude = (minLat + maxLat) / 2
  const longitudeCorrection = Math.max(
    0.2,
    Math.cos((middleLatitude * Math.PI) / 180)
  )

  // Approximate geographical proportions instead of stretching every
  // route to the same rectangle.
  const geographicWidth = Math.max(
    0.00001,
    (maxLon - minLon) * longitudeCorrection
  )
  const geographicHeight = Math.max(0.00001, maxLat - minLat)
  const aspectRatio = geographicWidth / geographicHeight

  const width = 1000
  const height = 620
  const padding = 70
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2
  const scale = Math.min(
    innerWidth / geographicWidth,
    innerHeight / geographicHeight
  )

  const renderedWidth = geographicWidth * scale
  const renderedHeight = geographicHeight * scale
  const offsetX = (width - renderedWidth) / 2
  const offsetY = (height - renderedHeight) / 2

  const scaled = points.map(point => ({
    x:
      offsetX +
      (point.lon - minLon) *
        longitudeCorrection *
        scale,
    y:
      offsetY +
      (maxLat - point.lat) * scale,
  }))

  return {
    width,
    height,
    aspectRatio,
    path: scaled
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
      )
      .join(' '),
    start: scaled[0],
    end: scaled[scaled.length - 1],
  }
}

const buildElevationProfile = routeWaypoints => {
  const values = (Array.isArray(routeWaypoints) ? routeWaypoints : [])
    .map(getAltitude)
    .filter(value => value !== null)

  if (values.length < 3) return null

  const sampled =
    values.length <= 100
      ? values
      : Array.from({ length: 100 }, (_, index) =>
          values[Math.round((index / 99) * (values.length - 1))]
        )

  const min = Math.min(...sampled)
  const max = Math.max(...sampled)
  const range = Math.max(1, max - min)
  const width = 900
  const height = 130
  const padding = 8

  const points = sampled.map((altitude, index) => ({
    x:
      padding +
      (index / (sampled.length - 1)) *
        (width - padding * 2),
    y:
      padding +
      (1 - (altitude - min) / range) *
        (height - padding * 2),
  }))

  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    )
    .join(' ')

  return {
    width,
    height,
    line,
    area: `${line} L ${points[points.length - 1].x} ${
      height - padding
    } L ${points[0].x} ${height - padding} Z`,
  }
}

const normalizeCalories = value => {
  if (value == null || value === '') return null
  const text = String(value)
  return /kcal/i.test(text) ? text : `${text} kcal`
}

const normalizeElevation = value => {
  if (value == null || value === '') return null
  const text = String(value)
  return /hm/i.test(text) ? text : `${text} hm`
}

const parseTrainingPlanTitle = value => {
  const raw = String(value || '').trim()

  if (!raw) {
    return {
      weekLabel: null,
      trainingLabel: null,
    }
  }

  const weekMatch = raw.match(/\b(?:Wo\.?|Woche)\s*(\d+)\b/i)
  const weekLabel = weekMatch ? `Woche ${weekMatch[1]}` : null

  let trainingLabel = raw
    .replace(/\b(?:Wo\.?|Woche)\s*\d+\b/gi, '')
    .replace(
      /\b(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\b/gi,
      ''
    )
    .replace(/[·|–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const normalized = trainingLabel.toLowerCase()

  if (normalized.includes('intervall')) {
    trainingLabel = 'Intervalltraining'
  } else if (
    normalized.includes('long run') ||
    normalized.includes('langer lauf') ||
    normalized.includes('lang')
  ) {
    trainingLabel = 'Long Run'
  } else if (
    normalized.includes('tempo') ||
    normalized.includes('schwelle')
  ) {
    trainingLabel = 'Tempolauf'
  } else if (
    normalized.includes('regeneration') ||
    normalized.includes('recovery')
  ) {
    trainingLabel = 'Regenerationslauf'
  } else if (
    normalized.includes('locker') ||
    normalized.includes('easy')
  ) {
    trainingLabel = 'Lockerer Lauf'
  } else if (!trainingLabel) {
    trainingLabel = null
  }

  return {
    weekLabel,
    trainingLabel,
  }
}

const waitForPaint = () =>
  new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })

function Toggle({ checked, onChange, label }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        background: '#FFF8F5',
        border: '1px solid #F0E8E0',
        borderRadius: 11,
        padding: '8px 9px',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        style={{ width: 17, height: 17 }}
      />
      <span>{label}</span>
    </label>
  )
}

function StoryTimeline({ phases, density = 'comfortable' }) {
  if (!Array.isArray(phases) || phases.length === 0) return null

  const compact =
    phases.length > 9 || density === 'compact' || density === 'dense'
  const veryCompact =
    phases.length > 11 || density === 'compact'

  return (
    <div style={{ display: 'flex', gap: 4, width: '100%' }}>
      {phases.map((phase, index) => {
        const meta = classifyPhase(phase?.name)
        const phasePace = phase?.pace
          ? phase.pace.replace(' min/km', '')
          : '–'

        const weight =
          Number(phase?.actualDurationSeconds) ||
          Number(phase?.actualDistanceMeters) ||
          1

        return (
          <div
            key={`${phase?.index || index}-${phase?.name || 'phase'}`}
            style={{
              flexGrow: weight,
              flexBasis: 0,
              minWidth: 0,
              background: meta.background,
              border: `1px solid ${meta.color}55`,
              borderTop: `5px solid ${meta.color}`,
              borderRadius: veryCompact ? 7 : 9,
              padding: veryCompact
                ? '5px 1px'
                : compact
                  ? '6px 1px'
                  : '8px 3px',
              textAlign: 'center',
              fontFamily: 'sans-serif',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontSize: veryCompact ? 9 : compact ? 11 : 15,
                lineHeight: 1,
              }}
            >
              {meta.icon}
            </div>

            <div
              style={{
                fontSize: compact ? 6.8 : 9,
                fontWeight: 'bold',
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {shortPhaseLabel(phase)}
            </div>

            <div
              style={{
                fontSize: compact ? 6.8 : 9,
                color: '#8B6B5A',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {phasePace}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function StoryShareModal({
  open,
  onClose,
  title,
  date,
  routeMapUrl,
  routeWaypoints = [],
  sportType = 'running',
  distance,
  duration,
  pace,
  speed,
  heartRate,
  calories,
  runningIndex,
  elevation,
  elevationGain,
  userId,
  activityId,
  polarExerciseId,
  actualDate,
  phases = [],
  logoSrc = '/route-icon.png',
}) {
  const cardRef = useRef(null)
  const fileInputRef = useRef(null)

  const [creating, setCreating] = useState(false)
  const [showMap, setShowMap] = useState(true)
  const [showTimeline, setShowTimeline] = useState(true)
  const [showHeartRate, setShowHeartRate] = useState(true)
  const [showCalories, setShowCalories] = useState(true)
  const [showElevation, setShowElevation] = useState(true)
  const [showElevationProfile, setShowElevationProfile] = useState(true)
  const [showHighlight, setShowHighlight] = useState(true)
  const [highlightData, setHighlightData] = useState(null)
  const [highlightLoading, setHighlightLoading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [exportWithoutMap, setExportWithoutMap] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [infoMessage, setInfoMessage] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const intervalAverage = useMemo(
    () => averagePace(phases, 'interval'),
    [phases]
  )

  const recoveryAverage = useMemo(
    () => averagePace(phases, 'recovery'),
    [phases]
  )

  const sport = SPORT_META[sportType] || {
    icon: '🏅',
    label: 'Aktivität',
  }

  const routeOverlay = useMemo(
    () => buildRouteOverlay(routeWaypoints),
    [routeWaypoints]
  )

  const elevationProfile = useMemo(
    () => buildElevationProfile(routeWaypoints),
    [routeWaypoints]
  )

  const isRunning = sportType === 'running'
  const isElevationSport = [
    'hiking',
    'walking',
    'cycling',
    'mountain_biking',
  ].includes(sportType)

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    setShowMap(true)
    setShowTimeline(
      isRunning && Array.isArray(phases) && phases.length > 0
    )
    setShowCalories(true)
    setShowHeartRate(true)
    setShowHighlight(true)
    setShowElevation(!isRunning || Number(elevationGain) >= 100)
    setShowElevationProfile(
      isElevationSport || (isRunning && Number(elevationGain) >= 100)
    )

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open, isRunning, isElevationSport, elevationGain])

  useEffect(() => {
    if (!open) {
      setErrorMessage(null)
      setInfoMessage(null)
      setSuccessMessage(null)
      setExportWithoutMap(false)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    }
  }, [photoUrl])

  const handlePhotoChange = event => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Bitte wähle eine Bilddatei aus.')
      return
    }

    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(URL.createObjectURL(file))
    setErrorMessage(null)
  }

  const removePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhotoUrl(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const renderCanvas = async () => {
    if (!cardRef.current) {
      throw new Error('Die Aktivitätsvorschau ist noch nicht bereit.')
    }

    await waitForPaint()

    const { default: html2canvas } = await import('html2canvas')

    return html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#FFF8F0',
      logging: false,
      imageTimeout: 12000,
      removeContainer: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: cardRef.current.scrollWidth,
      windowHeight: cardRef.current.scrollHeight,
    })
  }

  const createBlob = async canvas => {
    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/png', 0.95)
    )

    if (!blob) {
      throw new Error('Die Bilddatei konnte nicht erzeugt werden.')
    }

    return blob
  }

  const buildFileName = () => {
    const sportSlug =
      sportType === 'mountain_biking'
        ? 'mountainbike'
        : sportType === 'cycling'
          ? 'radfahren'
          : sportType === 'hiking'
            ? 'wandern'
            : sportType === 'walking'
              ? 'walking'
              : sportType === 'swimming'
                ? 'schwimmen'
                : 'laufen'

    const dateSlug = actualDate
      ? String(actualDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    return `${sportSlug}-${dateSlug}.png`
  }

  const saveBlob = blob => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildFileName()
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()

    setSuccessMessage('Bild wurde gespeichert.')
    setTimeout(() => setSuccessMessage(null), 2200)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const shareBlob = async blob => {
    const file = new File([blob], buildFileName(), {
      type: 'image/png',
    })

    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: title || 'Meine Aktivität',
        })
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
        console.warn(
          'Teilen nicht möglich, Datei wird stattdessen gespeichert:',
          error
        )
      }
    }

    saveBlob(blob)
  }

  const createStoryBlob = async () => {
    let canvas

    try {
      canvas = await renderCanvas()
    } catch (firstError) {
      const mapWasVisible =
        showMap &&
        !exportWithoutMap &&
        Boolean(routeMapUrl) &&
        !routeOverlay

      if (!mapWasVisible) throw firstError

      console.warn(
        'Export mit Karte fehlgeschlagen. Zweiter Versuch ohne Karte:',
        firstError
      )

      setExportWithoutMap(true)
      setInfoMessage(
        'Die Kartenansicht konnte nicht exportiert werden. Das Bild wird ohne Karte erstellt.'
      )

      await waitForPaint()
      canvas = await renderCanvas()
    }

    return createBlob(canvas)
  }

  const createAndSave = async () => {
    if (creating) return

    setCreating(true)
    setErrorMessage(null)
    setInfoMessage(null)
    setSuccessMessage(null)

    try {
      const blob = await createStoryBlob()
      saveBlob(blob)
    } catch (error) {
      console.error('Aktivitätsbild konnte nicht gespeichert werden:', error)

      setErrorMessage(
        `Das Bild konnte nicht gespeichert werden: ${
          error?.message || 'Unbekannter Fehler'
        }`
      )
    } finally {
      setCreating(false)
      setExportWithoutMap(false)
    }
  }

  const createAndShare = async () => {
    if (creating) return

    setCreating(true)
    setErrorMessage(null)
    setInfoMessage(null)
    setSuccessMessage(null)

    try {
      const blob = await createStoryBlob()
      await shareBlob(blob)
    } catch (error) {
      console.error('Aktivitätsbild konnte nicht geteilt werden:', error)

      setErrorMessage(
        `Das Bild konnte nicht geteilt werden: ${
          error?.message || 'Unbekannter Fehler'
        }`
      )
    } finally {
      setCreating(false)
      setExportWithoutMap(false)
    }
  }

  const closeModal = () => {
    if (creating) return
    setErrorMessage(null)
    setInfoMessage(null)
    setExportWithoutMap(false)
    onClose()
  }

  const isPremium = true
  const isMinimal = false
  const isInterval = false
  const isRouteOnly = false
  const isSquare = false
  const hasPhoto = Boolean(photoUrl)

  const mapVisibleInPreview =
    showMap &&
    !routeOverlay &&
    routeMapUrl &&
    !exportWithoutMap

  const effectiveElevation =
    normalizeElevation(elevationGain) ||
    normalizeElevation(elevation)

  const effectiveCalories = normalizeCalories(calories)
  const {
    weekLabel,
    trainingLabel,
  } = parseTrainingPlanTitle(title)

  const displayTrainingLabel =
    trainingLabel || (isRunning ? 'Lauf' : sport.label)

  const currentHighlightActivity = useMemo(
    () => ({
      id: activityId,
      polarExerciseId,
      sportType,
      distance,
      pace,
      speed,
      heartRate,
      elevationGain,
      actualDate,
    }),
    [
      activityId,
      polarExerciseId,
      sportType,
      distance,
      pace,
      speed,
      heartRate,
      elevationGain,
      actualDate,
    ]
  )

  useEffect(() => {
    if (!open) return undefined

    let cancelled = false

    const loadHighlight = async () => {
      setHighlightLoading(true)

      try {
        let history = []

        if (userId) {
          const { data, error } = await supabase
            .from('logs')
            .select(
              'id, polar_exercise_id, actual_date, sport_type, km, distance_meters, pace, bpm, average_speed_kmh, elevation_gain, hoehenmeter'
            )
            .eq('user_id', userId)

          if (error) throw error
          history = data || []
        }

        const selected = selectActivityHighlight({
          current: currentHighlightActivity,
          history,
          trainingType: displayTrainingLabel,
        })

        if (!cancelled) {
          setHighlightData(selected)
        }
      } catch (error) {
        console.error(
          'Story-Highlight konnte nicht ermittelt werden:',
          error
        )

        if (!cancelled) {
          setHighlightData(
            selectActivityHighlight({
              current: currentHighlightActivity,
              history: [],
              trainingType: displayTrainingLabel,
            })
          )
        }
      } finally {
        if (!cancelled) {
          setHighlightLoading(false)
        }
      }
    }

    loadHighlight()

    return () => {
      cancelled = true
    }
  }, [
    open,
    userId,
    currentHighlightActivity,
    displayTrainingLabel,
  ])

  if (!open) return null

  const metricItems = [
    distance && ['📍', 'Distanz', distance],
    duration && ['⏱', 'Dauer', duration],
    (isRunning ? pace : speed || pace) && [
      isRunning ? '🏃' : '⚡',
      isRunning ? 'Pace' : 'Ø Tempo',
      isRunning ? pace : speed || pace,
    ],
    showElevation &&
      effectiveElevation && [
        '⛰️',
        'Aufstieg',
        effectiveElevation,
      ],
    showCalories &&
      effectiveCalories && [
        '🔥',
        'Kalorien',
        effectiveCalories,
      ],
    showHeartRate &&
      heartRate && ['❤️', 'Ø HF', heartRate],
  ].filter(Boolean)

  const classicMetrics = [
    ['📍', 'Distanz', distance],
    [
      isRunning ? '⏱' : '⚡',
      isRunning ? 'Pace' : 'Ø Tempo',
      isRunning ? pace : speed || pace,
    ],
    ...(showHeartRate ? [['❤️', 'Ø HF', heartRate]] : []),
    ...(showCalories && effectiveCalories
      ? [['🔥', 'Kalorien', effectiveCalories]]
      : []),
  ]

  const visibleMetrics = (
    isPremium || isSquare || isMinimal
      ? metricItems
      : classicMetrics
  ).filter(([, , value]) => value)

  const timelineVisible =
    showTimeline &&
    Array.isArray(phases) &&
    phases.length > 0

  const elevationProfileVisible =
    showElevationProfile &&
    Boolean(elevationProfile) &&
    !isSquare

  const highlightVisible =
    showHighlight && Boolean(highlightData)

  // Each visible block contributes to the space pressure inside the fixed
  // 9:16 story. The layout gets progressively more compact as content grows.
  const contentScore =
    visibleMetrics.length +
    (timelineVisible ? 3 : 0) +
    (elevationProfileVisible ? 2 : 0) +
    (highlightVisible ? 1 : 0) +
    (showMap && routeOverlay ? 2 : 0)

  const density =
    contentScore >= 11
      ? 'compact'
      : contentScore >= 8
        ? 'dense'
        : contentScore >= 6
          ? 'balanced'
          : 'comfortable'

  const metricColumns =
    visibleMetrics.length >= 5
      ? 3
      : visibleMetrics.length === 1
        ? 1
        : 2

  const onlyRoute =
    showMap &&
    Boolean(routeOverlay) &&
    visibleMetrics.length === 0 &&
    !timelineVisible &&
    !elevationProfileVisible &&
    !highlightVisible

  const routeAspectRatio = routeOverlay?.aspectRatio || 1
  const routeShape =
    routeAspectRatio >= 1.6
      ? 'wide'
      : routeAspectRatio <= 0.72
        ? 'tall'
        : 'balanced'

  const layout = {
    comfortable: {
      cardPadding: '30px 28px 42px',
      logoSize: 58,
      logoGap: 10,
      headerBottom: 16,
      titleSize: 27,
      titleBottom: 16,
      routeHeight: 228,
      routeWidth: '72%',
      routeLeft: '14%',
      metricGap: 10,
      metricBottom: 16,
      metricPadding: '13px 10px',
      metricRadius: 16,
      metricLabelSize: 10,
      metricValueSize: 18,
      timelinePadding: 15,
      timelineRadius: 20,
      timelineTitleSize: 11,
      timelineTitleBottom: 11,
      profileHeight: 72,
      blockGap: 12,
      highlightPadding: '11px 13px',
      highlightSize: 12,
    },
    balanced: {
      cardPadding: '25px 24px 34px',
      logoSize: 52,
      logoGap: 9,
      headerBottom: 11,
      titleSize: 24,
      titleBottom: 10,
      routeHeight: 188,
      routeWidth: '68%',
      routeLeft: '16%',
      metricGap: 8,
      metricBottom: 11,
      metricPadding: '10px 7px',
      metricRadius: 14,
      metricLabelSize: 8.5,
      metricValueSize: 16,
      timelinePadding: 12,
      timelineRadius: 17,
      timelineTitleSize: 10,
      timelineTitleBottom: 8,
      profileHeight: 60,
      blockGap: 9,
      highlightPadding: '9px 11px',
      highlightSize: 11,
    },
    dense: {
      cardPadding: '21px 20px 28px',
      logoSize: 46,
      logoGap: 8,
      headerBottom: 8,
      titleSize: 21,
      titleBottom: 7,
      routeHeight: 154,
      routeWidth: '64%',
      routeLeft: '18%',
      metricGap: 6,
      metricBottom: 8,
      metricPadding: '8px 5px',
      metricRadius: 12,
      metricLabelSize: 7.5,
      metricValueSize: 14,
      timelinePadding: 9,
      timelineRadius: 14,
      timelineTitleSize: 9,
      timelineTitleBottom: 6,
      profileHeight: 48,
      blockGap: 7,
      highlightPadding: '8px 9px',
      highlightSize: 10,
    },
    compact: {
      cardPadding: '18px 17px 22px',
      logoSize: 40,
      logoGap: 7,
      headerBottom: 6,
      titleSize: 19,
      titleBottom: 5,
      routeHeight: 126,
      routeWidth: '60%',
      routeLeft: '20%',
      metricGap: 5,
      metricBottom: 6,
      metricPadding: '6px 4px',
      metricRadius: 10,
      metricLabelSize: 6.8,
      metricValueSize: 12.5,
      timelinePadding: 7,
      timelineRadius: 12,
      timelineTitleSize: 8,
      timelineTitleBottom: 5,
      profileHeight: 40,
      blockGap: 5,
      highlightPadding: '7px 8px',
      highlightSize: 9,
    },
  }[density]

  const routeShapeHeightFactor =
    routeShape === 'wide'
      ? 0.78
      : routeShape === 'tall'
        ? 1.08
        : 0.92

  const routeDisplayWidth = onlyRoute
    ? '88%'
    : layout.routeWidth

  const routeDisplayLeft = onlyRoute
    ? '6%'
    : layout.routeLeft

  const routeDisplayHeight = onlyRoute
    ? '70%'
    : Math.round(
        layout.routeHeight * routeShapeHeightFactor
      )

  const routeVerticalShift = onlyRoute
    ? 0
    : density === 'comfortable'
      ? -14
      : density === 'balanced'
        ? -11
        : -8

  const routeStrokeWidth = onlyRoute ? 14 : 11.5
  const routeMarkerRadius = onlyRoute ? 14 : 10

  const cardBackground = hasPhoto
    ? `linear-gradient(
        180deg,
        rgba(20,18,16,0.10) 0%,
        rgba(20,18,16,0.14) 42%,
        rgba(20,18,16,0.78) 100%
      ), url("${photoUrl}") center / cover no-repeat`
    : isInterval
      ? 'linear-gradient(165deg, #FFF8F0 0%, #FFF0F2 48%, #F0FAF4 100%)'
      : 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 52%, #FFF0F5 100%)'

  const secondaryText = hasPhoto
    ? 'rgba(255,255,255,0.84)'
    : '#B08C72'

  const glassBackground = hasPhoto
    ? 'rgba(20,18,16,0.34)'
    : 'rgba(255,255,255,0.84)'

  const glassBorder = hasPhoto
    ? '1px solid rgba(255,255,255,0.25)'
    : '1px solid #EFE4DB'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aktivität teilen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(50,30,20,0.76)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding:
          'max(12px, env(safe-area-inset-top)) 12px max(18px, env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
        scrollPaddingTop: 140,
        scrollPaddingBottom: 110,
      }}
    >
      <div style={{ width: '100%', maxWidth: 620, margin: '0 auto' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 3,
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 18,
            padding: 12,
            marginBottom: 10,
            boxShadow: '0 6px 22px rgba(61,43,31,0.16)',
          }}
        >
          <div
            style={{
              fontFamily: 'sans-serif',
              fontSize: 17,
              color: '#3D2B1F',
              fontWeight: 'bold',
              marginBottom: 4,
            }}
          >
            Aktivität teilen
          </div>


          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                padding: '10px 11px',
                borderRadius: 12,
                border: '1.5px solid #FFD4B0',
                background: '#FFF5EE',
                color: '#C17A3A',
                fontSize: 11,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              📷 {photoUrl ? 'Foto ändern' : 'Eigenes Foto hinzufügen'}
            </button>

            {photoUrl && (
              <button
                type="button"
                onClick={removePhoto}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid #E8D9CF',
                  background: 'white',
                  color: '#B8A090',
                  fontSize: 11,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Entfernen
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 8,
              marginBottom: 10,
              fontFamily: 'sans-serif',
            }}
          >
            <Toggle
              checked={showHighlight}
              onChange={setShowHighlight}
              label="Highlight"
            />

            {showHighlight && (
              <div
                style={{
                  padding: '9px 10px',
                  borderRadius: 11,
                  border: '1px solid #F0E8E0',
                  background: 'white',
                  color: '#8B6B5A',
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                {highlightLoading
                  ? 'Highlight wird ermittelt…'
                  : highlightData
                    ? `${highlightData.icon} ${highlightData.text}${
                        highlightData.detail
                          ? ` · ${highlightData.detail}`
                          : ''
                      }`
                    : 'Für diese Aktivität ist noch kein Highlight verfügbar.'}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
              gap: 8,
              fontFamily: 'sans-serif',
              fontSize: 12,
              color: '#8B6B5A',
            }}
          >
            <Toggle checked={showMap} onChange={setShowMap} label="Karte / Route" />
            <Toggle checked={showTimeline} onChange={setShowTimeline} label="Phasen" />
            <Toggle checked={showHeartRate} onChange={setShowHeartRate} label="Herzfrequenz" />
            <Toggle checked={showCalories} onChange={setShowCalories} label="Kalorien" />

            {(effectiveElevation || isElevationSport) && (
              <Toggle checked={showElevation} onChange={setShowElevation} label="Höhenmeter" />
            )}

            {elevationProfile && (
              <Toggle
                checked={showElevationProfile}
                onChange={setShowElevationProfile}
                label="Höhenprofil"
              />
            )}
          </div>
        </div>

        {infoMessage && (
          <div
            style={{
              marginBottom: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: '#FFF9E8',
              border: '1px solid #FFE8A0',
              color: '#8B6B2E',
              fontFamily: 'sans-serif',
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            ℹ️ {infoMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 'calc(env(safe-area-inset-bottom) + 92px)',
              transform: 'translateX(-50%)',
              zIndex: 20,
              padding: '10px 14px',
              borderRadius: 999,
              background: 'rgba(45,112,82,0.96)',
              color: 'white',
              fontFamily: 'sans-serif',
              fontSize: 12,
              fontWeight: 'bold',
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
              whiteSpace: 'nowrap',
            }}
          >
            ✅ {successMessage}
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              marginBottom: 10,
              padding: '10px 12px',
              borderRadius: 12,
              background: '#FDECEA',
              border: '1px solid #F5C4CC',
              color: '#B85464',
              fontFamily: 'sans-serif',
              fontSize: 12,
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        <div
          ref={cardRef}
          style={{
            width: 540,
            maxWidth: '100%',
            aspectRatio: isSquare ? '1 / 1' : '9 / 16',
            margin: '0 auto',
            boxSizing: 'border-box',
            background: cardBackground,
            padding: isSquare
              ? '28px'
              : isMinimal
                ? '38px 34px 72px'
                : layout.cardPadding,
            color: hasPhoto ? 'white' : '#3D2B1F',
            fontFamily: "'Georgia', 'Times New Roman', serif",
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            position: 'relative',
          }}
        >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: layout.logoGap,
                marginBottom: isMinimal ? 24 : layout.headerBottom,
                position: 'relative',
                zIndex: 3,
              }}
            >
              <img
                src={logoSrc}
                alt=""
                style={{
                  width: layout.logoSize,
                  height: layout.logoSize,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.16)',
                  border: '1px solid rgba(255,255,255,0.9)',
                }}
              />

              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: 'sans-serif',
                    color: secondaryText,
                    marginTop: 0,
                  }}
                >
                  {date || 'Aktivität'}
                </div>

                {weekLabel && (
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: 'sans-serif',
                      color: secondaryText,
                      marginTop: 3,
                      fontWeight: 'bold',
                    }}
                  >
                    {weekLabel}
                  </div>
                )}
              </div>
            </div>

          {!isRouteOnly && (
            <div
              style={{
                fontSize: isMinimal ? 34 : layout.titleSize,
                fontWeight: 'bold',
                lineHeight: 1.08,
                marginBottom: isMinimal ? 24 : layout.titleBottom,
                position: 'relative',
                zIndex: 3,
                textShadow: hasPhoto
                  ? '0 2px 12px rgba(0,0,0,0.30)'
                  : 'none',
              }}
            >
              {sport.icon} {displayTrainingLabel}
            </div>
          )}

          {showMap && routeOverlay && (isPremium || isRouteOnly) && (
            <svg
              viewBox={`-45 -45 ${routeOverlay.width + 90} ${routeOverlay.height + 90}`}
              preserveAspectRatio="xMidYMid meet"
              style={{
                width: routeDisplayWidth,
                height: routeDisplayHeight,
                position: onlyRoute ? 'absolute' : 'relative',
                left: routeDisplayLeft,
                top: onlyRoute ? '12%' : routeVerticalShift,
                marginTop: onlyRoute ? 0 : 0,
                marginBottom: onlyRoute ? 0 : layout.blockGap,
                zIndex: 2,
                overflow: 'visible',
                contain: 'none',
                filter: hasPhoto
                  ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.34))'
                  : 'drop-shadow(0 4px 10px rgba(255,123,90,0.20))',
              }}
            >
              <path
                d={routeOverlay.path}
                fill="none"
                stroke={hasPhoto ? '#FFFFFF' : '#FF7B5A'}
                strokeWidth={routeStrokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={hasPhoto ? 0.94 : 0.9}
              />
              <circle
                cx={routeOverlay.start.x}
                cy={routeOverlay.start.y}
                r={routeMarkerRadius}
                fill="#5BA88A"
                stroke="white"
                strokeWidth={onlyRoute ? 7 : 5}
              />
              <circle
                cx={routeOverlay.end.x}
                cy={routeOverlay.end.y}
                r={routeMarkerRadius}
                fill="#E56B6F"
                stroke="white"
                strokeWidth={onlyRoute ? 7 : 5}
              />
            </svg>
          )}

          {mapVisibleInPreview && (
            <img
              data-story-map="true"
              src={routeMapUrl}
              alt="Strecke"
              crossOrigin="anonymous"
              style={{
                width: '100%',
                height: isInterval ? 198 : 238,
                objectFit: 'cover',
                borderRadius: 20,
                border: '1px solid #E9DED4',
                display: 'block',
                marginBottom: 17,
              }}
            />
          )}

          {!isRouteOnly && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMinimal
                    ? '1fr'
                    : `repeat(${metricColumns}, minmax(0, 1fr))`,
                  gap: layout.metricGap,
                  marginTop:
                    isPremium &&
                    !timelineVisible &&
                    !elevationProfileVisible &&
                    !highlightVisible
                      ? 'auto'
                      : showMap && routeOverlay
                        ? Math.max(3, layout.blockGap - 2)
                        : layout.blockGap,
                  marginBottom: layout.metricBottom,
                  position: 'relative',
                  zIndex: 3,
                }}
              >
                {visibleMetrics
                  .slice(0, isSquare ? 4 : 6)
                  .map(([icon, label, value]) => (
                    <div
                      key={label}
                      style={{
                        background: glassBackground,
                        border: glassBorder,
                        borderRadius: isMinimal
                          ? 16
                          : layout.metricRadius,
                        padding: isMinimal
                          ? '19px 14px'
                          : layout.metricPadding,
                        textAlign: 'center',
                        fontFamily: 'sans-serif',
                        backdropFilter: 'blur(7px)',
                        WebkitBackdropFilter: 'blur(7px)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: isMinimal
                            ? 12
                            : layout.metricLabelSize,
                          color: secondaryText,
                          textTransform: 'uppercase',
                          letterSpacing: 0.7,
                        }}
                      >
                        {icon} {label}
                      </div>

                      <div
                        style={{
                          marginTop:
                            density === 'compact' ? 2 : 4,
                          fontSize: isMinimal
                            ? 30
                            : layout.metricValueSize,
                          lineHeight: 1.08,
                          fontWeight: 'bold',
                        }}
                      >
                        {value || '–'}
                      </div>
                    </div>
                  ))}
              </div>

              {!isMinimal &&
                showTimeline &&
                Array.isArray(phases) &&
                phases.length > 0 && (
                  <div
                    style={{
                      background: glassBackground,
                      border: glassBorder,
                      borderRadius: layout.timelineRadius,
                      padding: isInterval
                        ? 18
                        : layout.timelinePadding,
                      position: 'relative',
                      zIndex: 3,
                    }}
                  >
                    <div
                      style={{
                        fontSize: layout.timelineTitleSize,
                        fontFamily: 'sans-serif',
                        fontWeight: 'bold',
                        color: secondaryText,
                        textTransform: 'uppercase',
                        letterSpacing: 0.8,
                        marginBottom: layout.timelineTitleBottom,
                      }}
                    >
                      Phasenübersicht
                    </div>

                    <StoryTimeline
                      phases={phases}
                      density={density}
                    />

                    {isInterval &&
                      (intervalAverage || recoveryAverage) && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            marginTop: 12,
                            fontFamily: 'sans-serif',
                          }}
                        >
                          {intervalAverage && (
                            <div
                              style={{
                                flex: 1,
                                background: '#FFF3F2',
                                color: '#B85464',
                                borderRadius: 12,
                                padding: 9,
                                textAlign: 'center',
                                fontSize: 11,
                                fontWeight: 'bold',
                              }}
                            >
                              🔥 Ø {intervalAverage}
                            </div>
                          )}

                          {recoveryAverage && (
                            <div
                              style={{
                                flex: 1,
                                background: '#FFF9E8',
                                color: '#A07830',
                                borderRadius: 12,
                                padding: 9,
                                textAlign: 'center',
                                fontSize: 11,
                                fontWeight: 'bold',
                              }}
                            >
                              🌿 Ø {recoveryAverage}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                )}


              {showElevationProfile &&
                elevationProfile &&
                !isSquare && (
                  <div
                    style={{
                      marginTop: layout.blockGap,
                      padding:
                        density === 'compact'
                          ? '6px 8px 5px'
                          : density === 'dense'
                            ? '7px 9px 6px'
                            : '10px 12px 8px',
                      borderRadius: 15,
                      background: glassBackground,
                      border: glassBorder,
                      position: 'relative',
                      zIndex: 3,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontFamily: 'sans-serif',
                        color: secondaryText,
                        textTransform: 'uppercase',
                        letterSpacing: 0.7,
                        marginBottom: 4,
                      }}
                    >
                      Höhenprofil
                    </div>

                    <svg
                      viewBox={`0 0 ${elevationProfile.width} ${elevationProfile.height}`}
                      style={{
                        width: '100%',
                        height: layout.profileHeight,
                        display: 'block',
                      }}
                    >
                      <path
                        d={elevationProfile.area}
                        fill={
                          hasPhoto
                            ? 'rgba(255,255,255,0.16)'
                            : 'rgba(91,168,138,0.18)'
                        }
                      />
                      <path
                        d={elevationProfile.line}
                        fill="none"
                        stroke={hasPhoto ? '#FFFFFF' : '#5BA88A'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
            </>
          )}

          {onlyRoute && (
            <div
              style={{
                position: 'absolute',
                left: 34,
                right: 34,
                bottom: 34,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                zIndex: 3,
                fontFamily: 'sans-serif',
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: secondaryText }}>
                  {date}
                </div>
                <div
                  style={{
                    fontSize: 25,
                    fontWeight: 'bold',
                    marginTop: 4,
                  }}
                >
                  {sport.icon} {title || sport.label}
                </div>
              </div>

              {distance && (
                <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                  {distance}
                </div>
              )}
            </div>
          )}

          {showHighlight && highlightData && (
            <div
              style={{
                marginTop: layout.blockGap,
                padding: layout.highlightPadding,
                borderRadius: 14,
                background: glassBackground,
                border: glassBorder,
                position: 'relative',
                zIndex: 3,
                fontFamily: 'sans-serif',
                fontSize: 12,
                fontWeight: 'bold',
                textAlign: 'center',
                backdropFilter: 'blur(7px)',
                WebkitBackdropFilter: 'blur(7px)',
              }}
            >
              {highlightData.icon} {highlightData.text}
              {highlightData.detail && (
                <span style={{ opacity: 0.86 }}>
                  {' '}· {highlightData.detail}
                </span>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 4,
            display: 'grid',
            gridTemplateColumns: '0.9fr 1.1fr 1.35fr',
            gap: 8,
            marginTop: 12,
            paddingTop: 14,
            paddingBottom:
              'max(14px, calc(env(safe-area-inset-bottom) + 8px))',
            background:
              'linear-gradient(to bottom, rgba(50,30,20,0), rgba(50,30,20,0.94) 22%)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <button
            type="button"
            onClick={closeModal}
            disabled={creating}
            style={{
              padding: '14px 9px',
              borderRadius: 15,
              border: '1px solid #E8D9CF',
              background: 'white',
              color: '#8B6B5A',
              fontWeight: 'bold',
              fontSize: 12,
              cursor: creating ? 'default' : 'pointer',
              opacity: creating ? 0.7 : 1,
            }}
          >
            Schließen
          </button>

          <button
            type="button"
            onClick={createAndSave}
            disabled={creating}
            style={{
              padding: '14px 9px',
              borderRadius: 15,
              border: '1px solid #FFD0B8',
              background: '#FFF5EE',
              color: '#C16045',
              fontWeight: 'bold',
              fontSize: 12,
              cursor: creating ? 'default' : 'pointer',
              opacity: creating ? 0.72 : 1,
            }}
          >
            {creating ? '⏳' : '💾 Speichern'}
          </button>

          <button
            type="button"
            onClick={createAndShare}
            disabled={creating}
            style={{
              padding: '14px 9px',
              borderRadius: 15,
              border: 'none',
              background:
                'linear-gradient(135deg,#FF8C69,#FF6B9D)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: 12,
              cursor: creating ? 'default' : 'pointer',
              opacity: creating ? 0.72 : 1,
            }}
          >
            {creating ? '⏳ Erstellen…' : '📤 Teilen'}
          </button>
        </div>
      </div>
    </div>
  )
}
