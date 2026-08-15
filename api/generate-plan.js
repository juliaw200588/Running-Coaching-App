import { generateHikingPlan } from '../src/lib/hikingPlanServer.js'
import { generateCyclingPlan } from '../src/lib/cyclingPlanServer.js'

const RUNNING_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    goal: { type: 'string' },
    startDate: { type: 'string' },
    name: { type: 'string' },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          sub: { type: 'string' },
          icon: { type: 'string' },
          dateRange: { type: 'string' },
          description: { type: 'string' },
          accent: { type: 'string' },
          light: { type: 'string' },
          mid: { type: 'string' },
          soft: { type: 'string' },
          weeks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                n: { type: 'integer' },
                dateRange: { type: 'string' },
                regen: { type: 'boolean' },
                days: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      tag: { type: 'string' },
                      einheit: { type: 'string' },
                      details: { type: 'string' },
                      optional: { type: 'boolean' },
                    },
                    required: ['tag', 'einheit', 'details', 'optional'],
                  },
                },
              },
              required: ['n', 'dateRange', 'regen', 'days'],
            },
          },
        },
        required: [
          'id',
          'label',
          'sub',
          'icon',
          'dateRange',
          'description',
          'accent',
          'light',
          'mid',
          'soft',
          'weeks',
        ],
      },
    },
  },
  required: ['title', 'goal', 'startDate', 'name', 'phases'],
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Gemeinsamer Einstieg für alle Planarten.
  // Laufen nutzt weiterhin exakt die bestehende Logik darunter.
  // Weitere Sportarten werden hier später ergänzt.
  const sportType = req.body?.sport_type || req.body?.sportType || 'running'

  if (sportType === 'hiking') {
    try {
      const result = await generateHikingPlan(req.body || {})
      return res.status(200).json(result)
    } catch (error) {
      console.error('[Generate Plan][Hiking] Erstellung fehlgeschlagen:', error)
      return res.status(500).json({
        error:
          error?.message ||
          'Der Marsch-/Wander-Trainingsplan konnte nicht erstellt werden.',
      })
    }
  }

  if (sportType === 'cycling') {
    try {
      const result = await generateCyclingPlan(req.body || {})
      return res.status(200).json(result)
    } catch (error) {
      console.error('[Generate Plan][Cycling] Erstellung fehlgeschlagen:', error)
      return res.status(500).json({
        error:
          error?.message ||
          'Der Rad-Trainingsplan konnte nicht erstellt werden.',
      })
    }
  }

  if (!['running', 'run'].includes(sportType)) {
    return res.status(400).json({
      error: `Diese Sportart wird für die Planerstellung noch nicht unterstützt: ${sportType}`,
    })
  }

  const { name, zielTyp, niveau, goal, goalTime, previousTime, startDate, weeksUntilRace, runsPerWeek, preferredDays, alter, aktuelleWochenKm, verletzungen, maxHF, ruheHF, geschlecht, wohnort } = req.body

  const zielBeschreibung = {
    rennen: 'hat ein bevorstehendes Rennen und möchte sich gezielt darauf vorbereiten',
    distanz: 'möchte eine bestimmte Distanz schaffen',
    starten: 'fängt gerade mit dem Laufen an und braucht einen sanften Einstieg',
  }[zielTyp] || 'möchte einen Trainingsplan'

  const niveauBeschreibung = {
    'Anfänger': 'Anfänger (läuft selten oder gar nicht)',
    'Fortgeschritten': 'Fortgeschrittener (läuft regelmäßig)',
    'Erfahren': 'Erfahrener Läufer (nimmt an Wettkämpfen teil)',
  }[niveau] || niveau

  const distanzInfo = goal ? `Zieldistanz: ${goal}` : 'Kein spezifisches Rennen – allgemeiner Einsteigerplan'
  const zeitInfo = goalTime || previousTime
    ? `Zielzeit: ${goalTime || 'keine'}, Bisherige Zeit: ${previousTime || 'keine'}`
    : 'Keine Zeitangabe – Fokus auf Finishen bzw. Einstieg'

  const hfMax = maxHF || (alter
    ? geschlecht === 'w'
      ? Math.round(206 - 0.88 * parseInt(alter))
      : geschlecht === 'm'
        ? Math.round(220 - parseInt(alter))
        : Math.round(208 - 0.7 * parseInt(alter))
    : null)

  // Trainingspaces berechnen
  let paceInfo = ''
  const fmt = (min) => {
    const m = Math.floor(min)
    const s = Math.round((min - m) * 60).toString().padStart(2, '0')
    return m + ':' + s
  }
  const parseTime = (timeStr) => {
    if (!timeStr) return null
    const parts = timeStr.replace('h', '').trim().split(':')
    if (parts.length === 3) return parseInt(parts[0])*60 + parseInt(parts[1]) + parseInt(parts[2])/60
    if (parts.length === 2) return parseInt(parts[0])*60 + parseInt(parts[1])
    return null
  }
  const distKm = goal === 'Marathon' ? 42.195 : goal === 'Halbmarathon' ? 21.0975 : goal === '10 km' ? 10 : 5

  const prevMin = parseTime(previousTime)
  const goalMin = parseTime(goalTime)

  // Riegel-Formel (Riegel 1977): T2 = T1 × (D2/D1)^k – sagt die Wettkampfzeit für eine
  // ANDERE Distanz aus einer bekannten Zeit voraus. Exponent leicht nach Niveau angepasst
  // (weniger trainierte Läufer:innen bauen bei zunehmender Distanz stärker ab).
  const riegelExponent = niveau === 'Erfahren' ? 1.04 : niveau === 'Anfänger' ? 1.08 : 1.06
  const predictMin = (knownMin, knownKm, targetKm) => knownMin * Math.pow(targetKm / knownKm, riegelExponent)

  if (prevMin || goalMin) {
    // Basis für Trainingspaces: bisherige Zeit bevorzugt, sonst Zielzeit.
    // Ohne bisherige Zeit ist die Zielzeit eine unbewiesene Wunschvorstellung, kein
    // echter Fitness-Datenpunkt – deshalb wird sie niveau-abhängig gedämpft, bevor sie
    // als Basis für die ALLTÄGLICHEN Trainingsbereiche (Zone 2, Tempo, Intervalle) dient.
    // Erfahrenere Läufer:innen kalibrieren Zielzeiten realistischer, daher kleinerer Abschlag.
    const sicherheitsfaktor = prevMin
      ? 1
      : (niveau === 'Erfahren' ? 1.04 : niveau === 'Anfänger' ? 1.12 : 1.08)
    const baseMin = (prevMin || goalMin) * sicherheitsfaktor
    const basePace = baseMin / distKm

    // Zielzeit für Renntempo-Einheiten
    const goalPace = goalMin ? goalMin / distKm : basePace

    // 5-km-äquivalente Pace (für Intervalle/VO2max-Reize) und Halbmarathon-äquivalente
    // Pace (für Tempodauerlauf/Schwelle) – NICHT einfach von der Zieldistanz-Pace ableiten!
    // Sonst würden z.B. bei einem Marathon-Ziel "Intervalle" nur knapp über Marathontempo
    // liegen und der eigentliche VO2max-Reiz würde komplett ausbleiben.
    const pace5k = predictMin(baseMin, distKm, 5) / 5
    const paceHm = predictMin(baseMin, distKm, 21.0975) / 21.0975

    // Zone 2: +1:20 bis +1:50 min/km zur Basis-Wettkampfpace
    const easyLow = basePace + 1.33
    const easyHigh = basePace + 1.83

    // Langer Lauf: +1:30 bis +2:00 min/km
    const longLow = basePace + 1.5
    const longHigh = basePace + 2.0

    // Tempo/Schwelle: an die HM-äquivalente Pace gekoppelt (Schwellenpace ≈ HM-Renntempo
    // ist ein etablierter Richtwert), NICHT an die Zieldistanz-Pace
    const tempoLow = paceHm - 0.05
    const tempoHigh = paceHm + 0.15

    // Intervalle: an die 5-km-äquivalente Pace gekoppelt (VO2max-Reiz), NICHT an die Zieldistanz-Pace
    const intervalLow = pace5k - 0.05
    const intervalHigh = pace5k + 0.1

    // Renntempo-Einheiten: Zielwettkampfpace
    const raceLow = goalPace - 0.1
    const raceHigh = goalPace + 0.2

    const basisText = prevMin
      ? `bisherige Zeit (${previousTime})`
      : `Zielzeit (${goalTime}) – da keine bisherige Zeit angegeben`

    const zielText = goalMin && prevMin
      ? `
- Renntempo-Einheiten (Zielzeit ${goalTime}): ${fmt(raceLow)}-${fmt(raceHigh)} min/km`
      : ''

    paceInfo = `
BERECHNETE TRAININGSPACES (Basis: ${basisText}, Wettkampfpace: ${fmt(basePace)} min/km):
- Zone 2 / Lockerer Lauf: ${fmt(easyLow)}-${fmt(easyHigh)} min/km (+1:20 bis +1:50 zur Wettkampfpace)
- Langer Lauf: ${fmt(longLow)}-${fmt(longHigh)} min/km (immer langsamer als lockere Läufe)
- Tempodauerlauf/Schwelle: ${fmt(tempoLow)}-${fmt(tempoHigh)} min/km (entspricht der halbmarathon-äquivalenten Renntempo, per Riegel-Formel aus der Zielzeit hochgerechnet)
- Intervalle: ${fmt(intervalLow)}-${fmt(intervalHigh)} min/km (entspricht der 5-km-äquivalenten Renntempo, per Riegel-Formel aus der Zielzeit hochgerechnet – deutlich schneller als die Zieldistanz-Pace bei HM/Marathon-Zielen!)${zielText}

WICHTIG:
- Zone 2 ist IMMER deutlich langsamer als Wettkampfpace – das fühlt sich zu langsam an, ist aber korrekt!
- Langer Lauf ist IMMER langsamer als die lockeren Läufe
- Intervalle sind bei HM-/Marathon-Zielen SPÜRBAR SCHNELLER als die Zieldistanz-Wettkampfpace – das ist beabsichtigt (VO2max-Training), NICHT anpassen!
- Renntempo-Einheiten erst in der spezifischen Phase einführen`
  }

  const ruheHFNum = ruheHF ? parseInt(ruheHF) : null

  // Karvonen-Methode (Herzfrequenzreserve): Zielwert = (HFmax - Ruhe-HF) × Intensität + Ruhe-HF.
  // Präziser als reine %HFmax-Zonen, weil sie die individuelle Fitness (niedrige Ruhe-HF bei
  // gut Trainierten) mit einbezieht. Nur nutzbar, wenn beide Werte vorliegen - sonst Fallback
  // auf die einfache %HFmax-Methode.
  const karvonenZone = (pct) => Math.round((hfMax - ruheHFNum) * pct + ruheHFNum)

  const hfInfo = hfMax
    ? (ruheHFNum
        ? `Maximale Herzfrequenz: ${hfMax} bpm, Ruhe-Herzfrequenz: ${ruheHFNum} bpm (Herzfrequenzreserve-Methode/Karvonen genutzt - präziser als reine %HFmax-Zonen). Zone 1: <${karvonenZone(0.6)} bpm, Zone 2: ${karvonenZone(0.6)}-${karvonenZone(0.7)} bpm, Zone 3: ${karvonenZone(0.7)}-${karvonenZone(0.8)} bpm, Zone 4: ${karvonenZone(0.8)}-${karvonenZone(0.9)} bpm, Zone 5: >${karvonenZone(0.9)} bpm`
        : `Maximale Herzfrequenz: ${hfMax} bpm (keine Ruhe-HF angegeben, einfache %HFmax-Methode). Zone 1: <${Math.round(hfMax*0.6)} bpm, Zone 2: ${Math.round(hfMax*0.6)}-${Math.round(hfMax*0.7)} bpm, Zone 3: ${Math.round(hfMax*0.7)}-${Math.round(hfMax*0.8)} bpm, Zone 4: ${Math.round(hfMax*0.8)}-${Math.round(hfMax*0.9)} bpm, Zone 5: >${Math.round(hfMax*0.9)} bpm`)
    : 'Keine HF-Angabe – Pace und Gefühlsangaben nutzen (Unterhaltungstempo für Zone 2)'

  const geschlechtInfo = geschlecht === 'w' ? 'Weiblich' : geschlecht === 'm' ? 'Männlich' : 'Divers/nicht angegeben'
  const verletzungsInfo = verletzungen ? `Verletzungsgeschichte: ${verletzungen} – bitte besonders vorsichtig steigern und extra Regeneration einplanen` : 'Keine bekannten Verletzungen'
  const umfangInfo = aktuelleWochenKm ? `Aktuelle Wochenkilometer: ${aktuelleWochenKm} km – davon ausgehend steigern` : 'Ausgangsumfang unbekannt – konservativ starten'

  const selectedDays = Array.isArray(preferredDays) && preferredDays.length
    ? preferredDays
    : ({ 3: ['Di','Do','So'], 4: ['Di','Do','Sa','So'], 5: ['Di','Mi','Do','Sa','So'] }[runsPerWeek] || ['Di','Do','So'])

  const wochenstruktur = `
AUSGEWÄHLTE TRAININGSTAGE: ${selectedDays.join(', ')}.
- Nutze für alle Pflicht-Laufeinheiten ausschließlich diese Tage.
- Die Anzahl der Pflicht-Laufeinheiten pro Woche beträgt exakt ${runsPerWeek}.
- Verteile Qualität, lockere Läufe und langen Lauf trainingsphysiologisch sinnvoll auf diese Tage.
- Intensive Einheiten möglichst nicht direkt hintereinander.
- Der lange Lauf soll ausreichend Abstand zur wichtigsten Qualitätseinheit haben, soweit die ausgewählten Tage das zulassen.
- Wenn die Tagesauswahl enge Folgen erzwingt (z.B. Fr/Sa/So), reduziere die Intensität angrenzender Läufe, statt mehrere harte Reize aneinanderzureihen.
- Erfinde keine zusätzlichen Pflicht-Lauftage außerhalb der ausgewählten Tage.
- Optionale Kraft-/Mobilitätseinheiten dürfen nur als optional=true ausgegeben werden und müssen nicht auf einen ausgewählten Lauftag fallen.`

  // Rennstrategie berechnen
  const rennstrategie = goalTime
    ? (() => {
        const parts = goalTime.split(':')
        const totalMin = parts.length === 3
          ? parseInt(parts[0])*60 + parseInt(parts[1]) + parseInt(parts[2])/60
          : parseInt(parts[0])*60 + parseInt(parts[1])
        const distanzKm = goal === 'Marathon' ? 42.195 : goal === 'Halbmarathon' ? 21.0975 : goal === '10 km' ? 10 : 5
        const paceMin = totalMin / distanzKm
        const paceM = Math.floor(paceMin)
        const paceS = Math.round((paceMin - paceM) * 60).toString().padStart(2,'0')
        const ersteHaelfte = Math.round(paceMin * 1.03 * 10) / 10
        const ersteM = Math.floor(ersteHaelfte)
        const ersteS = Math.round((ersteHaelfte - ersteM) * 60).toString().padStart(2,'0')
        return `Zielpace: ${paceM}:${paceS} min/km. Strategie: Erste Hälfte ca. 3% langsamer (${ersteM}:${ersteS} min/km), zweite Hälfte auf Zielpace oder schneller – negatives Splitting.`
      })()
    : 'Keine Zielzeit – Rennstrategie: Erste 3 km sehr konservativ, dann nach Gefühl steigern.'

  // Verpflegungs-/Hydrationsstrategie für den Renntag, distanzabhängig berechnet
  const renntagFueling = goal === 'Marathon'
    ? 'Ab ca. 45 Min alle 20-25 Min 20-30g Kohlenhydrate (Gel/Riegel/Sportgetränk), insgesamt 60-90g KH/Stunde anstreben. An jedem Verpflegungsstand trinken, bei Hitze zusätzlich Elektrolyte. Verpflegungsstrategie UNBEDINGT vorher in den langen Läufen exakt getestet haben – nichts Neues am Renntag ausprobieren!'
    : goal === 'Halbmarathon'
      ? 'Nach ca. 45-60 Min 1 Gel/Riegel (~25-30g KH), danach je nach Bedarf alle 30-40 Min. An Verpflegungsständen in kleinen Schlucken trinken. Verpflegungsstrategie vorher im Training testen – nichts Neues am Renntag ausprobieren!'
      : 'Bei dieser Distanz meist keine Verpflegung während des Rennens nötig. 2-3 Std. vorher letzte kohlenhydratreiche Mahlzeit, ab 60 Min vorher nur noch trinken.'

  const carbLoadingHinweis = (goal === 'Marathon' || goal === 'Halbmarathon')
    ? 'In den letzten 2 Tagen vor dem Rennen: bewusst kohlenhydratreicher essen (Nudeln, Reis, Brot), dabei Ballaststoffe und Fett etwas reduzieren, um am Renntag Magen-Darm-Probleme zu vermeiden.'
    : null

  const concreteTempoInstruction = (prevMin || goalMin)
    ? `TEMPOEINHEITEN: Wenn du eine Tempo-/Schwelleneinheit planst, MUSS im Hauptteil die konkrete berechnete Pace-Spanne ${fmt(tempoLow)}-${fmt(tempoHigh)} min/km stehen. Formulierungen wie "etwas zügiger", "zügiger als gewohnt" oder "kontrolliert schneller" dürfen nur ERGÄNZEND zur Pace stehen, niemals anstelle der Pace.`
    : 'TEMPOEINHEITEN: Da keine verlässliche bisherige Zeit oder Zielzeit vorliegt, keine Pace erfinden. Tempo über verständliches Belastungsgefühl und ggf. vorhandene HF-Zonen steuern.'

  const concreteRacePaceInstruction = goalMin
    ? `RENNTEMPO: Jede Einheit mit "Renntempo", "Wettkampftempo", "HM-Pace", "10-km-Pace", "Marathon-Pace" oder vergleichbarer Bezeichnung MUSS die konkrete Zielpace ca. ${fmt(raceLow)}-${fmt(raceHigh)} min/km direkt im Hauptteil nennen. Niemals nur "im geplanten Renntempo" schreiben.`
    : prevMin
      ? 'RENNTEMPO: Es wurde keine Zielzeit angegeben. Bezeichne keine Pace als festes Ziel-Renntempo. Nutze stattdessen eine spezifische kontrollierte Einheit auf Basis der aktuellen Leistungsdaten.'
      : 'RENNTEMPO: Ohne Zielzeit und ohne bisherige Zeit keine konkrete Renntempo-Pace erfinden.'

  const systemPrompt = `Du bist ein professioneller Lauftrainer mit tiefem Wissen in Sportphysiologie, Periodisierung und Verletzungsprävention. Erstelle einen wissenschaftlich fundierten, personalisierten Trainingsplan als JSON.

Antworte NUR mit validem JSON, kein Markdown, keine Erklärungen.

Das JSON muss exakt diesem Schema folgen:
{
  "title": "16-Wochen Trainingsplan",
  "goal": "Halbmarathon finishen",
  "startDate": "2026-06-08",
  "name": "Julia",
  "phases": [
    {
      "id": "basis",
      "label": "Basisphase",
      "sub": "Wo. 1–4",
      "icon": "🌱",
      "dateRange": "8. Jun – 5. Jul",
      "description": "Kurze Beschreibung der Phase",
      "accent": "#059669",
      "light": "#ecfdf5",
      "mid": "#a7f3d0",
      "soft": "#d1fae5",
      "weeks": [
        {
          "n": 1,
          "dateRange": "08.06. – 14.06.",
          "regen": false,
          "days": [
            { "tag": "Di", "einheit": "Locker + Strides", "details": "35 min Zone 2 (Unterhaltungstempo) + 6×80m Strides locker – Ziel: Laufökonomie & aerobe Basis", "optional": false },
            { "tag": "Do", "einheit": "Locker", "details": "30 min Zone 2 – Ziel: aktive Erholung & Fettstoffwechsel", "optional": false },
            { "tag": "Sa", "einheit": "Langer Lauf", "details": "12 km Zone 2 – Ziel: Grundlagenausdauer aufbauen, nie schneller als Unterhaltungstempo", "optional": false },
            { "tag": "So", "einheit": "Kraft & Mobilität", "details": "20 min: Einbeinige Kniebeugen 3×10, Calf Raises 3×15, Hüftkreisen, Ausfallschritte – optional", "optional": true }
          ]
        }
      ]
    }
  ]
}

Farben pro Phase:
- Basisphase: accent #059669, light #ecfdf5, mid #a7f3d0, soft #d1fae5
- Entwicklung: accent #d97706, light #fffbeb, mid #fcd34d, soft #fef3c7
- Spezifisch: accent #e11d48, light #fff1f2, mid #fda4af, soft #ffe4e6
- Tapering: accent #7c3aed, light #f5f3ff, mid #c4b5fd, soft #ede9fe

═══════════════════════════════════════
PHASENSPEZIFISCHE PERIODISIERUNG
═══════════════════════════════════════

BASISPHASE:
- Anfänger: erste 35-40% der Wochen, ausschließlich Zone 1-2
- Fortgeschritten: erste 20-25% der Wochen (bei 12 Wochen = Wo. 1-3, bei 16 Wochen = Wo. 1-4)
- Erfahren: erste 15-20% der Wochen (bei 16 Wochen = Wo. 1-3)
- Inhalte: Zone 1-2, Strides, Kräftigung, kein Tempo
- Umfang langsam steigern (max. 10% pro Woche)

ENTWICKLUNGSPHASE:
- Startet direkt nach der Basisphase!
- Anfänger: erste kurze Intervalle Zone 3 (2-3 min), keine Pace-Angaben
- Fortgeschritten: klassische Intervalle Zone 4 (4-6×3-5 min mit Pace), Tempodauerläufe 20-30 min
- Erfahren: komplexe Intervalle (Pyramiden, Leiterläufe), längere Tempoläufe 30-40 min
- Langer Lauf steigt auf 70-80% der Renndistanz
- Strides weiterhin nach lockeren Läufen

HM-SPEZIFISCHE PHASE (nächste 25% der Wochen):
- Renntempo-Intervalle (HM-Pace, Zone 4)
- Längere Tempodauerläufe (35-45 min)
- Langer Lauf erreicht 90-100% der Renndistanz
- Rennstrategie vorbereiten

TAPERING (letzte 2-3 Wochen):
- Umfang um 30-40% reduzieren, Intensität BEIBEHALTEN
- Kurze scharfe Einheiten um Beine frisch zu halten
- 1 Woche vor Rennen: Rennstrategie-Analyse in der Details-Beschreibung: "${rennstrategie}"
- 1 Woche vor Rennen: Verpflegungs-/Hydrationsstrategie ebenfalls in die Renntag-Vorbereitung einbauen: "${renntagFueling}"${carbLoadingHinweis ? `
- 2 Tage vor Rennen: Carb-Loading-Hinweis in die Details der jeweiligen Einheit einbauen: "${carbLoadingHinweis}"` : ''}
- Letzte 3 Tage: nur sehr lockere kurze Läufe oder Pause

═══════════════════════════════════════
TRAININGSPHILOSOPHIE – STRIKT EINHALTEN
═══════════════════════════════════════

0. PACE-VORGABEN STRIKT EINHALTEN: Nutze die berechneten Trainingspaces exakt – Zone 2 ist IMMER deutlich langsamer als die Wettkampfpace. Nie schneller als angegeben für lockere Läufe! Die Intervall- und Tempopace sind bewusst NICHT von der Zieldistanz-Pace abgeleitet, sondern von der 5-km- bzw. Halbmarathon-äquivalenten Pace – bei HM-/Marathon-Zielen sind Intervalle daher deutlich schneller als die Zieldistanz-Wettkampfpace. Das ist korrekt so, nicht anpassen!
   ${concreteTempoInstruction}
   ${concreteRacePaceInstruction}
   WICHTIG ZUR DARSTELLUNG: Eine konkrete Pace gehört in die Details des jeweiligen Hauptteils. Der Nutzer soll die Einheit ohne eigenes Umrechnen direkt ausführen können.${hfMax ? `
   HF-ZONEN IN DEN DETAILS: Da HF-Zonen berechnet wurden (siehe unten), schreibe bei JEDER Einheit mit einer Zone-Angabe (Zone 1-5) IMMER Pace UND HF-Bereich zusammen in die Klammer, Format "Zone X (Pace-Bereich min/km, HF-Bereich bpm)". Beispiel: "Zone 2 (7:44-8:14 min/km, 129-143 bpm)" statt nur "Zone 2 (7:44-8:14 min/km)". Nutze exakt die unten berechneten HF-Zonengrenzen, nicht selbst schätzen.` : ''}

1. 80/20 REGEL: 80% Zone 1-2, maximal 20% Zone 4-5. Keine Zone 3 als eigenständige Einheit.

2. KEINE AUFEINANDERFOLGENDEN HARTEN TAGE: Zwischen Intervallen/Tempo immer mindestens 1 lockerer Tag.

3. WOCHENSTRUKTUR: ${wochenstruktur}

4. LANGER LAUF: Immer Zone 2, immer langsamster Lauf der Woche.

5. 10%-REGEL: Wochenumfang nie mehr als 10% steigern.

6. REGENERATIONSWOCHEN: Alle 3-4 Wochen, Umfang -20-30%, keine harten Einheiten (regen: true).
   PLATZIERUNG – STRIKT EINHALTEN: Eine Regenerationswoche darf NIEMALS die erste Woche einer neuen Phase sein! Jede neue Phase muss in Woche 1 sofort mit ihrem vollen, phasentypischen Trainingsreiz beginnen (z.B. Entwicklungsphase Woche 1 = erste echte Intervalle, nicht Zone 2; Spezifische Phase Woche 1 = erste Renntempo-Einheit, nicht Zone 2). Fällt der 3-4-Wochen-Rhythmus rechnerisch auf den Beginn einer neuen Phase, verschiebe die Regenerationswoche stattdessen auf die LETZTE Woche der VORHERIGEN Phase – so schließt die alte Phase erholt ab und die neue Phase startet frisch und sofort intensiv. Prüfe vor der Ausgabe: Ist bei irgendeiner Phase week.n === 1 gleichzeitig regen === true? Falls ja, korrigieren!

7. EINLAUFEN/AUSLAUFEN PFLICHT: Bei allen Intervall- und Tempoeinheiten immer "10-15 min einlaufen + [Hauptteil] + 10 min auslaufen" in den Details.

8. STRIDES: Nach 1-2 lockeren Läufen pro Woche 4-8×80-100m locker-flotte Strides am ENDE des Laufs (keine Sprints). Formulierung immer so: 'X min locker laufen, danach am Ende Y×80m Strides locker-flott mit je 90 Sek. Gehpause' – so ist klar dass die Strides nach dem lockeren Teil kommen!

9. KRÄFTIGUNG (optional): 1× pro Woche als optionale Einheit: Einbeinige Kniebeugen, Calf Raises, Hüftstabilisation, Ausfallschritte.

10. WARM-UP/COOL-DOWN HINWEIS: In Details bei Intervallen und Tempoläufen immer erwähnen.

11. ANFÄNGER-SPEZIFISCH: Laufen/Gehen-Intervalle in Woche 1-4 (z.B. "3 min laufen, 2 min gehen × 6"). Keine Pace-Angaben, nur Zeitangaben und Gefühlsangaben.

12. RENNSTRATEGIE: In der letzten Woche vor dem Renntag in der Einheit "Renntag-Vorbereitung" die konkrete Strategie einbauen: "${rennstrategie}" Zusätzlich die Verpflegungs-/Hydrationsstrategie ergänzen: "${renntagFueling}"${carbLoadingHinweis ? ` Außerdem 2 Tage vorher einen Carb-Loading-Hinweis einbauen: "${carbLoadingHinweis}"` : ''}

13. KEINE FAHRTSPIELE – nur Intervalle oder Tempodauerläufe.

14. VERLETZUNGSPRÄVENTION: Bei bekannten Verletzungen extra Ruhetage, Kräftigung betonen, langsamer steigern.

15. JEDE EINHEIT hat einen Zweck in den Details (z.B. "Ziel: Fettstoffwechsel trainieren").

16. EINHEITEN-FORMAT – STRIKT EINHALTEN, KEINE AUSNAHMEN:
- Lockere Läufe & Regeneration: immer in MINUTEN (z.B. "35 min Zone 2")
- Langer Lauf: immer in KM (z.B. "14 km Zone 2")
- Intervalle: IMMER in KM oder METERN – NIEMALS in Minuten!
  ✅ Richtig: "6×1 km Zone 4", "8×400m Zone 4", "5×800m Zone 4"
  ❌ Falsch: "5×3 min Zone 4", "6×4 min Zone 4" – VERBOTEN!
- Tempodauerläufe: in KM (z.B. "8 km Tempodauerlauf Zone 3-4")
- Renntempo-Einheiten: in KM (z.B. "3×3 km HM-Pace", "4×2 km Renntempo")
- Aufwärmen/Auslaufen: immer in MINUTEN (z.B. "10 min einlaufen Zone 2")
- Strides: immer in METERN (z.B. "6×80m Strides")

MERKE: Nur lockere Läufe und Aufwärmen/Auslaufen in Minuten – alles andere in km oder Metern!

17. VERPFLEGUNG BEI LANGEN LÄUFEN: Bei jedem "Langer Lauf" ab 12 km bzw. ab ca. 75 Minuten IMMER einen kurzen Verpflegungs-/Hydrationshinweis ans Ende der Details anhängen, z.B. "Ab 60 Min: alle 20-25 Min ca. 20-30g Kohlenhydrate (Gel/Riegel) + regelmäßig trinken (150-250ml alle 15-20 Min)". Bei kürzeren Läufen (unter 12 km) NICHT nötig, da unnötige Zusatzinfo die Details überladen würde. Dient auch dazu, die Renntag-Verpflegungsstrategie vorher im Training zu testen.

═══════════════════════════════════════
NIVEAU-SPEZIFISCHE ANPASSUNGEN
═══════════════════════════════════════

ANFÄNGER & FORTGESCHRITTEN – ähnliche Struktur, aber unterschiedliche Intensität:

Basisphase (beide):
- Zone 1-2, lockere Läufe, Strides, Kräftigung
- Fortgeschritten: durchgehende lockere Läufe mit Pace-Angaben
- Anfänger: Laufen/Gehen-Wechsel abhängig vom Ausgangsumfang:
  - 0 km/Woche (noch nie gelaufen): 4-5 Wochen Laufen/Gehen (z.B. 2 min laufen, 2 min gehen, progressiv steigern)
  - 1-10 km/Woche (gelegentlich): 2-3 Wochen Laufen/Gehen, dann durchgehend
  - 10+ km/Woche (läuft schon aber Anfänger-Niveau): 1 Woche Laufen/Gehen oder direkt durchgehend locker
  - Keine Angabe: konservativ, 3 Wochen Laufen/Gehen
  - Keine Pace-Angaben bei Anfänger, nur Zeit und Gefühl ("etwas schneller als normal")

Entwicklungsphase (beide):
- Intervalle werden eingeführt – Progression ist PFLICHT, nie sofort mit langen Intervallen starten!

ANFÄNGER Intervall-Progression:
- Erste Intervallwoche: 4×300m Zone 3 (etwas schneller als normal, kein genaues Tempo)
- Zweite Intervallwoche: 5×300m oder 4×400m Zone 3
- Danach: 4-5×400m Zone 3
- Keine Pace-Angaben, nur Gefühl ("etwas schneller als Unterhaltungstempo")

FORTGESCHRITTEN Intervall-Progression:
- Erste Intervallwoche: 4×800m Zone 4 (NICHT mehr als 4 Wiederholungen!)
- Zweite Intervallwoche: 5×800m Zone 4
- Dritte Intervallwoche: 4×1 km Zone 4
- Danach: 5×1 km oder 6×800m Zone 4
- Immer mit Pace-Angaben

ERFAHREN Intervall-Progression:
- Erste Intervallwoche: 5×1 km Zone 4
- Danach: 6×1 km, Pyramiden, Leiterläufe

- Tempodauerläufe:
  - Anfänger: 15-20 min "etwas zügiger als gewohnt", keine Pace
  - Fortgeschritten: 5-8 km mit Pace-Angabe, progressiv steigern
  - Erfahren: 8-12 km mit Pace-Angabe

Spezifische Phase (beide):
- Anfänger: erste Renntempo-Einheiten sehr kurz (2-3×5 min), Fokus auf Finishen
- Fortgeschritten: längere Renntempo-Intervalle (3-4×10 min), Renntempo etablieren

Tapering (beide):
- Gleiche Struktur, Umfang reduzieren, kurze Qualitätseinheiten beibehalten

ERFAHREN – eigene Periodisierung:

Basisphase (kürzer, 20-25% des Plans):
- Zone 1-2 Basis, aber aerobe Grundlage bereits vorhanden
- Strides und leichte Tempoläufe schon in Woche 2-3 erlaubt
- Kurze Intervalle (4×2 min Zone 4) bereits möglich
- Höhere Gesamtkilometer von Anfang an

Entwicklungsphase:
- Komplexe Intervallstrukturen (Pyramiden: 1-2-3-2-1 min, Leiterläufe)
- Längere Intervalle (6-8×1 km Zone 4-5)
- Längere Tempodauerläufe (35-45 min Zone 4)
- Mehr Qualitätseinheiten pro Woche

Spezifische Phase:
- Renntempo-Einheiten dominant und häufig
- Lange Renntempo-Blöcke (2×6 km, 3×5 km)
- Rennsimulatoren (letzter langer Lauf teilweise in Renntempo)

Tapering:
- Kürzer als bei Anfänger/Fortgeschritten (nur 1-2 Wochen)
- Intensität bleibt hoch, Umfang stark reduziert`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        // Lange Pläne (z. B. 20–25 Wochen) brauchen mehr Ausgaberaum.
        // Structured Output verhindert syntaktisch kaputtes JSON.
        max_tokens: 14000,
        system: systemPrompt,
        output_config: {
          format: {
            type: 'json_schema',
            schema: RUNNING_PLAN_SCHEMA,
          },
        },
        messages: [{
          role: 'user',
          content: `Erstelle einen ${weeksUntilRace}-wöchigen Trainingsplan.
Name: ${name || 'Läufer/in'} (wird automatisch aus dem Profil übernommen)
${paceInfo}
Geschlecht: ${geschlechtInfo}
Niveau: ${niveauBeschreibung}
Ziel: ${name || 'die Person'} ${zielBeschreibung}
${distanzInfo}
${zeitInfo}
${hfInfo}
${umfangInfo}
${verletzungsInfo}
Läufe pro Woche: ${runsPerWeek}
Bevorzugte Lauftage: ${selectedDays.join(', ')}
Startdatum: ${startDate}
Wohnort: ${wohnort || 'nicht angegeben'}

WICHTIG FÜR DIE AUSGABE:
- Gib exakt ${weeksUntilRace} Wochen zurück.
- Jede normale Laufeinheit hat optional=false.
- Nur echte optionale Zusatz-/Krafteinheiten haben optional=true.
- Jede Woche enthält regen=true nur wenn es sich um eine geplante Entlastungswoche handelt, sonst regen=false.
- Formuliere Details kompakt und konkret; vermeide Wiederholungen.
- Bei Tempoeinheiten mit vorhandener Zeitbasis die berechnete Tempo-Pace immer konkret nennen.
- Bei Renntempoeinheiten mit Zielzeit die konkrete Zielpace immer direkt nennen; niemals nur "im Renntempo".`
        }]
      })
    })

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API Fehler' })

    if (data.stop_reason === 'max_tokens') {
      console.error('[Generate Plan][Running] Ausgabe wurde wegen Tokenlimit beendet.')
      return res.status(500).json({
        error: 'Der Trainingsplan war für die Ausgabe zu umfangreich. Bitte erneut versuchen.',
      })
    }

    const responseText = data?.content?.find(item => item?.type === 'text')?.text
    if (!responseText) {
      return res.status(500).json({ error: 'Es wurde kein Trainingsplan zurückgegeben.' })
    }

    const plan = JSON.parse(responseText)
    const generatedWeeks = (plan?.phases || []).flatMap(phase => phase?.weeks || [])

    for (const week of generatedWeeks) {
      const requiredDays = (week?.days || []).filter(day => !day.optional)

      if (requiredDays.length !== Number(runsPerWeek)) {
        return res.status(500).json({
          error: `Woche ${week?.n ?? '?'} enthält ${requiredDays.length} statt ${runsPerWeek} Pflichtläufe.`,
        })
      }

      const invalidDay = requiredDays.find(day => !selectedDays.includes(day.tag))
      if (invalidDay) {
        return res.status(500).json({
          error: `Woche ${week?.n ?? '?'} nutzt mit ${invalidDay.tag} einen nicht ausgewählten Lauftag.`,
        })
      }
    }

    if (generatedWeeks.length !== Number(weeksUntilRace)) {
      console.error(
        `[Generate Plan][Running] ${generatedWeeks.length} statt ${weeksUntilRace} Wochen erhalten.`
      )
      return res.status(500).json({
        error: `Der Trainingsplan wurde unvollständig erstellt (${generatedWeeks.length}/${weeksUntilRace} Wochen). Bitte erneut versuchen.`,
      })
    }

    res.status(200).json({ plan })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
