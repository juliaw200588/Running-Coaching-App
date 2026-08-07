export const GENERAL_COPY = {
  activity_count: {
    1: 'Alles beginnt mit einer einzigen Aktivität.',
    10: 'Zehnmal Zeit für Bewegung – ein guter Anfang.',
    25: 'Dein Kalender füllt sich langsam mit Bewegung.',
    50: 'Bewegung ist keine Ausnahme mehr.',
    100: 'Hundert Aktivitäten erzählen bereits eine lange Geschichte.',
    250: 'Aus Motivation wurde Gewohnheit.',
    500: 'Fünfhundert Aktivitäten. Dranbleiben hat viele Formen.',
    1000: 'Tausend Aktivitäten. Das ist echte Beständigkeit.',
  },

  total_hours: {
    10: 'Zehn Stunden Bewegung – Zeit, die nur dir und deinem Weg gehört.',
    25: 'Jede einzelne Stunde war eine Investition in dich.',
    50: 'Aus kurzen Einheiten wird langsam echte Trainingszeit.',
    100: 'Hundert Stunden aktiv. Bewegung bekommt Gewicht in deinem Alltag.',
    250: 'Ein Vierteltausend Stunden Bewegung – beeindruckend.',
    500: 'Viele Abende. Viele Wochenenden. Viele Erinnerungen.',
    1000: 'Tausend Stunden aktiv. Bewegung ist längst ein Teil deines Lebens.',
  },

  total_distance_km: {
    100: 'Viele kleine Strecken ergeben einen großen Weg.',
    250: 'Deine Aktivitäten verbinden sich langsam zu einer echten Reise.',
    500: 'Fünfhundert Kilometer – Bewegung hinterlässt Spuren.',
    1000: 'Vierstellig. Dein Trainingsweg wird richtig lang.',
    2500: 'Zweitausendfünfhundert Kilometer voller Bewegung und Erinnerungen.',
    5000: 'Fünftausend Kilometer. Aus einzelnen Aktivitäten wird eine Geschichte.',
    10000: 'Zehntausend Kilometer. Dein sportlicher Weg reicht inzwischen sehr weit.',
  },

  total_elevation_m: {
    500: 'Die ersten Höhenmeter sammeln sich schneller, als man denkt.',
    1000: 'Tausend Höhenmeter – ein kleiner Berg aus vielen Aktivitäten.',
    2500: 'Jeder Anstieg zählt.',
    5000: 'Fünftausend Höhenmeter. Aus Hügeln wird langsam ein Gebirge.',
    10000: 'Zehntausend Höhenmeter – ein echter Meilenstein.',
    25000: 'Viele kleine Anstiege ergeben große Höhen.',
    50000: 'Fünfzigtausend Höhenmeter. Das ist beeindruckend.',
    100000: 'Sechsstellige Höhenmeter. Jeder einzelne wurde erarbeitet.',
    250000: 'Ein Viertelmillion Höhenmeter. Ein sportlicher Weg mit viel Auf und Ab.',
    500000: 'Eine halbe Million Höhenmeter. Ein Leben voller Aufstiege.',
  },

  active_day_streak: {
    3: 'Drei Tage in Folge – Dranbleiben beginnt klein.',
    7: 'Eine ganze Woche aktiv. Aus Motivation wird langsam Rhythmus.',
    14: 'Zwei Wochen am Stück – Beständigkeit wird sichtbar.',
    30: 'Dreißig Tage in Folge. Routine ist längst angekommen.',
    50: 'Fünfzig Tage aktiv. Das braucht echte Konsequenz.',
    100: 'Hundert Tage am Stück. Außergewöhnliche Beständigkeit.',
  },

  active_week_streak: {
    3: 'Drei aktive Wochen hintereinander – ein guter Rhythmus entsteht.',
    5: 'Fünf Wochen am Stück. Bewegung hat ihren Platz gefunden.',
    10: 'Zehn aktive Wochen – aus Motivation wird Gewohnheit.',
    25: 'Ein halbes Jahr konsequent aktiv. Stark.',
    52: 'Ein ganzes Jahr Woche für Woche aktiv – legendär.',
  },
}

export const MOMENT_COPY = {
  start_before_hour: {
    6: 'Die Welt schläft noch – du bist schon unterwegs.',
  },
  start_after_hour: {
    21: 'Wenn der Tag endet, beginnt manchmal dein Moment.',
  },
  calendar_date: {
    '01-01': 'Das neue Jahr beginnt mit Bewegung.',
    '12-25': 'Ein besonderer Tag. Ein besonderer Moment.',
    '12-31': 'Das Jahr endet in Bewegung.',
  },
  four_seasons: {
    4: 'Dein Weg kennt Frühling, Sommer, Herbst und Winter.',
  },
  weekday_in: {
    weekend: 'Wochenenden sind auch dafür da, draußen unterwegs zu sein.',
  },
  count_start_before_hour: {
    5: 'Aus frühem Start wird langsam eine Morgenroutine.',
  },
  count_start_after_hour: {
    5: 'Auch nach langen Tagen findest du noch Zeit für Bewegung.',
  },
  monthly_activity_count: {
    10: 'Viele kleine Einheiten machen einen starken Monat.',
  },
  weekday_count: {
    7: 'Ein Wochentag wird langsam zu deinem ganz eigenen Ritual.',
  },
  monthly_sport_count: {
    3: 'Abwechslung bringt neue Perspektiven in deinen sportlichen Weg.',
  },
  monthly_distance_km: {
    100: 'Dieser Monat hat Strecke gemacht.',
  },
  active_weekend_streak: {
    3: 'Wochenende für Wochenende bleibst du dran.',
  },
}

export const getGeneralCopy = (metric, threshold) => {
  const table = GENERAL_COPY?.[metric]
  if (!table) return null
  return table?.[Number(threshold)] || table?.[threshold] || null
}

export const getMomentCopy = (metric, threshold) => {
  const table = MOMENT_COPY?.[metric]
  if (!table) return null
  return table?.[Number(threshold)] || table?.[threshold] || null
}
