import { buildCyclingPlanGuardrails } from './cyclingPlanGenerator.js'

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    goal: { type: 'string' },
    sport_type: { type: 'string' },
    plan_type: { type: 'string' },
    startDate: { type: 'string' },
    goalDate: { type: ['string', 'null'] },
    weeksUntilRace: { type: 'integer' },
    unitsPerWeek: { type: 'integer' },
    planCaution: { type: ['string', 'null'] },
    event: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            date: { type: ['string', 'null'] },
            distanceKm: { type: ['number', 'null'] },
            details: { type: 'string' },
          },
          required: ['title','date','distanceKm','details'],
        },
      ],
    },
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
          accent: { type: 'string' },
          description: { type: 'string' },
          weeks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                n: { type: 'integer' },
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
                      durationMinutes: { type: ['integer', 'null'] },
                      intensity: { type: ['string', 'null'] },
                      loadGuidance: { type: ['string', 'null'] },
                      distanceGuidance: { type: ['string', 'null'] },
                      nutritionTip: { type: ['string', 'null'] },
                      strengthPrescription: { type: ['string', 'null'] },
                      optional: { type: 'boolean' },
                      sport_type: { type: 'string' },
                    },
                    required: [
                      'tag',
                      'einheit',
                      'details',
                      'durationMinutes',
                      'intensity',
                      'loadGuidance',
                      'distanceGuidance',
                      'nutritionTip',
                      'strengthPrescription',
                      'optional',
                      'sport_type',
                    ],
                  },
                },
              },
              required: ['n','regen','days'],
            },
          },
        },
        required: ['id','label','sub','icon','accent','description','weeks'],
      },
    },
  },
  required: [
    'title',
    'goal',
    'sport_type',
    'plan_type',
    'startDate',
    'goalDate',
    'weeksUntilRace',
    'unitsPerWeek',
    'planCaution',
    'event',
    'phases',
  ],
}

