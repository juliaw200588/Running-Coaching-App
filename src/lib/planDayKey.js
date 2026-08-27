// Plan-sichere Schlüssel für Trainingsplan-Tage.
// Hintergrund: der frühere Schlüssel `${phase}_w${week}_d${index}` war nur innerhalb
// eines einzelnen Plans eindeutig. Bei parallelen Plänen konnten dadurch Logs,
// Done-Status und Skip-Status versehentlich in einem anderen Plan auftauchen.

export const legacyPlanDayKey = (phaseId, weekN, dayIdx) =>
  `${phaseId}_w${weekN}_d${dayIdx}`

export const planDayKeyFromLegacy = (planId, legacyKey) =>
  planId ? `plan:${planId}:${legacyKey}` : legacyKey

export const planDayKey = (planId, phaseId, weekN, dayIdx) =>
  planDayKeyFromLegacy(planId, legacyPlanDayKey(phaseId, weekN, dayIdx))

export const planDayKeyCandidates = (
  planId,
  phaseId,
  weekN,
  dayIdx,
  allowLegacy = false
) => {
  const legacyKey = legacyPlanDayKey(phaseId, weekN, dayIdx)
  const scopedKey = planDayKeyFromLegacy(planId, legacyKey)

  if (!allowLegacy || !planId || scopedKey === legacyKey) {
    return [scopedKey]
  }

  return [scopedKey, legacyKey]
}

export const valueForPlanDay = (
  map,
  {
    planId,
    phaseId,
    weekN,
    dayIdx,
    allowLegacy = false,
  }
) => {
  if (!map) return undefined

  for (const key of planDayKeyCandidates(
    planId,
    phaseId,
    weekN,
    dayIdx,
    allowLegacy
  )) {
    if (map[key] !== undefined) return map[key]
  }

  return undefined
}

export const legacyKeyFromScoped = key => {
  const match = String(key || '').match(/^plan:[^:]+:(.+)$/)
  return match ? match[1] : String(key || '')
}

export const belongsToPlan = (key, planId) => {
  if (!planId) return !String(key || '').startsWith('plan:')
  return String(key || '').startsWith(`plan:${planId}:`)
}

// Nur für die Abwärtskompatibilität des bisherigen HAUPTPLANS:
// Bestehende Legacy-Daten werden in der Oberfläche zusätzlich unter ihrem neuen
// planbezogenen Schlüssel gespiegelt. Es wird dabei NICHTS in der DB dupliziert.
// Bei Zusatz-/gemeinsamen Plänen sollte allowLegacy=false bleiben.
export const addLegacyAliasesForPlan = (
  source,
  plan,
  planId,
  allowLegacy = false,
  transform = value => value
) => {
  const next = { ...(source || {}) }
  if (!allowLegacy || !planId || !plan) return next

  for (const phase of plan?.phases || []) {
    for (const week of phase?.weeks || []) {
      for (let dayIdx = 0; dayIdx < (week?.days || []).length; dayIdx += 1) {
        const legacyKey = legacyPlanDayKey(phase.id, week.n, dayIdx)
        const scopedKey = planDayKey(planId, phase.id, week.n, dayIdx)

        if (
          next[scopedKey] === undefined &&
          next[legacyKey] !== undefined
        ) {
          next[scopedKey] = transform(
            next[legacyKey],
            legacyKey,
            scopedKey
          )
        }
      }
    }
  }

  return next
}
