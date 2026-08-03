import { useMemo, useState } from 'react'

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

export default function ElevationPerformanceChart({
  routeWaypoints = [],
  splits = [],
  sportType = 'running',
  elevationGain = null,
  elevationLoss = null,
  defaultOpen = true,
}) {
  const [detailsOpen, setDetailsOpen] = useState(defaultOpen)

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

  const linePath = scaled
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const areaPath = scaled.length
    ? `${linePath} L ${scaled[scaled.length - 1].x} ${
        padding.top + innerHeight
      } L ${scaled[0].x} ${padding.top + innerHeight} Z`
    : ''

  const gridValues =
    minAltitude !== null && maxAltitude !== null
      ? [0, 0.5, 1].map(
          ratio => minAltitude + (maxAltitude - minAltitude) * ratio
        )
      : []

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
              gap: '4px 12px',
              marginTop: 5,
              color: '#8B6B5A',
              fontSize: 10,
              lineHeight: 1.4,
            }}
          >
            {elevationGain != null && (
              <span>↗️ {Math.round(Number(elevationGain))} hm</span>
            )}
            {elevationLoss != null && (
              <span>↘️ {Math.round(Number(elevationLoss))} hm</span>
            )}
            {maxAltitude !== null && (
              <span>Höchster Punkt {Math.round(maxAltitude)} m</span>
            )}
            {minAltitude !== null && (
              <span>Niedrigster Punkt {Math.round(minAltitude)} m</span>
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

      {profile.length >= 2 && (
        <div style={{ overflowX: 'hidden' }}>
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

            <path d={areaPath} fill="url(#elevationFill)" />
            <path
              d={linePath}
              fill="none"
              stroke="#58A978"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

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
              Orange = deutlicher Anstieg · Grün = flach oder bergab
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
                const normalized =
                  sportType === 'running' || sportType === 'hiking'
                    ? (maxEffort - split.effortValue) / effortRange
                    : (split.effortValue - minEffort) / effortRange
                const height = 42 + Math.max(0, normalized) * 42
                const color =
                  terrain === 'up'
                    ? '#F3A45F'
                    : terrain === 'down'
                      ? '#71B998'
                      : '#83C5A7'

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

                    <div
                      title={`+${Math.round(split.ascent)} / -${Math.round(
                        split.descent
                      )} hm`}
                      style={{
                        width: '100%',
                        height,
                        borderRadius: '5px 5px 2px 2px',
                        background: color,
                        position: 'relative',
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
                    </div>

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
          </div>

          {insight && (
            <div
              style={{
                marginTop: 10,
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
    </div>
  )
}
