import { parseTrainingFeedback } from './trainingFeedback.js'

const localDate = value => {
  if (!value) return null
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const daysBetween = (a, b) => {
  const da = localDate(a)
  const db = localDate(b)
  if (!da || !db) return null
  return Math.round((db - da) / 86400000)
}

const feedbackLevel = value => {
  const { effort, recovery } = parseTrainingFeedback(value)
  if (effort === 'very_hard' || recovery === 'exhausted') return 'high'
  if (effort === 'demanding' || recovery === 'tired') return 'medium'
  if (effort || recovery) return 'low'
  return null
}

export const getDailyCoaching = ({ context, weekData, logs = [], todayStr, hero }) => {
  if (!context?.week || !weekData || !todayStr) return null

  const todayPlan = weekData.planned.find(day => day.scheduleIndex === context.dayIndex) || null
  const recentFeedback = logs
    .filter(log => log?.day_key && log?.actual_date && log?.gefuehl)
    .map(log => ({ ...log, feedbackLevel: feedbackLevel(log.gefuehl), daysAgo: daysBetween(log.actual_date, todayStr) }))
    .filter(log => log.feedbackLevel && log.daysAgo != null && log.daysAgo >= 0 && log.daysAgo <= 3)
    .sort((a, b) => a.daysAgo - b.daysAgo)

  const latestSignal = recentFeedback[0] || null

  if (hero?.type === 'trained') {
    const currentLevel = feedbackLevel(hero.log?.gefuehl)
    if (currentLevel === 'high') {
      return {
        tone: 'attention',
        icon: '🌿',
        title: 'Für heute reicht das.',
        text: 'Die Einheit war sehr fordernd. Gib der Erholung jetzt bewusst Raum.',
      }
    }
    return {
      tone: 'good',
      icon: '✓',
      title: 'Training erledigt.',
      text: 'Deine Planeinheit ist geschafft. Für heute musst du nichts mehr nachholen.',
    }
  }

  if (!todayPlan) {
    if (latestSignal?.feedbackLevel === 'high' || latestSignal?.feedbackLevel === 'medium') {
      return {
        tone: 'rest',
        icon: '🌿',
        title: 'Heute darf Erholung wirken.',
        text: 'Die letzte Planeinheit war fordernd – der Ruhetag passt heute besonders gut.',
      }
    }
    return {
      tone: 'rest',
      icon: '🌿',
      title: 'Heute ist Erholung Teil des Plans.',
      text: 'Nutze den Ruhetag, damit du frisch in die nächste Einheit gehst.',
    }
  }

  if (latestSignal?.feedbackLevel === 'high') {
    return {
      tone: 'attention',
      icon: '🟠',
      title: 'Heute bewusst starten.',
      text: 'Die letzte Planeinheit war sehr fordernd. Starte kontrolliert und orientiere dich am Körpergefühl.',
    }
  }

  if (latestSignal?.feedbackLevel === 'medium') {
    return {
      tone: 'attention',
      icon: '🟠',
      title: 'Erholung etwas im Blick behalten.',
      text: 'Die letzte Einheit war fordernd. Bleib heute bewusst im geplanten Bereich.',
    }
  }

  return {
    tone: 'good',
    icon: '🟢',
    title: 'Alles im grünen Bereich.',
    text: 'Geh wie geplant in deine heutige Einheit und bleib bei den vorgesehenen Vorgaben.',
  }
}
