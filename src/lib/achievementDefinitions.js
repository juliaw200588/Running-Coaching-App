export const ACHIEVEMENT_CATEGORIES = {
  milestones: { id: 'milestones', label: 'Meilensteine', icon: '⭐' },
  performance: { id: 'performance', label: 'Bestleistungen', icon: '🏅' },
  consistency: { id: 'consistency', label: 'Kontinuität', icon: '🔥' },
  development: { id: 'development', label: 'Entwicklung', icon: '📈' },
  moments: { id: 'moments', label: 'Besondere Momente', icon: '🌟' },
}

export const SPORT_META = {
  all: { label: 'Allgemein', icon: '✨' },
  running: { label: 'Laufen', icon: '🏃' },
  cycling: { label: 'Radfahren', icon: '🚴' },
  mountain_biking: { label: 'Mountainbike', icon: '🚵' },
  hiking: { label: 'Wandern', icon: '🥾' },
  swimming: { label: 'Schwimmen', icon: '🏊' },
}



const rarityForDefinition = ({ sport, metric, threshold }) => {
  const value = Number(threshold)

  if (metric === 'calendar_date') return 'special'
  if (metric === 'four_seasons') return 'rare'
  if (metric === 'vertical_ratio_over') return 'rare'
  if (metric === 'monthly_sport_count') return 'rare'
  if (metric === 'active_weekend_streak') return value >= 4 ? 'rare' : 'special'

  if (sport === 'running') {
    if (metric === 'single_distance_km') {
      if (value >= 42.195) return 'legendary'
      if (value >= 21.0975) return 'epic'
      if (value >= 10) return 'rare'
      if (value >= 5) return 'special'
      return 'common'
    }
    if (metric === 'total_distance_km') {
      if (value >= 10000) return 'legendary'
      if (value >= 2500) return 'epic'
      if (value >= 500) return 'rare'
      if (value >= 100) return 'special'
      return 'common'
    }
    if (metric === 'activity_count') {
      if (value >= 1000) return 'legendary'
      if (value >= 250) return 'epic'
      if (value >= 50) return 'rare'
      if (value >= 5) return 'special'
      return 'common'
    }
    if (metric === 'pace_under_seconds') {
      if (value <= 240) return 'legendary'
      if (value <= 300) return 'epic'
      if (value <= 420) return 'rare'
      if (value <= 480) return 'special'
      return 'common'
    }
    if (metric === 'single_elevation_m') {
      if (value >= 2000) return 'legendary'
      if (value >= 1000) return 'epic'
      if (value >= 500) return 'rare'
      if (value >= 250) return 'special'
      return 'common'
    }
  }

  if (sport === 'mountain_biking') {
    if (metric === 'single_distance_km') {
      if (value >= 150) return 'legendary'
      if (value >= 100) return 'epic'
      if (value >= 50) return 'rare'
      if (value >= 25) return 'special'
      return 'common'
    }
    if (metric === 'single_elevation_m') {
      if (value >= 3000) return 'legendary'
      if (value >= 1500) return 'epic'
      if (value >= 750) return 'rare'
      if (value >= 500) return 'special'
      return 'common'
    }
    if (metric === 'total_elevation_m') {
      if (value >= 500000) return 'legendary'
      if (value >= 100000) return 'epic'
      if (value >= 25000) return 'rare'
      if (value >= 5000) return 'special'
      return 'common'
    }
  }

  if (sport === 'cycling') {
    if (metric === 'single_distance_km') {
      if (value >= 250) return 'legendary'
      if (value >= 150) return 'epic'
      if (value >= 100) return 'rare'
      if (value >= 50) return 'special'
      return 'common'
    }
    if (metric === 'average_speed_over') {
      if (value >= 35) return 'legendary'
      if (value >= 32.5) return 'epic'
      if (value >= 27.5) return 'rare'
      if (value >= 22.5) return 'special'
      return 'common'
    }
  }

  if (sport === 'hiking') {
    if (metric === 'single_distance_km') {
      if (value >= 100) return 'legendary'
      if (value >= 50) return 'epic'
      if (value >= 25) return 'rare'
      if (value >= 10) return 'special'
      return 'common'
    }
    if (metric === 'single_elevation_m') {
      if (value >= 3000) return 'legendary'
      if (value >= 1500) return 'epic'
      if (value >= 750) return 'rare'
      if (value >= 250) return 'special'
      return 'common'
    }
  }

  if (sport === 'swimming' && metric === 'single_distance_km') {
    if (value >= 5) return 'legendary'
    if (value >= 3) return 'epic'
    if (value >= 2) return 'rare'
    if (value >= 1) return 'special'
    return 'common'
  }

  if (metric === 'activity_count') {
    if (value >= 1000) return 'legendary'
    if (value >= 250) return 'epic'
    if (value >= 50) return 'rare'
    if (value >= 10) return 'special'
    return 'common'
  }

  if (metric === 'total_hours') {
    if (value >= 1000) return 'legendary'
    if (value >= 500) return 'epic'
    if (value >= 100) return 'rare'
    if (value >= 25) return 'special'
    return 'common'
  }

  if (metric === 'total_distance_km') {
    if (value >= 10000) return 'legendary'
    if (value >= 5000) return 'epic'
    if (value >= 1000) return 'rare'
    if (value >= 250) return 'special'
    return 'common'
  }

  if (metric === 'total_elevation_m') {
    if (value >= 500000) return 'legendary'
    if (value >= 100000) return 'epic'
    if (value >= 25000) return 'rare'
    if (value >= 5000) return 'special'
    return 'common'
  }

  if (metric === 'active_day_streak') {
    if (value >= 100) return 'legendary'
    if (value >= 30) return 'epic'
    if (value >= 14) return 'rare'
    if (value >= 7) return 'special'
    return 'common'
  }

  if (metric === 'active_week_streak') {
    if (value >= 52) return 'legendary'
    if (value >= 25) return 'epic'
    if (value >= 10) return 'rare'
    if (value >= 5) return 'special'
    return 'common'
  }

  return 'special'
}

