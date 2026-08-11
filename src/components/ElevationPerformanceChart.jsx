import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

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

const haversineKm = (a, b) => {
  const lat1 = getLatitude(a)
  const lon1 = getLongitude(a)
  const lat2 = getLatitude(b)
  const lon2 = getLongitude(b)

  if ([lat1, lon1, lat2, lon2].some(value => value === null)) return 0

  const radius = 6371
  const toRad = value => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2

  return 2 * radius * Math.asin(Math.sqrt(h))
}

const parsePaceSeconds = value => {
  if (!value) return null
  const match = String(value).match(/(\d+):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

const formatPace = seconds => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '–'
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
}

const formatDistance = value =>
  Number.isFinite(value)
    ? `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`
    : '–'

const buildProfile = routeWaypoints => {
  const points = (Array.isArray(routeWaypoints) ? routeWaypoints : [])
    .map(point => ({
      raw: point,
      altitude: getAltitude(point),
    }))
    .filter(point => point.altitude !== null)

  if (points.length < 2) return []

  let distance = 0

  return points.map((point, index) => {
    if (index > 0) {
      distance += haversineKm(points[index - 1].raw, point.raw)
    }

    return {
      distance,
      altitude: point.altitude,
    }
  })
}

const downsample = (points, maxPoints = 140) => {
  if (points.length <= maxPoints) return points

  const step = (points.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, index) => {
    return points[Math.round(index * step)]
  })
}

const getSplitMetrics = (splits, sportType) =>
  (Array.isArray(splits) ? splits : [])
    .map((split, index) => {
      const distanceMeters =
        numberOrNull(split?.distanzM ?? split?.distanceMeters) || 1000
      const durationSeconds =
        numberOrNull(split?.dauerSek ?? split?.durationSeconds)

      const speed =
        numberOrNull(split?.avgSpeed) ||
        (distanceMeters > 0 && durationSeconds > 0
          ? (distanceMeters / 1000) / (durationSeconds / 3600)
          : null)

      const paceSeconds =
        parsePaceSeconds(split?.pace) ||
        (distanceMeters > 0 && durationSeconds > 0
          ? durationSeconds / (distanceMeters / 1000)
          : null)

      const ascent =
        numberOrNull(
          split?.hoehenmeter ??
            split?.ascentMeters ??
            split?.elevationGain
        ) || 0

      const descent =
        numberOrNull(
          split?.abstiegMeter ??
            split?.descentMeters ??
            split?.elevationLoss
        ) || 0

      return {
        index: split?.km || index + 1,
        distanceMeters,
        durationSeconds,
        speed,
        paceSeconds,
        ascent,
        descent,
        effortValue:
          sportType === 'running' || sportType === 'hiking'
            ? paceSeconds
            : speed,
      }
    })
    .filter(split => Number.isFinite(split.effortValue) && split.effortValue > 0)

const getTerrainType = split => {
  const net = split.ascent - split.descent
  if (net >= 15) return 'up'
  if (net <= -15) return 'down'
  return 'flat'
}

const getSteepnessClass = split => {
  const distanceKm = Math.max(0.1, Number(split.distanceMeters || 0) / 1000)
  const net = Number(split.ascent || 0) - Number(split.descent || 0)
  const grade = (net / (distanceKm * 1000)) * 100

  if (grade >= 6) return { key: 'steep', color: '#E56B6F', label: 'steiler Anstieg' }
  if (grade >= 3) return { key: 'up', color: '#F3A45F', label: 'Anstieg' }
  if (grade <= -3) return { key: 'down', color: '#71B998', label: 'Abfahrt' }
  return { key: 'flat', color: '#83C5A7', label: 'flach' }
}

