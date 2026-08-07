import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { loadAndEvaluateAchievements } from '../lib/achievementService.js'
import {
  buildCollections,
  getCollectionSummary,
} from '../lib/achievementCollections.js'

function CollectionCard({ collection }) {
  const [open, setOpen] = useState(false)

  const countLabel = collection.waitingForData
    ? 'vorbereitet'
    : `${collection.unlockedCount}/${collection.totalCount}`

  return (
    <div
      style={{
        borderRadius: 20,
        border: collection.complete
          ? '1px solid #E7C875'
          : '1px solid #EAE1DA',
        background: collection.complete
          ? 'linear-gradient(145deg,#FFFDF5,#FFF5DE)'
          : '#FFFFFF',
        padding: 16,
        fontFamily: 'sans-serif',
        boxShadow: collection.complete
          ? '0 9px 26px rgba(176,128,49,0.12)'
          : 'none',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(previous => !previous)}
        style={{
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 15,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              fontSize: 25,
              background: collection.complete
                ? '#FFEFC5'
                : '#F7F1ED',
            }}
          >
            {collection.complete
              ? collection.completeIcon
              : collection.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 'bold',
                    color: '#3D2B1F',
                  }}
                >
                  {collection.title}
                </div>

                {collection.complete && (
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 9.5,
                      color: '#B17725',
                      fontWeight: 'bold',
                    }}
                  >
                    🏆 {collection.completeTitle}
                  </div>
                )}
              </div>

              <div
                style={{
                  flexShrink: 0,
                  padding: '4px 7px',
                  borderRadius: 999,
                  background: collection.complete
                    ? '#FFF0C9'
                    : '#F5F0EC',
                  color: collection.complete
                    ? '#B47723'
                    : '#947E70',
                  fontSize: 9,
                  fontWeight: 'bold',
                }}
              >
                {collection.complete
                  ? '✓ VOLLSTÄNDIG'
                  : countLabel}
              </div>
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 10.5,
                color: '#987F70',
                lineHeight: 1.45,
              }}
            >
              {collection.complete
                ? collection.completeText
                : collection.description}
            </div>
          </div>
        </div>

        {collection.waitingForData ? (
          <div
            style={{
              marginTop: 13,
              padding: '8px 10px',
              borderRadius: 11,
              background: '#F7F3F0',
              color: '#A18B7E',
              fontSize: 9.5,
              lineHeight: 1.4,
            }}
          >
            Wird automatisch gefüllt, sobald deine Aktivitäten
            passende Umgebungs- oder Wetterdaten enthalten.
          </div>
        ) : (
          <>
            <div
              style={{
                marginTop: 13,
                height: 7,
                borderRadius: 999,
                overflow: 'hidden',
                background: '#F1E7E0',
              }}
            >
              <div
                style={{
                  width: `${collection.percent}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: collection.complete
                    ? 'linear-gradient(90deg,#EAB65F,#D99739)'
                    : 'linear-gradient(90deg,#FFB47A,#FF7D74)',
                }}
              />
            </div>

            <div
              style={{
                marginTop: 7,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 9.5,
                color: '#A89284',
              }}
            >
              <span>{collection.percent} % gesammelt</span>
              <span>{open ? 'Weniger ↑' : 'Ansehen ↓'}</span>
            </div>
          </>
        )}

        {collection.waitingForData && (
          <div
            style={{
              marginTop: 7,
              textAlign: 'right',
              fontSize: 9.5,
              color: '#A89284',
            }}
          >
            {open ? 'Weniger ↑' : 'Ansehen ↓'}
          </div>
        )}
      </button>

      {open && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
            gap: 8,
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid #EFE6DF',
          }}
        >
          {collection.items.map(item => {
            const muted = !item.available
            const collected = item.unlocked

            return (
              <div
                key={item.id || item.key || item.sport}
                style={{
                  minHeight: 70,
                  borderRadius: 13,
                  padding: '10px 9px',
                  background: collected
                    ? '#F2FAF5'
                    : muted
                      ? '#FAF7F5'
                      : '#F7F3F0',
                  border: collected
                    ? '1px solid #CCE9D8'
                    : '1px solid #ECE3DD',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: muted ? 0.72 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: 20,
                    filter: collected ? 'none' : 'grayscale(1)',
                    opacity: collected ? 1 : 0.45,
                  }}
                >
                  {collected
                    ? item.icon
                    : muted
                      ? '◌'
                      : '○'}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 'bold',
                      color: collected
                        ? '#4B8C68'
                        : '#9A897E',
                      lineHeight: 1.3,
                    }}
                  >
                    {item.label}
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 8.5,
                      color: '#B09E93',
                    }}
                  >
                    {collected
                      ? 'Gesammelt'
                      : muted
                        ? 'Noch nicht auswertbar'
                        : 'Noch offen'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AchievementCollections({ user }) {
  const [loading, setLoading] = useState(true)
  const [evaluation, setEvaluation] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

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
        console.error(
          'Sammlungen konnten nicht geladen werden:',
          error
        )

        if (!cancelled) {
          setErrorMessage(
            'Die Sammlungen konnten gerade nicht geladen werden.'
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

  const collections = useMemo(
    () =>
      buildCollections({
        achievements: evaluation?.achievements || [],
        activities: evaluation?.activities || [],
      }),
    [evaluation]
  )

  const summary = useMemo(
    () => getCollectionSummary(collections),
    [collections]
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
        📚 Sammlungen werden zusammengestellt…
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
            'linear-gradient(135deg,#F4FBF7 0%,#FFF7EE 55%,#F8F2FF 100%)',
          border: '1px solid #E4DDD5',
        }}
      >
        <div
          style={{
            fontSize: 19,
            fontWeight: 'bold',
            color: '#3D2B1F',
          }}
        >
          📚 Deine Sammlungen
        </div>

        <div
          style={{
            marginTop: 5,
            fontSize: 11,
            lineHeight: 1.45,
            color: '#947F71',
          }}
        >
          Erfolge zeigen, was du erreicht hast. Sammlungen zeigen,
          was du auf deinem Weg erlebt hast.
        </div>

        <div
          style={{
            marginTop: 13,
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 'bold',
              color: '#5B9273',
            }}
          >
            {summary.complete}
          </span>

          <span style={{ fontSize: 10, color: '#9E897C' }}>
            von {summary.total} Sammlungen vollständig
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 11,
        }}
      >
        {collections.map(collection => (
          <CollectionCard
            key={collection.id}
            collection={collection}
          />
        ))}
      </div>
    </div>
  )
}
