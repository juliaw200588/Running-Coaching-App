const normalizeSport = value => {
  const raw = String(value || '').toLowerCase()
  if (raw === 'walking') return 'hiking'
  if (raw === 'indoor_cycling' || raw === 'indoor cycling') return 'cycling'
  return raw
}

const SPORT_LABELS = {
  running: { label: 'Laufen', icon: '🏃' },
  cycling: { label: 'Radfahren', icon: '🚴' },
  mountain_biking: { label: 'Mountainbike', icon: '🚵' },
  hiking: { label: 'Wandern', icon: '🥾' },
  swimming: { label: 'Schwimmen', icon: '🏊' },
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

const hasTag = (activities, aliases) =>
  activities.some(activity => {
    const tags = getActivityTags(activity)
    return aliases.some(alias =>
      tags.some(tag => tag.includes(alias))
    )
  })

const hasAnyTagData = activities =>
  activities.some(activity => getActivityTags(activity).length > 0)

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

export const COLLECTION_DEFINITIONS = [
  {
    id: 'tageszeiten',
    title: 'Tageszeiten',
    icon: '🌅',
    description: 'Von frühen Starts bis zu späten Einheiten.',
    completeText: 'Du hast Bewegung zu ganz unterschiedlichen Tageszeiten erlebt.',
    items: [
      achievementItem('moment_early_bird', 'Früh unterwegs', '🌅'),
      achievementItem('moment_morning_routine_5', 'Morgenroutine', '☀️'),
      achievementItem('moment_evening_routine_10', 'Feierabendroutine', '🌇'),
      achievementItem('moment_night_owl', 'Nachts unterwegs', '🌙'),
    ],
  },
  {
    id: 'entdecker',
    title: 'Entdecker',
    icon: '🧭',
    description: 'Dein sportlicher Weg kennt mehr als nur eine Richtung.',
    completeText: 'Du bist in allen verfügbaren Sportwelten unterwegs gewesen.',
    items: [
      firstSportItem('running', 'Laufen entdeckt', '🏃'),
      firstSportItem('cycling', 'Radfahren entdeckt', '🚴'),
      firstSportItem('mountain_biking', 'MTB entdeckt', '🚵'),
      firstSportItem('hiking', 'Wandern entdeckt', '🥾'),
      firstSportItem('swimming', 'Schwimmen entdeckt', '🏊'),
      achievementItem('moment_multisport_month_3', 'Vielseitiger Monat', '✨'),
    ],
  },
  {
    id: 'dranbleiben',
    title: 'Dranbleiben',
    icon: '🔥',
    description: 'Nicht ein einzelner Tag zählt, sondern dass du wiederkommst.',
    completeText: 'Beständigkeit ist längst ein Teil deines sportlichen Weges.',
    items: [
      achievementItem('all_active_day_streak_7', '7 Tage aktiv', '🔥'),
      achievementItem('all_active_day_streak_14', '14 Tage aktiv', '🔥'),
      achievementItem('all_active_week_streak_5', '5 aktive Wochen', '📅'),
      achievementItem('all_active_week_streak_10', '10 aktive Wochen', '📅'),
    ],
  },
  {
    id: 'weite',
    title: 'Weite',
    icon: '🗺️',
    description: 'Viele einzelne Strecken ergeben irgendwann eine große Reise.',
    completeText: 'Dein sportlicher Weg reicht inzwischen sehr weit.',
    items: [
      achievementItem('all_total_distance_500', '500 km', '🗺️'),
      achievementItem('all_total_distance_1000', '1.000 km', '🗺️'),
      achievementItem('all_total_distance_2500', '2.500 km', '🗺️'),
      achievementItem('all_total_distance_5000', '5.000 km', '🗺️'),
      achievementItem('all_total_distance_10000', '10.000 km', '🗺️'),
    ],
  },
  {
    id: 'hoehe',
    title: 'Höhenjäger',
    icon: '⛰️',
    description: 'Jeder Anstieg zählt.',
    completeText: 'Aus vielen Anstiegen ist ein ganzes Gebirge geworden.',
    items: [
      achievementItem('all_total_elevation_5000', '5.000 hm', '⛰️'),
      achievementItem('all_total_elevation_10000', '10.000 hm', '⛰️'),
      achievementItem('all_total_elevation_25000', '25.000 hm', '🏔️'),
      achievementItem('all_total_elevation_50000', '50.000 hm', '🏔️'),
      achievementItem('all_total_elevation_100000', '100.000 hm', '🏔️'),
    ],
  },
  {
    id: 'besondere_tage',
    title: 'Besondere Tage',
    icon: '✨',
    description: 'Manche Aktivitäten bleiben wegen ihres Moments in Erinnerung.',
    completeText: 'Du hast Bewegung mit ganz besonderen Tagen verbunden.',
    items: [
      achievementItem('moment_weekend_start', 'Wochenende', '🗓️'),
      achievementItem('moment_sunday_7', 'Sonntagsritual', '☕'),
      achievementItem('moment_new_year', 'Neujahr', '🎆'),
      achievementItem('moment_christmas', 'Weihnachten', '🎄'),
      achievementItem('moment_new_year_eve', 'Jahresausklang', '✨'),
      achievementItem('moment_four_seasons', 'Vier Jahreszeiten', '🍂'),
    ],
  },
  {
    id: 'natur',
    title: 'Natur',
    icon: '🌿',
    description: 'Orte und Landschaften, die deine Aktivitäten besonders machen.',
    completeText: 'Dein Weg führt durch ganz unterschiedliche Landschaften.',
    dataDependent: true,
    items: [
      tagItem('forest', 'Wald', '🌲', ['wald', 'forest']),
      tagItem('coast', 'Küste', '🌊', ['küste', 'coast', 'coastal']),
      tagItem('mountain', 'Berge', '🏔️', ['berg', 'mountain', 'alpine']),
      tagItem('field', 'Feld & Wiese', '🌾', ['feld', 'field', 'wiese', 'meadow']),
      tagItem('beach', 'Strand', '🏖️', ['strand', 'beach', 'sand']),
    ],
  },
  {
    id: 'wetter',
    title: 'Wetter',
    icon: '🌦️',
    description: 'Bewegung fühlt sich bei jedem Wetter anders an.',
    completeText: 'Sonne, Regen, Schnee – du warst bei allem unterwegs.',
    dataDependent: true,
    items: [
      tagItem('sun', 'Sonne', '☀️', ['sonne', 'sun', 'sunny', 'clear']),
      tagItem('rain', 'Regen', '🌧️', ['regen', 'rain', 'rainy']),
      tagItem('snow', 'Schnee', '❄️', ['schnee', 'snow', 'snowy']),
      tagItem('fog', 'Nebel', '🌫️', ['nebel', 'fog', 'foggy', 'mist']),
      tagItem('wind', 'Wind', '💨', ['wind', 'windy', 'sturm', 'storm']),
    ],
  },
]

const evaluateItem = (item, achievementMap, activities) => {
  if (item.type === 'achievement') {
    const achievement = achievementMap.get(item.id)
    return {
      ...item,
      unlocked: Boolean(achievement?.unlocked),
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
      unlockedAt: first?.actual_date || first?.date || null,
      sportMeta: SPORT_LABELS[item.sport],
    }
  }

  if (item.type === 'tag') {
    const unlocked = hasTag(activities, item.aliases)
    return {
      ...item,
      unlocked,
      unlockedAt: null,
    }
  }

  return {
    ...item,
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

  return COLLECTION_DEFINITIONS
    .filter(definition =>
      !definition.dataDependent || hasAnyTagData(activities)
    )
    .map(definition => {
      const items = definition.items.map(item =>
        evaluateItem(item, achievementMap, activities)
      )

      const unlockedCount = items.filter(item => item.unlocked).length
      const totalCount = items.length
      const percent =
        totalCount > 0
          ? Math.round((unlockedCount / totalCount) * 100)
          : 0

      return {
        ...definition,
        items,
        unlockedCount,
        totalCount,
        percent,
        complete: totalCount > 0 && unlockedCount === totalCount,
      }
    })
}

export const getCollectionSummary = collections => {
  const total = collections.length
  const complete = collections.filter(collection => collection.complete).length

  return {
    total,
    complete,
    percent:
      total > 0
        ? Math.round((complete / total) * 100)
        : 0,
  }
}
