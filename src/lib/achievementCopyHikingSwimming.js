export const HIKING_COPY = {
  single_distance_km: {
    5: 'Fünf Kilometer zu Fuß – manchmal beginnt Entdecken ganz nah.',
    10: 'Zehn Kilometer. Aus einem Spaziergang wird eine echte Wanderung.',
    15: 'Fünfzehn Kilometer – der Weg wird langsam zum Erlebnis.',
    20: 'Zwanzig Kilometer zu Fuß. Zeit, Landschaft wirklich wahrzunehmen.',
    25: 'Ein Viertelhundert Kilometer – Schritt für Schritt erarbeitet.',
    30: 'Dreißig Kilometer. Eine Strecke, die Geduld und Ausdauer verlangt.',
    40: 'Vierzig Kilometer zu Fuß – der Weg selbst wird zum Ziel.',
    50: 'Fünfzig Kilometer. Manche Wege vergisst man nicht.',
    75: 'Fünfundsiebzig Kilometer – ein ganzer Tag voller Landschaft.',
    100: 'Hundert Kilometer zu Fuß. Eine Reise aus eigener Kraft.',
  },

  single_elevation_m: {
    100: 'Der Weg geht nach oben – und die Aussicht verändert sich.',
    250: 'Die ersten echten Anstiege gehören jetzt dazu.',
    500: 'Fünfhundert Höhenmeter – jeder Schritt bringt dich höher.',
    750: 'Mehr Höhe, mehr Aussicht, mehr Erinnerung.',
    1000: 'Tausend Höhenmeter zu Fuß. Jeder Gipfel beginnt mit einem Schritt.',
    1500: 'Viele Schritte bergauf – und jede Aussicht wurde verdient.',
    2000: 'Zweitausend Höhenmeter. Das ist ein großer Tag in den Bergen.',
    3000: 'Dreitausend Höhenmeter zu Fuß. Außergewöhnlich.',
  },

  single_duration_hours: {
    1: 'Eine Stunde draußen. Oft braucht es nicht mehr.',
    2: 'Zwei Stunden unterwegs – genug Zeit, um den Kopf frei zu bekommen.',
    4: 'Vier Stunden auf dem Weg. Landschaft statt Uhr.',
    6: 'Sechs Stunden draußen – ein echter Wandertag.',
    8: 'Acht Stunden zu Fuß. Der Weg bestimmt den Rhythmus.',
    12: 'Zwölf Stunden unterwegs – ein Tag, der bleibt.',
    24: 'Vierundzwanzig Stunden auf den Beinen. Eine außergewöhnliche Erfahrung.',
  },

  total_distance_km: {
    50: 'Fünfzig Wanderkilometer – viele kleine Wege ergeben eine Geschichte.',
    100: 'Hundert Kilometer zu Fuß. Schritt für Schritt wächst deine Karte.',
    250: 'Deine Wanderschuhe kennen inzwischen viele Wege.',
    500: 'Fünfhundert Kilometer Natur, Wege und Entdeckungen.',
    1000: 'Vierstellig zu Fuß – aus einzelnen Touren wird eine Reise.',
    2500: 'Zweitausendfünfhundert Kilometer voller Landschaft und Ruhe.',
    5000: 'Fünftausend Wanderkilometer. Manche Wege begleiten dich lange.',
  },

  total_elevation_m: {
    1000: 'Tausend Höhenmeter – die ersten Gipfel summieren sich.',
    2500: 'Viele Wege nach oben ergeben langsam große Höhen.',
    5000: 'Fünftausend Höhenmeter. Jeder Anstieg hat sich gelohnt.',
    10000: 'Zehntausend Höhenmeter – ein kleines Gebirge zu Fuß.',
    25000: 'Viele Gipfel, viele Wege, viele Erinnerungen.',
    50000: 'Fünfzigtausend Höhenmeter. Die Berge gehören zu deiner Geschichte.',
    100000: 'Hunderttausend Höhenmeter zu Fuß – außergewöhnlich.',
  },

  activity_count: {
    1: 'Die erste Wanderung ist geschafft. Der nächste Weg wartet schon.',
    3: 'Drei Wanderungen – draußen sein wird langsam zur Gewohnheit.',
    10: 'Zehn Wanderungen. Du findest deinen Weg immer wieder nach draußen.',
    25: 'Fünfundzwanzig Touren – viele Wege, viele Erinnerungen.',
    50: 'Fünfzig Wanderungen. Draußen sein gehört längst dazu.',
    100: 'Hundert Wanderungen – ein kleines Archiv voller Landschaft.',
    250: '250 Wanderungen. Ein sportlicher Weg voller Entdeckungen.',
  },
}

export const SWIMMING_COPY = {
  single_distance_km: {
    0.5: 'Die ersten längeren Bahnen sind geschafft.',
    1: 'Ein Kilometer im Wasser – Bahn für Bahn erarbeitet.',
    2: 'Zwei Kilometer ohne festen Boden unter den Füßen.',
    3: 'Drei Kilometer – jetzt wird aus Schwimmen echte Ausdauer.',
    5: 'Fünf Kilometer im Wasser. Eine außergewöhnliche Ausdauerleistung.',
  },

  total_distance_km: {
    5: 'Fünf Kilometer Wasser – Bahn für Bahn gesammelt.',
    10: 'Zehn Schwimmkilometer. Dein Rhythmus wird sicherer.',
    25: 'Fünfundzwanzig Kilometer – aus einzelnen Bahnen wird echte Strecke.',
    50: 'Fünfzig Kilometer im Wasser. Technik und Ausdauer wachsen zusammen.',
    100: 'Hundert Schwimmkilometer – eine beeindruckende Summe.',
    250: '250 Kilometer im Wasser. Ruhe, Rhythmus und Ausdauer.',
    500: 'Fünfhundert Schwimmkilometer. Das ist außergewöhnliche Beständigkeit.',
  },
}

export const getHikingCopy = (metric, threshold) =>
  HIKING_COPY?.[metric]?.[Number(threshold)] || null

export const getSwimmingCopy = (metric, threshold) =>
  SWIMMING_COPY?.[metric]?.[Number(threshold)] || null