const RUNNING_DISTANCE_STORIES = new Map([
  [3, 'Der Anfang ist gemacht. Drei Kilometer nur für dich.'],
  [5, 'Fünf Kilometer am Stück – aus Laufen wird Ausdauer.'],
  [7.5, 'Du lässt die ersten fünf Kilometer längst hinter dir.'],
  [10, 'Zweistellig. Ein Lauf, der sich nach einem echten Meilenstein anfühlt.'],
  [15, 'Aus einer Laufrunde wird langsam eine lange Strecke.'],
  [21.0975, '21,1 Kilometer – ein Meilenstein, den du dir Schritt für Schritt erarbeitet hast.'],
  [25, 'Weiter als ein Halbmarathon – und noch immer unterwegs.'],
  [30, 'Dreißig Kilometer verlangen mehr als nur schnelle Beine.'],
  [42.195, '42,195 Kilometer. Eine Distanz, die bleibt.'],
  [50, 'Fünfzig Kilometer. Ab hier beginnt ein ganz anderes Kapitel.'],
])

const RUNNING_COUNT_STORIES = new Map([
  [1, 'Alles beginnt mit diesem einen Lauf.'],
  [5, 'Du bist wieder losgelaufen. Und wieder.'],
  [10, 'Aus einzelnen Läufen entsteht langsam eine Gewohnheit.'],
  [25, '25-mal Schuhe an und los. Dranbleiben zahlt sich aus.'],
  [50, 'Fünfzig Läufe – Bewegung gehört längst zu deinem Alltag.'],
  [100, 'Hundert Läufe. Das ist keine Phase mehr.'],
  [250, '250 Läufe erzählen von echter Beständigkeit.'],
  [500, 'Fünfhundert Läufe – aus Routine ist ein Teil deines Lebens geworden.'],
  [1000, 'Tausend Läufe. Ein sportlicher Weg mit unzähligen Geschichten.'],
])

const RUNNING_PACE_STORIES = new Map([
  [510, 'Du wirst sicherer – und ganz nebenbei schneller.'],
  [480, 'Die Acht vor dem Doppelpunkt ist Geschichte.'],
  [450, 'Dein Rhythmus verändert sich. Das Tempo kommt mit.'],
  [420, 'Unter sieben. Ein echter Tempo-Meilenstein.'],
  [390, 'Du näherst dich einer Pace, die früher vielleicht weit weg wirkte.'],
  [360, 'Die Fünf steht vorne. Das ist schnell.'],
  [330, 'Tempo ist längst mehr als nur ein Nebeneffekt.'],
  [300, 'Unter fünf Minuten pro Kilometer – ein außergewöhnlicher Schritt.'],
  [270, 'Jetzt wird aus schnell wirklich sehr schnell.'],
  [240, 'Vier Minuten pro Kilometer. Eine Marke für die ganz besonderen Tage.'],
])

