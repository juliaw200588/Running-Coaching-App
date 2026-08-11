export const TRAINING_EFFORT_OPTIONS = [
  { value: 'light', emoji: '😌', label: 'Leicht' },
  { value: 'fitting', emoji: '🙂', label: 'Passend' },
  { value: 'demanding', emoji: '😮‍💨', label: 'Fordernd' },
  { value: 'very_hard', emoji: '🥵', label: 'Sehr hart' },
]

export const TRAINING_RECOVERY_OPTIONS = [
  { value: 'fresh', emoji: '💚', label: 'Frisch' },
  { value: 'normal', emoji: '🙂', label: 'Normal' },
  { value: 'tired', emoji: '😴', label: 'Müde' },
  { value: 'exhausted', emoji: '🪫', label: 'Erschöpft' },
]

const effortLabels = Object.fromEntries(TRAINING_EFFORT_OPTIONS.map(item => [item.value, item.label]))
const recoveryLabels = Object.fromEntries(TRAINING_RECOVERY_OPTIONS.map(item => [item.value, item.label]))

export const parseTrainingFeedback = value => {
  if (!value) return { effort: null, recovery: null, previousFeeling: null }

  if (typeof value === 'object') {
    return {
      effort: value.effort || null,
      recovery: value.recovery || null,
      previousFeeling: value.previousFeeling ?? value.polarFeeling ?? null,
    }
  }

  const text = String(value).trim()
  if (!text) return { effort: null, recovery: null, previousFeeling: null }

  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && (parsed.effort || parsed.recovery || parsed.v === 1)) {
      return {
        effort: parsed.effort || null,
        recovery: parsed.recovery || null,
        previousFeeling: parsed.previousFeeling ?? parsed.polarFeeling ?? null,
      }
    }
  } catch {}

  return { effort: null, recovery: null, previousFeeling: text }
}

export const encodeTrainingFeedback = ({ effort, recovery }, previousValue = null) => {
  const previous = parseTrainingFeedback(previousValue)
  const previousFeeling = previous.previousFeeling ?? (
    previous.effort || previous.recovery ? null : (previousValue ? String(previousValue) : null)
  )

  return JSON.stringify({
    v: 1,
    effort: effort || null,
    recovery: recovery || null,
    previousFeeling,
  })
}

export const hasStructuredTrainingFeedback = value => {
  const feedback = parseTrainingFeedback(value)
  return Boolean(feedback.effort && feedback.recovery)
}

export const trainingFeedbackText = value => {
  const feedback = parseTrainingFeedback(value)
  const parts = []

  if (feedback.effort) parts.push(`Belastung: ${effortLabels[feedback.effort]?.toLowerCase() || feedback.effort}`)
  if (feedback.recovery) parts.push(`danach: ${recoveryLabels[feedback.recovery]?.toLowerCase() || feedback.recovery}`)

  if (parts.length) return parts.join(' · ')
  return feedback.previousFeeling ? String(feedback.previousFeeling) : null
}

export const trainingFeedbackSummary = value => {
  const feedback = parseTrainingFeedback(value)
  if (!feedback.effort && !feedback.recovery) return null

  const effort = TRAINING_EFFORT_OPTIONS.find(item => item.value === feedback.effort)
  const recovery = TRAINING_RECOVERY_OPTIONS.find(item => item.value === feedback.recovery)

  return [
    effort ? `${effort.emoji} ${effort.label}` : null,
    recovery ? `${recovery.emoji} ${recovery.label}` : null,
  ].filter(Boolean).join(' · ')
}
