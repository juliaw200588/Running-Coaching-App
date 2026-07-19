import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jgvsbecvgkcfafjyhxvr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
)

// Polar liefert "duration" als ISO-8601-Dauer (z.B. "PT47M36S" = 47 Min 36 Sek),
// nicht als einfache Sekundenzahl. Reines "/60" auf einen solchen String ergibt NaN,
// wodurch die Pace-Berechnung bisher stillschweigend übersprungen wurde.
function parseIsoDurationToSeconds(duration) {
  if (duration == null) return null
  if (typeof duration === 'number') return duration // falls doch mal eine reine Zahl kommt
  const match = String(duration).match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/)
  if (!match) return null
  const hours = parseFloat(match[1] || '0')
  const minutes = parseFloat(match[2] || '0')
  const seconds = parseFloat(match[3] || '0')
  return hours * 3600 + minutes * 60 + seconds
}

// Wandelt ein rohes Polar-Exercise-Objekt in unser einheitliches Aktivitäts-Format um.
// Wird sowohl vom Transaktions-Sync als auch vom History-Endpunkt genutzt.
function mapExercise(ex, exerciseId) {
  const distanceKm = ex.distance ? (ex.distance / 1000).toFixed(2) : null
  const durationSeconds = parseIsoDurationToSeconds(ex.duration)
  const durationMin = durationSeconds != null ? Math.round(durationSeconds / 60) : null
  const pace = distanceKm && durationSeconds != null
    ? (() => {
        const paceMin = (durationSeconds / 60) / parseFloat(distanceKm)
        const paceM = Math.floor(paceMin)
        const paceS = Math.round((paceMin - paceM) * 60).toString().padStart(2, '0')
        return `${paceM}:${paceS} min/km`
      })()
    : null

  // Running Index & Cadence: Feldnamen noch nicht 100% verifiziert (im Gegensatz zu
  // pace/duration). Versucht mehrere plausible Varianten, bricht bei keinem Treffer
  // nicht ab, sondern loggt die komplette Rohantwort - damit wir die echten Feldnamen
  // beim nächsten echten Sync in den Vercel-Logs ablesen und ggf. korrigieren können.
  const runningIndex = ex['running-index']?.score
    ?? ex['running-index']
    ?? ex.runningIndex
    ?? ex['training-load-pro']?.['running-index']
    ?? null
  const cadence = ex['average-cadence']
    ?? ex.cadence
    ?? ex['running-cadence']
    ?? ex['average-running-cadence']
    ?? null

  if (runningIndex == null || cadence == null) {
    console.log('[Polar mapExercise] Running Index/Cadence nicht gefunden. Rohes Exercise-Objekt:', JSON.stringify(ex).slice(0, 2000))
  }

  // Uhrzeit: steckt bereits im ohnehin abgefragten start-time-Feld, nur bisher weggeworfen.
  const uhrzeit = ex['start-time']?.split('T')[1]?.slice(0, 5) || null

  // Max-HF: gleiche Objektstruktur wie heart-rate.average (das bereits bestätigt funktioniert),
  // daher hohe Zuversicht ohne Debug-Logging nötig.
  const hfMax = ex['heart-rate']?.maximum ?? null

  // Höhenmeter, Gefühl, Trainingsbelastung/Erholung: Feldnamen nicht verifiziert, gleiches
  // vorsichtiges Vorgehen wie bei Running Index/Cadence - mehrere Varianten versuchen,
  // bei keinem Treffer die Rohantwort loggen statt zu raten.
  const hoehenmeter = ex.ascent
    ?? ex['total-ascent']
    ?? ex['ascent-descent']?.ascent
    ?? null
  // "Gefühl" = Polars eigenes RPE-Feld (user-rpe), bestätigt aus echten Rohdaten am 19.07.
  // "UNKNOWN" bedeutet: Nutzer hat für diesen Lauf kein Gefühl in Polar Flow eingetragen -
  // zählt für uns wie "kein Wert vorhanden".
  const rawRpe = ex['training-load-pro']?.['user-rpe']
  const gefuehl = (rawRpe && rawRpe !== 'UNKNOWN') ? rawRpe : null

  // Höhenmeter, Kadenz, Erholungszeit: anhand echter Rohdaten (19.07.) bestätigt NICHT
  // Teil dieser Zusammenfassungs-Antwort (kein falscher Feldname - die Werte fehlen
  // schlicht komplett). Polar Flow zeigt sie zwar an, das muss aber aus dem separaten,
  // detaillierteren "Samples"-Endpunkt stammen (Zeitreihendaten), nicht aus dieser
  // einfachen Exercise-Zusammenfassung. Bleibt vorerst null, bis das separat gebaut wird.
  const trainingLoad = ex['training-load']
    ?? ex['training-load-pro']?.['cardio-load']
    ?? ex['training-load-pro']?.['muscle-load']
    ?? null
  const recoveryTime = ex['recovery-time']
    ?? ex['training-load-pro']?.['recovery-time']
    ?? null

  // Nur noch trainingLoad überwachen - für die anderen vier ist das Verhalten jetzt
  // geklärt (Höhenmeter/Kadenz/Erholungszeit fehlen strukturell, Gefühl ist oft legitim
  // "kein Wert"), ständiges Loggen dafür würde nur unnötig Rauschen erzeugen.
  if (trainingLoad == null) {
    console.log('[Polar mapExercise] Trainingsbelastung nicht gefunden (unerwartet). Rohes Exercise-Objekt:', JSON.stringify(ex).slice(0, 4000))
  }

  return {
    polar_exercise_id: exerciseId,
    datum: ex['start-time']?.split('T')[0] || null,
    distanz: distanceKm ? `${distanceKm} km` : null,
    pace,
    herzfrequenz: ex['heart-rate']?.average ? `${ex['heart-rate'].average} bpm` : null,
    kalorien: ex.calories != null ? String(ex.calories) : null,
    dauer: durationMin ? `${durationMin} min` : null,
    sport: ex.sport || null,
    running_index: runningIndex != null ? String(runningIndex) : null,
    cadence: cadence != null ? String(cadence) : null,
    uhrzeit,
    hf_max: hfMax != null ? String(hfMax) : null,
    hoehenmeter: hoehenmeter != null ? String(hoehenmeter) : null,
    gefuehl: gefuehl != null ? String(gefuehl) : null,
    training_load: trainingLoad != null ? String(trainingLoad) : null,
    recovery_time: recoveryTime != null ? String(recoveryTime) : null,
  }
}