const storyFromDefinition = ({ sport, metric, threshold }) => {
  const value = Number(threshold)

  if (sport === 'running' && metric === 'single_distance_km') {
    return RUNNING_DISTANCE_STORIES.get(value) ||
      'Jeder neue Distanzrekord erweitert deinen Horizont.'
  }

  if (sport === 'running' && metric === 'activity_count') {
    return RUNNING_COUNT_STORIES.get(value) ||
      'Lauf für Lauf wächst aus Motivation Beständigkeit.'
  }

  if (sport === 'running' && metric === 'pace_under_seconds') {
    return RUNNING_PACE_STORIES.get(value) ||
      'Dein Tempo zeigt, wie weit du gekommen bist.'
  }

  if (sport === 'running' && metric === 'total_distance_km') {
    if (value <= 50) return 'Die ersten Laufkilometer sammeln sich schneller, als man denkt.'
    if (value <= 250) return 'Aus einzelnen Läufen wird langsam eine große Strecke.'
    if (value <= 1000) return 'Kilometer für Kilometer wächst deine Laufgeschichte.'
    if (value <= 5000) return 'Was einmal mit wenigen Kilometern begann, ist längst eine beeindruckende Summe.'
    return 'Zehntausende Schritte, unzählige Läufe – und jeder davon gehört zu deinem Weg.'
  }

  if (sport === 'running' && metric === 'single_elevation_m') {
    if (value <= 100) return 'Heute ging es nicht nur vorwärts, sondern auch bergauf.'
    if (value <= 500) return 'Mehr Höhenmeter machen aus einem Lauf ein kleines Abenteuer.'
    if (value <= 1000) return 'Vierstellige Höhenmeter verlangen Kraft, Ausdauer und Geduld.'
    return 'Das ist längst mehr als ein Lauf – das ist ein echtes Bergabenteuer.'
  }

  if (sport === 'mountain_biking') {
    if (metric === 'single_distance_km') {
      if (value <= 25) return 'Die ersten längeren Trails liegen hinter dir.'
      if (value <= 50) return 'Fünfzig Kilometer auf dem Bike – genug Strecke für echte Abenteuer.'
      if (value <= 100) return 'Eine Tour, die Ausdauer und Abenteuer verbindet.'
      return 'So eine Distanz auf dem Mountainbike bleibt im Kopf.'
    }
    if (metric === 'single_elevation_m') {
      if (value <= 500) return 'Die Berge werden langsam Teil deiner Touren.'
      if (value <= 1000) return 'Vierstellige Höhenmeter – bergauf wird zum festen Bestandteil.'
      return 'Viele Höhenmeter, viele Anstiege, ein großes Abenteuer.'
    }
    if (metric === 'total_elevation_m') {
      return value < 25000
        ? 'Höhenmeter sammeln sich Kurve für Kurve.'
        : 'Aus einzelnen Anstiegen ist inzwischen ein ganzes Gebirge geworden.'
    }
    if (metric === 'total_distance_km') return 'Trail für Trail wächst deine Mountainbike-Geschichte.'
    if (metric === 'single_duration_hours') return 'Manche Touren misst man irgendwann besser in Stunden als in Kilometern.'
  }

  if (sport === 'cycling') {
    if (metric === 'single_distance_km') {
      if (value < 100) return 'Mit jeder längeren Tour wächst dein Radius.'
      if (value === 100) return 'Hundert Kilometer am Stück – ein Klassiker, den man nicht vergisst.'
      return 'Eine lange Radtour, bei der der Weg selbst zum Ziel wird.'
    }
    if (metric === 'average_speed_over') return `Ø ${String(threshold).replace('.', ',')} km/h – dein Tempo wird sichtbar.`
    if (metric === 'single_elevation_m') return 'Auch auf dem Rad zählen nicht nur Kilometer, sondern die Wege nach oben.'
    if (metric === 'total_elevation_m') return 'Viele kleine Anstiege ergeben irgendwann große Höhen.'
    if (metric === 'total_distance_km') return 'Kilometer sammeln. Erinnerungen auch.'
    if (metric === 'single_duration_hours') return 'Zeit im Sattel wird zur Ausdauer.'
  }

  if (sport === 'hiking') {
    if (metric === 'single_distance_km') {
      if (value <= 10) return 'Ein Weg, ein Ziel und die ersten längeren Kilometer zu Fuß.'
      if (value <= 25) return 'Aus einem Spaziergang wird eine echte Wanderung.'
      if (value <= 50) return 'Eine Strecke, die Geduld und Ausdauer verlangt.'
      return 'So weit zu Fuß – das ist ein Erlebnis, das bleibt.'
    }
    if (metric === 'single_elevation_m') return 'Jeder Anstieg verändert den Blick auf den Weg.'
    if (metric === 'single_duration_hours') return 'Manche Tage verbringt man am besten draußen auf dem Weg.'
    if (metric === 'total_distance_km') return 'Schritt für Schritt wächst deine persönliche Wanderkarte.'
    if (metric === 'total_elevation_m') return 'Viele Wege nach oben ergeben irgendwann große Höhen.'
    if (metric === 'activity_count') return 'Aus einzelnen Wanderungen wird eine echte Gewohnheit draußen.'
  }

  if (sport === 'swimming') {
    if (metric === 'single_distance_km') {
      if (value < 1) return 'Die ersten längeren Bahnen sind geschafft.'
      if (value === 1) return 'Ein Kilometer im Wasser – Bahn für Bahn erarbeitet.'
      if (value <= 3) return 'Aus Technik und Ausdauer wird echte Strecke.'
      return 'Fünf Kilometer im Wasser – eine außergewöhnliche Ausdauerleistung.'
    }
    if (metric === 'total_distance_km') return 'Bahn für Bahn wächst deine Ausdauer.'
  }

  if (metric === 'activity_count') {
    if (value === 1) return 'Alles beginnt mit einer einzigen Aktivität.'
    if (value <= 25) return 'Du kommst wieder. Genau daraus entsteht Gewohnheit.'
    if (value <= 100) return 'Bewegung wird immer mehr zu einem festen Teil deines Alltags.'
    return 'So viele Aktivitäten entstehen nur, wenn man wirklich dranbleibt.'
  }

  if (metric === 'total_hours') {
    if (value <= 25) return 'Zeit für Bewegung ist Zeit für dich.'
    if (value <= 100) return 'Viele einzelne Trainingsstunden ergeben echte Erfahrung.'
    return 'So viel aktive Zeit erzählt mehr als jede einzelne Zahl.'
  }

  if (metric === 'total_distance_km') {
    if (value <= 500) return 'Viele kleine Strecken ergeben einen großen Weg.'
    if (value <= 2500) return 'Deine Aktivitäten verbinden sich zu einer beeindruckenden Gesamtdistanz.'
    return 'Was einmal mit einer einzelnen Aktivität begann, reicht inzwischen sehr weit.'
  }

  if (metric === 'total_elevation_m') {
    if (value <= 5000) return 'Jeder Höhenmeter bringt dich ein Stück weiter nach oben.'
    if (value <= 50000) return 'Aus kleinen Anstiegen entsteht langsam ein Gebirge.'
    return 'So viele Höhenmeter muss man sich Schritt für Schritt erarbeiten.'
  }

  if (metric === 'active_day_streak') {
    if (value <= 7) return 'Dranbleiben beginnt mit ein paar Tagen hintereinander.'
    if (value <= 30) return 'Aus Motivation wird langsam Routine.'
    return 'Beständigkeit ist längst eine deiner Stärken.'
  }

  if (metric === 'active_week_streak') {
    if (value <= 5) return 'Eine aktive Woche folgt auf die nächste.'
    if (value <= 25) return 'Deine Bewegung hat einen festen Platz in deinem Alltag.'
    return 'Ein ganzes Jahr konsequent aktiv – das ist echte Beständigkeit.'
  }

  if (metric === 'start_before_hour') return 'Die Welt schläft noch – du bist schon unterwegs.'
  if (metric === 'start_after_hour') return 'Wenn der Tag endet, beginnt manchmal dein Moment.'
  if (metric === 'count_start_before_hour') return 'Aus frühem Start wird langsam eine Morgenroutine.'
  if (metric === 'count_start_after_hour') return 'Auch nach langen Tagen findest du noch Zeit für Bewegung.'
  if (metric === 'weekday_in') return 'Wochenenden sind auch dafür da, draußen unterwegs zu sein.'
  if (metric === 'weekday_count') return 'Ein bestimmter Wochentag wird langsam zu deinem Ritual.'
  if (metric === 'monthly_activity_count') return 'Viele kleine Einheiten machen einen starken Monat.'
  if (metric === 'monthly_distance_km') return 'Dieser Monat hat Strecke gemacht.'
  if (metric === 'monthly_sport_count') return 'Abwechslung bringt neue Perspektiven in deinen sportlichen Weg.'
  if (metric === 'active_weekend_streak') return 'Wochenende für Wochenende bleibst du dran.'
  if (metric === 'calendar_date') return 'Ein besonderer Tag bekommt seine eigene sportliche Erinnerung.'
  if (metric === 'four_seasons') return 'Dein Weg kennt Frühling, Sommer, Herbst und Winter.'
  if (metric === 'vertical_ratio_over') return 'Wenn der Weg steiler wird, wächst das Abenteuer.'

  return 'Ein weiterer Meilenstein auf deinem sportlichen Weg.'
}