const safeNumber = value => {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const normalizeDay = value => {
  const raw = String(value || '').trim().toLowerCase()
  const map = {
    mo:'Mo', montag:'Mo',
    di:'Di', dienstag:'Di',
    mi:'Mi', mittwoch:'Mi',
    do:'Do', donnerstag:'Do',
    fr:'Fr', freitag:'Fr',
    sa:'Sa', samstag:'Sa',
    so:'So', sonntag:'So',
  }
  return map[raw] || value
}

const sanitizeInput = body => ({
  name: String(body?.name || '').slice(0,80),
  goalType: body?.goalType || '',
  bikeType: body?.bikeType || 'road',
  level: body?.level || '',
  targetDistanceKm: safeNumber(body?.targetDistanceKm),
  eventDate: body?.eventDate || null,
  tourName: String(body?.tourName || '').slice(0,120),
  tourTotalKm: safeNumber(body?.tourTotalKm),
  tourDays: safeNumber(body?.tourDays),
  longestStageKm: safeNumber(body?.longestStageKm),
  targetTerrain: body?.targetTerrain || 'mixed',

  currentFrequency: body?.currentFrequency || '',
  currentWeeklyHours: safeNumber(body?.currentWeeklyHours),
  currentWeeklyKm: safeNumber(body?.currentWeeklyKm),
  longestRecentHours: safeNumber(body?.longestRecentHours),
  longestRecentKm: safeNumber(body?.longestRecentKm),
  trainingTerrain: body?.trainingTerrain || 'flat',
  indoorTrainer: body?.indoorTrainer || 'no',
  strengthTraining: body?.strengthTraining === 'yes' ? 'yes' : 'no',

  alter: safeNumber(body?.alter),
  maxHF: safeNumber(body?.maxHF),
  ruheHF: safeNumber(body?.ruheHF),
  ftp: safeNumber(body?.ftp),

  considerations: String(body?.considerations || '').slice(0,600),
  startDate: body?.startDate || '',
  weeksUntilGoal: safeNumber(body?.weeksUntilGoal),
  availableWeeks: safeNumber(body?.availableWeeks),
  unitsPerWeek: safeNumber(body?.unitsPerWeek),
  preferredDays: Array.isArray(body?.preferredDays)
    ? body.preferredDays.slice(0,7)
    : [],
  allowAdjacentDays: body?.allowAdjacentDays === 'yes' ? 'yes' : 'no',
})

const flattenWeeks = plan =>
  (plan?.phases || []).flatMap(phase => phase?.weeks || [])

const hfContext = input => {
  const max = input.maxHF
  const rest = input.ruheHF

  if (!max) return 'Keine verlässliche maximale Herzfrequenz angegeben.'

  if (rest) {
    const zone = pct => Math.round((max - rest) * pct + rest)
    return `HFmax ${max}, Ruhe-HF ${rest}. Orientierung nach Herzfrequenzreserve:
Zone 1 unter ca. ${zone(.60)} bpm,
Zone 2 ca. ${zone(.60)}-${zone(.70)} bpm,
Zone 3 ca. ${zone(.70)}-${zone(.80)} bpm,
Zone 4 ca. ${zone(.80)}-${zone(.90)} bpm,
Zone 5 über ca. ${zone(.90)} bpm.`
  }

  return `HFmax ${max}. Grobe Orientierung:
Zone 1 unter ${Math.round(max*.60)} bpm,
Zone 2 ${Math.round(max*.60)}-${Math.round(max*.70)} bpm,
Zone 3 ${Math.round(max*.70)}-${Math.round(max*.80)} bpm,
Zone 4 ${Math.round(max*.80)}-${Math.round(max*.90)} bpm,
Zone 5 über ${Math.round(max*.90)} bpm.`
}

const ftpContext = input => {
  if (!input.ftp) return 'Keine FTP angegeben.'
  const ftp = input.ftp
  const watts = (low, high) =>
    `${Math.round(ftp*low)}-${Math.round(ftp*high)} W`
  return `FTP ${ftp} W. Nutzbare Orientierungen:
locker / Grundlage etwa 55-70 % FTP (${watts(.55,.70)}),
zügig / Tempo etwa 76-88 % FTP (${watts(.76,.88)}),
Schwelle etwa 90-100 % FTP (${watts(.90,1.00)}),
kurze intensive Intervalle je nach Ziel etwa 105-120 % FTP (${watts(1.05,1.20)}).
Wattbereiche nur passend zum Einheitstyp einsetzen.`
}

const validatePlan = (plan, input, guardrails) => {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Planantwort fehlt.')
  }

  const weeks = flattenWeeks(plan)
  const expectedWeeks = Number(guardrails.requestedWeeks)
  const expectedUnits = Number(input.unitsPerWeek)

  if (weeks.length !== expectedWeeks) {
    throw new Error(
      `Plan enthält ${weeks.length} statt ${expectedWeeks} Wochen.`
    )
  }

  const expectedNumbers = Array.from(
    { length:expectedWeeks },
    (_, index) => index + 1
  )

  const weekNumbers = weeks.map(week => Number(week.n))
  if (weekNumbers.some((value,index) => value !== expectedNumbers[index])) {
    throw new Error('Wochennummerierung ist nicht vollständig.')
  }

  for (const week of weeks) {
    const requiredDays = (week.days || []).filter(day => !day.optional)

    if (requiredDays.length !== expectedUnits) {
      throw new Error(
        `Woche ${week.n} enthält ${requiredDays.length} statt ${expectedUnits} Pflichteinheiten.`
      )
    }

    for (const day of week.days || []) {
      day.sport_type = 'cycling'
      day.tag = normalizeDay(day.tag)

      const isBackToBack = /back[- ]?to[- ]?back/i.test(
        String(day.einheit || '')
      )

      const allowedException =
        input.allowAdjacentDays === 'yes' &&
        guardrails.backToBack?.appropriate &&
        isBackToBack

      if (!input.preferredDays.includes(day.tag) && !allowedException) {
        throw new Error(
          `Woche ${week.n} nutzt den nicht ausgewählten Trainingstag ${day.tag}.`
        )
      }

      const isStrength =
        Boolean(day.strengthPrescription) ||
        /kraft|stabilität|strength/i.test(String(day.einheit || ''))

      if (isStrength) {
        if (input.strengthTraining !== 'yes') {
          throw new Error('Plan enthält Krafttraining, obwohl es nicht ausgewählt wurde.')
        }
        day.durationMinutes = day.durationMinutes || 30
        day.intensity = null
        day.loadGuidance = null
        day.distanceGuidance = null
      } else {
        const duration = Number(day.durationMinutes)
        if (!Number.isFinite(duration) || duration < 20) {
          throw new Error(
            `Woche ${week.n}: Für "${day.einheit}" fehlt eine konkrete Trainingsdauer.`
          )
        }
        day.durationMinutes = Math.round(duration)
      }

      if (
        /\b\d+(?:[.,]\d+)?\s*km\/h\b/i.test(String(day.details || '')) ||
        /\b\d+(?:[.,]\d+)?\s*km\/h\b/i.test(String(day.loadGuidance || ''))
      ) {
        throw new Error(
          `Woche ${week.n} enthält eine Geschwindigkeitsvorgabe in km/h.`
        )
      }
    }
  }

  return {
    ...plan,
    sport_type:'cycling',
    plan_type:'cycling_endurance',
    weeksUntilRace:expectedWeeks,
    unitsPerWeek:expectedUnits,
    cyclingProfile:{
      bikeType:input.bikeType,
      targetDistanceKm:guardrails.targetDistanceKm,
      targetTerrain:input.targetTerrain,
      trainingTerrain:input.trainingTerrain,
      indoorTrainer:input.indoorTrainer,
      ftp:input.ftp,
      maxHF:input.maxHF,
      ruheHF:input.ruheHF,
      preferredDays:input.preferredDays,
      guardrails,
    },
  }
}

