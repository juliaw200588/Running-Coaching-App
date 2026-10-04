import { supabase } from './supabase.js'

const STORAGE_PREFIX = 'training-plan-generation-job-v1'
const POLL_INTERVAL_MS = 1500
const MAX_WAIT_MS = 10 * 60 * 1000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const storageKey = userId => `${STORAGE_PREFIX}:${userId}`

function createJobId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // UUID-v4-Fallback für ältere Browser.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function savePendingJob(userId, job) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(job))
  } catch {}
}

function clearPendingJob(userId, jobId) {
  if (typeof window === 'undefined') return

  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return

    const stored = JSON.parse(raw)
    if (!jobId || stored?.jobId === jobId) {
      window.localStorage.removeItem(storageKey(userId))
    }
  } catch {}
}

export function getPendingPlanGeneration() {
  if (typeof window === 'undefined') return null

  try {
    const keys = Object.keys(window.localStorage)
      .filter(key => key.startsWith(`${STORAGE_PREFIX}:`))

    for (const key of keys) {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (parsed?.jobId && parsed?.userId) return parsed
    }
  } catch {}

  return null
}

async function readJob(jobId, userId) {
  const { data, error } = await supabase
    .from('plan_generation_jobs')
    .select('id,user_id,sport_type,status,plan_data,error_message,created_at,updated_at')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function waitForJob({ jobId, userId, directRequest }) {
  const started = Date.now()
  let requestFinished = false
  let requestError = null

  directRequest
    .then(() => { requestFinished = true })
    .catch(error => {
      requestFinished = true
      requestError = error
    })

  while (Date.now() - started < MAX_WAIT_MS) {
    try {
      const job = await readJob(jobId, userId)

      if (job?.status === 'completed' && job?.plan_data?.phases?.length) {
        clearPendingJob(userId, jobId)
        return job.plan_data
      }

      if (job?.status === 'failed') {
        clearPendingJob(userId, jobId)
        throw new Error(job.error_message || 'Der Trainingsplan konnte nicht erstellt werden.')
      }
    } catch (error) {
      // Ein kurzzeitiger Supabase-/Netzfehler darf den serverseitig laufenden Job
      // nicht abbrechen. Nur einen bereits explizit fehlgeschlagenen Job weiterwerfen.
      if (String(error?.message || '').includes('Trainingsplan konnte nicht erstellt')) {
        throw error
      }
    }

    // Wenn der eigentliche Browser-Request sofort gar nicht erst beim Server ankam,
    // nicht zehn Minuten blind warten. Bei einem Tabwechsel kann der Request dagegen
    // clientseitig abbrechen, obwohl der Server weiterläuft – deshalb 20 Sekunden Kulanz.
    if (requestFinished && requestError && Date.now() - started > 20000) {
      const job = await readJob(jobId, userId).catch(() => null)
      if (!job || job.status === 'pending') {
        clearPendingJob(userId, jobId)
        throw requestError
      }
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(
    'Die Planerstellung läuft ungewöhnlich lange. Der Auftrag bleibt gespeichert – bitte öffne die App erneut und versuche es noch einmal.'
  )
}

export async function generatePlanWithBackgroundRecovery(payload) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const user = authData?.user
  if (!user?.id) {
    throw new Error('Du bist nicht angemeldet.')
  }

  const sportType = payload?.sport_type || payload?.sportType || 'running'
  const jobId = createJobId()

  const { error: insertError } = await supabase
    .from('plan_generation_jobs')
    .insert({
      id: jobId,
      user_id: user.id,
      sport_type: sportType,
      status: 'pending',
    })

  if (insertError) {
    throw new Error(
      `Die Planerstellung konnte nicht gestartet werden: ${insertError.message}`
    )
  }

  savePendingJob(user.id, {
    jobId,
    userId: user.id,
    sportType,
    startedAt: new Date().toISOString(),
  })

  const directRequest = fetch('/api/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // keepalive hilft zusätzlich beim Wechseln/Verlassen einer Seite.
    // Die eigentliche Absicherung erfolgt aber über den Supabase-Job.
    keepalive: true,
    body: JSON.stringify({
      ...payload,
      generationJobId: jobId,
      generationUserId: user.id,
    }),
  }).then(async response => {
    const raw = await response.text()
    let data = null

    try {
      data = raw ? JSON.parse(raw) : null
    } catch {
      const compact = String(raw || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 260)

      throw new Error(
        response.ok
          ? 'Die Plan-API hat keine gültigen JSON-Daten zurückgegeben.'
          : `Plan-API ${response.status}: ${compact || response.statusText || 'Unbekannter Serverfehler'}`
      )
    }

    if (!response.ok || data?.error) {
      throw new Error(data?.error || `Plan-API ${response.status}`)
    }

    return data
  })

  return waitForJob({
    jobId,
    userId: user.id,
    directRequest,
  })
}
