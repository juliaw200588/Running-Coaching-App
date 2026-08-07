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
    rarity: options.rarity || rarityFromTier(index + 1),
    story:
      options.story ||
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
    [510, 3], [480, 3], [450, 3], [420, 3], [390, 3], [360, 3], [330, 5], [300, 5], [270, 5], [240, 5],
  ].map(([threshold, minDistanceKm], index) => {
    const m = Math.floor(threshold / 60)
    const s = String(threshold % 60).padStart(2, '0')
    return {
      id: `running_pace_under_${threshold}`, version: 1, sport: 'running', category: 'performance',
      metric: 'pace_under_seconds', threshold, minDistanceKm, unit: 'min/km', icon: '⚡',
      visibility: threshold <= 270 ? 'hinted' : 'visible', tier: index + 1,
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

export const ACHIEVEMENT_DEFINITIONS = [

  ...GENERAL,
  ...RUNNING,
  ...CYCLING,
  ...MOUNTAIN_BIKING,
  ...HIKING,
  ...SWIMMING,
  ...CONSISTENCY,
  ...MOMENTS,
].map(normalizeAchievementDefinition)

export const getDefinitionsForActiveSports = activeSports =>
  ACHIEVEMENT_DEFINITIONS.filter(
    definition => definition.sport === 'all' || activeSports.includes(definition.sport)
  )

export const getAchievementDefinition = id =>
  ACHIEVEMENT_DEFINITIONS.find(definition => definition.id === id) || null