export default function ElevationPerformanceChart({
  routeWaypoints = [],
  splits = [],
  sportType = 'running',
  elevationGain = null,
  elevationLoss = null,
  defaultOpen = true,
}) {
  const [detailsOpen, setDetailsOpen] = useState(defaultOpen)
  const [activeSplitIndex, setActiveSplitIndex] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [activeProfileIndex, setActiveProfileIndex] = useState(null)

  const profile = useMemo(
    () => downsample(buildProfile(routeWaypoints)),
    [routeWaypoints]
  )

  const splitMetrics = useMemo(
    () => getSplitMetrics(splits, sportType),
    [splits, sportType]
  )

  if (profile.length < 2 && splitMetrics.length < 2) return null

  const altitudes = profile.map(point => point.altitude)
  const minAltitude = altitudes.length ? Math.min(...altitudes) : null
  const maxAltitude = altitudes.length ? Math.max(...altitudes) : null
  const totalDistance = profile.length
    ? profile[profile.length - 1].distance
    : null

  const chartWidth = 680
  const chartHeight = 190
  const padding = { left: 42, right: 14, top: 16, bottom: 28 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom
  const altitudeRange =
    maxAltitude !== null && minAltitude !== null
      ? Math.max(1, maxAltitude - minAltitude)
      : 1
  const distanceRange = Math.max(totalDistance || 1, 1)

  const scaled = profile.map(point => ({
    x: padding.left + (point.distance / distanceRange) * innerWidth,
    y:
      padding.top +
      innerHeight -
      ((point.altitude - minAltitude) / altitudeRange) * innerHeight,
  }))

  const highestProfilePoint =
    profile.length > 0
      ? profile.reduce((best, point) =>
          point.altitude > best.altitude ? point : best
        )
      : null

  const lowestProfilePoint =
    profile.length > 0
      ? profile.reduce((best, point) =>
          point.altitude < best.altitude ? point : best
        )
      : null

  const getProfilePointPosition = point => {
    if (!point) return null

    return {
      x: padding.left + (point.distance / distanceRange) * innerWidth,
      y:
        padding.top +
        innerHeight -
        ((point.altitude - minAltitude) / altitudeRange) * innerHeight,
    }
  }

  const highestPosition = getProfilePointPosition(highestProfilePoint)
  const lowestPosition = getProfilePointPosition(lowestProfilePoint)

  const activeSplit =
    activeSplitIndex == null
      ? null
      : splitMetrics.find(split => split.index === activeSplitIndex)

  const activeSplitStartKm = activeSplit
    ? Math.max(0, Number(activeSplit.index) - 1)
    : null
  const activeSplitEndKm = activeSplit
    ? Math.min(distanceRange, Number(activeSplit.index))
    : null

  const linePath = scaled
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const areaPath = scaled.length
    ? `${linePath} L ${scaled[scaled.length - 1].x} ${
        padding.top + innerHeight
      } L ${scaled[0].x} ${padding.top + innerHeight} Z`
    : ''

  // Eigene Geometrie für die vergrößerte Ansicht.
  // Dadurch wird das Diagramm höher gezeichnet, ohne Schriften und Linien
  // einfach vertikal zu verzerren.
  const largeChartHeight = 330
  const largePadding = { left: 42, right: 14, top: 18, bottom: 32 }
  const largeInnerHeight =
    largeChartHeight - largePadding.top - largePadding.bottom

  const largeScaled = profile.map(point => ({
    x: largePadding.left + (point.distance / distanceRange) * innerWidth,
    y:
      largePadding.top +
      largeInnerHeight -
      ((point.altitude - minAltitude) / altitudeRange) * largeInnerHeight,
  }))

  const largeLinePath = largeScaled
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const largeAreaPath = largeScaled.length
    ? `${largeLinePath} L ${largeScaled[largeScaled.length - 1].x} ${
        largePadding.top + largeInnerHeight
      } L ${largeScaled[0].x} ${largePadding.top + largeInnerHeight} Z`
    : ''

  const gridValues =
    minAltitude !== null && maxAltitude !== null
      ? [0, 0.5, 1].map(
          ratio => minAltitude + (maxAltitude - minAltitude) * ratio
        )
      : []

  const activeProfilePoint =
    activeProfileIndex == null ? null : profile[activeProfileIndex] || null

  const activeProfilePosition = activeProfilePoint
    ? getProfilePointPosition(activeProfilePoint)
    : null

  const activeLargeProfilePosition = activeProfilePoint
    ? {
        x:
          largePadding.left +
          (activeProfilePoint.distance / distanceRange) * innerWidth,
        y:
          largePadding.top +
          largeInnerHeight -
          ((activeProfilePoint.altitude - minAltitude) / altitudeRange) *
            largeInnerHeight,
      }
    : null

  const updateActiveProfilePoint = event => {
    if (!profile.length) return

    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width) return

    const plotLeft = rect.left + (padding.left / chartWidth) * rect.width
    const plotRight =
      rect.left + ((chartWidth - padding.right) / chartWidth) * rect.width
    const clientX = event.clientX
    const ratio = Math.max(
      0,
      Math.min(1, (clientX - plotLeft) / Math.max(1, plotRight - plotLeft))
    )
    const targetDistance = ratio * distanceRange

    let nearestIndex = 0
    let nearestDifference = Infinity

    profile.forEach((point, index) => {
      const difference = Math.abs(point.distance - targetDistance)
      if (difference < nearestDifference) {
        nearestDifference = difference
        nearestIndex = index
      }
    })

    setActiveProfileIndex(nearestIndex)
  }

  const effortValues = splitMetrics.map(split => split.effortValue)
  const minEffort = effortValues.length ? Math.min(...effortValues) : 0
  const maxEffort = effortValues.length ? Math.max(...effortValues) : 1
  const effortRange = Math.max(0.01, maxEffort - minEffort)

  const terrainGroups = splitMetrics.reduce(
    (acc, split) => {
      const type = getTerrainType(split)
      acc[type].push(split)
      return acc
    },
    { up: [], flat: [], down: [] }
  )

  const averageFor = (items, field) =>
    items.length
      ? items.reduce((sum, item) => sum + item[field], 0) / items.length
      : null

  const uphillAverage =
    sportType === 'running' || sportType === 'hiking'
      ? averageFor(terrainGroups.up, 'paceSeconds')
      : averageFor(terrainGroups.up, 'speed')
  const downhillAverage =
    sportType === 'running' || sportType === 'hiking'
      ? averageFor(terrainGroups.down, 'paceSeconds')
      : averageFor(terrainGroups.down, 'speed')

  const strongestClimb = [...splitMetrics]
    .filter(split => split.ascent - split.descent > 0)
    .sort(
      (a, b) =>
        b.ascent - b.descent - (a.ascent - a.descent)
    )[0]

  const strongestDescent = [...splitMetrics]
    .filter(split => split.descent - split.ascent > 0)
    .sort(
      (a, b) =>
        b.descent - b.ascent - (a.descent - a.ascent)
    )[0]

  const insight =
    uphillAverage && downhillAverage
      ? sportType === 'running' || sportType === 'hiking'
        ? `Bergauf warst du im Schnitt ${formatPace(
            Math.abs(uphillAverage - downhillAverage)
          )} min/km langsamer als bergab.`
        : `Bergauf lag deine Geschwindigkeit im Schnitt ${Math.abs(
            downhillAverage - uphillAverage
          ).toLocaleString('de-DE', {
            maximumFractionDigits: 1,
          })} km/h unter deiner Geschwindigkeit bergab.`
      : null

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        border: '1.5px solid #F0E8E0',
        padding: 14,
        marginBottom: 16,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: '#5C3D2E',
            }}
          >
            Höhenprofil
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 7,
              fontSize: 10,
              lineHeight: 1.4,
            }}
          >
            {elevationGain != null && (
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 99,
                  background: '#F0FAF4',
                  color: '#3D8B6E',
                  fontWeight: 'bold',
                }}
              >
                ↗️ {Math.round(Number(elevationGain))} hm
              </span>
            )}
            {elevationLoss != null && (
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 99,
                  background: '#EEF7FC',
                  color: '#497EAA',
                  fontWeight: 'bold',
                }}
              >
                ↘️ {Math.round(Number(elevationLoss))} hm
              </span>
            )}
            {maxAltitude !== null && (
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 99,
                  background: '#FFF6E8',
                  color: '#A07830',
                  fontWeight: 'bold',
                }}
              >
                🔺 {Math.round(maxAltitude)} m
              </span>
            )}
            {minAltitude !== null && (
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 99,
                  background: '#F7F2FF',
                  color: '#7A63A6',
                  fontWeight: 'bold',
                }}
              >
                🔻 {Math.round(minAltitude)} m
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDetailsOpen(value => !value)}
          style={{
            flexShrink: 0,
            border: 'none',
            background: '#F7F2EE',
            color: '#8B6B5A',
            borderRadius: 10,
            padding: '7px 9px',
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 'bold',
          }}
        >
          {detailsOpen ? 'Weniger' : 'Mehr'}
        </button>
      </div>

      {profile.length >= 2 && minAltitude !== null && maxAltitude !== null && (
        <div
          style={{
            fontSize: 9,
            color: '#B8A090',
            marginBottom: 5,
          }}
        >
          Maßstab {Math.round(minAltitude)}–{Math.round(maxAltitude)} m
        </div>
      )}

      {profile.length >= 2 && (
        <button
          type="button"
          onClick={() => {
            setActiveProfileIndex(null)
            setProfileOpen(true)
          }}
          aria-label="Höhenprofil vergrößern"
          style={{
            width: '100%',
            display: 'block',
            border: 'none',
            background: 'transparent',
            padding: 0,
            margin: 0,
            cursor: 'zoom-in',
            textAlign: 'left',
          }}
        >
          <div style={{ overflowX: 'hidden', position: 'relative' }}>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                zIndex: 1,
                padding: '5px 7px',
                borderRadius: 9,
                background: 'rgba(255,255,255,0.90)',
                border: '1px solid #EFE5DE',
                color: '#8B6B5A',
                fontSize: 9,
                fontWeight: 'bold',
                boxShadow: '0 3px 10px rgba(92,61,46,0.06)',
              }}
            >
              ⛶ Vergrößern
            </div>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ width: '100%', display: 'block' }}
              role="img"
              aria-label="Höhenprofil der Aktivität"
            >
            <defs>
              <linearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6DBB8B" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6DBB8B" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {gridValues.map((value, index) => {
              const y =
                padding.top +
                innerHeight -
                ((value - minAltitude) / altitudeRange) * innerHeight

              return (
                <g key={value}>
                  <line
                    x1={padding.left}
                    x2={chartWidth - padding.right}
                    y1={y}
                    y2={y}
                    stroke="#EFE8E2"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 7}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill="#B8A090"
                  >
                    {Math.round(value)} m
                  </text>
                </g>
              )
            })}

            {activeSplit && (
              <rect
                x={
                  padding.left +
                  (activeSplitStartKm / distanceRange) * innerWidth
                }
                y={padding.top}
                width={Math.max(
                  3,
                  ((activeSplitEndKm - activeSplitStartKm) / distanceRange) *
                    innerWidth
                )}
                height={innerHeight}
                fill="#FF8C69"
                opacity="0.10"
                rx="3"
              />
            )}

            <path d={areaPath} fill="url(#elevationFill)" />
            <path
              d={linePath}
              fill="none"
              stroke="#58A978"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {highestPosition && (
              <g>
                <line
                  x1={highestPosition.x}
                  x2={highestPosition.x}
                  y1={highestPosition.y - 24}
                  y2={highestPosition.y - 4}
                  stroke="#E56B6F"
                  strokeWidth="1.5"
                />
                <circle
                  cx={highestPosition.x}
                  cy={highestPosition.y}
                  r="4"
                  fill="#E56B6F"
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={highestPosition.x}
                  y={Math.max(11, highestPosition.y - 28)}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="#B85464"
                >
                  {Math.round(highestProfilePoint.altitude)} m
                </text>
              </g>
            )}

            {lowestPosition && (
              <g>
                <circle
                  cx={lowestPosition.x}
                  cy={lowestPosition.y}
                  r="3.5"
                  fill="#7A63A6"
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={lowestPosition.x}
                  y={Math.min(chartHeight - 31, lowestPosition.y + 15)}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill="#7A63A6"
                >
                  {Math.round(lowestProfilePoint.altitude)} m
                </text>
              </g>
            )}

            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
              const x = padding.left + ratio * innerWidth
              const distance = distanceRange * ratio

              return (
                <g key={ratio}>
                  <line
                    x1={x}
                    x2={x}
                    y1={padding.top + innerHeight}
                    y2={padding.top + innerHeight + 4}
                    stroke="#DCCFC5"
                  />
                  <text
                    x={x}
                    y={chartHeight - 8}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#B8A090"
                  >
                    {distance.toLocaleString('de-DE', {
                      maximumFractionDigits: 1,
                    })}{' '}
                    km
                  </text>
                </g>
              )
            })}
            </svg>
          </div>
        </button>
      )}

      {detailsOpen && splitMetrics.length >= 2 && (
        <>
          <div
            style={{
              borderTop: '1px solid #F0E8E0',
              marginTop: 8,
              paddingTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#5C3D2E',
                fontWeight: 'bold',
                marginBottom: 3,
              }}
            >
              Tempo und Höhenmeter je Abschnitt
            </div>
            <div
              style={{
                fontSize: 9,
                color: '#B8A090',
                marginBottom: 10,
              }}
            >
              Rot = steil · Orange = Anstieg · Grün = flach oder bergab
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 4,
                height: 112,
                overflowX: 'auto',
                paddingBottom: 4,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {splitMetrics.map(split => {
                const terrain = getTerrainType(split)
                const steepness = getSteepnessClass(split)
                const normalized =
                  sportType === 'running' || sportType === 'hiking'
                    ? (maxEffort - split.effortValue) / effortRange
                    : (split.effortValue - minEffort) / effortRange
                const height = 42 + Math.max(0, normalized) * 42
                const color = steepness.color
                const active = activeSplitIndex === split.index

                return (
                  <div
                    key={split.index}
                    style={{
                      minWidth: 44,
                      flex: '1 0 44px',
                      maxWidth: 64,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 8,
                        color: '#8B6B5A',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sportType === 'running' || sportType === 'hiking'
                        ? formatPace(split.paceSeconds)
                        : `${split.speed.toLocaleString('de-DE', {
                            maximumFractionDigits: 1,
                          })}`}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveSplitIndex(current =>
                          current === split.index ? null : split.index
                        )
                      }
                      title={`${steepness.label} · +${Math.round(
                        split.ascent
                      )} / -${Math.round(split.descent)} hm`}
                      style={{
                        width: '100%',
                        height,
                        borderRadius: '5px 5px 2px 2px',
                        background: color,
                        position: 'relative',
                        border: active
                          ? '2px solid #5C3D2E'
                          : '2px solid transparent',
                        boxShadow: active
                          ? '0 0 0 3px rgba(92,61,46,0.10)'
                          : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'transform 0.15s ease',
                        transform: active ? 'translateY(-3px)' : 'none',
                      }}
                    >
                      {(split.ascent > 0 || split.descent > 0) && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 3,
                            left: 2,
                            right: 2,
                            color: 'rgba(255,255,255,0.95)',
                            fontSize: 7,
                            fontWeight: 'bold',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          +{Math.round(split.ascent)}
                        </div>
                      )}
                    </button>

                    <div
                      style={{
                        fontSize: 8,
                        color: '#B8A090',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      km {split.index}
                    </div>
                  </div>
                )
              })}
            </div>

            {activeSplit && (
              <div
                style={{
                  marginTop: 9,
                  padding: '9px 10px',
                  borderRadius: 11,
                  background: '#FFF8F5',
                  border: '1px solid #F0E0D0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  fontSize: 10,
                  color: '#8B6B5A',
                }}
              >
                <div>
                  <strong style={{ color: '#3D2B1F' }}>
                    km {activeSplit.index}
                  </strong>
                  {' · '}
                  +{Math.round(activeSplit.ascent)} / -
                  {Math.round(activeSplit.descent)} hm
                </div>

                <div style={{ fontWeight: 'bold', color: '#3D2B1F' }}>
                  {sportType === 'running' || sportType === 'hiking'
                    ? formatPace(activeSplit.paceSeconds)
                    : `${activeSplit.speed.toLocaleString('de-DE', {
                        maximumFractionDigits: 1,
                      })} km/h`}
                </div>
              </div>
            )}
          </div>

          {(insight || strongestClimb || strongestDescent) && (
            <div
              style={{
                marginTop: 10,
                display: 'grid',
                gap: 7,
              }}
            >
              {strongestClimb && (
                <div
                  style={{
                    padding: '9px 10px',
                    borderRadius: 11,
                    background: '#FFF6E8',
                    border: '1px solid #F3D2A5',
                    color: '#A07830',
                    fontSize: 10,
                    lineHeight: 1.45,
                  }}
                >
                  ⛰️ Stärkster Anstieg bei km {strongestClimb.index}: +
                  {Math.round(strongestClimb.ascent)} hm
                </div>
              )}

              {strongestDescent && (
                <div
                  style={{
                    padding: '9px 10px',
                    borderRadius: 11,
                    background: '#EEF7FC',
                    border: '1px solid #C9E4F4',
                    color: '#497EAA',
                    fontSize: 10,
                    lineHeight: 1.45,
                  }}
                >
                  ↘️ Stärkste Abfahrt bei km {strongestDescent.index}: -
                  {Math.round(strongestDescent.descent)} hm
                </div>
              )}

              {insight && (
                <div
                  style={{
                    padding: '10px 11px',
                    borderRadius: 12,
                    background: '#F0FAF4',
                    border: '1px solid #B8E4CC',
                    color: '#3D8B6E',
                    fontSize: 10,
                    lineHeight: 1.5,
                  }}
                >
                  💡 {insight}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!profile.length && splitMetrics.length >= 2 && (
        <div
          style={{
            fontSize: 10,
            color: '#B8A090',
            lineHeight: 1.5,
          }}
        >
          Für diese Aktivität ist kein vollständiges Höhenprofil gespeichert.
          Die Abschnittsanalyse verwendet die Höhenmeter der Splits.
        </div>
      )}

      {profileOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Höhenprofil vergrößert"
            onClick={() => setProfileOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              background: 'rgba(48,35,28,0.48)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom))',
              boxSizing: 'border-box',
            }}
          >
            <div
              onClick={event => event.stopPropagation()}
              style={{
                width: 'min(980px, 100%)',
                maxHeight: '92vh',
                overflowY: 'auto',
                background: '#FFFCFA',
                borderRadius: 22,
                border: '1px solid #EEDFD5',
                boxShadow: '0 24px 70px rgba(61,43,31,0.24)',
                padding: '18px 16px 16px',
                boxSizing: 'border-box',
                fontFamily: 'sans-serif',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 19,
                      lineHeight: 1.15,
                      fontWeight: 850,
                      color: '#3D2B1F',
                    }}
                  >
                    Höhenprofil
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#9D8273',
                      marginTop: 5,
                    }}
                  >
                    Fahre mit dem Finger oder der Maus über das Profil.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  aria-label="Höhenprofil schließen"
                  style={{
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                    borderRadius: 12,
                    border: '1px solid #EADDD5',
                    background: '#FFFFFF',
                    color: '#6E5547',
                    cursor: 'pointer',
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                {elevationGain != null && (
                  <div
                    style={{
                      padding: '10px 11px',
                      borderRadius: 13,
                      background: '#F0FAF4',
                      border: '1px solid #D8EFE1',
                    }}
                  >
                    <div style={{ fontSize: 9, color: '#729985', fontWeight: 800 }}>
                      AUFSTIEG
                    </div>
                    <div style={{ fontSize: 17, color: '#3D8B6E', fontWeight: 850, marginTop: 3 }}>
                      ↗️ {Math.round(Number(elevationGain))} hm
                    </div>
                  </div>
                )}

                {elevationLoss != null && (
                  <div
                    style={{
                      padding: '10px 11px',
                      borderRadius: 13,
                      background: '#EEF7FC',
                      border: '1px solid #D8EAF4',
                    }}
                  >
                    <div style={{ fontSize: 9, color: '#7C9EB7', fontWeight: 800 }}>
                      ABSTIEG
                    </div>
                    <div style={{ fontSize: 17, color: '#497EAA', fontWeight: 850, marginTop: 3 }}>
                      ↘️ {Math.round(Number(elevationLoss))} hm
                    </div>
                  </div>
                )}

                {maxAltitude !== null && (
                  <div
                    style={{
                      padding: '10px 11px',
                      borderRadius: 13,
                      background: '#FFF6E8',
                      border: '1px solid #F4E2C4',
                    }}
                  >
                    <div style={{ fontSize: 9, color: '#AF8B55', fontWeight: 800 }}>
                      HÖCHSTER PUNKT
                    </div>
                    <div style={{ fontSize: 17, color: '#A07830', fontWeight: 850, marginTop: 3 }}>
                      🔺 {Math.round(maxAltitude)} m
                    </div>
                  </div>
                )}

                {minAltitude !== null && (
                  <div
                    style={{
                      padding: '10px 11px',
                      borderRadius: 13,
                      background: '#F7F2FF',
                      border: '1px solid #E8DDF8',
                    }}
                  >
                    <div style={{ fontSize: 9, color: '#9B88BD', fontWeight: 800 }}>
                      TIEFSTER PUNKT
                    </div>
                    <div style={{ fontSize: 17, color: '#7A63A6', fontWeight: 850, marginTop: 3 }}>
                      🔻 {Math.round(minAltitude)} m
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  minHeight: 50,
                  borderRadius: 14,
                  background: activeProfilePoint ? '#FFF6EE' : '#F7F3F0',
                  border: activeProfilePoint
                    ? '1px solid #F4CFB8'
                    : '1px solid #ECE2DC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  padding: '9px 12px',
                  boxSizing: 'border-box',
                  marginBottom: 8,
                  color: '#6E5547',
                }}
              >
                {activeProfilePoint ? (
                  <>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#A38A7C', fontWeight: 800 }}>
                        POSITION
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 850, color: '#3D2B1F', marginTop: 2 }}>
                        {activeProfilePoint.distance.toLocaleString('de-DE', {
                          maximumFractionDigits: 1,
                        })} km
                      </div>
                    </div>
                    <div style={{ width: 1, alignSelf: 'stretch', background: '#EADDD4' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#A38A7C', fontWeight: 800 }}>
                        HÖHE
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 850, color: '#3D8B6E', marginTop: 2 }}>
                        {Math.round(activeProfilePoint.altitude)} m
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: '#9D8273', textAlign: 'center' }}>
                    Profil berühren, um Kilometer und Höhe anzuzeigen.
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: 9,
                  color: '#B09A8D',
                  margin: '0 0 4px 2px',
                }}
              >
                Maßstab {Math.round(minAltitude)}–{Math.round(maxAltitude)} m
              </div>

              <div
                style={{
                  width: '100%',
                  overflow: 'hidden',
                  borderRadius: 14,
                  background: '#FFFFFF',
                  border: '1px solid #F0E8E0',
                }}
              >
                <svg
                  viewBox={`0 0 ${chartWidth} ${largeChartHeight}`}
                  onPointerDown={updateActiveProfilePoint}
                  onPointerMove={event => {
                    if (event.pointerType === 'mouse' || event.buttons > 0) {
                      updateActiveProfilePoint(event)
                    }
                  }}
                  onMouseMove={updateActiveProfilePoint}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    cursor: 'crosshair',
                  }}
                  role="img"
                  aria-label="Interaktives Höhenprofil der Aktivität"
                >
                  <defs>
                    <linearGradient id="elevationFillLarge" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6DBB8B" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#6DBB8B" stopOpacity="0.04" />
                    </linearGradient>
                  </defs>

                  {gridValues.map(value => {
                    const y =
                      largePadding.top +
                      largeInnerHeight -
                      ((value - minAltitude) / altitudeRange) *
                        largeInnerHeight

                    return (
                      <g key={`large-${value}`}>
                        <line
                          x1={largePadding.left}
                          x2={chartWidth - largePadding.right}
                          y1={y}
                          y2={y}
                          stroke="#EFE8E2"
                          strokeWidth="1"
                        />
                        <text
                          x={largePadding.left - 7}
                          y={y + 3}
                          textAnchor="end"
                          fontSize="9"
                          fill="#A99183"
                        >
                          {Math.round(value)} m
                        </text>
                      </g>
                    )
                  })}

                  <path d={largeAreaPath} fill="url(#elevationFillLarge)" />
                  <path
                    d={largeLinePath}
                    fill="none"
                    stroke="#58A978"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {activeLargeProfilePosition && activeProfilePoint && (
                    <g pointerEvents="none">
                      <line
                        x1={activeLargeProfilePosition.x}
                        x2={activeLargeProfilePosition.x}
                        y1={largePadding.top}
                        y2={largePadding.top + largeInnerHeight}
                        stroke="#C96F52"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                      />
                      <circle
                        cx={activeLargeProfilePosition.x}
                        cy={activeLargeProfilePosition.y}
                        r="5"
                        fill="#C96F52"
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                      />
                    </g>
                  )}

                  {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                    const x = largePadding.left + ratio * innerWidth
                    const distance = distanceRange * ratio

                    return (
                      <g key={`large-distance-${ratio}`}>
                        <line
                          x1={x}
                          x2={x}
                          y1={largePadding.top + largeInnerHeight}
                          y2={padding.top + innerHeight + 4}
                          stroke="#DCCFC5"
                        />
                        <text
                          x={x}
                          y={chartHeight - 8}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#A99183"
                        >
                          {distance.toLocaleString('de-DE', {
                            maximumFractionDigits: 1,
                          })}{' '}
                          km
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
