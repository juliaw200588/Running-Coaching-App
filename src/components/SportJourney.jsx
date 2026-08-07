import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { loadAndEvaluateAchievements } from '../lib/achievementService.js'
import {
  buildJourney,
  groupJourneyByYear,
  JOURNEY_SPORT_META,
} from '../lib/achievementJourney.js'

const RARITY_ACCENT = {
  common: '#B7AAA1',
  special: '#6FAF86',
  rare: '#6B94D6',
  epic: '#9B73C4',
  legendary: '#D89A42',
}

const formatDate = date =>
  date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
  })

function JourneyEvent({ event }) {
  const accent =
    RARITY_ACCENT[event.rarity] || RARITY_ACCENT.common

  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: 30,
        paddingBottom: 20,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 10,
          top: 16,
          bottom: -4,
          width: 1.5,
          background: '#E8DED7',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 2,
          top: 5,
          width: 18,
          height: 18,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: '#FFFFFF',
          border: `2px solid ${accent}`,
          fontSize: 8,
          zIndex: 1,
        }}
      >
        {event.icon}
      </div>

      <div
        style={{
          borderRadius: 17,
          border: `1px solid ${accent}33`,
          borderLeft: `4px solid ${accent}`,
          background: '#FFFFFF',
          padding: '13px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9.5,
                color: '#B19A8C',
                textTransform: 'capitalize',
              }}
            >
              {formatDate(event.date)}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 14,
                fontWeight: 'bold',
                color: '#3D2B1F',
              }}
            >
              {event.icon} {event.title}
            </div>
          </div>

          {event.highlight && (
            <div
              style={{
                flexShrink: 0,
                alignSelf: 'flex-start',
                padding: '4px 7px',
                borderRadius: 999,
                background: `${accent}14`,
                color: accent,
                fontSize: 8.5,
                fontWeight: 'bold',
              }}
            >
              MEILENSTEIN
            </div>
          )}
        </div>

        {event.story && (
          <div
            style={{
              marginTop: 7,
              fontSize: 10.5,
              lineHeight: 1.5,
              color: '#8E7465',
            }}
          >
            {event.story}
          </div>
        )}

        {event.activity && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 9,
            }}
          >
            {event.activity.name && (
              <span
                style={{
                  padding: '4px 7px',
                  borderRadius: 999,
                  background: '#F6F1ED',
                  color: '#8A7467',
                  fontSize: 8.8,
                }}
              >
                {event.activity.name}
              </span>
            )}

            {event.activity.km != null && (
              <span
                style={{
                  padding: '4px 7px',
                  borderRadius: 999,
                  background: '#FFF1E8',
                  color: '#B76F4D',
                  fontSize: 8.8,
                }}
              >
                {event.activity.km.toLocaleString('de-DE', {
                  maximumFractionDigits: 1,
                })}{' '}
                km
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SportJourney({ user }) {
  const [loading, setLoading] = useState(true)
  const [evaluation, setEvaluation] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [sportFilter, setSportFilter] = useState('all')
  const [mode, setMode] = useState('highlights')

  useEffect(() => {
    if (!user?.id) return undefined

    let cancelled = false

    const load = async () => {
      setLoading(true)

      try {
        const result = await loadAndEvaluateAchievements({
          supabase,
          userId: user.id,
        })

        if (!cancelled) setEvaluation(result)
      } catch (error) {
        console.error('Sportlicher Weg konnte nicht geladen werden:', error)

        if (!cancelled) {
          setErrorMessage(
            'Dein sportlicher Weg konnte gerade nicht geladen werden.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const journey = useMemo(
    () =>
      buildJourney({
        achievements: evaluation?.achievements || [],
        activities: evaluation?.activities || [],
      }),
    [evaluation]
  )

  const activeSports = useMemo(() => {
    const sports = new Set(
      (evaluation?.activities || [])
        .map(activity => {
          const raw = String(activity?.sport_type || '').toLowerCase()
          if (raw === 'walking') return 'hiking'
          if (raw === 'indoor_cycling') return 'cycling'
          return raw
        })
        .filter(Boolean)
    )

    return ['all', ...Object.keys(JOURNEY_SPORT_META).filter(
      sport => sport !== 'all' && sports.has(sport)
    )]
  }, [evaluation])

  const filtered = useMemo(
    () =>
      journey.filter(event => {
        const sportMatches =
          sportFilter === 'all' ||
          event.sport === sportFilter

        const modeMatches =
          mode === 'all' || event.highlight

        return sportMatches && modeMatches
      }),
    [journey, sportFilter, mode]
  )

  const grouped = useMemo(
    () => groupJourneyByYear(filtered),
    [filtered]
  )

  if (loading) {
    return (
      <div
        style={{
          padding: 46,
          textAlign: 'center',
          color: '#A38E81',
          fontFamily: 'sans-serif',
        }}
      >
        🛤️ Dein sportlicher Weg wird zusammengestellt…
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div
        style={{
          padding: 36,
          textAlign: 'center',
          color: '#B85464',
          fontFamily: 'sans-serif',
        }}
      >
        {errorMessage}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <div
        style={{
          borderRadius: 20,
          padding: 17,
          marginBottom: 14,
          background:
            'linear-gradient(135deg,#FFF6ED 0%,#F2FAF6 52%,#F5F1FC 100%)',
          border: '1px solid #E8DDD5',
        }}
      >
        <div
          style={{
            fontSize: 19,
            fontWeight: 'bold',
            color: '#3D2B1F',
          }}
        >
          🛤️ Mein sportlicher Weg
        </div>

        <div
          style={{
            marginTop: 5,
            fontSize: 11,
            color: '#947F71',
            lineHeight: 1.45,
          }}
        >
          Deine Meilensteine – nicht als Statistik, sondern als
          persönliche Geschichte.
        </div>

        <div
          style={{
            marginTop: 13,
            fontSize: 10,
            color: '#9F897B',
          }}
        >
          {journey.length} Erinnerungen auf deinem bisherigen Weg
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
          paddingBottom: 5,
          marginBottom: 8,
          scrollbarWidth: 'none',
        }}
      >
        {activeSports.map(sport => {
          const meta = JOURNEY_SPORT_META[sport]
          const active = sportFilter === sport

          return (
            <button
              key={sport}
              type="button"
              onClick={() => setSportFilter(sport)}
              style={{
                flex: '0 0 auto',
                padding: '7px 10px',
                borderRadius: 999,
                border: active
                  ? '1.5px solid #FF8C69'
                  : '1px solid #E7DDD6',
                background: active ? '#FFF2EB' : '#FFFFFF',
                color: active ? '#C16045' : '#89756A',
                fontSize: 9.5,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {meta?.icon} {meta?.label}
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 7,
          marginBottom: 16,
        }}
      >
        {[
          ['highlights', '⭐ Highlights'],
          ['all', 'Alle Erinnerungen'],
        ].map(([key, label]) => {
          const active = mode === key

          return (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              style={{
                flex: 1,
                padding: '8px 9px',
                borderRadius: 11,
                border: active
                  ? '1.5px solid #A98BC2'
                  : '1px solid #E8E0EA',
                background: active ? '#F7F1FC' : '#FFFFFF',
                color: active ? '#75578D' : '#917E9D',
                fontSize: 9.5,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {grouped.length === 0 ? (
        <div
          style={{
            padding: '40px 18px',
            borderRadius: 18,
            textAlign: 'center',
            background: '#FFFFFF',
            border: '1px solid #EEE5DF',
            color: '#A38E81',
            fontSize: 11,
          }}
        >
          Für diese Auswahl gibt es noch keine Erinnerungen.
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.year} style={{ marginBottom: 9 }}>
            <div
              style={{
                margin: '0 0 12px 30px',
                fontFamily: "'Georgia','Times New Roman',serif",
                fontSize: 23,
                fontWeight: 'bold',
                color: '#3D2B1F',
              }}
            >
              {group.year}
            </div>

            {group.events.map(event => (
              <JourneyEvent key={event.id} event={event} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
