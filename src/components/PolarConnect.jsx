import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import IgnoredActivities from './IgnoredActivities.jsx'
import AchievementUnlockModal from './AchievementUnlockModal.jsx'
import {
  loadAndEvaluateAchievements,
  markAchievementUnlocksShown,
} from '../lib/achievementService.js'
import {
  enrichActivityContext,
} from '../lib/activityContext.js'
import { matchActivityToPlans, candidateLabel } from '../lib/activityPlanMatcher.js'

const TAG_OFFSET = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 }

const MULTISPORT_MIGRATION_VERSION = 2

// Schätzt die geplante Distanz eines Tages aus dem Freitext (gleiche Logik wie in
// TrainingPlan.jsx für die "ca. X km"-Wochenanzeige) - wird hier genutzt, um Polar-Läufe
// nicht nur nach Datum, sondern auch nach Distanz-Ähnlichkeit zuzuordnen.
const estimateDayKm = (details) => {
  if (!details) return 0
  const clean = details.replace(/\([^)]*\)/g, '')

  // Erkennt ein führendes "NN km: ..." als GESAMT-Distanz des Tages (z.B.
  // "16 km: 12 km Zone 2 + 4 km progressiv..."). Die folgenden km-Angaben sind dann nur
  // eine Aufschlüsselung des Gesamtwerts, keine zusätzliche Distanz - nicht mit aufsummieren.
  const totalMatch = clean.match(/^\s*(\d+(?:[.,]\d+)?)\s*km\s*:/)
  if (totalMatch) return parseFloat(totalMatch[1].replace(',', '.'))

  let km = 0
  const repRegex = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b/gi
  let m
  while ((m = repRegex.exec(clean))) {
    const reps = parseInt(m[1])
    let dist = parseFloat(m[2].replace(',', '.'))
    if (m[3].toLowerCase() === 'm') dist = dist / 1000
    km += reps * dist
  }
  let rest = clean.replace(repRegex, '')
  const kmRegex = /(\d+(?:[.,]\d+)?)\s*km\b/g
  while ((m = kmRegex.exec(rest))) km += parseFloat(m[1].replace(',', '.'))
  rest = rest.replace(kmRegex, '')
  const minRegex = /(\d+)\s*min\b/g
  while ((m = minRegex.exec(rest))) km += parseInt(m[1]) / 8
  return km
}

// Berechnet für jeden (nicht-optionalen) Plan-Tag ein echtes Kalenderdatum.
// Liest bewusst das ECHTE, angezeigte week.dateRange jeder Woche aus (z.B. "13.07. – 19.07.")
// statt es aus plan.startDate + hochgezähltem Wochen-Offset zu rekonstruieren – die KI
// schreibt startDate und dateRange unabhängig voneinander beim Planerstellen, sie können
// also auseinanderdriften. Das Parsen des angezeigten dateRange garantiert, dass die
// berechneten Daten immer exakt zu dem passen, was der Nutzer tatsächlich sieht.

// Baut "YYYY-MM-DD" aus den LOKALEN Datumsteilen statt über toISOString() (das erst
// in UTC umrechnet und dadurch bei positiven Zeitzonen wie Deutschland (UTC+1/+2) um
// einen Tag zurückspringen kann - z.B. lokale Mitternacht 14.07. wird zu 13.07. 22:00 UTC).
const toLocalDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const isRunningActivity = (activity) =>
  (activity?.sport_type || 'running') === 'running'

const activityMeta = (activity) => {
  const type = activity?.sport_type || 'running'

  const map = {
    running: { icon: '🏃‍♀️', label: 'Lauf' },
    walking: { icon: '🚶', label: 'Walking' },
    hiking: { icon: '🥾', label: 'Wanderung' },
    cycling: { icon: '🚴', label: 'Radtour' },
    mountain_biking: { icon: '🚵', label: 'Mountainbike-Tour' },
    swimming: { icon: '🏊', label: 'Schwimmen' },
  }

  return map[type] || { icon: '🏅', label: activity?.activity_name || 'Aktivität' }
}

