import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const TAG_OFFSET = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 }
const dayKey = (phaseId, weekN, dayIdx) => `${phaseId}_w${weekN}_d${dayIdx}`

// Berechnet für jeden (nicht-optionalen) Plan-Tag ein echtes Kalenderdatum.
// Liest bewusst das ECHTE, angezeigte week.dateRange jeder Woche aus (z.B. "13.07. – 19.07.")
// statt es aus plan.startDate + hochgezähltem Wochen-Offset zu rekonstruieren – die KI
// schreibt startDate und dateRange unabhängig voneinander beim Planerstellen, sie können
// also auseinanderdriften. Das Parsen des angezeigten dateRange garantiert, dass die
// berechneten Daten immer exakt zu dem passen, was der Nutzer tatsächlich sieht.
function getPlanDayDates(plan) {
  const result = []
  if (!plan) return result
  const fallbackYear = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getFullYear() : new Date().getFullYear()
  const startMonth = plan.startDate ? new Date(plan.startDate + 'T00:00:00').getMonth() : null

  for (const phase of plan.phases || []) {
    for (const week of phase.weeks || []) {
      const match = week.dateRange?.match(/(\d{1,2})\.(\d{1,2})\./)
      if (!match) continue
      const day = parseInt(match[1])
      const month = parseInt(match[2]) - 1

      // Jahreswechsel-Heuristik: falls der Wochenmonat deutlich vor dem Startmonat liegt
      // (z.B. Plan startet im November, diese Woche zeigt Januar), ist es das Folgejahr.
      let year = fallbackYear
      if (startMonth !== null && month < startMonth - 6) year = fallbackYear + 1

      const weekStart = new Date(year, month, day)

      ;(week.days || []).forEach((dayObj, di) => {
        if (dayObj.optional) return
        const offset = TAG_OFFSET[dayObj.tag] ?? 0
        const d = new Date(weekStart)
        d.setDate(d.getDate() + offset)
        result.push({
          date: d,
          dateStr: d.toISOString().split('T')[0],
          key: dayKey(phase.id, week.n, di),
          tag: dayObj.tag,
          einheit: dayObj.einheit,
          weekN: week.n,
          phaseLabel: phase.label,
        })
      })
    }
  }
  return result
}

const diffDays = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000)

