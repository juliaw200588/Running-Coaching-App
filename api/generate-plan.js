export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, zielTyp, niveau, goal, goalTime, previousTime, startDate, weeksUntilRace, runsPerWeek, alter, aktuelleWochenKm, verletzungen, maxHF, geschlecht, wohnort } = req.body

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

  const hfInfo = hfMax
    ? `Maximale Herzfrequenz: ${hfMax} bpm. Zone 1: <${Math.round(hfMax*0.6)} bpm, Zone 2: ${Math.round(hfMax*0.6)}-${Math.round(hfMax*0.7)} bpm, Zone 3: ${Math.round(hfMax*0.7)}-${Math.round(hfMax*0.8)} bpm, Zone 4: ${Math.round(hfMax*0.8)}-${Math.round(hfMax*0.9)} bpm, Zone 5: >${Math.round(hfMax*0.9)} bpm`
    : 'Keine HF-Angabe – Pace und Gefühlsangaben nutzen (Unterhaltungstempo für Zone 2)'

  const geschlechtInfo = geschlecht === 'w' ? 'Weiblich' : geschlecht === 'm' ? 'Männlich' : 'Divers/nicht angegeben'
  const verletzungsInfo = verletzungen ? `Verletzungsgeschichte: ${verletzungen} – bitte besonders vorsichtig steigern und extra Regeneration einplanen` : 'Keine bekannten Verletzungen'
  const umfangInfo = aktuelleWochenKm ? `Aktuelle Wochenkilometer: ${aktuelleWochenKm} km – davon ausgehend steigern` : 'Ausgangsumfang unbekannt – konservativ starten'

  const wochenstruktur = {
    3: 'Di=Qualität (Intervalle/Tempo), Do=Locker (Zone 2), Sa=Langer Lauf (Zone 2)',
    4: 'Di=Qualität, Mi=Locker (Zone 2), Fr=Qualität, Sa=Langer Lauf (Zone 2)',
    5: 'Di=Qualität, Mi=Locker, Do=Qualität, Sa=Langer Lauf, So=Sehr locker (Zone 1)',
  }[runsPerWeek] || 'Di=Qualität, Do=Locker, Sa=Langer Lauf'

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
          "days": [
            { "tag": "Di", "einheit": "Locker + Strides", "details": "35 min Zone 2 (Unterhaltungstempo) + 6×80m Strides locker – Ziel: Laufökonomie & aerobe Basis" },
            { "tag": "Do", "einheit": "Locker", "details": "30 min Zone 2 – Ziel: aktive Erholung & Fettstoffwechsel" },
            { "tag": "Sa", "einheit": "Langer Lauf", "details": "12 km Zone 2 – Ziel: Grundlagenausdauer aufbauen, nie schneller als Unterhaltungstempo" },
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
- Letzte 3 Tage: nur sehr lockere kurze Läufe oder Pause

═══════════════════════════════════════
TRAININGSPHILOSOPHIE – STRIKT EINHALTEN
═══════════════════════════════════════

0. PACE-VORGABEN STRIKT EINHALTEN: Nutze die berechneten Trainingspaces exakt – Zone 2 ist IMMER deutlich langsamer als die Wettkampfpace. Nie schneller als angegeben für lockere Läufe! Die Intervall- und Tempopace sind bewusst NICHT von der Zieldistanz-Pace abgeleitet, sondern von der 5-km- bzw. Halbmarathon-äquivalenten Pace – bei HM-/Marathon-Zielen sind Intervalle daher deutlich schneller als die Zieldistanz-Wettkampfpace. Das ist korrekt so, nicht anpassen!

1. 80/20 REGEL: 80% Zone 1-2, maximal 20% Zone 4-5. Keine Zone 3 als eigenständige Einheit.

2. KEINE AUFEINANDERFOLGENDEN HARTEN TAGE: Zwischen Intervallen/Tempo immer mindestens 1 lockerer Tag.

3. WOCHENSTRUKTUR: ${wochenstruktur}

4. LANGER LAUF: Immer Zone 2, immer langsamster Lauf der Woche.

5. 10%-REGEL: Wochenumfang nie mehr als 10% steigern.

6. REGENERATIONSWOCHEN: Alle 3-4 Wochen, Umfang -20-30%, keine harten Einheiten (regen: true).

7. EINLAUFEN/AUSLAUFEN PFLICHT: Bei allen Intervall- und Tempoeinheiten immer "10-15 min einlaufen + [Hauptteil] + 10 min auslaufen" in den Details.

8. STRIDES: Nach 1-2 lockeren Läufen pro Woche 4-8×80-100m locker-flotte Strides am ENDE des Laufs (keine Sprints). Formulierung immer so: 'X min locker laufen, danach am Ende Y×80m Strides locker-flott mit je 90 Sek. Gehpause' – so ist klar dass die Strides nach dem lockeren Teil kommen!

9. KRÄFTIGUNG (optional): 1× pro Woche als optionale Einheit: Einbeinige Kniebeugen, Calf Raises, Hüftstabilisation, Ausfallschritte.

10. WARM-UP/COOL-DOWN HINWEIS: In Details bei Intervallen und Tempoläufen immer erwähnen.

11. ANFÄNGER-SPEZIFISCH: Laufen/Gehen-Intervalle in Woche 1-4 (z.B. "3 min laufen, 2 min gehen × 6"). Keine Pace-Angaben, nur Zeitangaben und Gefühlsangaben.

12. RENNSTRATEGIE: In der letzten Woche vor dem Renntag in der Einheit "Renntag-Vorbereitung" die konkrete Strategie einbauen: "${rennstrategie}"

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
        max_tokens: 8000,
        system: systemPrompt,
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
Startdatum: ${startDate}
Wohnort: ${wohnort || 'nicht angegeben'}`
        }]
      })
    })

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API Fehler' })

    const text = data.content[0].text
    const clean = text.replace(/```json|```/g, '').trim()
    const plan = JSON.parse(clean)

    res.status(200).json({ plan })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