export default function PolarConnect({ user, plan, onOpenActivities }) {
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
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyActivities, setHistoryActivities] = useState([])
  const [historySelections, setHistorySelections] = useState({})
  const [historyShoeSelections, setHistoryShoeSelections] = useState({})
  const [historyAssigning, setHistoryAssigning] = useState(null)
  const [historyAssignedIds, setHistoryAssignedIds] = useState(new Set())
  const [showMultisportMigration, setShowMultisportMigration] = useState(false)
  const [migrationRunning, setMigrationRunning] = useState(false)
  const [showIgnoredActivities, setShowIgnoredActivities] = useState(false)
  const [ignoredCount, setIgnoredCount] = useState(0)
  const [syncSummary, setSyncSummary] = useState(null)
  const [achievementUnlocks, setAchievementUnlocks] = useState([])
  const [
    openActivitiesAfterAchievements,
    setOpenActivitiesAfterAchievements,
  ] = useState(false)

  const [activePlanRows, setActivePlanRows] = useState([])
  const [supplementModal, setSupplementModal] = useState(null)
  const [supplementInput, setSupplementInput] = useState({
    feeling:'',
    note:'',
    schuh_id:'',
    mobility_status:'',
    backpack_weight:'',
    pressure_points:'',
    hyrox_data:{},
  })

  useEffect(() => {
    checkConnection()
    loadOccupiedKeys()
    loadActivePlans()
    loadPending()
    loadSchuhe()
    loadIgnoredCount()

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

  const loadActivePlans = async () => {
    try {
      // Alle aktuell gespeicherten Pläne des Nutzers einbeziehen:
      // Hauptplan + gemeinsame/Zusatzpläne. Dadurch skaliert das Matching
      // automatisch auch auf einen dritten oder weiteren aktiven Plan.
      const { data, error } = await supabase
        .from('plans')
        .select('id, plan_data, is_primary, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setActivePlanRows(data || [])
    } catch (error) {
      console.warn('Aktive Trainingspläne konnten nicht geladen werden:', error)
      setActivePlanRows([])
    }
  }

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


  const loadIgnoredCount = async () => {
    try {
      const { count, error } = await supabase
        .from('polar_ignored_activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (error) throw error
      setIgnoredCount(count || 0)
    } catch (error) {
      console.warn(
        'Anzahl nicht übernommener Aktivitäten konnte nicht geladen werden:',
        error
      )
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

    const isConnected = Boolean(
      data?.polar_user_id || data?.polar_access_token
    )

    if (isConnected) {
      setConnected(true)
      setLastSync(data.polar_connected_at)

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('multisport_migration_version')
          .eq('id', user.id)
          .single()

        const migrationVersion =
          Number(profileData?.multisport_migration_version) || 0

        if (migrationVersion < MULTISPORT_MIGRATION_VERSION) {
          setShowMultisportMigration(true)
        }
      } catch (error) {
        console.warn(
          'Multisport-Migrationsstatus konnte nicht geladen werden:',
          error
        )
      }
    } else {
      setConnected(false)
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

  const handleSync = async ({ quiet = false } = {}) => {
    setSyncing(true)
    if (!quiet) setMessage(null)
    setSyncSummary(null)

    try {
      const response = await fetch('/api/polar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        setMessage({
          type: 'error',
          text: `Fehler: ${data.error || 'Synchronisierung fehlgeschlagen.'}`,
        })
        return data
      }

      await Promise.all([loadPending(), loadIgnoredCount()])

      const activities = data.activities || []
      const groups = activities.reduce((acc, activity) => {
        const type = activity.sport_type || 'running'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {})

      setSyncSummary({
        count: data.count || activities.length,
        groups,
        updatedCount: data.updatedCount || 0,
      })

      if (!quiet) {
        if (!activities.length && !(data.updatedCount > 0)) {
          setMessage({
            type: 'info',
            text: 'Keine neuen oder aktualisierten Aktivitäten gefunden.',
          })
        } else {
          const parts = []
          if (activities.length) {
            parts.push(
              `${activities.length} neue ${
                activities.length === 1 ? 'Aktivität' : 'Aktivitäten'
              }`
            )
          }
          if (data.updatedCount > 0) {
            parts.push(
              `${data.updatedCount} ${
                data.updatedCount === 1
                  ? 'bestehende Aktivität aktualisiert'
                  : 'bestehende Aktivitäten aktualisiert'
              }`
            )
          }

          setMessage({
            type: 'success',
            text: `✅ ${parts.join(' und ')}.`,
          })
        }
      }

      return data
    } catch (error) {
      console.error('Polar-Synchronisierung fehlgeschlagen:', error)
      setMessage({
        type: 'error',
        text: 'Verbindungsfehler. Bitte erneut versuchen.',
      })
      return { error: error.message }
    } finally {
      setSyncing(false)
    }
  }

  const markMultisportMigrationDone = async () => {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        multisport_migration_version: MULTISPORT_MIGRATION_VERSION,
      })

    if (error) throw error
  }

  const handleMultisportMigrationLater = () => {
    setShowMultisportMigration(false)
  }

  const handleMultisportMigrationNow = async () => {
    if (migrationRunning) return

    setMigrationRunning(true)
    setMessage(null)

    try {
      const { error: deleteError } = await supabase
        .from('polar_ignored_activities')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) throw deleteError

      const result = await handleSync({ quiet: true })

      if (result?.error) {
        throw new Error(result.error)
      }

      await markMultisportMigrationDone()
      await loadIgnoredCount()
      setShowMultisportMigration(false)

      const count = result?.activities?.length || 0
      const updatedCount = result?.updatedCount || 0

      setMessage({
        type: count || updatedCount ? 'success' : 'info',
        text:
          count || updatedCount
            ? `🎉 ${count} neue Aktivitäten gefunden${
                updatedCount
                  ? ` und ${updatedCount} bestehende aktualisiert`
                  : ''
              }.`
            : 'Keine weiteren Aktivitäten aus den neuen Sportarten gefunden.',
      })
    } catch (error) {
      console.error('Multisport-Migration fehlgeschlagen:', error)
      setMessage({
        type: 'error',
        text:
          'Die früheren Aktivitäten konnten nicht erneut gesucht werden. ' +
          'Bitte versuche es später noch einmal.',
      })
    } finally {
      setMigrationRunning(false)
    }
  }

  const getCandidates = activity =>
    matchActivityToPlans({
      activity,
      planRows: activePlanRows,
      occupiedKeys,
      maxDays: 4,
      limit: 6,
    })


  const checkForNewAchievements = async () => {
    try {
      const result = await loadAndEvaluateAchievements({
        supabase,
        userId: user.id,
      })

      const newUnlocks = result?.newlyUnlocked || []

      if (newUnlocks.length > 0) {
        setAchievementUnlocks(newUnlocks)
      }

      return newUnlocks
    } catch (error) {
      // Das Speichern der Aktivität soll nie daran scheitern,
      // dass die Erfolgsauswertung vorübergehend nicht funktioniert.
      console.warn(
        'Neue Erfolge konnten nicht geprüft werden:',
        error
      )
      return []
    }
  }

  const closeAchievementModal = async () => {
    const ids = achievementUnlocks.map(item => item.id)

    setAchievementUnlocks([])

    try {
      await markAchievementUnlocksShown({
        supabase,
        userId: user.id,
        achievementIds: ids,
      })
    } catch (error) {
      console.warn(
        'Erfolge konnten nicht als angesehen markiert werden:',
        error
      )
    }

    if (openActivitiesAfterAchievements) {
      setOpenActivitiesAfterAchievements(false)
      onOpenActivities?.()
    }
  }


const enrichImportedActivity = async activity => {
  if (!activity?.polar_exercise_id) return

  await enrichActivityContext({
    userId: user.id,
    polarExerciseId: activity.polar_exercise_id,
  })
}

  const openSupplement = (activity, chosenKey, candidates = []) => {
    const candidate = candidates.find(item => item.key === chosenKey) || null
    const running = isRunningActivity(activity)

    setSupplementInput({
      feeling:activity.gefuehl || '',
      note:'',
      schuh_id:running ? (shoeSelections[activity.id] || '') : '',
      mobility_status:'',
      backpack_weight:'',
      pressure_points:'',
      hyrox_data:{},
    })
    setSupplementModal({ activity, chosenKey, candidate })
  }

  const setHyroxSupplementField = (stationId, field, value) => {
    setSupplementInput(prev => ({
      ...prev,
      hyrox_data:{
        ...(prev.hyrox_data || {}),
        [stationId]:{
          ...(prev.hyrox_data?.[stationId] || {}),
          [field]:value,
        },
      },
    }))
  }

  const assignActivity = async (activity, chosenKey, supplement = null) => {
    setAssigning(activity.id)

    const running = isRunningActivity(activity)
    const schuhId = running
      ? supplement?.schuh_id || shoeSelections[activity.id] || null
      : null

    try {
      const generalKey =
        `activity_polar_${activity.datum || 'unknown'}_` +
        `${String(activity.polar_exercise_id || crypto.randomUUID())}`

      const targetKey =
        chosenKey && chosenKey !== 'extra'
          ? chosenKey
          : generalKey

      const autoNote = running
        ? chosenKey === 'extra'
          ? 'Extra-Lauf, automatisch von Polar importiert (kein Plan-Tag)'
          : 'Automatisch von Polar synchronisiert'
        : `${activity.activity_name || activityMeta(activity).label}, automatisch von Polar importiert`

      const note = supplement?.note?.trim()
        ? supplement.note.trim()
        : autoNote

      const sportData = {
        ...(supplement?.mobility_status
          ? { mobility_status:supplement.mobility_status }
          : {}),
        ...(supplement?.backpack_weight
          ? { backpack_weight:supplement.backpack_weight }
          : {}),
        ...(supplement?.pressure_points
          ? { pressure_points:supplement.pressure_points }
          : {}),
      }

      await supabase.from('logs').upsert({
        user_id: user.id,
        day_key: targetKey,
        pace: activity.pace || null,
        km: activity.distanz || null,
        bpm: activity.herzfrequenz || null,
        note,
        schuh_id: schuhId,
        actual_date: activity.datum || null,
        running_index: running ? activity.running_index || null : null,
        cadence: activity.cadence || null,
        uhrzeit: activity.uhrzeit || null,
        hf_max: activity.hf_max || null,
        hoehenmeter: activity.hoehenmeter || null,
        gefuehl: supplement?.feeling || activity.gefuehl || null,
        training_load: activity.training_load || null,
        recovery_time: activity.recovery_time || null,
        polar_exercise_id: activity.polar_exercise_id || null,
        kalorien: activity.kalorien || null,
        route_waypoints: activity.route_waypoints || null,
        km_splits: activity.km_splits || null,
        run_segments: running ? activity.run_segments || null : null,

        sport_type: activity.sport_type || 'running',
        source: activity.source || 'polar',
        activity_name:
          activity.activity_name || activityMeta(activity).label,
        duration_seconds: activity.duration_seconds || null,
        moving_time_seconds: activity.moving_time_seconds || null,
        distance_meters: activity.distance_meters || null,
        average_speed_kmh: activity.average_speed_kmh || null,
        max_speed_kmh: activity.max_speed_kmh || null,
        elevation_gain: activity.elevation_gain || null,
        elevation_loss: activity.elevation_loss || null,
        polar_import_version:
          activity.polar_import_version || 1,
        sport_data:sportData,
        hyrox_data:supplement?.hyrox_data || {},
        generic_data:{},
      }, { onConflict: 'user_id,day_key' })

      if (chosenKey && chosenKey !== 'extra') {
        await supabase.from('training_done').upsert({
          user_id: user.id,
          day_key: chosenKey,
          done: true,
        }, { onConflict: 'user_id,day_key' })

        setOccupiedKeys(prev => new Set([...prev, chosenKey]))
      }

      // Laufschuh-Kilometer ausschließlich für echte Laufaktivitäten hochzählen.
      if (running && schuhId && activity.distanz) {
        const gelaufeneKm =
          parseFloat(String(activity.distanz).replace(',', '.')) || 0

        if (gelaufeneKm > 0) {
          const { data: schuh } = await supabase
            .from('shoes')
            .select('start_km')
            .eq('id', schuhId)
            .single()

          if (schuh) {
            await supabase
              .from('shoes')
              .update({
                start_km: (schuh.start_km || 0) + gelaufeneKm,
              })
              .eq('id', schuhId)
          }
        }
      }

      await supabase
        .from('polar_pending_activities')
        .delete()
        .eq('id', activity.id)

      const remaining = pending.filter(a => a.id !== activity.id)
      setPending(remaining)
      setSupplementModal(null)

      await enrichImportedActivity(activity)

      // Erst jetzt ist die Aktivität endgültig in `logs` übernommen.
      // Deshalb erfolgt die Erfolgsauswertung genau an dieser Stelle
      // und nicht bereits beim Polar-Sync in die Pending-Liste.
      const newAchievements = await checkForNewAchievements()

      if (remaining.length > 0) {
        setMessage({
          type: 'success',
          text: running
            ? `✅ Lauf übernommen. Noch ${remaining.length} ${
                remaining.length === 1
                  ? 'Aktivität ist'
                  : 'Aktivitäten sind'
              } offen.`
            : `✅ ${activityMeta(activity).label} übernommen. Noch ${
                remaining.length
              } ${
                remaining.length === 1
                  ? 'Aktivität ist'
                  : 'Aktivitäten sind'
              } offen.`,
        })
        setAssigning(null)
      } else {
        setMessage({
          type: 'success',
          text: '✅ Alle offenen Aktivitäten wurden übernommen.',
        })
        setAssigning(null)

        if (newAchievements.length > 0) {
          // Bei der letzten offenen Aktivität bleibt das Freischalt-Erlebnis
          // sichtbar. Erst nach "Fertig" wechseln wir zu Aktivitäten.
          setOpenActivitiesAfterAchievements(true)
        } else {
          setTimeout(() => {
            onOpenActivities?.()
          }, 650)
        }
      }
    } catch (e) {
      console.error('Aktivität übernehmen fehlgeschlagen:', e)
      setMessage({
        type: 'error',
        text: 'Aktivität konnte nicht übernommen werden. Bitte erneut versuchen.',
      })
      setAssigning(null)
    }
  }

const discardActivity = async (activity) => {
  try {
    if (!activity.polar_exercise_id) {
      throw new Error('Die Polar-ID der Aktivität fehlt.')
    }

    const { error: ignoreError } = await supabase
      .from('polar_ignored_activities')
      .upsert(
        {
          user_id: user.id,
          polar_exercise_id: String(activity.polar_exercise_id),
          sport_type: activity.sport_type || 'running',
          activity_name:
            activity.activity_name || activityMeta(activity).label,
          activity_date: activity.datum || null,
          distance_text: activity.distanz || null,
          activity_data: activity,
        },
        {
          onConflict: 'user_id,polar_exercise_id',
        }
      )

    if (ignoreError) {
      throw ignoreError
    }

    const { error: deleteError } = await supabase
      .from('polar_pending_activities')
      .delete()
      .eq('id', activity.id)
      .eq('user_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    setPending(prev => prev.filter(a => a.id !== activity.id))
    setIgnoredCount(prev => prev + 1)
    setMessage({
      type: 'success',
      text: 'Aktivität wurde nicht übernommen.',
    })
  } catch (error) {
    console.error('Polar-Aktivität konnte nicht nicht übernommen werden:', error)
    setMessage({
      type: 'error',
      text: 'Die Aktivität konnte nicht nicht übernommen werden.',
    })
  }
}

  const loadHistory = async () => {
    setShowHistory(true)
    setHistoryLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/polar/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      const data = await response.json()
      if (data.error) {
        setMessage({ type: 'error', text: `Fehler: ${data.error}` })
      } else {
        setHistoryActivities(data.activities || [])
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Verlauf konnte nicht geladen werden.' })
    }
    setHistoryLoading(false)
  }

  const assignHistoryActivity = async (activity, chosenKey) => {
    const historyId = activity.polar_exercise_id
    setHistoryAssigning(historyId)
    const schuhId = historyShoeSelections[historyId] || null
    try {
      if (chosenKey === 'extra') {
        const extraKey = `extra_polar_${activity.datum}_${crypto.randomUUID().slice(0, 8)}`
        await supabase.from('logs').upsert({
          user_id: user.id,
          day_key: extraKey,
          pace: activity.pace || null,
          km: activity.distanz || null,
          bpm: activity.herzfrequenz || null,
          note: 'Extra-Lauf, aus Polar-Verlauf nachgetragen (kein Plan-Tag)',
          schuh_id: schuhId,
          actual_date: activity.datum || null,
          running_index: activity.running_index || null,
          cadence: activity.cadence || null,
          uhrzeit: activity.uhrzeit || null,
          hf_max: activity.hf_max || null,
          hoehenmeter: activity.hoehenmeter || null,
          gefuehl: activity.gefuehl || null,
          training_load: activity.training_load || null,
          recovery_time: activity.recovery_time || null,
          polar_exercise_id: activity.polar_exercise_id || null,
          kalorien: activity.kalorien || null,
          route_waypoints: activity.route_waypoints || null,
          km_splits: activity.km_splits || null,
        }, { onConflict: 'user_id,day_key' })
      } else {
        await supabase.from('logs').upsert({
          user_id: user.id,
          day_key: chosenKey,
          pace: activity.pace || null,
          km: activity.distanz || null,
          bpm: activity.herzfrequenz || null,
          note: 'Aus Polar-Verlauf nachgetragen',
          schuh_id: schuhId,
          actual_date: activity.datum || null,
          running_index: activity.running_index || null,
          cadence: activity.cadence || null,
          uhrzeit: activity.uhrzeit || null,
          hf_max: activity.hf_max || null,
          hoehenmeter: activity.hoehenmeter || null,
          gefuehl: activity.gefuehl || null,
          training_load: activity.training_load || null,
          recovery_time: activity.recovery_time || null,
          polar_exercise_id: activity.polar_exercise_id || null,
          kalorien: activity.kalorien || null,
          route_waypoints: activity.route_waypoints || null,
          km_splits: activity.km_splits || null,
        }, { onConflict: 'user_id,day_key' })
        await supabase.from('training_done').upsert({
          user_id: user.id,
          day_key: chosenKey,
          done: true,
        }, { onConflict: 'user_id,day_key' })
        setOccupiedKeys(prev => new Set([...prev, chosenKey]))
      }

      if (schuhId && activity.distanz) {
        const gelaufeneKm = parseFloat(String(activity.distanz).replace(',', '.')) || 0
        if (gelaufeneKm > 0) {
          const { data: schuh } = await supabase.from('shoes').select('start_km').eq('id', schuhId).single()
          if (schuh) {
            await supabase.from('shoes').update({ start_km: (schuh.start_km || 0) + gelaufeneKm }).eq('id', schuhId)
          }
        }
      }

      setHistoryAssignedIds(prev => new Set([...prev, historyId]))

      await enrichImportedActivity(activity)

      const newAchievements = await checkForNewAchievements()

      if (newAchievements.length > 0) {
        setMessage({
          type: 'success',
          text: '✅ Zugeordnet!',
        })
      } else {
        setMessage({
          type: 'success',
          text: '✅ Zugeordnet! Seite wird aktualisiert…',
        })
        setTimeout(() => window.location.reload(), 900)
      }
    } catch (e) {
      console.error('Zuordnung aus Verlauf fehlgeschlagen:', e)
      setMessage({ type: 'error', text: 'Zuordnung fehlgeschlagen. Bitte erneut versuchen.' })
      setHistoryAssigning(null)
    }
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
      <AchievementUnlockModal
        open={achievementUnlocks.length > 0}
        achievements={achievementUnlocks}
        onClose={closeAchievementModal}
      />

      {supplementModal && (() => {
        const a = supplementModal.activity
        const candidate = supplementModal.candidate
        const running = isRunningActivity(a)
        const plannedText = `${candidate?.einheit || ''} ${candidate?.details || ''}`.toLowerCase()
        const hasMobility = /mobility|mobilität|beweglichkeit|stretch|dehnen/.test(plannedText)
        const hiking = ['hiking','walking'].includes(a?.sport_type)
        const stations = candidate?.hyrox_log?.stations || []
        const isHyrox = stations.length > 0 || /hyrox/.test(`${candidate?.planName || ''} ${plannedText}`.toLowerCase())
        const effortChoices = ['Sehr leicht','Leicht','Passend','Schwer','Zu schwer']
        const techniqueChoices = ['Sicher','Etwas unsicher','Schwierig']

        return (
          <div
            onClick={() => !assigning && setSupplementModal(null)}
            style={{
              position:'fixed', inset:0, zIndex:500,
              background:'rgba(45,30,24,.62)',
              display:'flex', alignItems:'flex-end', justifyContent:'center',
              backdropFilter:'blur(2px)',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width:'100%', maxWidth:560, maxHeight:'92dvh', overflowY:'auto',
                background:'#FFFCFA', borderRadius:'28px 28px 0 0',
                padding:'10px 18px calc(22px + env(safe-area-inset-bottom))',
                boxSizing:'border-box', boxShadow:'0 -12px 50px rgba(60,35,25,.24)',
              }}
            >
              <div style={{width:42,height:5,borderRadius:99,background:'#E9DED7',margin:'2px auto 16px'}} />

              <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,letterSpacing:1.2,color:'#C17A5C',textTransform:'uppercase'}}>
                Training ergänzen
              </div>
              <h3 style={{margin:'5px 0 4px',fontSize:21,color:'#3D2B1F'}}>
                {candidate?.einheit || a.activity_name || activityMeta(a).label}
              </h3>
              {candidate && (
                <div style={{fontFamily:'sans-serif',fontSize:11,color:'#9A8376',marginBottom:12}}>
                  {candidate.planName} · Woche {candidate.weekN}
                </div>
              )}

              <div style={{
                padding:'12px 13px',borderRadius:15,background:'#F0FAF4',
                border:'1px solid #CDE8D9',marginBottom:16,
              }}>
                <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,color:'#4F8B70',marginBottom:7}}>
                  ✓ Von Polar übernommen
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {a.distanz && <span style={{fontFamily:'sans-serif',fontSize:10.5,color:'#5D6D63'}}>📍 {a.distanz}</span>}
                  {running && a.pace && <span style={{fontFamily:'sans-serif',fontSize:10.5,color:'#5D6D63'}}>⏱ {a.pace}</span>}
                  {a.herzfrequenz && <span style={{fontFamily:'sans-serif',fontSize:10.5,color:'#5D6D63'}}>❤️ {a.herzfrequenz}</span>}
                  {a.dauer && <span style={{fontFamily:'sans-serif',fontSize:10.5,color:'#5D6D63'}}>⌚ {a.dauer}</span>}
                </div>
              </div>

              {running && schuhe.length > 0 && (
                <div style={{marginBottom:14}}>
                  <label style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,color:'#A88F7E',textTransform:'uppercase',letterSpacing:.6}}>
                    Laufschuhe
                  </label>
                  <select
                    value={supplementInput.schuh_id}
                    onChange={e=>setSupplementInput(p=>({...p,schuh_id:e.target.value}))}
                    style={{width:'100%',marginTop:5,padding:'11px 12px',borderRadius:12,border:'1.5px solid #EADDD5',background:'white',fontSize:13,color:'#3D2B1F'}}
                  >
                    <option value="">Kein Schuh ausgewählt</option>
                    {schuhe.map(s=><option key={s.id} value={s.id}>{s.marke} {s.modell} ({Math.round(s.start_km || 0)} km)</option>)}
                  </select>
                </div>
              )}

              <div style={{marginBottom:14}}>
                <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,color:'#A88F7E',textTransform:'uppercase',letterSpacing:.6,marginBottom:7}}>
                  Wie hat sich die Einheit angefühlt?
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {effortChoices.map(choice=>(
                    <button
                      type="button" key={choice}
                      onClick={()=>setSupplementInput(p=>({...p,feeling:choice}))}
                      style={{
                        border:`1.5px solid ${supplementInput.feeling===choice?'#5BA88A':'#EADDD5'}`,
                        background:supplementInput.feeling===choice?'#EEF8F3':'white',
                        color:supplementInput.feeling===choice?'#3D8B6E':'#806E63',
                        borderRadius:99,padding:'7px 10px',fontSize:10,fontWeight:800,
                      }}
                    >{choice}</button>
                  ))}
                </div>
              </div>

              {hasMobility && (
                <div style={{marginBottom:14}}>
                  <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,color:'#A88F7E',textTransform:'uppercase',letterSpacing:.6,marginBottom:7}}>
                    Mobility erledigt?
                  </div>
                  <div style={{display:'flex',gap:7}}>
                    {['Ja','Teilweise','Nein'].map(choice=>(
                      <button
                        type="button" key={choice}
                        onClick={()=>setSupplementInput(p=>({...p,mobility_status:choice}))}
                        style={{
                          flex:1,border:`1.5px solid ${supplementInput.mobility_status===choice?'#5BA88A':'#EADDD5'}`,
                          background:supplementInput.mobility_status===choice?'#EEF8F3':'white',
                          color:supplementInput.mobility_status===choice?'#3D8B6E':'#806E63',
                          borderRadius:12,padding:'9px 7px',fontSize:10,fontWeight:800,
                        }}
                      >{choice}</button>
                    ))}
                  </div>
                </div>
              )}

              {hiking && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:14}}>
                  <label style={{fontFamily:'sans-serif',fontSize:9.5,fontWeight:900,color:'#A88F7E',textTransform:'uppercase'}}>
                    Rucksackgewicht
                    <input
                      value={supplementInput.backpack_weight}
                      onChange={e=>setSupplementInput(p=>({...p,backpack_weight:e.target.value}))}
                      placeholder="z. B. 6 kg"
                      style={{width:'100%',marginTop:5,padding:'10px',borderRadius:11,border:'1.5px solid #EADDD5',boxSizing:'border-box'}}
                    />
                  </label>
                  <label style={{fontFamily:'sans-serif',fontSize:9.5,fontWeight:900,color:'#A88F7E',textTransform:'uppercase'}}>
                    Füße / Druckstellen
                    <input
                      value={supplementInput.pressure_points}
                      onChange={e=>setSupplementInput(p=>({...p,pressure_points:e.target.value}))}
                      placeholder="keine / kurz notieren"
                      style={{width:'100%',marginTop:5,padding:'10px',borderRadius:11,border:'1.5px solid #EADDD5',boxSizing:'border-box'}}
                    />
                  </label>
                </div>
              )}

              {isHyrox && stations.length > 0 && (
                <div style={{marginBottom:14}}>
                  <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,color:'#A88F7E',textTransform:'uppercase',letterSpacing:.6,marginBottom:8}}>
                    HYROX-Stationen
                  </div>
                  <div style={{display:'grid',gap:9}}>
                    {stations.map((station,index)=>{
                      const stationId = station.id || `station-${index}`
                      const values = supplementInput.hyrox_data?.[stationId] || {}
                      const label = station.label || station.name || station.title || stationId
                      const weightEach = /farmer/i.test(`${stationId} ${label}`)
                      return (
                        <div key={stationId} style={{padding:'11px',borderRadius:14,border:'1px solid #EADDD5',background:'#FFF8F5'}}>
                          <div style={{fontFamily:'sans-serif',fontSize:11,fontWeight:900,color:'#5C3D2E',marginBottom:8}}>{label}</div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:8}}>
                            <input
                              value={values[weightEach?'weight_each':'weight'] || ''}
                              onChange={e=>setHyroxSupplementField(stationId,weightEach?'weight_each':'weight',e.target.value)}
                              placeholder={weightEach?'kg je Hand':'Gewicht kg'}
                              inputMode="decimal"
                              style={{padding:'9px',borderRadius:10,border:'1px solid #EADDD5'}}
                            />
                            <input
                              value={values.distance || ''}
                              onChange={e=>setHyroxSupplementField(stationId,'distance',e.target.value)}
                              placeholder="Distanz / Wdh."
                              style={{padding:'9px',borderRadius:10,border:'1px solid #EADDD5'}}
                            />
                          </div>
                          <div style={{fontFamily:'sans-serif',fontSize:9,fontWeight:900,color:'#A88F7E',marginBottom:5}}>BELASTUNG</div>
                          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                            {['Zu leicht','Leicht','Passend','Schwer','Zu schwer'].map(choice=>(
                              <button type="button" key={choice} onClick={()=>setHyroxSupplementField(stationId,'effort',choice)}
                                style={{border:`1px solid ${values.effort===choice?'#FF8C69':'#EADDD5'}`,background:values.effort===choice?'#FFF0E8':'white',borderRadius:99,padding:'5px 7px',fontSize:8.8,fontWeight:800,color:'#765E50'}}>
                                {choice}
                              </button>
                            ))}
                          </div>
                          <div style={{fontFamily:'sans-serif',fontSize:9,fontWeight:900,color:'#A88F7E',marginBottom:5}}>TECHNIK</div>
                          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                            {techniqueChoices.map(choice=>(
                              <button type="button" key={choice} onClick={()=>setHyroxSupplementField(stationId,'technique',choice)}
                                style={{border:`1px solid ${values.technique===choice?'#5BA88A':'#EADDD5'}`,background:values.technique===choice?'#EEF8F3':'white',borderRadius:99,padding:'5px 7px',fontSize:8.8,fontWeight:800,color:'#765E50'}}>
                                {choice}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <label style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,color:'#A88F7E',textTransform:'uppercase',letterSpacing:.6}}>
                Notiz <span style={{fontWeight:600,textTransform:'none',color:'#C5B4A9'}}>optional</span>
                <textarea
                  value={supplementInput.note}
                  onChange={e=>setSupplementInput(p=>({...p,note:e.target.value}))}
                  placeholder="Was soll der Coach noch wissen?"
                  rows={2}
                  style={{width:'100%',marginTop:5,padding:'11px 12px',borderRadius:12,border:'1.5px solid #EADDD5',resize:'none',boxSizing:'border-box',fontSize:13}}
                />
              </label>

              <div style={{display:'flex',gap:8,marginTop:16}}>
                <button
                  type="button"
                  disabled={assigning === a.id}
                  onClick={()=>setSupplementModal(null)}
                  style={{flex:1,padding:13,borderRadius:15,border:'1.5px solid #EADDD5',background:'white',color:'#9A8376',fontWeight:900}}
                >
                  Zurück
                </button>
                <button
                  type="button"
                  disabled={assigning === a.id}
                  onClick={()=>assignActivity(a,supplementModal.chosenKey,supplementInput)}
                  style={{flex:2,padding:13,borderRadius:15,border:'none',background:'#5BA88A',color:'white',fontWeight:900}}
                >
                  {assigning === a.id ? '⏳ Speichere…' : 'Training abschließen ✓'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showIgnoredActivities && (
        <IgnoredActivities
          user={user}
          onClose={() => setShowIgnoredActivities(false)}
          onReleased={async () => {
            await loadIgnoredCount()
            await handleSync({ quiet: true })
            await loadPending()
          }}
        />
      )}

      {showMultisportMigration && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(50,30,20,0.68)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom))',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 430,
              maxHeight: '90dvh',
              overflowY: 'auto',
              background:
                'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 55%, #FFF0F5 100%)',
              borderRadius: 24,
              padding: 22,
              boxSizing: 'border-box',
              boxShadow: '0 24px 70px rgba(61,43,31,0.28)',
              fontFamily: 'sans-serif',
            }}
          >
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                marginBottom: 14,
                boxShadow: '0 8px 24px rgba(255,140,105,0.16)',
              }}
            >
              🌿
            </div>

            <div
              style={{
                fontSize: 11,
                color: '#C17A3A',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Neu in Version 2.0
            </div>

            <h3
              style={{
                margin: '0 0 10px',
                color: '#3D2B1F',
                fontFamily: "'Georgia', 'Times New Roman', serif",
                fontSize: 24,
              }}
            >
              Flora ist jetzt Multisport!
            </h3>

            <div
              style={{
                fontSize: 14,
                color: '#6F5648',
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Ab sofort kannst du neben Läufen auch diese Aktivitäten
              verwalten und auswerten:
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {[
                ['🚴', 'Radfahren'],
                ['🚵', 'Mountainbike'],
                ['🥾', 'Wandern'],
                ['🏊', 'Schwimmen'],
              ].map(([icon, label]) => (
                <div
                  key={label}
                  style={{
                    background: 'rgba(255,255,255,0.86)',
                    border: '1px solid #EFE4DB',
                    borderRadius: 13,
                    padding: '10px 11px',
                    color: '#5C3D2E',
                    fontSize: 12,
                    fontWeight: 'bold',
                  }}
                >
                  {icon} {label}
                </div>
              ))}
            </div>

            <div
              style={{
                padding: '11px 12px',
                borderRadius: 13,
                background: '#FFF5EE',
                border: '1px solid #FFD4B0',
                color: '#8B6B5A',
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 9,
              }}
            >
              Früher verworfene Polar-Aktivitäten dieser Sportarten
              können jetzt erneut gesucht werden.
            </div>

            <div
              style={{
                color: '#8B6B5A',
                fontSize: 11,
                lineHeight: 1.5,
                marginBottom: 18,
              }}
            >
              💡 Bereits übernommene Aktivitäten bleiben unverändert und
              werden nicht doppelt eingespielt.
            </div>

            <div style={{ display: 'flex', gap: 9 }}>
              <button
                type="button"
                onClick={handleMultisportMigrationLater}
                disabled={migrationRunning}
                style={{
                  flex: 1,
                  padding: 13,
                  borderRadius: 14,
                  border: '1.5px solid #E8D9CF',
                  background: 'white',
                  color: '#8B6B5A',
                  fontWeight: 'bold',
                  cursor: migrationRunning ? 'default' : 'pointer',
                }}
              >
                Später
              </button>

              <button
                type="button"
                onClick={handleMultisportMigrationNow}
                disabled={migrationRunning}
                style={{
                  flex: 1.5,
                  padding: 13,
                  borderRadius: 14,
                  border: 'none',
                  background:
                    'linear-gradient(135deg,#FF8C69,#FF6B9D)',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: migrationRunning ? 'default' : 'pointer',
                  opacity: migrationRunning ? 0.72 : 1,
                }}
              >
                {migrationRunning
                  ? '⏳ Suche läuft…'
                  : 'Jetzt suchen'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            {syncing ? '⏳ Synchronisiere…' : '🔄 Aktivitäten synchronisieren'}
          </button>
        )}
      </div>

      {pending.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#5C3D2E', fontFamily: 'sans-serif', marginBottom: 10 }}>
            Aktivitäten übernehmen ({pending.length})
          </div>
          {pending.map((a) => {
            const id = a.id
            const running = isRunningActivity(a)
            const meta = activityMeta(a)
            const candidates = getCandidates(a)
            const selected =
              selections[id] ?? (candidates[0]?.key || 'extra')
            const isAssigning = assigning === id

            return (
              <div
                key={id}
                style={{
                  background: 'white',
                  borderRadius: 14,
                  padding: '14px 16px',
                  border: '1.5px solid #F0E8E0',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
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
                    {meta.icon} {a.activity_name || meta.label} ·{' '}
                    {a.datum
                      ? new Date(`${a.datum}T00:00:00`).toLocaleDateString(
                          'de-DE',
                          {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          }
                        )
                      : 'Unbekannt'}
                  </div>

                  {a.dauer && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#B8A090',
                        fontFamily: 'sans-serif',
                      }}
                    >
                      {a.dauer}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  {a.distanz && (
                    <span style={{ fontSize: 11, background: '#FFF0E6', color: '#C17A3A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                      📍 {a.distanz}
                    </span>
                  )}

                  {running && a.pace && (
                    <span style={{ fontSize: 11, background: '#E8F0FF', color: '#4060C0', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                      ⏱ {a.pace}
                    </span>
                  )}

                  {!running && a.average_speed_kmh != null && (
                    <span style={{ fontSize: 11, background: '#E8F0FF', color: '#4060C0', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                      ⚡ {Number(a.average_speed_kmh).toFixed(1)} km/h
                    </span>
                  )}

                  {a.elevation_gain != null && (
                    <span style={{ fontSize: 11, background: '#FFF8E1', color: '#A07830', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                      ⛰️ {Math.round(Number(a.elevation_gain))} hm
                    </span>
                  )}

                  {a.herzfrequenz && (
                    <span style={{ fontSize: 11, background: '#FDECEA', color: '#B85464', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                      ❤️ {a.herzfrequenz}
                    </span>
                  )}

                  {a.kalorien && (
                    <span style={{ fontSize: 11, background: '#F0FAF4', color: '#5BA88A', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                      🔥 {a.kalorien} kcal
                    </span>
                  )}

                  {running && a.running_index && (
                    <span style={{ fontSize: 11, background: '#F5F0FF', color: '#A78BCA', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                      🏃 RI {a.running_index}
                    </span>
                  )}

                  {running && a.cadence && (
                    <span style={{ fontSize: 11, background: '#E8F5EF', color: '#3D8B6E', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>
                      👣 {a.cadence} spm
                    </span>
                  )}
                </div>

                {candidates.length > 0 ? (
                  <>
                    <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>
                      Welchem Plan-Tag zuordnen?
                    </label>

                    <select
                      value={selected}
                      onChange={e =>
                        setSelections(prev => ({
                          ...prev,
                          [id]: e.target.value,
                        }))
                      }
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 13, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer', marginBottom: 10 }}
                    >
                      {candidates.length === 0 && (
                        <option value="">
                          Kein passender offener Tag gefunden
                        </option>
                      )}

                      {candidates.map(candidate => (
                        <option
                          key={candidate.key}
                          value={candidate.key}
                        >
                          {candidateLabel(candidate)}
                        </option>
                      ))}

                      <option value="extra">
                        — Als Extra-Lauf speichern (kein Plan-Tag) —
                      </option>
                    </select>

                    {schuhe.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4, fontFamily: 'sans-serif' }}>
                          Laufschuhe
                        </label>

                        <select
                          value={shoeSelections[id] || ''}
                          onChange={e =>
                            setShoeSelections(prev => ({
                              ...prev,
                              [id]: e.target.value,
                            }))
                          }
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 13, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer' }}
                        >
                          <option value="">Kein Schuh ausgewählt</option>

                          {schuhe.map(shoe => (
                            <option key={shoe.id} value={shoe.id}>
                              {shoe.marke} {shoe.modell} (
                              {Math.round(shoe.start_km || 0)} km)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      padding: '9px 11px',
                      borderRadius: 11,
                      background: '#F0FAF4',
                      border: '1px solid #B8E4CC',
                      color: '#3D8B6E',
                      fontSize: 11,
                      fontFamily: 'sans-serif',
                      marginBottom: 10,
                      lineHeight: 1.4,
                    }}
                  >
                    Diese Aktivität wird direkt unter „Aktivitäten“
                    gespeichert. Eine Laufplan-Zuordnung und Laufschuh-Auswahl
                    sind nicht erforderlich.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => discardActivity(a)}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #F0E8E0', background: 'white', color: '#B8A090', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}
                  >
                    Nicht übernehmen
                  </button>

                  <button
                    onClick={() =>
                      openSupplement(a, selected, candidates)
                    }
                    disabled={
                      (running && !selected) || isAssigning
                    }
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: 'none',
                      background:
                        (running && !selected) || isAssigning
                          ? '#F0E8E0'
                          : 'linear-gradient(135deg,#FF8C69,#FFB347)',
                      color:
                        (running && !selected) || isAssigning
                          ? '#C4A882'
                          : 'white',
                      fontSize: 12,
                      fontWeight: 'bold',
                      cursor:
                        (running && !selected) || isAssigning
                          ? 'default'
                          : 'pointer',
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {isAssigning
                      ? '⏳ Speichere…'
                      : running
                        ? '✓ Zuordnen'
                        : '✓ Übernehmen'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {false && connected && (
        <div style={{ marginBottom: 16 }}>
          {ignoredCount > 0 && (
            <button
              type="button"
              onClick={() => setShowIgnoredActivities(true)}
              style={{
                width: '100%',
                marginTop: 12,
                padding: '12px 14px',
                borderRadius: 13,
                border: '1.5px solid #F0E8E0',
                background: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                fontFamily: 'sans-serif',
                textAlign: 'left',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#5C3D2E',
                    fontWeight: 'bold',
                  }}
                >
                  Nicht übernommene Polar-Aktivitäten
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: '#B8A090',
                    marginTop: 3,
                  }}
                >
                  {ignoredCount}{' '}
                  {ignoredCount === 1 ? 'Aktivität' : 'Aktivitäten'}
                </div>
              </div>

              <span style={{ color: '#C4A882', fontSize: 18 }}>›</span>
            </button>
          )}

          {syncSummary && (
            <div
              style={{
                marginTop: 12,
                padding: '11px 12px',
                borderRadius: 12,
                background: '#F0FAF4',
                border: '1px solid #B8E4CC',
                color: '#5BA88A',
                fontSize: 11,
                lineHeight: 1.5,
                fontFamily: 'sans-serif',
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                Synchronisation abgeschlossen
              </div>
              {syncSummary.count > 0
                ? Object.entries(syncSummary.groups).map(([type, count]) => (
                    <div key={type}>
                      {activityMeta({ sport_type: type }).icon}{' '}
                      {count} {activityMeta({ sport_type: type }).label}
                      {count !== 1 ? 'en' : ''}
                    </div>
                  ))
                : 'Keine neuen Aktivitäten gefunden.'}
              {syncSummary.updatedCount > 0 && (
                <div style={{ marginTop: 4 }}>
                  🔄 {syncSummary.updatedCount}{' '}
                  {syncSummary.updatedCount === 1
                    ? 'bestehende Aktivität aktualisiert'
                    : 'bestehende Aktivitäten aktualisiert'}
                </div>
              )}
            </div>
          )}

          {!showHistory ? (
            <button onClick={loadHistory}
              style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1.5px solid #F0E0D0', background: 'white', color: '#8B7355', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
              🕘 Verlauf durchsuchen (falls ein Lauf fehlt oder falsch zugeordnet wurde)
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#5C3D2E', fontFamily: 'sans-serif' }}>
                  🕘 Verlauf (letzte Läufe von Polar)
                </div>
                <button onClick={() => setShowHistory(false)}
                  style={{ background: 'none', border: 'none', color: '#C4A882', cursor: 'pointer', fontSize: 12, fontFamily: 'sans-serif' }}>
                  Schließen
                </button>
              </div>

              {historyLoading && (
                <div style={{ textAlign: 'center', padding: 16, color: '#B8A090', fontFamily: 'sans-serif', fontSize: 13 }}>⏳ Lade Verlauf…</div>
              )}

              {!historyLoading && historyActivities.length === 0 && (
                <div style={{ textAlign: 'center', padding: 16, color: '#B8A090', fontFamily: 'sans-serif', fontSize: 13 }}>Keine Läufe im Verlauf gefunden.</div>
              )}

              {!historyLoading && historyActivities.map((a) => {
                const hid = a.polar_exercise_id
                const alreadyAssigned = historyAssignedIds.has(hid)
                const hCandidates = getCandidates(a)
                const hSelected = historySelections[hid] ?? (hCandidates[0]?.key || '')
                const isHAssigning = historyAssigning === hid

                return (
                  <div key={hid} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', border: '1.5px solid #F0E8E0', marginBottom: 10, opacity: alreadyAssigned ? 0.5 : 1 }}>
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
                      {a.running_index && <span style={{ fontSize: 11, background: '#F5F0FF', color: '#A78BCA', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>🏃 RI {a.running_index}</span>}
                      {a.cadence && <span style={{ fontSize: 11, background: '#E8F5EF', color: '#3D8B6E', padding: '3px 10px', borderRadius: 99, fontFamily: 'sans-serif', fontWeight: 'bold' }}>👣 {a.cadence} spm</span>}
                    </div>

                    {alreadyAssigned ? (
                      <div style={{ fontSize: 12, color: '#5BA88A', fontFamily: 'sans-serif', fontWeight: 'bold' }}>✓ Bereits zugeordnet</div>
                    ) : (
                      <>
                        <select
                          value={hSelected}
                          onChange={e => setHistorySelections(p => ({ ...p, [hid]: e.target.value }))}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 13, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer', marginBottom: 10 }}>
                          {hCandidates.length === 0 && <option value="">Kein passender offener Tag gefunden</option>}
                          {hCandidates.map(c => (
                            <option key={c.key} value={c.key}>
                              {candidateLabel(c)}
                            </option>
                          ))}
                          <option value="extra">— Als Extra-Lauf speichern (kein Plan-Tag) —</option>
                        </select>

                        {schuhe.length > 0 && (
                          <select
                            value={historyShoeSelections[hid] || ''}
                            onChange={e => setHistoryShoeSelections(p => ({ ...p, [hid]: e.target.value }))}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #F0E8E0', fontSize: 13, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif', cursor: 'pointer', marginBottom: 10 }}>
                            <option value="">Kein Schuh ausgewählt</option>
                            {schuhe.map(s => (
                              <option key={s.id} value={s.id}>{s.marke} {s.modell} ({Math.round(s.start_km || 0)} km)</option>
                            ))}
                          </select>
                        )}

                        <button onClick={() => assignHistoryActivity(a, hSelected)} disabled={!hSelected || isHAssigning}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', background: !hSelected || isHAssigning ? '#F0E8E0' : 'linear-gradient(135deg,#FF8C69,#FFB347)', color: !hSelected || isHAssigning ? '#C4A882' : 'white', fontSize: 12, fontWeight: 'bold', cursor: !hSelected || isHAssigning ? 'default' : 'pointer', fontFamily: 'sans-serif' }}>
                          {isHAssigning ? '⏳ Speichere…' : '✓ Zuordnen'}
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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