function isRunning(ex) {
  return ex.sport?.toLowerCase().includes('running') || ex.sport?.toLowerCase().includes('lauf')
}

// Holt neue Läufe von Polar für einen User und speichert sie in polar_pending_activities.
// Wird sowohl vom manuellen Sync-Button als auch vom Webhook aufgerufen.
export async function fetchAndPersistPolarActivities(userId) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!integration?.polar_access_token) {
    throw new Error('Polar nicht verbunden')
  }

  const token = integration.polar_access_token
  const polarUserId = integration.polar_user_id

  const txRes = await fetch(`https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  })

  if (txRes.status === 204 || !txRes.ok) return []

  const txData = await txRes.json()
  const transactionId = txData['transaction-id']

  const activitiesRes = await fetch(
    `https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions/${transactionId}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
  )
  const activitiesData = await activitiesRes.json()
  const exercises = activitiesData['exercises'] || []

  const stored = []

  for (const exerciseUrl of exercises) {
    // ?samples=true&zones=true laut offizieller Polar-Doku: liefert zusätzliche
    // Zeitreihen-Daten (vermutlich Kadenz, Distanz-über-Zeit für km-Splits, evtl. sogar
    // GPS-Punkte). Struktur der Antwort noch nicht verifiziert - wird unten geloggt,
    // um sie an echten Daten zu sehen statt zu raten.
    const separator = exerciseUrl.includes('?') ? '&' : '?'
    const exRes = await fetch(`${exerciseUrl}${separator}samples=true&zones=true`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    })
    const ex = await exRes.json()

    console.log('[Polar Samples] Schlüssel der Antwort:', Object.keys(ex).join(', '))
    if (ex.samples) console.log('[Polar Samples] Rohe samples-Daten:', JSON.stringify(ex.samples).slice(0, 4000))
    if (ex.route) console.log('[Polar Samples] Rohe route-Daten:', JSON.stringify(ex.route).slice(0, 2000))

    if (isRunning(ex)) {
      const exerciseId = exerciseUrl.split('/').filter(Boolean).pop()
      const row = { user_id: userId, ...mapExercise(ex, exerciseId) }

      const { error } = await supabase
        .from('polar_pending_activities')
        .upsert(row, { onConflict: 'user_id,polar_exercise_id' })

      if (!error) stored.push(row)
      else console.error('Polar activity upsert error:', error)
    }
  }

  // Transaktion bestätigen, damit Polar die Aktivitäten als abgeholt markiert
  await fetch(
    `https://www.polaraccesslink.com/v3/users/${polarUserId}/exercise-transactions/${transactionId}`,
    { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }
  )

  return stored
}

