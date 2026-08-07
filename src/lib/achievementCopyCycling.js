export const CYCLING_COPY = {
  single_distance_km: {
    25: 'Die ersten längeren Straßen liegen hinter dir.',
    50: 'Fünfzig Kilometer – der Horizont rückt ein gutes Stück weiter.',
    75: 'Mit jeder längeren Tour wächst dein Radius.',
    100: 'Hundert Kilometer am Stück – ein Klassiker, den man nicht vergisst.',
    150: 'Hundertfünfzig Kilometer. Jetzt wird die Straße wirklich lang.',
    200: 'Zweihundert Kilometer – Ausdauer, Tempo und viel Asphalt.',
    250: 'Ein Vierteltausend Kilometer in einer Tour. Das ist legendär.',
  },

  total_distance_km: {
    100: 'Die ersten hundert Radkilometer liegen hinter dir.',
    250: 'Kilometer sammeln. Erinnerungen auch.',
    500: 'Fünfhundert Kilometer – der Radius wächst.',
    1000: 'Vierstellig auf zwei Rädern. Der Horizont wird größer.',
    2500: 'Viele Straßen, viele Touren, viele Erinnerungen.',
    5000: 'Fünftausend Kilometer – aus einzelnen Ausfahrten wird eine Reise.',
    10000: 'Zehntausend Radkilometer. Weite wird zur Gewohnheit.',
    25000: 'Fünfundzwanzigtausend Kilometer – genug, um einmal weit um die Welt zu denken.',
  },

  single_elevation_m: {
    250: 'Auch auf dem Rad zählen nicht nur Kilometer, sondern die Wege nach oben.',
    500: 'Fünfhundert Höhenmeter – die Straße wird welliger.',
    1000: 'Vierstellige Höhenmeter. Aus Rollen wird Klettern.',
    1500: 'Viele Anstiege, viele Kurven, viel Ausdauer.',
    2000: 'Zweitausend Höhenmeter – das ist ein echter Bergtag auf dem Rad.',
    3000: 'Dreitausend Höhenmeter. Ein Tag für starke Beine.',
    5000: 'Fünftausend Höhenmeter in einer Tour. Außergewöhnlich.',
  },

  total_elevation_m: {
    1000: 'Die ersten tausend Höhenmeter sind gesammelt.',
    2500: 'Jeder Anstieg zählt – und sie summieren sich.',
    5000: 'Fünftausend Höhenmeter. Bergauf wird langsam vertraut.',
    10000: 'Zehntausend Höhenmeter – aus Hügeln wird ein Gebirge.',
    25000: 'Viele kleine Anstiege ergeben irgendwann große Höhen.',
    50000: 'Fünfzigtausend Höhenmeter – die Straße ging oft nach oben.',
    100000: 'Sechsstellige Höhenmeter. Eine beeindruckende Bilanz.',
    250000: 'Ein Viertelmillion Höhenmeter – weit mehr als nur Rollen.',
  },

  single_duration_hours: {
    1: 'Eine Stunde im Sattel – der Kopf wird frei.',
    2: 'Zwei Stunden Fahrtwind und Straße.',
    4: 'Vier Stunden auf dem Rad – jetzt wird aus einer Runde eine Ausfahrt.',
    6: 'Sechs Stunden im Sattel. Der Horizont bleibt dein Ziel.',
    8: 'Acht Stunden auf zwei Rädern. Ein ganzer Tag unterwegs.',
  },

  average_speed_over: {
    20: 'Du findest deinen Rhythmus auf dem Rad.',
    22.5: 'Das Rad kommt ins Rollen – und dein Tempo wird konstanter.',
    25: 'Fünfundzwanzig im Schnitt. Deine Ausdauer trägt.',
    27.5: 'Du gleitest inzwischen richtig über den Asphalt.',
    30: 'Dreißig km/h Durchschnitt verlangen Ausdauer und Kontrolle.',
    32.5: 'Das fährt nicht mehr jeder – dein Tempo ist außergewöhnlich.',
    35: 'Fünfunddreißig im Schnitt. Beeindruckendes Tempo über eine ganze Tour.',
  },
}

export const getCyclingCopy = (metric, threshold) =>
  CYCLING_COPY?.[metric]?.[Number(threshold)] || null