const series = ({ prefix, sport = 'all', category = 'milestones', metric, thresholds, unit, icon, title, description, visibility = 'visible', options = {} }) =>
  thresholds.map((threshold, index) => ({
    id: `${prefix}_${String(threshold).replace('.', '_')}`,
    version: 1,
    sport,
    category,
    metric,
    threshold,
    unit,
    icon,
    title: title(threshold),
    description: description(threshold),
    visibility,
    tier: index + 1,
    rarity:
      options.rarity ||
      rarityForDefinition({
        sport,
        metric,
        threshold,
      }),
    story:
      typeof options.story === 'function'
        ? options.story(threshold, index)
        : options.story ||
          storyFromDefinition({
            sport,
            metric,
            threshold,
          }),
    ...options,
  }))

const GENERAL = [
  ...series({
    prefix: 'all_activity_count', metric: 'activity_count',
    thresholds: [1, 10, 25, 50, 100, 250, 500, 1000], unit: 'Aktivitäten', icon: '✨',
    title: v => v === 1 ? 'Erste Aktivität' : `${v} Aktivitäten`,
    description: v => v === 1 ? 'Der erste Schritt auf deinem sportlichen Weg.' : `Du hast insgesamt ${v} Aktivitäten abgeschlossen.`,
  }),
  ...series({
    prefix: 'all_total_hours', metric: 'total_hours',
    thresholds: [10, 25, 50, 100, 250, 500, 1000], unit: 'Stunden', icon: '⏱️',
    title: v => `${v} Stunden aktiv`,
    description: v => `Du hast insgesamt ${v} Stunden Bewegung gesammelt.`,
  }),
  ...series({
    prefix: 'all_total_distance', metric: 'total_distance_km',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000], unit: 'km', icon: '🗺️',
    title: v => `${v.toLocaleString('de-DE')} Kilometer`,
    description: v => `Deine Aktivitäten ergeben zusammen ${v.toLocaleString('de-DE')} Kilometer.`,
  }),
  ...series({
    prefix: 'all_total_elevation', metric: 'total_elevation_m',
    thresholds: [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000], unit: 'hm', icon: '⛰️',
    title: v => `${v.toLocaleString('de-DE')} Höhenmeter`,
    description: v => `Du hast insgesamt ${v.toLocaleString('de-DE')} Höhenmeter überwunden.`,
  }),
]

