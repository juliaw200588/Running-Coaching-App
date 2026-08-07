export const RUNNING_COPY = {
  single_distance_km: {
    3: 'Der Anfang ist gemacht. Drei Kilometer nur für dich.',
    5: 'Fünf Kilometer am Stück – aus Laufen wird Ausdauer.',
    7.5: 'Du lässt die ersten fünf Kilometer längst hinter dir.',
    10: 'Zweistellig. Ein Lauf, der sich nach einem echten Meilenstein anfühlt.',
    15: 'Aus einer Laufrunde wird langsam eine lange Strecke.',
    21.0975: '21,1 Kilometer – ein Meilenstein, den du dir Schritt für Schritt erarbeitet hast.',
    25: 'Weiter als ein Halbmarathon – und noch immer unterwegs.',
    30: 'Dreißig Kilometer verlangen mehr als nur schnelle Beine.',
    42.195: '42,195 Kilometer. Eine Distanz, die bleibt.',
    50: 'Fünfzig Kilometer. Ab hier beginnt ein ganz anderes Kapitel.',
  },

  total_distance_km: {
    25: 'Die ersten Laufkilometer sammeln sich schneller, als man denkt.',
    50: 'Aus einzelnen Läufen entsteht langsam ein echter Trainingsweg.',
    100: 'Hundert Laufkilometer. Eine Distanz, die sich Schritt für Schritt aufgebaut hat.',
    250: 'Deine Laufschuhe kennen inzwischen viele Wege.',
    500: 'Fünfhundert Kilometer entstehen nur durch echtes Dranbleiben.',
    1000: 'Vierstellig. Dein Laufkonto wächst zu etwas Besonderem.',
    2500: 'Tausende Kilometer voller früher Morgen, guter Tage und harter Einheiten.',
    5000: 'Eine Strecke, die man nicht an einem Tag läuft – sondern über viele Geschichten hinweg.',
    10000: 'Zehntausend Laufkilometer. Das ist eine Lebensleistung.',
  },

  activity_count: {
    1: 'Alles beginnt mit diesem einen Lauf.',
    5: 'Du bist wieder losgelaufen. Und wieder.',
    10: 'Aus einzelnen Läufen entsteht langsam eine Gewohnheit.',
    25: '25-mal Schuhe an und los. Dranbleiben zahlt sich aus.',
    50: 'Fünfzig Läufe – Bewegung gehört längst zu deinem Alltag.',
    100: 'Hundert Läufe. Das ist keine Phase mehr.',
    250: '250 Läufe erzählen von echter Beständigkeit.',
    500: 'Fünfhundert Läufe – aus Routine ist ein Teil deines Lebens geworden.',
    1000: 'Tausend Läufe. Ein sportlicher Weg mit unzähligen Geschichten.',
  },

  pace_under_seconds: {
    510: 'Du wirst sicherer – und ganz nebenbei schneller.',
    480: 'Die Acht vor dem Doppelpunkt ist Geschichte.',
    450: 'Dein Rhythmus verändert sich. Das Tempo kommt mit.',
    420: 'Unter sieben. Ein echter Tempo-Meilenstein.',
    390: 'Du näherst dich einer Pace, die früher vielleicht weit weg wirkte.',
    360: 'Die Fünf steht vorne. Das ist schnell.',
    330: 'Tempo ist längst mehr als nur ein Nebeneffekt.',
    300: 'Unter fünf Minuten pro Kilometer – ein außergewöhnlicher Schritt.',
    270: 'Jetzt wird aus schnell wirklich sehr schnell.',
    240: 'Vier Minuten pro Kilometer. Eine Marke für die ganz besonderen Tage.',
  },

  single_elevation_m: {
    100: 'Heute ging es nicht nur vorwärts, sondern auch bergauf.',
    250: 'Ein Lauf mit spürbaren Anstiegen – die Ebene liegt hinter dir.',
    500: 'Fünfhundert Höhenmeter machen aus einem Lauf ein kleines Abenteuer.',
    750: 'Jeder Anstieg fordert mehr – und macht den Lauf besonderer.',
    1000: 'Vierstellige Höhenmeter verlangen Kraft, Ausdauer und Geduld.',
    1500: 'Das ist längst kein gewöhnlicher Lauf mehr.',
    2000: 'Zweitausend Höhenmeter. Ein echtes Bergabenteuer auf zwei Beinen.',
  },
}

export const getRunningCopy = (metric, threshold) =>
  RUNNING_COPY?.[metric]?.[Number(threshold)] || null
