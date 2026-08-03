import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const SPORT_META = {
  running: { icon: '🏃', label: 'Lauf', color: '#FF8C69', soft: '#FFF0E6' },
  walking: { icon: '🚶', label: 'Walking', color: '#76A85B', soft: '#F1F8EC' },
  hiking: { icon: '🥾', label: 'Wanderung', color: '#76A85B', soft: '#F1F8EC' },
  cycling: { icon: '🚴', label: 'Radtour', color: '#62A7D6', soft: '#EEF7FC' },
  mountain_biking: { icon: '🚵', label: 'Mountainbike-Tour', color: '#8B6B4A', soft: '#F7F0E8' },
  swimming: { icon: '🏊', label: 'Schwimmen', color: '#4AA8B8', soft: '#EAF8FA' },
}

const getMeta = activity =>
  SPORT_META[activity?.sport_type || activity?.activity_data?.sport_type || 'running'] ||
  { icon: '🏅', label: 'Aktivität', color: '#A78BCA', soft: '#F7F2FF' }

export default function IgnoredActivities({
  user,
  onClose,
  onReleased,
}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [releasing, setReleasing] = useState(null)
  const [message, setMessage] = useState(null)

  const load = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('polar_ignored_activities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Nicht übernommene Aktivitäten laden fehlgeschlagen:', error)
      setMessage({
        type: 'error',
        text: 'Die Aktivitäten konnten nicht geladen werden.',
      })
    } else {
      setItems(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [user.id])

  const release = async item => {
    setReleasing(item.id)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('polar_ignored_activities')
        .delete()
        .eq('id', item.id)
        .eq('user_id', user.id)

      if (error) throw error

      const remaining = items.filter(entry => entry.id !== item.id)
      setItems(remaining)

      setMessage({
        type: 'success',
        text: '✅ Aktivität wurde zur Übernahme freigegeben.',
      })

      await onReleased?.()
    } catch (error) {
      console.error('Aktivität freigeben fehlgeschlagen:', error)
      setMessage({
        type: 'error',
        text: 'Die Aktivität konnte nicht freigegeben werden.',
      })
    } finally {
      setReleasing(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'rgba(50,30,20,0.68)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          height: 'min(88dvh, 850px)',
          background: 'white',
          borderRadius: '28px 28px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -12px 50px rgba(61,43,31,0.22)',
        }}
      >
        <div
          style={{
            padding: '20px 22px 14px',
            borderBottom: '1px solid #F0E8E0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  color: '#3D2B1F',
                  fontSize: 19,
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                }}
              >
                Nicht übernommene Polar-Aktivitäten
              </h3>

              <div
                style={{
                  marginTop: 7,
                  color: '#8B6B5A',
                  fontSize: 12,
                  lineHeight: 1.5,
                  fontFamily: 'sans-serif',
                }}
              >
                Diese Aktivitäten wurden bei einer früheren Synchronisation
                bewusst nicht übernommen. Du kannst sie jederzeit wieder zur
                Übernahme freigeben.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '1px solid #F0E8E0',
                background: '#FFF8F5',
                color: '#8B6B5A',
                cursor: 'pointer',
                fontSize: 18,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '14px 18px 28px',
          }}
        >
          {message && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                marginBottom: 12,
                background:
                  message.type === 'success' ? '#F0FAF4' : '#FDECEA',
                border:
                  message.type === 'success'
                    ? '1px solid #B8E4CC'
                    : '1px solid #F5C4CC',
                color:
                  message.type === 'success' ? '#5BA88A' : '#B85464',
                fontSize: 12,
                fontFamily: 'sans-serif',
              }}
            >
              {message.text}
            </div>
          )}

          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: 35,
                color: '#B8A090',
                fontFamily: 'sans-serif',
              }}
            >
              ⏳ Lade…
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '42px 20px',
                color: '#B8A090',
                fontFamily: 'sans-serif',
              }}
            >
              <div style={{ fontSize: 38, marginBottom: 10 }}>✨</div>
              <div style={{ fontSize: 14, color: '#5C3D2E', fontWeight: 'bold' }}>
                Keine nicht übernommenen Aktivitäten
              </div>
              <div style={{ fontSize: 12, marginTop: 5 }}>
                Hier ist gerade alles aufgeräumt.
              </div>
            </div>
          ) : (
            items.map(item => {
              const activity = item.activity_data || {}
              const meta = getMeta(item)
              const title =
                activity.activity_name ||
                item.activity_name ||
                meta.label

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'white',
                    borderRadius: 14,
                    padding: '13px 14px',
                    border: `1.5px solid ${meta.color}33`,
                    borderLeft: `4px solid ${meta.color}`,
                    marginBottom: 10,
                    boxShadow: '0 3px 12px rgba(61,43,31,0.035)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      marginBottom: 8,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          color: '#3D2B1F',
                          fontWeight: 'bold',
                        }}
                      >
                        {meta.icon} {title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#B8A090',
                          marginTop: 3,
                        }}
                      >
                        {activity.datum || item.activity_date || 'Datum unbekannt'}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 10,
                        color: meta.color,
                        background: meta.soft,
                        borderRadius: 99,
                        padding: '3px 9px',
                        fontWeight: 'bold',
                        height: 'fit-content',
                      }}
                    >
                      Nicht übernommen
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 7,
                      marginBottom: 10,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {(activity.distanz || item.distance_text) && (
                      <span
                        style={{
                          fontSize: 11,
                          borderRadius: 99,
                          padding: '3px 9px',
                          background: '#FFF0E6',
                          color: '#C17A3A',
                          fontWeight: 'bold',
                        }}
                      >
                        📍 {activity.distanz || item.distance_text}
                      </span>
                    )}

                    {activity.average_speed_kmh != null && (
                      <span
                        style={{
                          fontSize: 11,
                          borderRadius: 99,
                          padding: '3px 9px',
                          background: '#EEF7FC',
                          color: '#497EAA',
                          fontWeight: 'bold',
                        }}
                      >
                        ⚡ {Number(activity.average_speed_kmh).toFixed(1)} km/h
                      </span>
                    )}

                    {activity.elevation_gain != null && (
                      <span
                        style={{
                          fontSize: 11,
                          borderRadius: 99,
                          padding: '3px 9px',
                          background: '#FFF8E1',
                          color: '#A07830',
                          fontWeight: 'bold',
                        }}
                      >
                        ⛰️ {Math.round(Number(activity.elevation_gain))} hm
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => release(item)}
                    disabled={releasing === item.id}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 11,
                      border: '1.5px solid #B8E4CC',
                      background: '#F0FAF4',
                      color: '#3D8B6E',
                      fontSize: 12,
                      fontWeight: 'bold',
                      cursor:
                        releasing === item.id ? 'default' : 'pointer',
                      opacity: releasing === item.id ? 0.65 : 1,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {releasing === item.id
                      ? '⏳ Wird freigegeben…'
                      : 'Zur Übernahme freigeben'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