const RUNNING = [
  ...series({
    prefix: 'running_single_distance', sport: 'running', category: 'performance', metric: 'single_distance_km',
    thresholds: [3, 5, 7.5, 10, 15, 21.0975, 25, 30, 42.195, 50], unit: 'km', icon: '🏃',
    title: v => v === 21.0975 ? 'Erster Halbmarathon' : v === 42.195 ? 'Erster Marathon' : v === 50 ? 'Erster Ultramarathon' : `Erste ${String(v).replace('.', ',')} km`,
    description: v => `Du hast erstmals mindestens ${String(v).replace('.', ',')} Kilometer in einem Lauf erreicht.`,
  }),
  ...series({
    prefix: 'running_total_distance', sport: 'running', metric: 'total_distance_km',
    thresholds: [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000], unit: 'km', icon: '👟',
    title: v => `${v.toLocaleString('de-DE')} Laufkilometer`,
    description: v => `Du hast insgesamt ${v.toLocaleString('de-DE')} Kilometer laufend zurückgelegt.`,
  }),
  ...series({
    prefix: 'running_activity_count', sport: 'running', metric: 'activity_count',
    thresholds: [1, 5, 10, 25, 50, 100, 250, 500, 1000], unit: 'Läufe', icon: '🏃',
    title: v => v === 1 ? 'Erster Lauf' : `${v} Läufe`,
    description: v => v === 1 ? 'Dein erster Lauf ist geschafft.' : `Du hast ${v} Läufe abgeschlossen.`,
  }),

...[
  [510, 3], [480, 3], [450, 3], [420, 3], [390, 3],
  [360, 3], [330, 5], [300, 5], [270, 5], [240, 5],
].map(([threshold, minDistanceKm], index, values) => {
  const m = Math.floor(threshold / 60)
  const s = String(threshold % 60).padStart(2, '0')
  const slowerMilestone = index === 0 ? 570 : values[index - 1][0]

  return {
    id: `running_pace_under_${threshold}`,
    version: 1,
    sport: 'running',
    category: 'performance',
    metric: 'pace_under_seconds',
    threshold,
    progressStartSeconds: slowerMilestone,
    minDistanceKm,
    unit: 'min/km',
    icon: '⚡',
    visibility: threshold <= 270 ? 'hinted' : 'visible',
    tier: index + 1,
    rarity: rarityForDefinition({
      sport: 'running',
      metric: 'pace_under_seconds',
      threshold,
    }),
    story: storyFromDefinition({
      sport: 'running',
      metric: 'pace_under_seconds',
      threshold,
    }),
    title: `Pace unter ${m}:${s}`,
    description: `Du bist über mindestens ${minDistanceKm} km schneller als ${m}:${s} min/km gelaufen.`,
  }
}),
  ...series({
    prefix: 'running_single_elevation', sport: 'running', category: 'performance', metric: 'single_elevation_m',
    thresholds: [100, 250, 500, 750, 1000, 1500, 2000], unit: 'hm', icon: '⛰️',
    title: v => `${v} hm in einem Lauf`,
    description: v => `Du hast in einem Lauf mindestens ${v} Höhenmeter gesammelt.`,
    options: { activatesTag: 'trail_running' },
  }),
]

