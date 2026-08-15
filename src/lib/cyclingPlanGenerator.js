const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const roundQuarter = value => Math.round(value * 4) / 4

const toNumber = (value, fallback = 0) => {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : fallback
}

export const getCyclingTargetDistance = form => {
  if (form?.goalType === 'tour') {
    const longestStage = toNumber(form?.longestStageKm)
    const total = toNumber(form?.tourTotalKm)
    const days = Math.max(1, toNumber(form?.tourDays, 1))
    return longestStage || (total ? total / days : 60)
  }

  return toNumber(form?.targetDistanceKm, 80)
}

export const getRecommendedCyclingWeeks = form => {
  if (form?.goalType === 'beginner') return 8

  const target = getCyclingTargetDistance(form)
  const longestKm = toNumber(form?.longestRecentKm)
  const longestHours = toNumber(form?.longestRecentHours)

  let weeks

  if (form?.goalType === 'tour') {
    const days = Math.max(1, toNumber(form?.tourDays, 1))
    weeks = days >= 4 ? 16 : 14
  } else if (target <= 60) {
    weeks = 8
  } else if (target <= 100) {
    weeks = 12
  } else if (target <= 150) {
    weeks = 14
  } else if (target <= 200) {
    weeks = 16
  } else {
    weeks = 18
  }

  if (
    (longestKm > 0 && longestKm >= target * 0.75) ||
    longestHours >= 4
  ) {
    weeks -= 2
  }

  if (
    (longestKm > 0 && longestKm < target * 0.3) ||
    (longestHours > 0 && longestHours < 1.5)
  ) {
    weeks += 2
  }

  return clamp(weeks, 8, 24)
}

const getPeakLongHours = form => {
  if (form?.goalType === 'beginner') return 2

  const target = getCyclingTargetDistance(form)

  if (form?.goalType === 'tour') {
    const stage = toNumber(form?.longestStageKm, target)
    if (stage <= 60) return 3
    if (stage <= 90) return 4
    if (stage <= 120) return 5
    return 6
  }

  if (target <= 60) return 2.5
  if (target <= 100) return 3.5
  if (target <= 150) return 4.5
  if (target <= 200) return 5.5
  return 6
}

const getStartLongHours = form => {
  const longestHours = toNumber(form?.longestRecentHours)
  const peak = getPeakLongHours(form)

  if (longestHours > 0) {
    return roundQuarter(clamp(longestHours * 0.8, 0.75, peak * 0.8))
  }

  const longestKm = toNumber(form?.longestRecentKm)
  if (longestKm > 0) {
    // Nur grobe interne Einordnung; die Nutzersteuerung bleibt zeitbasiert.
    const estimatedHours = longestKm / (
      form?.bikeType === 'road' ? 24 :
      form?.bikeType === 'gravel' ? 20 : 18
    )
    return roundQuarter(clamp(estimatedHours * 0.8, 0.75, peak * 0.8))
  }

  return form?.level === 'beginner' ? 0.75 : 1.25
}

const getTerrainRule = form => {
  const targetDemanding = ['hilly', 'mountainous', 'mixed'].includes(form?.targetTerrain)
  const trainingTerrain = form?.trainingTerrain || 'flat'
  const indoor = form?.indoorTrainer || 'no'

  if (!targetDemanding) {
    return {
      mismatch: false,
      rule: 'Keine verpflichtenden Anstiege nötig. Flaches oder gemischtes Training ist passend.',
      allowedAlternatives: indoor !== 'no' ? ['indoor_resistance'] : [],
    }
  }

  if (['hilly', 'climbs', 'mixed'].includes(trainingTerrain)) {
    return {
      mismatch: false,
      rule: 'Zielspezifische Anstiege dürfen sinnvoll eingeplant werden, aber ohne starre Höhenmeterpflicht.',
      allowedAlternatives: ['natural_climbs'],
    }
  }

  const allowedAlternatives = []
  if (indoor !== 'no') allowedAlternatives.push('indoor_resistance')

  return {
    mismatch: true,
    rule:
      allowedAlternatives.length
        ? 'Das Ziel ist bergiger als die normale Trainingsumgebung. Nutze vorhandenen Indoor-Widerstand für Kraftausdauer; flache Ausfahrten bleiben vollständig valide.'
        : 'Das Ziel ist bergiger als die Trainingsumgebung. Keine nicht verfügbaren Anstiege erfinden. Baue stattdessen Zeit auf dem Rad, allgemeine Ausdauer und belastbare Trittleistung im vorhandenen Gelände auf.',
    allowedAlternatives,
  }
}

