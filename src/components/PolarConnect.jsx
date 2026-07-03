import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export default function PolarConnect({ user }) {
  const [connected, setConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [activities, setActivities] = useState([])
  const [lastSync, setLastSync] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    checkConnection()

    // Polar callback aus URL erkennen
    const params = new URLSearchParams(window.location.search)
    if (params.get('polar_connected') === 'true') {
      setMessage({ type: 'success', text: '✅ Polar erfolgreich verbunden!' })
      window.history.replaceState({}, '', window.location.pathname)
      checkConnection()
    } else if (params.get('polar_error')) {
      setMessage({ type: 'error', text: '❌ Verbindung fehlgeschlagen. Bitte erneut versuchen.' })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user])

  const checkConnection = async () => {
    const { data } = await supabase
      .from('integrations')
      .select('polar_connected_at, polar_user_id')
      .eq('user_id', user.id)
      .single()

    if (data?.polar_access_token !== undefined || data?.polar_user_id) {
      setConnected(true)
      setLastSync(data.polar_connected_at)
    }
    setLoading(false)
  }

  const handleConnect = () => {
    // User ID als state mitgeben damit callback weiß wer sich verbindet
    window.location.href = `/api/polar/auth?state=${user.id}`
  }

  const handleDisconnect = async () => {
    await supabase.from('integrations').delete().eq('user_id', user.id)
    setConnected(false)
    setActivities([])
    setMessage({ type: 'info', text: 'Polar Verbindung getrennt.' })
  }

  const handleSync = async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/polar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      const data = await response.json()

      if (data.error) {
        setMessage({ type: 'error', text: `Fehler: ${data.error}` })
      } else if (data.activities?.length === 0) {
        setMessage({ type: 'info', text: 'Keine neuen Läufe gefunden.' })
      } else {
        setActivities(data.activities || [])
        setMessage({ type: 'success', text: `✅ ${data.count} neue Läufe synchronisiert!` })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Verbindungsfehler. Bitte erneut versuchen.' })
    }
    setSyncing(false)
  }

  const msgStyle = (type) => ({
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: 13,
    fontFamily: 'sans-serif',
    marginBottom: 16,
    background: type === 'success' ? '#F0FAF4' : type === 'error' ? '#FDECEA' : '#FFF5EE',
    color: type === 'success' ? '#5BA88A' : type === 'error' ? '#B85464' : '#C17A3A',
    border: `1px solid ${type === 'success' ? '#B8E4CC' : type === 'error' ? '#F5C4CC' : '#FFD4B0'}`,
  })

  if (loading) return <div style={{ textAlign: 'center', padding: 20, color: '#B8A090', fontFamily: 'sans-serif' }}>⏳ Lade…</div>

  return (
    <div>
      {message && <div style={msgStyle(message.type)}>{message.text}</div>}

      {/* Polar Card */}
      <div style={{ background: connected ? '#F0FAF4' : 'white', borderRadius: 16, padding: '18px 20px', border: `1.5px solid ${connected ? '#B8E4CC' : '#F0E8E0'}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: connected ? '#5BA88A' : '#F0E8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
            🏔️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#3D2B1F' }}>Polar Flow</div>
            <div style={{ fontSize: 12, color: connected ? '#5BA88A' : '#B8A090', fontFamily: 'sans-serif', marginTop: 2 }}>
              {connected ? '✓ Verbunden' : 'Noch nicht verbunden'}
            </div>
            {connected && lastSync && (
              <div style={{ fontSize: 11, color: '#B8A090', fontFamily: 'sans-serif', marginTop: 2 }}>
                Verbunden seit {new Date(lastSync).toLocaleDateString('de-DE')}
              </div>
            )}
          </div>
          {connected ? (
            <button onClick={handleDisconnect}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #F5C4CC', background: '#FDECEA', color: '#B85464', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
              Trennen
            </button>
          ) : (
            <button onClick={handleConnect}
              style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: 'white', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', boxShadow: '0 4px 12px rgba(255,140,105,0.4)' }}>
              Verbinden
            </button>
          )}
        </div>

        {connected && (
          <>
            <button onClick={handleSync} disabled={syncing}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: syncing ? '#F0E8E0' : 'linear-gradient(135deg,#7EC8A4,#5BA88A)', color: syncing ? '#C4A882' : 'white', fontSize: 14, fontWeight: 'bold', cursor: syncing ? 'default' : 'pointer', fontFamily: 'sans-serif', boxShadow: syncing ? 'none' : '0 4px 14px rgba(126,200,164,0.4)', transition: 'all 0.2s' }}>
              {syncing ? '⏳ Synchronisiere…' : '🔄 Läufe synchronisieren'}
            </button>
          </>
        )}
      </div>

      {/* Synchronisierte Läufe */}
      {activities.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#5C3D2E', fontFamily: 'sans-serif', marginBottom: 10 }}>
            Neue Läufe von Polar
          </div>
          {activities.map((a, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '1.5px solid #F0E8E0', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>
                  🏃‍♀️ {a.datum ? new Date(a.datum).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Unbekannt'}
                </div>
                {a.dauer && <div style={{ fontSize: 12, color: '#B8A090', fontFamily: 'sans-serif' }}>{a.dauer}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.distanz && <span style={{ fontSize: 11, background: '#FFF0E6', color: '#C17A3A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>📍 {a.distanz}</span>}
                {a.pace && <span style={{ fontSize: 11, background: '#E8F0FF', color: '#4060C0', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>⏱ {a.pace}</span>}
                {a.herzfrequenz && <span style={{ fontSize: 11, background: '#FDECEA', color: '#B85464', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>❤️ {a.herzfrequenz}</span>}
                {a.kalorien && <span style={{ fontSize: 11, background: '#F0FAF4', color: '#5BA88A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>🔥 {a.kalorien} kcal</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Garmin Platzhalter */}
      <div style={{ background: '#F5EDE8', borderRadius: 16, padding: '18px 20px', border: '1.5px solid #F0E0D0', opacity: 0.7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F0E8E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>⌚</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#8B6B5A' }}>Garmin Connect</div>
            <div style={{ fontSize: 12, color: '#C4A882', fontFamily: 'sans-serif', marginTop: 2 }}>Demnächst verfügbar</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', background: '#F0FAF4', border: '1px solid #B8E4CC', borderRadius: 12, fontSize: 12, color: '#5BA88A', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
        💡 Verbinde deine Sportuhr um Läufe automatisch zu synchronisieren und direkt in deinen Trainingsplan einzutragen.
      </div>
    </div>
  )
}