const CYCLING = [
  ...series({
    prefix: 'cycling_single_distance', sport: 'cycling', category: 'performance', metric: 'single_distance_km',
    thresholds: [25, 50, 75, 100, 150, 200, 250], unit: 'km', icon: '🚴',
    title: v => `${v} km Radtour`,
    description: v => `Du hast erstmals mindestens ${v} Kilometer in einer Radtour erreicht.`,
    options: { excludeIndoor: true },
  }),
  ...series({
    prefix: 'cycling_total_distance', sport: 'cycling', metric: 'total_distance_km',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000, 25000], unit: 'km', icon: '🚴',
    title: v => `${v.toLocaleString('de-DE')} Radkilometer`,
    description: v => `Du hast insgesamt ${v.toLocaleString('de-DE')} Kilometer mit dem Rad gesammelt.`,
  }),
  ...series({
    prefix: 'cycling_single_elevation', sport: 'cycling', category: 'performance', metric: 'single_elevation_m',
    thresholds: [250, 500, 1000, 1500, 2000, 3000, 5000], unit: 'hm', icon: '⛰️',
    title: v => `${v.toLocaleString('de-DE')} hm in einer Radtour`,
    description: v => `Du hast in einer Radtour mindestens ${v.toLocaleString('de-DE')} Höhenmeter erreicht.`,
    options: { excludeIndoor: true },
  }),
  ...series({
    prefix: 'cycling_total_elevation', sport: 'cycling', metric: 'total_elevation_m',
    thresholds: [1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000], unit: 'hm', icon: '🏔️',
    title: v => `${v.toLocaleString('de-DE')} Rad-Höhenmeter`,
    description: v => `Du hast beim Radfahren insgesamt ${v.toLocaleString('de-DE')} Höhenmeter gesammelt.`,
    options: { excludeIndoor: true },
  }),
  ...series({
    prefix: 'cycling_single_duration', sport: 'cycling', category: 'performance', metric: 'single_duration_hours',
    thresholds: [1, 2, 4, 6, 8], unit: 'Stunden', icon: '⏱️',
    title: v => `${v} Stunden im Sattel`,
    description: v => `Du warst in einer Radtour mindestens ${v} Stunden unterwegs.`,
  }),
  ...[20, 22.5, 25, 27.5, 30, 32.5, 35].map((threshold, index) => ({
    id: `cycling_average_speed_${String(threshold).replace('.', '_')}`,
    version: 1, sport: 'cycling', category: 'performance', metric: 'average_speed_over',
    threshold, minDistanceKm: 20, maxPlausibleSpeedKmh: 65, excludeIndoor: true,
    unit: 'km/h', icon: '⚡', visibility: threshold >= 32.5 ? 'hinted' : 'visible', tier: index + 1,
    rarity: rarityForDefinition({
      sport: 'cycling',
      metric: 'average_speed_over',
      threshold,
    }),
    story: storyFromDefinition({
      sport: 'cycling',
      metric: 'average_speed_over',
      threshold,
    }),
    title: `Ø ${String(threshold).replace('.', ',')} km/h`,
    description: `Du bist über mindestens 20 km im Durchschnitt ${String(threshold).replace('.', ',')} km/h gefahren.`,
  })),
]

const MOUNTAIN_BIKING = [
  ...series({
    prefix: 'mtb_single_distance', sport: 'mountain_biking', category: 'performance', metric: 'single_distance_km',
    thresholds: [10, 25, 50, 75, 100, 150], unit: 'km', icon: '🚵',
    title: v => `${v} km Mountainbike`,
    description: v => `Du hast erstmals mindestens ${v} Kilometer auf dem Mountainbike erreicht.`,
  }),
  ...series({
    prefix: 'mtb_total_distance', sport: 'mountain_biking', metric: 'total_distance_km',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000], unit: 'km', icon: '🚵',
    title: v => `${v.toLocaleString('de-DE')} MTB-Kilometer`,
    description: v => `Du hast insgesamt ${v.toLocaleString('de-DE')} Kilometer auf dem Mountainbike gesammelt.`,
  }),
  ...series({
    prefix: 'mtb_single_elevation', sport: 'mountain_biking', category: 'performance', metric: 'single_elevation_m',
    thresholds: [250, 500, 750, 1000, 1500, 2000, 3000], unit: 'hm', icon: '⛰️',
    title: v => `${v.toLocaleString('de-DE')} hm in einer MTB-Tour`,
    description: v => `Du hast in einer Mountainbike-Tour mindestens ${v.toLocaleString('de-DE')} Höhenmeter erreicht.`,
  }),
  ...series({
    prefix: 'mtb_total_elevation', sport: 'mountain_biking', metric: 'total_elevation_m',
    thresholds: [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000], unit: 'hm', icon: '🏔️',
    title: v => `${v.toLocaleString('de-DE')} MTB-Höhenmeter`,
    description: v => `Du hast beim Mountainbiken insgesamt ${v.toLocaleString('de-DE')} Höhenmeter gesammelt.`,
  }),
  ...series({
    prefix: 'mtb_single_duration', sport: 'mountain_biking', category: 'performance', metric: 'single_duration_hours',
    thresholds: [1, 2, 4, 6, 8], unit: 'Stunden', icon: '⏱️',
    title: v => `${v} Stunden Mountainbike`,
    description: v => `Du warst in einer Mountainbike-Tour mindestens ${v} Stunden unterwegs.`,
  }),
  ...series({
    prefix: 'mtb_activity_count', sport: 'mountain_biking', metric: 'activity_count',
    thresholds: [1, 5, 10, 25, 50, 100, 250], unit: 'Touren', icon: '🚵',
    title: v => v === 1 ? 'Erste MTB-Tour' : `${v} MTB-Touren`,
    description: v => v === 1 ? 'Deine erste Mountainbike-Tour ist geschafft.' : `Du hast ${v} Mountainbike-Touren abgeschlossen.`,
  }),
  {
    id: 'mtb_vertical_30', version: 1, sport: 'mountain_biking', category: 'moments',
    metric: 'vertical_ratio_over', threshold: 30, minDistanceKm: 10, unit: 'hm/km', icon: '🧗',
    visibility: 'secret', tier: 1, title: 'Vertikal unterwegs',
    description: 'Mehr als 30 Höhenmeter pro Kilometer auf einer MTB-Tour.',
  },
]