const shouldUseBackToBack = form => {
  const target = getCyclingTargetDistance(form)
  const tourDays = toNumber(form?.tourDays)

  return Boolean(
    (form?.goalType === 'tour' && tourDays >= 2) ||
    (['event', 'distance'].includes(form?.goalType) && target >= 150)
  )
}

export const buildCyclingPlanGuardrails = form => {
  const recommendedWeeks = getRecommendedCyclingWeeks(form)
  const requestedWeeks = clamp(
    toNumber(form?.weeksUntilGoal, recommendedWeeks),
    6,
    24
  )
  const availableWeeks = toNumber(form?.availableWeeks)

  return {
    version: 1,
    sportType: 'cycling',
    recommendedWeeks,
    requestedWeeks,
    availableWeeks: availableWeeks || null,
    preparationIsShort:
      Boolean(availableWeeks) && availableWeeks < recommendedWeeks,

    targetDistanceKm: getCyclingTargetDistance(form),
    startLongHours: getStartLongHours(form),
    peakLongHours: getPeakLongHours(form),

    progression: {
      priority:
        'Training primär über Zeit und Belastung steuern. Kilometer sind bei langen spezifischen Ausfahrten nur Orientierung.',
      pattern:
        'In der Regel 2–3 Aufbauwochen, danach eine Entlastungswoche.',
      recoveryReductionGuideline:
        'Entlastungswoche ungefähr 20–30 % weniger Gesamtzeit als die vorherige Aufbauwoche.',
      noCatchUpRule:
        'Verpasste Einheiten oder Wochen niemals durch abrupte Mehrbelastung nachholen.',
      startRule:
        'Die erste lange Ausfahrt startet konservativ unter der zuletzt gut vertragenen langen Belastung.',
      peakRule:
        'Die längste Trainingsausfahrt muss die volle Zieldistanz nicht erreichen; Zeit und stabile Belastung haben Vorrang.',
    },

    backToBack: {
      usefulForGoal: shouldUseBackToBack(form),
      appropriate:
        shouldUseBackToBack(form) && form?.allowAdjacentDays === 'yes',
      allowAdjacentDays: form?.allowAdjacentDays === 'yes',
      earliestPlanFraction: 0.55,
      rule:
        form?.allowAdjacentDays === 'yes'
          ? 'Back-to-back erst in der spezifischen Planhälfte. Beide Ausfahrten müssen an direkt aufeinanderfolgenden Kalendertagen liegen; der zweite Tag bleibt leichter/kürzer.'
          : 'Kein Back-to-back einplanen. Die ausgewählten Trainingstage bleiben verbindlich.',
    },

    terrain: getTerrainRule(form),

    indoor: {
      availability: form?.indoorTrainer || 'no',
      rule:
        form?.indoorTrainer === 'regular'
          ? 'Indoor-Einheiten dürfen regelmäßig als gezielte strukturierte Einheit genutzt werden.'
          : form?.indoorTrainer === 'sometimes'
            ? 'Indoor-Einheiten gelegentlich nutzen, aber nicht voraussetzen.'
            : 'Keine Indoor-Trainer-Einheiten einplanen.',
    },

    bike: {
      type: form?.bikeType || 'road',
      rule:
        form?.bikeType === 'gravel'
          ? 'Gravel: Untergrund und Fahrwiderstand berücksichtigen; Geschwindigkeit nie als Hauptziel verwenden.'
          : form?.bikeType === 'trekking'
            ? 'Trekking/Tourenrad: alltagstaugliche, ausdauerorientierte Belastung; Geschwindigkeit nie als Hauptziel verwenden.'
            : 'Rennrad: strukturierte Ausdauer- und Qualitätseinheiten möglich; Geschwindigkeit trotzdem nicht als Hauptsteuerung nutzen.',
    },

    strength: {
      available: form?.strengthTraining === 'yes',
      rule:
        form?.strengthTraining === 'yes'
          ? 'Krafttraining darf ergänzend eingeplant werden, konkret mit Übungen, Sätzen und Wiederholungen.'
          : 'Keine Krafttrainingseinheit einplanen.',
    },

    safety: {
      mainSignals:
        'anhaltende Schmerzen, ungewöhnliche Erschöpfung, Sitzbeschwerden, Knie-/Rückenbeschwerden und Erholung am Folgetag',
      longDistanceRule:
        'Bei sehr langen Zielen nicht verlangen, die volle Zieldistanz vorab im Training zu absolvieren.',
      tourRule:
        form?.goalType === 'tour'
          ? 'Bei Mehrtagestouren ist wiederholte Belastbarkeit wichtiger als eine einzelne maximale Ausfahrt.'
          : null,
    },
  }
}