export default function PolarConnect({ user, plan }) {
  const [connected, setConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [pending, setPending] = useState([])
  const [selections, setSelections] = useState({})
  const [shoeSelections, setShoeSelections] = useState({})
  const [occupiedKeys, setOccupiedKeys] = useState(new Set())
  const [assigning, setAssigning] = useState(null)
  const [schuhe, setSchuhe] = useState([])

  const planDays = plan ? getPlanDayDates(plan) : []

  useEffect(() => {
    checkConnection()
    loadOccupiedKeys()
    loadPending()
    loadSchuhe()

    // Live-Updates: neue Läufe (z.B. automatisch vom Polar-Webhook eingetragen)
    // tauchen sofort auf, ohne dass die Seite neu geladen werden muss.
    const channel = supabase
      .channel('polar_pending_activities_' + user.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'polar_pending_activities',
        filter: `user_id=eq.${user.id}`,
      }, () => loadPending())
      .subscribe()

    const params = new URLSearchParams(window.location.search)
    if (params.get('polar_connected') === 'true') {
      setMessage({ type: 'success', text: '✅ Polar erfolgreich verbunden!' })
      window.history.replaceState({}, '', window.location.pathname)
      checkConnection()
    } else if (params.get('polar_error')) {
      setMessage({ type: 'error', text: '❌ Verbindung fehlgeschlagen. Bitte erneut versuchen.' })
      window.history.replaceState({}, '', window.location.pathname)
    }

    return () => supabase.removeChannel(channel)
  }, [user])

  const loadPending = async () => {
    try {
      const { data } = await supabase
        .from('polar_pending_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('datum', { ascending: false })
      if (data) setPending(data)
    } catch (e) {
      console.error('Pending Aktivitäten laden fehlgeschlagen:', e)
    }
  }

  const loadOccupiedKeys = async () => {
    try {
      const { data } = await supabase.from('logs').select('day_key').eq('user_id', user.id)
      if (data) setOccupiedKeys(new Set(data.map(l => l.day_key)))
    } catch {}
  }

  const loadSchuhe = async () => {
    try {
      const { data } = await supabase.from('shoes').select('*').eq('user_id', user.id).order('created_at')
      if (data) setSchuhe(data)
    } catch {}
  }

  const checkConnection = async () => {
    const { data } = await supabase
      .from('integrations')
      .select('polar_connected_at, polar_user_id, polar_access_token')
      .eq('user_id', user.id)
      .single()

    if (data?.polar_user_id || data?.polar_access_token) {
      setConnected(true)
      setLastSync(data.polar_connected_at)
    }
    setLoading(false)
  }

  const handleConnect = async () => {
    const stateToken = crypto.randomUUID()
    localStorage.setItem('polar_state_token', stateToken)
    localStorage.setItem('polar_user_id', user.id)

    try {
      const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        await supabase.from('integrations').update({ polar_state_token: stateToken }).eq('user_id', user.id)
      } else {
        await supabase.from('integrations').insert({ user_id: user.id, polar_state_token: stateToken })
      }
    } catch (e) {
      console.error('Supabase error:', e)
    }

    window.location.href = `/api/polar/auth?state=${user.id}:${stateToken}`
  }

  const handleDisconnect = async () => {
    await supabase.from('integrations').delete().eq('user_id', user.id)
    setConnected(false)
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
      } else if (!data.activities?.length) {
        setMessage({ type: 'info', text: 'Keine neuen Läufe gefunden.' })
      } else {
        await loadPending() // Server hat bereits in polar_pending_activities gespeichert
        setMessage({ type: 'success', text: `✅ ${data.count} neue Läufe gefunden – bitte zuordnen.` })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Verbindungsfehler. Bitte erneut versuchen.' })
    }
    setSyncing(false)
  }

  const getCandidates = (activity) => {
    if (!activity.datum) return []
    return planDays
      .filter(d => !occupiedKeys.has(d.key))
      .map(d => ({ ...d, dist: diffDays(d.dateStr, activity.datum) }))
      .filter(d => Math.abs(d.dist) <= 3)
      .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))
  }

  const weekdayLabel = (d) => d.date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })

  const assignActivity = async (activity, chosenKey) => {
    setAssigning(activity.id)
    const schuhId = shoeSelections[activity.id] || null
    try {
      if (chosenKey === 'extra') {
        const extraKey = `extra_polar_${activity.datum}_${crypto.randomUUID().slice(0, 8)}`
        await supabase.from('logs').upsert({
          user_id: user.id,
          day_key: extraKey,
          pace: activity.pace || null,
          km: activity.distanz || null,
          bpm: activity.herzfrequenz || null,
          note: 'Extra-Lauf, automatisch von Polar importiert (kein Plan-Tag)',
          schuh_id: schuhId,
        }, { onConflict: 'user_id,day_key' })
      } else {
        await supabase.from('logs').upsert({
          user_id: user.id,
          day_key: chosenKey,
          pace: activity.pace || null,
          km: activity.distanz || null,
          bpm: activity.herzfrequenz || null,
          note: 'Automatisch von Polar synchronisiert',
          schuh_id: schuhId,
        }, { onConflict: 'user_id,day_key' })
        await supabase.from('training_done').upsert({
          user_id: user.id,
          day_key: chosenKey,
          done: true,
        }, { onConflict: 'user_id,day_key' })
        setOccupiedKeys(prev => new Set([...prev, chosenKey]))
      }

      // Schuh-km hochzählen, genau wie beim manuellen Log (TrainingPlan.jsx)
      if (schuhId && activity.distanz) {
        const gelaufeneKm = parseFloat(String(activity.distanz).replace(',', '.')) || 0
        if (gelaufeneKm > 0) {
          const { data: schuh } = await supabase.from('shoes').select('start_km').eq('id', schuhId).single()
          if (schuh) {
            await supabase.from('shoes').update({ start_km: (schuh.start_km || 0) + gelaufeneKm }).eq('id', schuhId)
          }
        }
      }

      await supabase.from('polar_pending_activities').delete().eq('id', activity.id)
      setPending(prev => prev.filter(a => a.id !== activity.id))
      setMessage({ type: 'success', text: '✅ Zugeordnet! Seite wird aktualisiert…' })
      setTimeout(() => window.location.reload(), 900)
    } catch (e) {
      console.error('Zuordnung fehlgeschlagen:', e)
      setMessage({ type: 'error', text: 'Zuordnung fehlgeschlagen. Bitte erneut versuchen.' })
      setAssigning(null)
    }
  }

  const discardActivity = async (activity) => {
    await supabase.from('polar_pending_activities').delete().eq('id', activity.id)
    setPending(prev => prev.filter(a => a.id !== activity.id))
  }

  const msgStyle = (type) => ({
    padding: '10px 14px', borderRadius: 12, fontSize: 13, fontFamily: 'sans-serif', marginBottom: 16,
    background: type === 'success' ? '#F0FAF4' : type === 'error' ? '#FDECEA' : '#FFF5EE',
    color: type === 'success' ? '#5BA88A' : type === 'error' ? '#B85464' : '#C17A3A',
    border: `1px solid ${type === 'success' ? '#B8E4CC' : type === 'error' ? '#F5C4CC' : '#FFD4B0'}`,
  })

  if (loading) return <div style={{ textAlign: 'center', padding: 20, color: '#B8A090', fontFamily: 'sans-serif' }}>⏳ Lade…</div>

  return (
    <div>
      {message && <div style={msgStyle(message.type)}>{message.text}</div>}

      <div style={{ background: connected ? '#F0FAF4' : 'white', borderRadius: 16, padding: '18px 20px', border: `1.5px solid ${connected ? '#B8E4CC' : '#F0E8E0'}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: connected ? 14 : 0 }}>
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
          <button onClick={handleSync} disabled={syncing}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: syncing ? '#F0E8E0' : 'linear-gradient(135deg,#7EC8A4,#5BA88A)', color: syncing ? '#C4A882' : 'white', fontSize: 14, fontWeight: 'bold', cursor: syncing ? 'default' : 'pointer', fontFamily: 'sans-serif', transition: 'all 0.2s' }}>
            {syncing ? '⏳ Synchronisiere…' : '🔄 Läufe synchronisieren'}
          </button>
        )}
      </div>

      {pending.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#5C3D2E', fontFamily: 'sans-serif', marginBottom: 10 }}>
            Läufe zuordnen ({pending.length})
          </div>
          {pending.map((a) => {
            const id = a.id
            const candidates = getCandidates(a)
            const selected = selections[id] ?? (candidates[0]?.key || '')
            const isAssigning = assigning === id

            return (
              <div key={id} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '1.5px solid #F0E8E0', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>
                    🏃‍♀️ {a.datum ? new Date(a.datum).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Unbekannt'}
                  </div>
                  {a.dauer && <div style={{ fontSize: 12, color: '#B8A090', fontFamily: 'sans-serif' }}>{a.dauer}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {a.distanz && <span style={{ fontSize: 11, background: '#FFF0E6', color: '#C17A3A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>📍 {a.distanz}</span>}
                  {a.pace && <span style={{ fontSize: 11, background: '#E8F0FF', color: '#4060C0', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>⏱ {a.pace}</span>}
                  {a.herzfrequenz && <span style={{ fontSize: 11, background: '#FDECEA', color: '#B85464', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>❤️ {a.herzfrequenz}</span>}
                  {a.kalorien && <span style={{ fontSize: 11, background: '#F0FAF4', color: '#5BA88A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>🔥 {a.kalorien} kcal</span>}
                </div>

                <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>
                  Welchem Plan-Tag zuordnen?
                </label>
                <select
                  value={selected}
                  onChange={e => setSelections(p => ({ ...p, [id]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 13, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer', marginBottom: 10 }}>
                  {candidates.length === 0 && <option value="">Kein passender offener Tag gefunden</option>}
                  {candidates.map(c => (
                    <option key={c.key} value={c.key}>
                      Wo. {c.weekN} · {weekdayLabel(c)} · {c.einheit} {c.dist !== 0 ? `(${c.dist > 0 ? '+' : ''}${c.dist} Tag${Math.abs(c.dist) !== 1 ? 'e' : ''})` : '(genau passend)'}
                    </option>
                  ))}
                  <option value="extra">— Als Extra-Lauf speichern (kein Plan-Tag) —</option>
                </select>

                {schuhe.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>
                      Laufschuhe
                    </label>
                    <select
                      value={shoeSelections[id] || ''}
                      onChange={e => setShoeSelections(p => ({ ...p, [id]: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 13, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer' }}>
                      <option value="">Kein Schuh ausgewählt</option>
                      {schuhe.map(s => (
                        <option key={s.id} value={s.id}>{s.marke} {s.modell} ({Math.round(s.start_km || 0)} km)</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => discardActivity(a)}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #F0E8E0', background: 'white', color: '#B8A090', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                    Verwerfen
                  </button>
                  <button onClick={() => assignActivity(a, selected)} disabled={!selected || isAssigning}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: !selected || isAssigning ? '#F0E8E0' : 'linear-gradient(135deg,#FF8C69,#FFB347)', color: !selected || isAssigning ? '#C4A882' : 'white', fontSize: 12, fontWeight: 'bold', cursor: !selected || isAssigning ? 'default' : 'pointer', fontFamily: 'sans-serif' }}>
                    {isAssigning ? '⏳ Speichere…' : '✓ Zuordnen'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

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
        💡 Nach dem Sync erscheinen deine Läufe hier zur Zuordnung – auch wenn du an einem anderen Tag als geplant gelaufen bist.
      </div>
    </div>
  )
}
