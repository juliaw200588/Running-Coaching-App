const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const roundQuarter = value => Math.round(value * 4) / 4

const toNumber = (value, fallback = 0) => {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export const getMtbTargetDistance = form => {
  if (form?.goalType === 'tour') {
    const longestStage = toNumber(form?.longestStageKm)
    const total = toNumber(form?.tourTotalKm)
    const days = Math.max(1, toNumber(form?.tourDays, 1))
    return longestStage || (total ? total / days : 45)
  }
  return toNumber(form?.targetDistanceKm, 50)
}

export const getRecommendedMtbWeeks = form => {
  if (form?.goalType === 'fitness') return form?.level === 'beginner' ? 10 : 8

  const target = getMtbTargetDistance(form)
  const targetHm = toNumber(form?.targetElevationM)
  const longestHours = toNumber(form?.longestRecentHours)
  const longestKm = toNumber(form?.longestRecentKm)

  let weeks
  if (form?.goalType === 'tour') {
    const days = Math.max(1, toNumber(form?.tourDays, 1))
    weeks = days >= 4 ? 16 : 14
  } else if (target <= 35) {
    weeks = 8
  } else if (target <= 60) {
    weeks = 12
  } else if (target <= 90) {
    weeks = 14
  } else {
    weeks = 16
  }

  if (targetHm >= 1500) weeks += 2
  if (targetHm >= 2500) weeks += 1

  if (
    longestHours >= 3.5 ||
    (longestKm > 0 && longestKm >= target * 0.7)
  ) weeks -= 2

  if (
    form?.level === 'beginner' ||
    (longestHours > 0 && longestHours < 1.25)
  ) weeks += 2

  return clamp(weeks, 8, 24)
}

const getPeakLongHours = form => {
  if (form?.goalType === 'fitness') return form?.level === 'beginner' ? 2 : 2.5

  const target = getMtbTargetDistance(form)
  const hm = toNumber(form?.targetElevationM)

  let hours =
    target <= 35 ? 2.25 :
    target <= 60 ? 3.5 :
    target <= 90 ? 4.5 : 5.5

  if (hm >= 1500) hours += 0.5
  if (form?.goalType === 'tour') hours += 0.5

  return clamp(roundQuarter(hours), 2, 6)
}

const getStartLongHours = form => {
  const longestHours = toNumber(form?.longestRecentHours)
  const peak = getPeakLongHours(form)

  if (longestHours > 0) {
    return roundQuarter(clamp(longestHours * 0.8, 0.75, peak * 0.8))
  }

  return form?.level === 'beginner' ? 0.75 : 1.25
}

const terrainRules = form => {
  const target = form?.targetTerrain || 'mixed'
  const training = form?.trainingTerrain || 'flat'
  const targetHm = toNumber(form?.targetElevationM)
  const currentHm = toNumber(form?.typicalElevationM)
  const needsClimbing =
    ['hilly','mountainous','alpine'].includes(target) || targetHm >= 800

  const hasClimbing =
    ['hilly','climbs','mountainous'].includes(training) ||
    currentHm >= 500

  return {
    mismatch: needsClimbing && !hasClimbing,
    targetElevationM: targetHm || null,
    typicalElevationM: currentHm || null,
    rule:
      needsClimbing && !hasClimbing
        ? 'Das Ziel ist höhenmeterreicher als die normale Trainingsumgebung. Keine nicht vorhandenen Berge erfinden. Nutze vorhandene kurze Anstiege wiederholt oder Indoor-Widerstand nur wenn verfügbar; ansonsten Ausdauer, Kraftausdauer und lange Sitzzeit im vorhandenen Gelände entwickeln.'
        : 'Vorhandene Anstiege dürfen zielspezifisch genutzt werden. Höhenmeter sind Belastungskontext, keine starre Wochenpflicht.',
  }
}

const trailRules = form => {
  const access = form?.trailAccess || 'none'
  const level = form?.technicalLevel || 'beginner'

  return {
    access,
    technicalLevel: level,
    rule:
      access === 'none'
        ? 'Keine Trailabschnitte voraussetzen. Technik auf breiten, übersichtlichen und sicheren Flächen üben.'
        : access === 'easy'
          ? 'Technik darf auf einfachen, bekannten Trails geübt werden. Keine anspruchsvollen Features voraussetzen.'
          : 'Technik darf auf passenden bekannten Trails stattfinden, muss aber dem angegebenen Technikniveau entsprechen.',
  }
}

export const buildMtbPlanGuardrails = form => {
  const recommendedWeeks = getRecommendedMtbWeeks(form)
  const requestedWeeks = clamp(
    toNumber(form?.weeksUntilGoal, recommendedWeeks),
    6,
    24
  )
  const availableWeeks = toNumber(form?.availableWeeks)

  return {
    version: 1,
    sportType: 'mountain_biking',
    recommendedWeeks,
    requestedWeeks,
    availableWeeks: availableWeeks || null,
    preparationIsShort: Boolean(availableWeeks) && availableWeeks < recommendedWeeks,

    targetDistanceKm: getMtbTargetDistance(form),
    targetElevationM: toNumber(form?.targetElevationM) || null,
    startLongHours: getStartLongHours(form),
    peakLongHours: getPeakLongHours(form),

    progression: {
      priority: 'MTB primär über Zeit und Belastung steuern. Kilometer und Höhenmeter sind bei langen/zielspezifischen Ausfahrten Orientierung.',
      pattern: 'In der Regel 2–3 Aufbauwochen, danach eine Entlastungswoche.',
      recoveryReductionGuideline: 'Entlastungswoche ungefähr 20–30 % weniger Gesamtzeit als die vorherige Aufbauwoche.',
      noCatchUpRule: 'Verpasste Einheiten nicht durch abrupte Mehrbelastung nachholen.',
      startRule: 'Die erste lange Ausfahrt startet konservativ unter der zuletzt gut vertragenen langen Belastung.',
    },

    technique: {
      preference: form?.techniquePreference || 'sometimes',
      level: form?.technicalLevel || 'beginner',
      trailAccess: form?.trailAccess || 'none',
      dedicatedAllowed: form?.techniquePreference !== 'no',
      frequency:
        form?.techniquePreference === 'regular'
          ? 'regelmäßig'
          : form?.techniquePreference === 'sometimes'
            ? 'gelegentlich'
            : 'keine eigenen Technikblöcke',
      rule:
        form?.techniquePreference === 'no'
          ? 'Keine eigene Technik-Trainingseinheit und keinen verpflichtenden Technikblock erzeugen. Sicherheitsrelevante Hinweise sind erlaubt.'
          : 'Technikblöcke immer konkret Schritt für Schritt erklären: sichere Übungsfläche, Wiederholungen/Dauer, Fokus, Ziel und klare Progressionsgrenze. Keine bloße Überschrift wie "Kurventechnik".',
    },

    terrain: terrainRules(form),
    trails: trailRules(form),

    indoor: {
      availability: form?.indoorTrainer || 'no',
      rule:
        form?.indoorTrainer === 'regular'
          ? 'Indoor darf für Ausdauer/Kraftausdauer regelmäßig genutzt werden, aber nie als Ersatz für Fahrtechnik.'
          : form?.indoorTrainer === 'sometimes'
            ? 'Indoor gelegentlich für Ausdauer/Kraftausdauer nutzen.'
            : 'Keine Indoor-Einheiten einplanen.',
    },

    strength: {
      available: form?.strengthTraining === 'yes',
      rule:
        form?.strengthTraining === 'yes'
          ? 'Krafttraining darf ergänzend konkret mit Übungen, Sätzen und Wiederholungen eingeplant werden.'
          : 'Keine Krafttrainingseinheit einplanen.',
    },

    backToBack: {
      usefulForGoal:
        form?.goalType === 'tour' && toNumber(form?.tourDays) >= 2,
      appropriate:
        form?.goalType === 'tour' &&
        toNumber(form?.tourDays) >= 2 &&
        form?.allowAdjacentDays === 'yes',
      rule:
        form?.allowAdjacentDays === 'yes'
          ? 'Back-to-back nur spät im Plan und nur bei Mehrtagestour-Ziel; zweiter Tag leichter/kürzer.'
          : 'Kein Back-to-back einplanen.',
    },

    safety: {
      rule: 'Technik niemals über Geschwindigkeit erzwingen. Keine Sprünge, Drops, steile technische Abfahrten oder riskanten Features als Pflichtaufgabe. Schwierigkeit nur erhöhen, wenn die vorherige Stufe sicher und kontrolliert gelingt.',
      signals: 'anhaltende Schmerzen, ungewöhnliche Erschöpfung, Kontrollverlust, wiederholte Fahrfehler unter Ermüdung und schlechte Erholung am Folgetag',
    },
  }
}
