export const MTB_COPY = {
  single_distance_km: {
    10: 'Die ersten Trails liegen hinter dir – und machen Lust auf mehr.',
    25: 'Fünfundzwanzig Kilometer zwischen Kurven, Wurzeln und Wegen.',
    50: 'Fünfzig Kilometer auf dem Bike – genug Strecke für ein echtes Abenteuer.',
    75: 'Der Radius wächst. Der Trail endet noch lange nicht.',
    100: 'Hundert Kilometer auf dem Mountainbike – Ausdauer trifft Abenteuer.',
    150: 'So eine Distanz auf dem Mountainbike bleibt im Kopf.',
  },

  total_distance_km: {
    100: 'Trail für Trail wächst dein Revier.',
    250: 'Immer neue Wege, immer mehr Geschichten im Gelände.',
    500: 'Fünfhundert Kilometer voller Kurven, Anstiege und Abfahrten.',
    1000: 'Vierstellig im Gelände. Dein Bike hat einiges gesehen.',
    2500: 'Aus einzelnen Touren ist längst eine große Mountainbike-Geschichte geworden.',
    5000: 'Fünftausend Kilometer zwischen Wald, Schotter und Trail.',
    10000: 'Zehntausend MTB-Kilometer. Das ist echte Leidenschaft fürs Gelände.',
  },

  single_elevation_m: {
    250: 'Die ersten längeren Anstiege gehören jetzt zu deinen Touren.',
    500: 'Fünfhundert Höhenmeter – bergauf wird langsam zum festen Bestandteil.',
    750: 'Mehr Höhenmeter, mehr Aussicht, mehr Abenteuer.',
    1000: 'Vierstellige Höhenmeter. Jetzt wird die Tour richtig bergig.',
    1500: 'Viele Anstiege, viele Kurven, ein großes Abenteuer.',
    2000: 'Zweitausend Höhenmeter auf dem Bike – das fordert.',
    3000: 'Dreitausend Höhenmeter. Das ist ein Tag für die Erinnerung.',
  },

  total_elevation_m: {
    500: 'Die ersten Höhenmeter sammeln sich Kurve für Kurve.',
    1000: 'Tausend Höhenmeter – die Berge werden langsam Teil deiner Geschichte.',
    2500: 'Aus einzelnen Anstiegen entsteht langsam ein Profil.',
    5000: 'Fünftausend Höhenmeter. Bergauf gehört längst dazu.',
    10000: 'Zehntausend Höhenmeter – ein kleines Gebirge ist geschafft.',
    25000: 'Viele kleine Anstiege ergeben irgendwann große Höhen.',
    50000: 'Fünfzigtausend Höhenmeter. Dein Revier wird immer vertikaler.',
    100000: 'Sechsstellige Höhenmeter auf dem Mountainbike – außergewöhnlich.',
    250000: 'Ein Viertelmillion Höhenmeter. Das ist weit mehr als nur ein Hobby.',
    500000: 'Eine halbe Million Höhenmeter. Ein ganzes Gebirge an Erinnerungen.',
  },

  single_duration_hours: {
    1: 'Eine Stunde draußen – genau genug für ein kleines Trail-Abenteuer.',
    2: 'Zwei Stunden im Gelände. Zeit verliert auf dem Bike schnell an Bedeutung.',
    4: 'Vier Stunden auf dem Mountainbike – jetzt wird aus einer Runde eine Tour.',
    6: 'Sechs Stunden zwischen Anstiegen und Abfahrten.',
    8: 'Acht Stunden im Sattel. Ein ganzer Tag voller Trail.',
  },

  activity_count: {
    1: 'Die erste MTB-Tour ist geschafft. Willkommen im Gelände.',
    5: 'Fünf Touren – der Trail zieht dich offenbar wieder an.',
    10: 'Zehn Touren. Aus Probieren wird langsam Leidenschaft.',
    25: 'Fünfundzwanzig Touren voller Dreck, Kurven und Höhenmeter.',
    50: 'Fünfzig MTB-Touren. Dein Bike kennt den Weg.',
    100: 'Hundert Touren im Gelände – das ist echte Beständigkeit.',
    250: '250 MTB-Touren. Aus Abenteuer ist längst ein Lebensgefühl geworden.',
  },

  vertical_ratio_over: {
    30: 'Wenn der Weg steiler wird, wächst das Abenteuer.',
  },
}

export const getMtbCopy = (metric, threshold) =>
  MTB_COPY?.[metric]?.[Number(threshold)] || null