const HIKING = [
  ...series({
    prefix: 'hiking_single_distance', sport: 'hiking', category: 'performance', metric: 'single_distance_km',
    thresholds: [5, 10, 15, 20, 25, 30, 40, 50, 75, 100], unit: 'km', icon: '🥾',
    title: v => `${v} km Wanderung`,
    description: v => `Du hast erstmals mindestens ${v} Kilometer in einer Wanderung erreicht.`,
  }),
  ...series({
    prefix: 'hiking_single_elevation', sport: 'hiking', category: 'performance', metric: 'single_elevation_m',
    thresholds: [100, 250, 500, 750, 1000, 1500, 2000, 3000], unit: 'hm', icon: '⛰️',
    title: v => `${v.toLocaleString('de-DE')} hm in einer Wanderung`,
    description: v => `Du hast in einer Wanderung mindestens ${v.toLocaleString('de-DE')} Höhenmeter erreicht.`,
  }),
  ...series({
    prefix: 'hiking_single_duration', sport: 'hiking', category: 'performance', metric: 'single_duration_hours',
    thresholds: [1, 2, 4, 6, 8, 12, 24], unit: 'Stunden', icon: '⏱️',
    title: v => `${v} Stunden gewandert`,
    description: v => `Du warst in einer Wanderung mindestens ${v} Stunden unterwegs.`,
  }),
  ...series({
    prefix: 'hiking_total_distance', sport: 'hiking', metric: 'total_distance_km',
    thresholds: [50, 100, 250, 500, 1000, 2500, 5000], unit: 'km', icon: '🥾',
    title: v => `${v.toLocaleString('de-DE')} Wanderkilometer`,
    description: v => `Du hast insgesamt ${v.toLocaleString('de-DE')} Kilometer wandernd zurückgelegt.`,
  }),
  ...series({
    prefix: 'hiking_total_elevation', sport: 'hiking', metric: 'total_elevation_m',
    thresholds: [1000, 2500, 5000, 10000, 25000, 50000, 100000], unit: 'hm', icon: '🏔️',
    title: v => `${v.toLocaleString('de-DE')} Wander-Höhenmeter`,
    description: v => `Du hast beim Wandern insgesamt ${v.toLocaleString('de-DE')} Höhenmeter gesammelt.`,
  }),
  ...series({
    prefix: 'hiking_activity_count', sport: 'hiking', metric: 'activity_count',
    thresholds: [1, 3, 10, 25, 50, 100, 250], unit: 'Wanderungen', icon: '🥾',
    title: v => v === 1 ? 'Erste Wanderung' : `${v} Wanderungen`,
    description: v => v === 1 ? 'Deine erste Wanderung ist geschafft.' : `Du hast ${v} Wanderungen abgeschlossen.`,
  }),
]

const SWIMMING = [
  ...series({
    prefix: 'swimming_single_distance', sport: 'swimming', category: 'performance', metric: 'single_distance_km',
    thresholds: [0.5, 1, 2, 3, 5], unit: 'km', icon: '🏊',
    title: v => `${String(v).replace('.', ',')} km geschwommen`,
    description: v => `Du hast in einer Schwimmeinheit mindestens ${String(v).replace('.', ',')} Kilometer erreicht.`,
  }),
  ...series({
    prefix: 'swimming_total_distance', sport: 'swimming', metric: 'total_distance_km',
    thresholds: [5, 10, 25, 50, 100, 250, 500], unit: 'km', icon: '🌊',
    title: v => `${v} Schwimmkilometer`,
    description: v => `Du hast insgesamt ${v} Kilometer schwimmend zurückgelegt.`,
  }),
]

const CONSISTENCY = [
  ...series({
    prefix: 'all_active_day_streak', category: 'consistency', metric: 'active_day_streak',
    thresholds: [3, 7, 14, 30, 50, 100], unit: 'Tage', icon: '🔥',
    title: v => `${v} Tage in Folge aktiv`,
    description: v => `Du warst an ${v} aufeinanderfolgenden Tagen aktiv.`,
  }),
  ...series({
    prefix: 'all_active_week_streak', category: 'consistency', metric: 'active_week_streak',
    thresholds: [3, 5, 10, 25, 52], unit: 'Wochen', icon: '📅',
    title: v => `${v} aktive Wochen`,
    description: v => `Du warst ${v} Wochen in Folge mindestens einmal aktiv.`,
  }),
]

