const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const roundHalf = value => Math.round(value * 2) / 2

const toNumber = (value, fallback = 0) => {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export const getHikingTargetDistance = form => {
  if (form?.goalType === 'tour') {
    const longestStage = toNumber(form?.longestStageKm)
    const total = toNumber(form?.tourTotalKm)
    const days = Math.max(1, toNumber(form?.tourDays, 1))
    return longestStage || (total ? total / days : 18)
  }

  return toNumber(form?.targetDistanceKm, 20)
}

export const getRecommendedHikingWeeks = form => {
  const target = getHikingTargetDistance(form)
  const longest = toNumber(form?.longestRecentKm)

  if (form?.goalType === 'beginner') return 8

  if (form?.goalType === 'tour') {
    const days = Math.max(1, toNumber(form?.tourDays, 1))
    let weeks = days >= 4 ? 16 : 14

    if (longest > 0 && longest >= target * 0.8) weeks -= 4
    if (longest > 0 && longest < target * 0.35) weeks += 2

    return clamp(weeks, 8, 24)
  }

  let weeks
  if (target <= 20) weeks = 8
  else if (target <= 30) weeks = 10
  else if (target <= 50) weeks = 14
  else if (target <= 75) weeks = 18
  else weeks = 20

  if (longest > 0 && longest >= target * 0.65) weeks = Math.max(8, weeks - 4)
  if (longest > 0 && longest < target * 0.2) weeks += 2

  return clamp(weeks, 8, 24)
}

const getPeakDistance = form => {
  const target = getHikingTargetDistance(form)

  if (form?.goalType === 'beginner') {
    return 12
  }

  if (form?.goalType === 'tour') {
    const longestStage = toNumber(form?.longestStageKm, target)
    // Mehrtagestour: Tagesbelastbarkeit statt künstlicher Maximaldistanz.
    return roundHalf(Math.min(28, Math.max(12, longestStage * 1.05)))
  }

  if (target <= 30) return roundHalf(target * 0.85)
  if (target <= 50) return roundHalf(target * 0.72)
  if (target <= 75) return roundHalf(Math.min(42, target * 0.64))

  // 100-km-/Ultra-Marsch: volle Distanz ausdrücklich NICHT im Training.
  return roundHalf(Math.min(50, Math.max(42, target * 0.48)))
}

const getStartLongDistance = form => {
  const longest = toNumber(form?.longestRecentKm)
  const target = getHikingTargetDistance(form)
  const peak = getPeakDistance(form)

  if (form?.goalType === 'beginner') {
    return longest > 0
      ? roundHalf(clamp(longest * 0.85, 3, 7))
      : 4
  }

  if (!longest) {
    return roundHalf(Math.max(5, Math.min(8, target * 0.25)))
  }

  // Bewusst unter der zuletzt gut vertragenen längeren Strecke starten:
  // Wiederholte Belastung soll Füße, Haut, Sehnen, Gelenke und Muskulatur
  // zunächst stabilisieren statt direkt einen neuen Rekord zu verlangen.
  return roundHalf(clamp(longest * 0.85, 5, peak * 0.82))
}

const getTerrainRule = form => {
  const targetDemanding = ['hilly', 'mountainous', 'mixed'].includes(form?.targetTerrain)
  const trainingTerrain = form?.trainingTerrain || 'flat'
  const tools = Array.isArray(form?.trainingOptions) ? form.trainingOptions : []

  if (!targetDemanding) {
    return {
      mismatch: false,
      rule: 'Keine verpflichtenden Höhenmeter nötig. Normales Gelände ist ausreichend.',
      allowedAlternatives: [],
    }
  }

  if (trainingTerrain === 'climbs' || trainingTerrain === 'mixed') {
    return {
      mismatch: false,
      rule: 'Zielspezifische Anstiege dürfen eingeplant werden, aber ohne starre Höhenmeterpflicht.',
      allowedAlternatives: ['natural_climbs'],
    }
  }

  const allowedAlternatives = []
  if (trainingTerrain === 'hilly') allowedAlternatives.push('local_hills')
  if (tools.includes('occasional_hills')) allowedAlternatives.push('occasional_hills')
  if (tools.includes('stairs')) allowedAlternatives.push('stairs')
  if (tools.includes('treadmill')) allowedAlternatives.push('incline_treadmill')
  if (tools.includes('gym')) allowedAlternatives.push('strength_endurance')

  return {
    mismatch: true,
    rule:
      allowedAlternatives.length > 0
        ? 'Das Ziel ist höhenmeterreicher als die normale Trainingsumgebung. Nutze ausschließlich die ausdrücklich verfügbaren Alternativen; normale flache Einheiten bleiben valide.'
        : 'Das Ziel ist höhenmeterreicher als die Trainingsumgebung. Keine künstlichen Höhenmeter, Treppen, Laufband- oder Studioeinheiten voraussetzen. Baue stattdessen Distanz, Zeit auf den Beinen und allgemeine Belastbarkeit auf.',
    allowedAlternatives,
  }
}

const shouldUseBackToBack = form => {
  const target = getHikingTargetDistance(form)
  const tourDays = toNumber(form?.tourDays)

  return Boolean(
    (form?.goalType === 'tour' && tourDays >= 2) ||
    (['march', 'distance'].includes(form?.goalType) && target >= 50)
  )
}

export const buildHikingPlanGuardrails = form => {
  const recommendedWeeks = getRecommendedHikingWeeks(form)
  const requestedWeeks = clamp(
    toNumber(form?.weeksUntilGoal, recommendedWeeks),
    6,
    24
  )
  const availableWeeks = toNumber(form?.availableWeeks)
  const startLongKm = getStartLongDistance(form)
  const peakLongKm = getPeakDistance(form)
  const terrain = getTerrainRule(form)
  const targetDistanceKm = getHikingTargetDistance(form)

  return {
    version: 1,
    sportType: 'hiking',
    recommendedWeeks,
    requestedWeeks,
    availableWeeks: availableWeeks || null,
    preparationIsShort:
      Boolean(availableWeeks) && availableWeeks < recommendedWeeks,

    targetDistanceKm,
    startLongKm,
    peakLongKm,

    progression: {
      pattern: '3 Belastungs-/Aufbauwochen, danach in der Regel 1 Entlastungswoche',
      recoveryReductionGuideline: 'ca. 20–30 % weniger Gesamtbelastung als die vorherige Aufbauwoche',
      noCatchUpRule:
        'Eine verpasste oder schlecht verträgliche Woche darf niemals durch einen größeren Belastungssprung nachgeholt werden.',
      startRule:
        'Die erste lange Einheit orientiert sich konservativ an der zuletzt gut vertragenen Strecke.',
      peakRule:
        'Die Peak-Distanz ist eine Obergrenze für die längste reguläre Trainingseinheit, kein Pflichtwert.',
    },

    backToBack: {
      appropriate: shouldUseBackToBack(form) && form?.allowAdjacentDays === 'yes',
      usefulForGoal: shouldUseBackToBack(form),
      allowAdjacentDays: form?.allowAdjacentDays === 'yes',
      earliestPlanFraction: 0.55,
      rule:
        form?.allowAdjacentDays === 'yes'
          ? 'Back-to-back-Einheiten erst in der spezifischeren Planhälfte und nur bei guter Verträglichkeit einsetzen. Beide Einheiten müssen an direkt aufeinanderfolgenden Kalendertagen liegen; die zweite bleibt deutlich kürzer und locker.'
          : 'Kein Back-to-back einplanen. Die gewählten Trainingstage bleiben verbindlich; ersetze den Reiz durch eine passende lange Einzelbelastung und gute Erholungsbeobachtung.',
    },

    terrain,

    movement: {
      style: form?.movementStyle || 'walk',
      rule:
        form?.movementStyle === 'runwalk'
          ? 'Gehen bleibt die Basis; gezielte kurze Laufanteile sind möglich, aber nie Pflicht. Lockere und zügige Gehanteile dürfen kombiniert werden.'
          : form?.movementStyle === 'brisk'
            ? 'Sportliches Gehen stärker gewichten: häufiger zügige Einheiten, aber weiterhin ausreichend lockere Einheiten. Keine Laufanteile.'
            : 'Gehen/Wandern als Basis: überwiegend locker, mit gezielten zügigen Abschnitten. Keine Laufanteile.',
    },

    backpack: {
      requiredAtGoal: form?.goalBackpack === 'yes',
      targetKg: toNumber(form?.backpackKg) || null,
      rule:
        form?.goalBackpack === 'yes'
          ? 'Rucksackbelastung konservativ aufbauen. Druckstellen oder Beschwerden haben Vorrang vor Gewicht/Distanz.'
          : 'Kein verpflichtendes Rucksacktraining.',
    },

    safety: {
      mainSignals:
        'Füße/Haut, Blasen/Druckstellen, Gelenke/Muskulatur und Erholung am Folgetag',
      ultraRule:
        targetDistanceKm >= 50
          ? 'Bei langen Märschen nicht verlangen, die volle Zieldistanz vorab im Training zu absolvieren.'
          : null,
      tourRule:
        form?.goalType === 'tour'
          ? 'Bei Mehrtagestouren ist die wiederholte Belastbarkeit an Folgetagen wichtiger als eine einzelne maximale Trainingsdistanz.'
          : null,
    },
  }
}