export async function generateCyclingPlan(body = {}) {
  const input = sanitizeInput(body)
  const guardrails = body?.guardrails || buildCyclingPlanGuardrails(input)

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Planservice ist nicht konfiguriert.')
  }

  if (!input.startDate) {
    throw new Error('Startdatum fehlt.')
  }

  if (!input.unitsPerWeek || input.unitsPerWeek < 2) {
    throw new Error('Ungültige Trainingshäufigkeit.')
  }

  if (input.preferredDays.length < input.unitsPerWeek) {
    throw new Error('Zu wenige Trainingstage ausgewählt.')
  }

  const system = `Du bist ein professioneller Radsporttrainer. Erstelle einen sicheren, nachvollziehbaren und alltagstauglichen personalisierten Trainingsplan.

WICHTIGES GRUNDPRINZIP:
Radtraining wird PRIMÄR über ZEIT und BELASTUNG gesteuert – NICHT über Durchschnittsgeschwindigkeit.
Wind, Untergrund, Verkehr, Radtyp und Gelände verändern km/h zu stark.
Gib deshalb NIEMALS eine km/h-Zielgeschwindigkeit vor.

NUTZERDATEN:
${JSON.stringify(input)}

FACHLICHE GRENZEN:
${JSON.stringify(guardrails)}

HERZFREQUENZ:
${hfContext(input)}

LEISTUNG:
${ftpContext(input)}

VERBINDLICHE REGELN:
1. Erzeuge EXAKT ${guardrails.requestedWeeks} Wochen.
2. Jede Woche enthält EXAKT ${input.unitsPerWeek} Pflicht-Trainingseinheiten.
3. Alle Pflicht-Radeinheiten verwenden grundsätzlich nur preferredDays.
4. Ausnahme ausschließlich für ausdrücklich erlaubtes echtes Back-to-back gemäß guardrails.
5. Alle Radeinheiten haben sport_type="cycling".
6. Phasen: Basis, Aufbau, Spezifisch, Zielphase. Alle vier Phasen verwenden.
7. Entlastungswochen etwa alle 3-4 Wochen sinnvoll integrieren; Umfang/Trainingszeit reduzieren.
8. Die erste lange Ausfahrt orientiert sich ungefähr an guardrails.startLongHours. Nicht direkt einen neuen Rekord verlangen.
9. Die längste reguläre Trainingsausfahrt überschreitet guardrails.peakLongHours nicht unnötig.
10. ZEIT ist bei normalen Einheiten die Hauptvorgabe:
    - durationMinutes ist für JEDE Radeinheit verpflichtend und muss eine konkrete Dauer enthalten.
    - Lockere/Grundlagen-/Tempo-/Intervall-Einheiten primär über diese Dauer steuern.
    - Die Dauer muss zur Einheit passen und darf nicht nur im Freitext angedeutet werden.
    - Beispiel: lockere Ausfahrt durationMinutes=60; lange Ausfahrt durationMinutes=180.
11. DISTANZ:
    - distanceGuidance bei langen und zielspezifischen Ausfahrten verwenden, damit der Nutzer zusätzlich ein Gefühl für den ungefähren Umfang bekommt.
    - Kilometer immer als großzügige ORIENTIERUNG formulieren, niemals als Pflicht wenn die Zeit erfüllt ist.
    - Beispiel: "Orientierung: meist etwa 60-75 km; Zeit und gleichmäßige Belastung haben Vorrang."
    - Bei kurzen normalen Trainingsausfahrten ist keine km-Range nötig, weil die sichtbare Dauer die Einheit eindeutig vorgibt.
12. GESCHWINDIGKEIT:
    - niemals km/h als Trainingsziel, Pace oder Belastungssteuerung ausgeben.
13. INTENSITÄT:
    - Nutzerseitig bevorzugt "locker", "zügig", "intensiv".
    - "locker": ruhige Grundlage, lange kontrollierbar.
    - "zügig": klarer Trainingsreiz, kontrolliert und nicht maximal.
    - "intensiv": kurze gezielte Intervalle; sparsam einsetzen.
14. Wenn FTP vorhanden:
    - loadGuidance soll bei geeigneten Einheiten konkrete Wattbereiche oder %-FTP enthalten.
    - Keine Wattvorgabe erfinden, die nicht zu den oben angegebenen Bereichen passt.
15. Wenn HF vorhanden:
    - loadGuidance darf ergänzend einen HF-Bereich nennen.
    - Bei langen lockeren Fahrten Zone 2 bevorzugen.
16. Wenn weder FTP noch HF zuverlässig vorliegen:
    - loadGuidance als verständliches Belastungsgefühl formulieren, keine Zahlen erfinden.
17. Keine doppelte Überladung: Wenn FTP gut steuerbar ist, HF nur ergänzend nennen.
18. BIKE TYPE:
    - Rennrad: strukturierte Ausdauer- und Qualitätseinheiten möglich.
    - Gravel: Untergrund/Fahrwiderstand berücksichtigen; technische Schwierigkeit nicht erfinden.
    - Trekking/Tour: Ausdauer, Sitzzeit, konstante Belastbarkeit und Tourentauglichkeit priorisieren.
19. GELÄNDE:
    - Zielgelände und verfügbares Trainingsgelände strikt unterscheiden.
    - Wenn guardrails.terrain.mismatch=true, keine nicht vorhandenen Berge/Anstiege erfinden.
    - Indoor-Widerstand nur wenn laut guardrails.indoor verfügbar.
20. INDOOR:
    - "no": keine Indoor-Einheit.
    - "sometimes": gelegentliche Alternative.
    - "regular": strukturierte Indoor-Einheiten dürfen regulär vorkommen.
21. KRAFT:
    - Nur wenn input.strengthTraining="yes".
    - strengthPrescription mit 4-5 Übungen, meist 2-3 Sätze, 8-12 Wiederholungen.
    - Gute Optionen: Split Squats, Step-ups, Hüftbeuge/RDL, Wadenheben, Rumpfstabilität.
    - Nicht bis Muskelversagen; Peak/Zielphase reduzieren.
22. VERPFLEGUNG:
    - Ab etwa 90 Minuten längeren Einheiten konkrete Testaufgabe geben.
    - Früh: ungefähr 30-60 g Kohlenhydrate pro Stunde als Orientierung und regelmäßig trinken.
    - Sehr lange spezifische Einheiten: persönliche Event-/Tourstrategie testen; höhere Mengen nur schrittweise und bei guter Verträglichkeit.
    - Kurze Einheiten nicht mit Ernährungshinweisen überladen.
23. BACK-TO-BACK:
    - Nur wenn guardrails.backToBack.appropriate=true.
    - Muss wirklich an direkt aufeinanderfolgenden Kalendertagen stattfinden.
    - Zweiter Tag leichter/kürzer.
24. EVENT/ZIEL:
    - Event oder Tour nicht als normale Trainingseinheit in phases ausgeben.
    - Falls Zieltermin vorhanden, event separat ausgeben.
    - Letzte Woche enthält Taper-/Vorbereitungseinheiten.
25. Bei knapper Vorbereitungszeit niemals aggressiver steigern, nur um das Ziel rechnerisch zu erreichen.
26. Keine medizinischen Diagnosen oder Erfolgsgarantien.
27. Keine internen technischen Begriffe, Modelle, APIs oder Kosten erwähnen.
28. details sollen konkret, knapp und direkt ausführbar sein.

PLANCHARAKTER:
- 2 Einheiten/Woche: lange Grundlage + gezielte zweite Ausfahrt.
- 3 Einheiten/Woche: lange Grundlage + locker + zügig/qualitativ.
- 4 Einheiten/Woche: zusätzliche kurze lockere Einheit.
- 5 Einheiten/Woche: mehr Frequenz, nicht automatisch mehr Intensität.
- Lange Ziele: spezifische Dauer steigern, aber nicht jede Woche länger.
- Mehrtagestour: wiederholte Sitzzeit und Belastbarkeit priorisieren.
- Kilometer sind Kontext; Zeit und Belastung steuern das Training.

AUSGABE:
Gib ausschließlich das strukturierte JSON gemäß Schema zurück.`

  const userContext = {
    input,
    guardrails,
    requestedWeeks:guardrails.requestedWeeks,
  }

  const response = await fetch(
    'https://api.anthropic.com/v1/messages',
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':process.env.ANTHROPIC_API_KEY,
        'anthropic-version':'2023-06-01',
      },
      body:JSON.stringify({
        model:'claude-sonnet-4-5',
        max_tokens:14000,
        system,
        output_config:{
          format:{
            type:'json_schema',
            schema:RESPONSE_SCHEMA,
          },
        },
        messages:[{
          role:'user',
          content:
            'Erstelle den vollständigen Rad-Trainingsplan aus diesem Kontext:\n' +
            JSON.stringify(userContext),
        }],
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('[Cycling Plan] Anthropic Fehler:', data)
    throw new Error(
      data?.error?.message ||
      `Planservice Fehler ${response.status}`
    )
  }

  if (data.stop_reason === 'max_tokens') {
    throw new Error('Der Trainingsplan war für die Ausgabe zu umfangreich. Bitte erneut versuchen.')
  }

  const text = data?.content?.find(item => item?.type === 'text')?.text

  if (!text) {
    throw new Error('Es wurde kein Trainingsplan zurückgegeben.')
  }

  const rawPlan = JSON.parse(text)
  const plan = validatePlan(rawPlan, input, guardrails)

  return {
    plan,
    meta:{
      guardrailsVersion:guardrails.version,
    },
  }
}
