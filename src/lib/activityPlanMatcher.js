import { planDayKey } from './planDayKey.js'

const DAY_MS = 86400000
const TAG_OFFSET = { Mo:0, Di:1, Mi:2, Do:3, Fr:4, Sa:5, So:6 }

const localDate = date =>
  `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

const diffDays = (a, b) =>
  Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / DAY_MS)

const normalize = value => String(value || '').trim().toLowerCase()

export const normalizeActivitySport = value => {
  const s = normalize(value)
  if (!s) return 'other'
  if (/(mountain|mtb)/.test(s)) return 'mountain_biking'
  if (/(hiking|hike|wandern|wander|trek)/.test(s)) return 'hiking'
  if (/(walking|walk|gehen|spazier)/.test(s)) return 'walking'
  if (/(cycling|cycle|bike|biking|radfahren|rennrad|road bike)/.test(s)) return 'cycling'
  if (/(swimming|swim|schwimm)/.test(s)) return 'swimming'
  if (/(strength|kraft|weight|gym)/.test(s)) return 'strength'
  if (/(hyrox)/.test(s)) return 'hyrox'
  if (/(running|run|laufen|lauf|jogging|trail)/.test(s)) return 'running'
  return 'other'
}

const daySport = day => {
  const explicit = normalizeActivitySport(day?.sport_type || day?.sportType)
  if (explicit !== 'other') return explicit
  return normalizeActivitySport(`${day?.einheit || ''} ${day?.details || ''}`)
}

const compatible = (activitySport, plannedSport, day) => {
  if (activitySport === plannedSport) return true

  // Walking/Hiking werden als nahe Verwandte behandelt.
  if (
    ['walking','hiking'].includes(activitySport) &&
    ['walking','hiking'].includes(plannedSport)
  ) return true

  // Ein echter Polar-Lauf darf als Kandidat für einen expliziten Lauf-Baustein
  // eines HYROX-Plans auftauchen, aber nicht für beliebige HYROX-Stationseinheiten.
  if (activitySport === 'running') {
    const text = normalize(`${day?.einheit || ''} ${day?.details || ''}`)
    return plannedSport === 'hyrox' && /(run|lauf|running|easy|interval)/.test(text)
  }

  return false
}

const estimateKm = details => {
  if (!details) return 0
  const clean = String(details).replace(/\([^)]*\)/g, '')
  const total = clean.match(/^\s*(\d+(?:[.,]\d+)?)\s*km\s*:/i)
  if (total) return Number(total[1].replace(',','.')) || 0

  let km = 0
  const rep = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b/gi
  let m
  while ((m = rep.exec(clean))) {
    let dist = Number(m[2].replace(',','.')) || 0
    if (m[3].toLowerCase() === 'm') dist /= 1000
    km += Number(m[1]) * dist
  }
  const rest = clean.replace(rep, '')
  const rx = /(\d+(?:[.,]\d+)?)\s*km\b/gi
  while ((m = rx.exec(rest))) km += Number(m[1].replace(',','.')) || 0
  return km
}

const estimateMinutes = day => {
  const direct = Number(day?.durationMinutes)
  if (Number.isFinite(direct) && direct > 0) return direct
  const text = `${day?.einheit || ''} ${day?.details || ''}`
  const match = text.match(/(\d+)\s*min\b/i)
  return match ? Number(match[1]) : 0
}

const weekStartFromRange = (plan, week) => {
  const match = week?.dateRange?.match(/(\d{1,2})\.(\d{1,2})\./)
  if (!match) return null

  const fallbackYear = plan?.startDate
    ? new Date(`${plan.startDate}T00:00:00`).getFullYear()
    : new Date().getFullYear()
  const startMonth = plan?.startDate
    ? new Date(`${plan.startDate}T00:00:00`).getMonth()
    : null

  const month = Number(match[2]) - 1
  let year = fallbackYear
  if (startMonth !== null && month < startMonth - 6) year += 1
  return new Date(year, month, Number(match[1]), 12, 0, 0)
}

export const flattenActivePlans = planRows => {
  const result = []

  for (const row of planRows || []) {
    const plan = row?.plan_data || row?.plan
    const planId = row?.id || row?.planId
    if (!plan || !planId) continue

    for (const phase of plan?.phases || []) {
      for (const week of phase?.weeks || []) {
        const weekStart = weekStartFromRange(plan, week)
        if (!weekStart) continue

        ;(week?.days || []).forEach((day, dayIdx) => {
          if (day?.optional) return
          const date = new Date(weekStart)
          date.setDate(date.getDate() + (TAG_OFFSET[day?.tag] ?? 0))

          result.push({
            ...day,
            planId,
            planName:
              plan?.planName ||
              plan?.title ||
              plan?.name ||
              (row?.is_primary ? 'Hauptplan' : 'Zusatzplan'),
            isPrimary:Boolean(row?.is_primary),
            phaseId:phase?.id,
            phaseLabel:phase?.label || '',
            weekN:week?.n,
            dayIdx,
            key:planDayKey(planId, phase?.id, week?.n, dayIdx),
            date,
            dateStr:localDate(date),
            plannedKm:estimateKm(day?.details),
            plannedMinutes:estimateMinutes(day),
            plannedSport:daySport(day),
          })
        })
      }
    }
  }

  return result
}

const actualKm = activity => {
  const meters = Number(activity?.distance_meters)
  if (Number.isFinite(meters) && meters > 0) return meters / 1000
  const parsed = Number(String(activity?.distanz || '').replace(',','.').match(/\d+(?:\.\d+)?/)?.[0])
  return Number.isFinite(parsed) ? parsed : null
}

const actualMinutes = activity => {
  const seconds = Number(activity?.duration_seconds)
  if (Number.isFinite(seconds) && seconds > 0) return seconds / 60
  const parsed = Number(String(activity?.dauer || '').match(/\d+/)?.[0])
  return Number.isFinite(parsed) ? parsed : null
}

const confidenceFor = score => {
  if (score <= 0.9) return 'high'
  if (score <= 2.4) return 'medium'
  return 'low'
}

export const matchActivityToPlans = ({
  activity,
  planRows,
  occupiedKeys = new Set(),
  maxDays = 4,
  limit = 6,
}) => {
  if (!activity?.datum) return []

  const sport = normalizeActivitySport(
    activity?.sport_type || activity?.sport || activity?.activity_name
  )
  const km = actualKm(activity)
  const minutes = actualMinutes(activity)

  return flattenActivePlans(planRows)
    .filter(day => !occupiedKeys.has(day.key))
    .filter(day => compatible(sport, day.plannedSport, day))
    .map(day => {
      const dayDelta = diffDays(day.dateStr, activity.datum)
      if (Math.abs(dayDelta) > maxDays) return null

      const kmDiff =
        km != null && day.plannedKm > 0 ? Math.abs(day.plannedKm - km) : null
      const minuteDiff =
        minutes != null && day.plannedMinutes > 0
          ? Math.abs(day.plannedMinutes - minutes)
          : null

      let score = Math.abs(dayDelta) * 1.5
      if (kmDiff != null) score += Math.min(kmDiff, 12) * 0.65
      if (minuteDiff != null) score += Math.min(minuteDiff, 90) / 35

      // Exakte Sportart ist stärker als verwandte Sportart / HYROX-Laufbaustein.
      if (sport !== day.plannedSport) score += 0.8

      return {
        ...day,
        activitySport:sport,
        dayDelta,
        kmDiff,
        minuteDiff,
        score,
        confidence:confidenceFor(score),
      }
    })
    .filter(Boolean)
    .sort((a,b) =>
      a.score - b.score ||
      Number(b.isPrimary) - Number(a.isPrimary) ||
      a.date - b.date
    )
    .slice(0, limit)
}

export const candidateLabel = candidate => {
  const dayPart =
    candidate.dayDelta === 0
      ? 'genau passend'
      : `${candidate.dayDelta > 0 ? '+' : ''}${candidate.dayDelta} Tag${Math.abs(candidate.dayDelta) === 1 ? '' : 'e'}`

  const kmPart =
    candidate.kmDiff != null && candidate.kmDiff > 0.5
      ? ` · Δ${candidate.kmDiff.toFixed(1)} km`
      : ''

  const planPart = candidate.planName || (candidate.isPrimary ? 'Hauptplan' : 'Trainingsplan')
  return `${planPart} · Wo. ${candidate.weekN} · ${candidate.einheit} (${dayPart}${kmPart})`
}
