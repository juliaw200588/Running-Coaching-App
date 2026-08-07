const normalizeSport = value => {
  const raw = String(value || '').toLowerCase()

  if (raw === 'walking') return 'hiking'
  if (raw === 'indoor_cycling' || raw === 'indoor cycling') return 'cycling'

  return raw
}

const getActivityTags = activity => {
  const values = [
    activity?.environment_tags,
    activity?.location_tags,
    activity?.route_tags,
    activity?.weather_tags,
    activity?.tags,
    activity?.weather_condition,
    activity?.surface,
    activity?.environment,
    activity?.location_type,
  ]

  return values
    .flatMap(value => {
      if (Array.isArray(value)) return value
      if (!value) return []

      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          if (Array.isArray(parsed)) return parsed
        } catch {
          // normale Zeichenkette
        }

        return value.split(/[;,|]/g)
      }

      return []
    })
    .map(value => String(value).trim().toLowerCase())
    .filter(Boolean)
}

const hasAnyTagData = activities =>
  activities.some(activity => getActivityTags(activity).length > 0)

const hasTag = (activities, aliases) =>
  activities.some(activity => {
    const tags = getActivityTags(activity)

    return aliases.some(alias =>
      tags.some(tag => tag.includes(alias))
    )
  })

const achievementItem = (id, label, icon) => ({
  type: 'achievement',
  id,
  label,
  icon,
})

const firstSportItem = (sport, label, icon) => ({
  type: 'first_sport',
  sport,
  label,
  icon,
})

const tagItem = (key, label, icon, aliases) => ({
  type: 'tag',
  key,
  label,
  icon,
  aliases,
})

const fixedItem = (key, label, icon, unlocked = false) => ({
  type: 'fixed',
  key,
  label,
  icon,
  unlocked,
})

export const COLLECTION_DEFINITIONS = [
  {
    id: 'natur',
    title: 'Natur',
    icon: '🌲',
    description: 'Die schönsten Orte, an denen dich dein Weg geführt hat.',
    completeTitle: 'Naturforscher',
    completeIcon: '🏆',
    completeText: 'Wald, Küste, Berge und mehr – du hast viele Landschaften entdeckt.',
    dataDependent: true,
    items: [
      tagItem('forest', 'Wald', '🌲', ['wald', 'forest']),
      tagItem('coast', 'Küste', '🌊', ['küste', 'coast', 'coastal']),
      tagItem('mountain', 'Berge', '🏔️', ['berg', 'mountain', 'alpine']),
      tagItem('field', 'Feld & Wiese', '🌾', ['feld', 'field', 'wiese', 'meadow']),
      tagItem('beach', 'Strand', '🏖️', ['strand', 'beach', 'sand']),
      tagItem('sunrise', 'Sonnenaufgang', '🌅', ['sunrise', 'sonnenaufgang']),
      tagItem('sunset', 'Sonnenuntergang', '🌄', ['sunset', 'sonnenuntergang']),
    ],
  },

  {
    id: 'wetter',
    title: 'Wetter',
    icon: '🌦️',
    description: 'Du warst bei ganz unterschiedlichen Bedingungen unterwegs.',
    completeTitle: 'Wetterfest',
    completeIcon: '🏆',
    completeText: 'Sonne, Regen, Schnee und mehr – das Wetter hält dich nicht auf.',
    dataDependent: true,
    items: [
      tagItem('sun', 'Sonne', '☀️', ['sonne', 'sun', 'sunny', 'clear']),
      tagItem('clouds', 'Bewölkt', '☁️', ['cloud', 'cloudy', 'bewölkt']),
      tagItem('rain', 'Regen', '🌧️', ['regen', 'rain', 'rainy']),
      tagItem('snow', 'Schnee', '❄️', ['schnee', 'snow', 'snowy']),
      tagItem('fog', 'Nebel', '🌫️', ['nebel', 'fog', 'foggy', 'mist']),
      tagItem('wind', 'Wind', '💨', ['wind', 'windy', 'sturm', 'storm']),
    ],
  },

  {
    id: 'entdecker',
    title: 'Entdecker',
    icon: '🌍',
    description: 'Neue Sportarten erweitern deinen Horizont.',
    completeTitle: 'Allrounder',
    completeIcon: '🏆',
    completeText: 'Du bist in allen aktuell unterstützten Sportwelten unterwegs gewesen.',
    items: [
      firstSportItem('running', 'Laufen', '🏃'),
      firstSportItem('cycling', 'Radfahren', '🚴'),
      firstSportItem('mountain_biking', 'Mountainbike', '🚵'),
      firstSportItem('hiking', 'Wandern', '🥾'),
      firstSportItem('swimming', 'Schwimmen', '🏊'),
      achievementItem('moment_multisport_month_3', 'Vielseitiger Monat', '✨'),
    ],
  },

  {
    id: 'tageszeiten',
    title: 'Tageszeiten',
    icon: '🌅',
    description: 'Jede Tageszeit hat ihren eigenen Charakter.',
    completeTitle: 'Rund um die Uhr',
    completeIcon: '🏆',
    completeText: 'Früh, spät und dazwischen – Bewegung kennt für dich keine feste Uhrzeit.',
    items: [
      achievementItem('moment_early_bird', 'Frühaufsteher', '🌅'),
      achievementItem('moment_morning_routine_5', 'Morgenroutine', '☀️'),
      achievementItem('moment_evening_routine_10', 'Feierabendroutine', '🌇'),
      achievementItem('moment_night_owl', 'Nachteule', '🌙'),
    ],
  },

  {
    id: 'besondere_tage',
    title: 'Besondere Tage',
    icon: '🎉',
    description: 'Manche Tage bekommen durch Bewegung ihre eigene Erinnerung.',
    completeTitle: 'Unvergessliche Momente',
    completeIcon: '🏆',
    completeText: 'Du hast aus besonderen Tagen auch sportliche Erinnerungen gemacht.',
    items: [
      achievementItem('moment_new_year', 'Neujahr', '🎆'),
      achievementItem('moment_christmas', 'Weihnachten', '🎄'),
      achievementItem('moment_new_year_eve', 'Silvester', '🎉'),
      achievementItem('moment_four_seasons', 'Vier Jahreszeiten', '🍂'),
      achievementItem('moment_weekend_start', 'Wochenende', '🗓️'),
      fixedItem('holiday', 'Urlaub', '🏖️', false),
    ],
  },

  {
    id: 'lifestyle',
    title: 'Lifestyle',
    icon: '❤️',
    description: 'Bewegung wird Teil deines Alltags.',
    completeTitle: 'Bewegung ist dein Alltag',
    completeIcon: '🏆',
    completeText: 'Aus einzelnen Aktivitäten ist ein fester Bestandteil deines Lebens geworden.',
    items: [
      achievementItem('all_active_day_streak_7', '7-Tage-Serie', '🔥'),
      achievementItem('all_active_week_streak_10', '10 aktive Wochen', '📅'),
      achievementItem('moment_sunday_7', 'Sonntagsritual', '☕'),
      achievementItem('moment_early_bird', 'Frühaufsteher', '🌅'),
      achievementItem('moment_night_owl', 'Nachteule', '🌙'),
      achievementItem('moment_weekend_streak_3', 'Wochenendserie', '⭐'),
    ],
  },
]