const MOMENTS = [
  // Sichtbare besondere Momente
  {
    id: 'moment_weekend_start',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'weekday_in',
    threshold: [0, 6],
    icon: '🌤️',
    visibility: 'visible',
    tier: 1,
    title: 'Wochenendbewegung',
    description: 'Eine Aktivität am Samstag oder Sonntag.',
  },
  {
    id: 'moment_morning_routine_5',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'count_start_before_hour',
    threshold: 5,
    hour: 8,
    unit: 'Morgenaktivitäten',
    icon: '☀️',
    visibility: 'visible',
    tier: 1,
    title: 'Morgenroutine',
    description: 'Fünf Aktivitäten vor 08:00 Uhr.',
  },
  {
    id: 'moment_evening_routine_10',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'count_start_after_hour',
    threshold: 10,
    hour: 18,
    unit: 'Abendaktivitäten',
    icon: '🌇',
    visibility: 'visible',
    tier: 1,
    title: 'Feierabendroutine',
    description: 'Zehn Aktivitäten ab 18:00 Uhr.',
  },
  {
    id: 'moment_active_month_10',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'monthly_activity_count',
    threshold: 10,
    unit: 'Aktivitäten',
    icon: '📅',
    visibility: 'visible',
    tier: 1,
    title: 'Aktiver Monat',
    description: 'Zehn Aktivitäten innerhalb eines Kalendermonats.',
  },

  // Angedeutete besondere Momente
  {
    id: 'moment_four_seasons',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'four_seasons',
    threshold: 4,
    icon: '🍂',
    visibility: 'hinted',
    tier: 1,
    title: 'Vier Jahreszeiten',
    description: 'In allen vier Jahreszeiten aktiv gewesen.',
  },
  {
    id: 'moment_sunday_7',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'weekday_count',
    threshold: 7,
    weekday: 0,
    unit: 'Sonntage',
    icon: '🌞',
    visibility: 'hinted',
    tier: 1,
    title: 'Sonntagsritual',
    description: 'An sieben verschiedenen Sonntagen aktiv gewesen.',
  },
  {
    id: 'moment_multisport_month_3',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'monthly_sport_count',
    threshold: 3,
    unit: 'Sportarten',
    icon: '🎨',
    visibility: 'hinted',
    tier: 1,
    title: 'Vielseitig unterwegs',
    description: 'Drei verschiedene Sportarten in einem Kalendermonat.',
  },
  {
    id: 'moment_month_distance_100',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'monthly_distance_km',
    threshold: 100,
    unit: 'km',
    icon: '🗺️',
    visibility: 'hinted',
    tier: 1,
    title: 'Hundert im Monat',
    description: 'In einem Kalendermonat insgesamt 100 Kilometer gesammelt.',
  },

  // Vollständig verborgene besondere Momente
  {
    id: 'moment_early_bird',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'start_before_hour',
    threshold: 6,
    icon: '🌅',
    visibility: 'secret',
    tier: 1,
    title: 'Frühaufsteher',
    description: 'Eine Aktivität vor 06:00 Uhr.',
  },
  {
    id: 'moment_night_owl',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'start_after_hour',
    threshold: 21,
    icon: '🌙',
    visibility: 'secret',
    tier: 1,
    title: 'Nachteule',
    description: 'Eine Aktivität nach 21:00 Uhr.',
  },
  {
    id: 'moment_three_active_weekends',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'active_weekend_streak',
    threshold: 3,
    unit: 'Wochenenden',
    icon: '🔥',
    visibility: 'secret',
    tier: 1,
    title: 'Wochenendserie',
    description: 'An drei aufeinanderfolgenden Wochenenden aktiv gewesen.',
  },
  {
    id: 'moment_new_year',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'calendar_date',
    threshold: '01-01',
    icon: '🎆',
    visibility: 'secret',
    tier: 1,
    title: 'Neujahrsaktivität',
    description: 'Das neue Jahr sportlich begonnen.',
  },
  {
    id: 'moment_christmas',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'calendar_date',
    threshold: '12-25',
    icon: '🎄',
    visibility: 'secret',
    tier: 1,
    title: 'Weihnachtsaktivität',
    description: 'Auch an Weihnachten aktiv geblieben.',
  },
  {
    id: 'moment_new_year_eve',
    version: 1,
    sport: 'all',
    category: 'moments',
    metric: 'calendar_date',
    threshold: '12-31',
    icon: '🎇',
    visibility: 'secret',
    tier: 1,
    title: 'Jahresausklang',
    description: 'Das Jahr sportlich beendet.',
  },
]


export const normalizeAchievementDefinition = definition => ({
  ...definition,
  rarity:
    definition.rarity ||
    rarityFromTier(definition.tier || 1),
  story:
    definition.story ||
    storyFromDefinition({
      sport: definition.sport,
      metric: definition.metric,
      threshold: definition.threshold,
    }),
})


const enrichDefinition = definition => ({
  ...definition,
  rarity:
    definition.rarity ||
    rarityForDefinition({
      sport: definition.sport,
      metric: definition.metric,
      threshold: definition.threshold,
    }),
  story:
    definition.story ||
    storyFromDefinition({
      sport: definition.sport,
      metric: definition.metric,
      threshold: definition.threshold,
    }),
})

export const ACHIEVEMENT_DEFINITIONS = [

  ...GENERAL,
  ...RUNNING,
  ...CYCLING,
  ...MOUNTAIN_BIKING,
  ...HIKING,
  ...SWIMMING,
  ...CONSISTENCY,
  ...MOMENTS,
].map(enrichDefinition).map(normalizeAchievementDefinition)

export const getDefinitionsForActiveSports = activeSports =>
  ACHIEVEMENT_DEFINITIONS.filter(
    definition => definition.sport === 'all' || activeSports.includes(definition.sport)
  )

export const getAchievementDefinition = id =>
  ACHIEVEMENT_DEFINITIONS.find(definition => definition.id === id) || null