// Holt Läufe über den NICHT-transaktionalen Endpunkt (/v3/exercises) - liefert die
// Verlaufsdaten wiederholbar, ohne sie als "abgeholt" zu markieren. Dient als manueller
// Wiederherstellungsweg, falls ein Lauf über den Transaktions-Sync bereits verbraucht
// wurde (z.B. nach einer falschen Zuordnung), aber erneut zugeordnet werden muss.
export async function fetchPolarHistory(userId) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!integration?.polar_access_token) {
    throw new Error('Polar nicht verbunden')
  }

  const token = integration.polar_access_token

  const res = await fetch('https://www.polaraccesslink.com/v3/exercises', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
  })

  if (!res.ok) throw new Error(`Polar API Fehler (${res.status})`)

  const data = await res.json()
  console.log('[Polar History] Rohe API-Antwort:', JSON.stringify(data).slice(0, 3000))

  const exercises = data.exercises || data || []
  console.log('[Polar History] Anzahl Einträge:', exercises.length)
  if (exercises[0]) console.log('[Polar History] Erster Eintrag (roh):', JSON.stringify(exercises[0]))

  const running = exercises.filter(isRunning)
  console.log('[Polar History] Davon als "running" erkannt:', running.length)

  return running
    .map(ex => mapExercise(ex, String(ex.id ?? ex['start-time'])))
    .filter(a => a.datum)
    .sort((a, b) => (a.datum < b.datum ? 1 : -1))
}

// Google's Encoded Polyline Algorithm Format (Standardalgorithmus, von Mapbox erwartet).
function encodeNumber(num) {
  let sgnNum = num << 1
  if (num < 0) sgnNum = ~sgnNum
  let output = ''
  while (sgnNum >= 0x20) {
    output += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63)
    sgnNum >>= 5
  }
  output += String.fromCharCode(sgnNum + 63)
  return output
}

function encodePolyline(points) {
  let output = ''
  let prevLat = 0
  let prevLon = 0
  for (const [lat, lon] of points) {
    const lat5 = Math.round(lat * 1e5)
    const lon5 = Math.round(lon * 1e5)
    output += encodeNumber(lat5 - prevLat)
    output += encodeNumber(lon5 - prevLon)
    prevLat = lat5
    prevLon = lon5
  }
  return output
}

// Zu viele Punkte sprengen die URL-Länge, die Mapbox akzeptiert - auf max. ~300 reduzieren,
// Start und Ende bleiben immer erhalten.
function simplifyPoints(points, maxPoints = 300) {
  if (points.length <= maxPoints) return points
  const step = points.length / maxPoints
  const result = []
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.floor(i * step)])
  }
  result.push(points[points.length - 1])
  return result
}

// Holt die GPX-Route für einen Lauf und parst die GPS-Punkte heraus.
// WICHTIG: Der genaue Endpunkt-Pfad für den GPX-Export ist bei mir nicht zu 100%
// verifiziert (im Gegensatz zu pace/duration). Bei einem Fehler wird die rohe
// Antwort geloggt, damit der Pfad bei Bedarf korrigiert werden kann.
export async function fetchExerciseRoute(userId, exerciseId) {
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!integration?.polar_access_token) {
    throw new Error('Polar nicht verbunden')
  }

  const token = integration.polar_access_token
  const polarUserId = integration.polar_user_id

  const gpxRes = await fetch(
    `https://www.polaraccesslink.com/v3/exercises/${exerciseId}/gpx`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/gpx+xml' } }
  )

  if (!gpxRes.ok) {
    const errText = await gpxRes.text().catch(() => '')
    console.log('[Polar Route] GPX-Abruf fehlgeschlagen, Status:', gpxRes.status, 'Antwort:', errText.slice(0, 1000))
    throw new Error(`GPX nicht verfügbar (${gpxRes.status})`)
  }

  const gpxText = await gpxRes.text()
  const points = []
  const trkptRegex = /<trkpt[^>]*\blat="(-?[\d.]+)"[^>]*\blon="(-?[\d.]+)"/g
  let m
  while ((m = trkptRegex.exec(gpxText))) {
    points.push([parseFloat(m[1]), parseFloat(m[2])])
  }

  if (points.length === 0) {
    console.log('[Polar Route] Keine GPS-Punkte im GPX gefunden. Roher Anfang der Antwort:', gpxText.slice(0, 1000))
    throw new Error('Keine GPS-Punkte gefunden')
  }

  return simplifyPoints(points)
}

export { supabase, encodePolyline }