const evaluateItem = (
  item,
  achievementMap,
  activities,
  tagDataAvailable
) => {
  if (item.type === 'achievement') {
    const achievement = achievementMap.get(item.id)

    return {
      ...item,
      unlocked: Boolean(achievement?.unlocked),
      available: true,
      unlockedAt: achievement?.unlockedAt || null,
    }
  }

  if (item.type === 'first_sport') {
    const matches = activities
      .filter(activity =>
        normalizeSport(activity?.sport_type) === item.sport
      )
      .filter(activity => activity?.actual_date || activity?.date)
      .sort((a, b) =>
        String(a.actual_date || a.date).localeCompare(
          String(b.actual_date || b.date)
        )
      )

    const first = matches[0] || null

    return {
      ...item,
      unlocked: Boolean(first),
      available: true,
      unlockedAt: first?.actual_date || first?.date || null,
    }
  }

  if (item.type === 'tag') {
    return {
      ...item,
      unlocked:
        tagDataAvailable && hasTag(activities, item.aliases),
      available: tagDataAvailable,
      unlockedAt: null,
    }
  }

  if (item.type === 'fixed') {
    return {
      ...item,
      available: false,
      unlocked: Boolean(item.unlocked),
      unlockedAt: null,
    }
  }

  return {
    ...item,
    available: true,
    unlocked: false,
    unlockedAt: null,
  }
}

export const buildCollections = ({
  achievements = [],
  activities = [],
}) => {
  const achievementMap = new Map(
    achievements.map(achievement => [
      achievement.id,
      achievement,
    ])
  )

  const tagDataAvailable = hasAnyTagData(activities)

  return COLLECTION_DEFINITIONS.map(definition => {
    const items = definition.items.map(item =>
      evaluateItem(
        item,
        achievementMap,
        activities,
        tagDataAvailable
      )
    )

    const availableItems = items.filter(item => item.available)
    const unlockedCount = items.filter(item => item.unlocked).length
    const availableUnlockedCount =
      availableItems.filter(item => item.unlocked).length

    const totalCount = items.length
    const availableCount = availableItems.length

    const percent =
      availableCount > 0
        ? Math.round(
            (availableUnlockedCount / availableCount) * 100
          )
        : 0

    const complete =
      availableCount === totalCount &&
      totalCount > 0 &&
      unlockedCount === totalCount

    return {
      ...definition,
      items,
      unlockedCount,
      totalCount,
      availableCount,
      unavailableCount: totalCount - availableCount,
      percent,
      complete,
      waitingForData:
        Boolean(definition.dataDependent) &&
        availableCount === 0,
    }
  })
}

export const getCollectionSummary = collections => ({
  total: collections.length,
  complete: collections.filter(collection => collection.complete).length,
})
