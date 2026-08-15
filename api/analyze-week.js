import { buildTrainingAnalysis, secondsToPace } from '../src/lib/trainingAnalysis.js'

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    weekVerdict: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: {
          type: 'string',
          enum: ['excellent', 'good', 'solid', 'recovery_needed', 'attention'],
        },
        headline: { type: 'string' },
        summary: { type: 'string' },
      },
      required: ['status', 'headline', 'summary'],
    },
    positive: {
      type: 'array',
      items: { type: 'string' },
    },
    attention: {
      type: 'array',
      items: { type: 'string' },
    },
    development: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        signals: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              metric: { type: 'string' },
              trend: { type: 'string', enum: ['up', 'stable', 'down', 'unclear'] },
              text: { type: 'string' },
            },
            required: ['metric', 'trend', 'text'],
          },
        },
      },
      required: ['summary', 'signals'],
    },
    loadAssessment: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: { type: 'string', enum: ['low', 'optimal', 'high', 'unclear'] },
        text: { type: 'string' },
      },
      required: ['status', 'text'],
    },
    planDecision: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          enum: ['keep', 'progress', 'reduce', 'recovery', 'cautious_return'],
        },
        reason: { type: 'string' },
      },
      required: ['action', 'reason'],
    },
    nextWeekFocus: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['title', 'text'],
    },
    confidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        level: { type: 'string', enum: ['high', 'medium', 'low'] },
        reason: { type: 'string' },
      },
      required: ['level', 'reason'],
    },
    recommendation: { type: 'string' },
    adjustmentSummary: { type: 'string' },
    emoji: { type: 'string' },
    nextWeekAdjusted: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tag: { type: 'string' },
          einheit: { type: 'string' },
          details: { type: 'string' },
          adjusted: { type: 'boolean' },
          adjustmentReason: { type: 'string' },
        },
        required: [
          'tag',
          'einheit',
          'details',
          'adjusted',
          'adjustmentReason',
        ],
      },
    },
  },
  required: [
    'weekVerdict',
    'positive',
    'attention',
    'development',
    'loadAssessment',
    'planDecision',
    'nextWeekFocus',
    'confidence',
    'recommendation',
    'adjustmentSummary',
    'emoji',
    'nextWeekAdjusted',
  ],
}

const compactRunForPrompt = run => ({
  // plannedTag ist nur der SOLL-Tag aus dem Plan.
  // actualDate/actualWeekday zeigen, wann die Aktivität wirklich stattgefunden hat.
  plannedTag: run.plannedTag ?? run.tag,
  actualDate: run.actualDate ?? run.date,
  actualWeekday: run.actualWeekday,
  workout: run.workout,
  workoutType: run.workoutType,
  plannedDetails: run.plannedDetails,
  completed: run.completed,
  skipped: run.skipped,
  skipReason: run.skipReason,
  actual: run.actual
    ? {
        km: run.actual.km,
        pace: run.actual.paceSeconds
          ? `${secondsToPace(run.actual.paceSeconds)} min/km`
          : null,
        avgHr: run.actual.avgHr,
        maxHr: run.actual.maxHr,
        avgHrZone: run.actual.avgHrZone,
        durationSeconds: run.actual.durationSeconds,
        runningIndex: run.actual.runningIndex,
        cadence: run.actual.cadence,
        elevationGainMeters: run.actual.elevationGainMeters,
        feeling: run.actual.feeling,
        note: run.actual.note,
        context: run.actual.context,
      }
    : null,
  splitTrend: run.splitTrend
    ? {
        firstHalfPace: secondsToPace(run.splitTrend.firstHalfPaceSeconds),
        secondHalfPace: secondsToPace(run.splitTrend.secondHalfPaceSeconds),
        paceDeltaSecondsPerKm: run.splitTrend.paceDeltaSecondsPerKm,
        firstHalfAvgHr: run.splitTrend.firstHalfAvgHr,
        secondHalfAvgHr: run.splitTrend.secondHalfAvgHr,
        hrDeltaBpm: run.splitTrend.hrDeltaBpm,
      }
    : null,
  segmentConsistency: run.segmentConsistency
    ? {
        count: run.segmentConsistency.count,
        averagePace: secondsToPace(run.segmentConsistency.averagePaceSeconds),
        fastestPace: secondsToPace(run.segmentConsistency.fastestPaceSeconds),
        slowestPace: secondsToPace(run.segmentConsistency.slowestPaceSeconds),
        spreadSecondsPerKm: run.segmentConsistency.spreadSecondsPerKm,
        firstToLastDeltaSeconds:
          run.segmentConsistency.firstToLastDeltaSeconds,
      }
    : null,
  splits: (run.splits || []).map(split => ({
    km: split.index,
    pace: secondsToPace(split.paceSeconds),
    avgHr: split.avgHr,
    maxHr: split.maxHr,
    cadence: split.cadence,
    ascentMeters: split.ascentMeters,
  })),
  segments: (run.segments || []).map(segment => ({
    index: segment.index,
    label: segment.label,
    distanceMeters: segment.distanceMeters,
    durationSeconds: segment.durationSeconds,
    pace: secondsToPace(segment.paceSeconds),
    avgHr: segment.avgHr,
    maxHr: segment.maxHr,
    cadence: segment.cadence,
  })),
})

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    weekLogs = [],
    plannedDays = [],
    weekNumber,
    plan,
    nextWeekDays = [],
    previousAnalyses = [],
    historyLogs = [],
    activityHistory = [],
    weekStart = null,
    weekCheckIn = null,
    schuhWarnung,
    isRegenWeek = false,
    nextIsRegenWeek = false,
    currentHFMax,
    currentRuheHF,
    aktuelleWochenKm,
    currentPhase,
  } = req.body || {}

  try {
    const facts = buildTrainingAnalysis({
      weekLogs,
      plannedDays,
      historyLogs,
      activityHistory,
      weekNumber,
      weekStart,
      currentHFMax,
      currentRuheHF,
      isRegenWeek,
      nextIsRegenWeek,
      aktuelleWochenKm,
    })

    const coachContext = {
      weekNumber,
      phase: currentPhase
        ? {
            id: currentPhase.id || null,
            label: currentPhase.label || null,
            description: currentPhase.description || null,
          }
        : null,
      plan: {
        title: plan?.title || 'Trainingsplan',
        goal: plan?.goal || null,
        sportType: plan?.sport_type || null,
        planType: plan?.plan_type || null,
        hikingProfile: plan?.hikingProfile || null,
        caution: plan?.planCaution || null,
      },
      weeklyCheckIn: weekCheckIn || null,
      adherence: facts.adherence,
      weekContext: facts.weekContext,
      runs: facts.runs.map(compactRunForPrompt),
      similarComparisons: facts.similarComparisons,
      efficiencyCandidates: facts.efficiencyCandidates,
      weekChronology: facts.chronology,
      allActivityChronology: facts.allActivityChronology,
      nonRunningLoad: facts.nonRunningLoad,
      tightLoadChains: facts.tightLoadChains,
      planRealityPatterns: facts.planRealityPatterns,
      subjectiveObjectiveSignals: facts.subjectiveObjectiveSignals,
      recoverySpacing: facts.recoverySpacing,
      fatigueSignals: facts.fatigueSignals,
      deterministicConfidence: facts.confidence,
      previousAnalyses: (previousAnalyses || []).slice(0, 3),
      shoesWarning: schuhWarnung || null,
      nextWeek: (nextWeekDays || []).map(day => ({
        tag: day.tag,
        einheit: day.einheit,
        details: day.details,
        optional: Boolean(day.optional),
      })),
    }

    const isHikingPlan =
      plan?.sport_type === 'hiking' ||
      plan?.plan_type === 'hiking_march'

    const runningSystem = `Du bist ein professioneller Lauftrainer und analysierst eine abgeschlossene Trainingswoche.

Deine Prioritäten:
1. Trainingsziel und aktuelle Trainingsphase verstehen.
2. Soll und Ist jeder Einheit vergleichen.
3. PLANTAG UND TATSÄCHLICHER TAG SIND NICHT DASSELBE: "plannedTag" ist nur der vorgesehene Tag, "actualDate"/"actualWeekday" ist die echte Durchführung. Aussagen über Reihenfolge, Erholung und Abstände ausschließlich aus den tatsächlichen Tagen ableiten.
4. Bei Intervallen/Tempoläufen Phasen/Segmente verwenden. Nie die Gesamtpace als Intervallpace behandeln.
5. Bei Long Runs und lockeren Läufen Kilometer-Splits, Pace-Drift und HF-Drift berücksichtigen.
6. Ähnliche Einheit mit ähnlicher Einheit vergleichen, nicht pauschal Wochendurchschnitte.
7. Belastung konservativ steuern. Eine perfekte Woche bedeutet NICHT automatisch zusätzliche Steigerung.
8. Regenerationswochen sind bewusst leichter und dürfen nicht als Rückschritt bewertet werden.
9. Einzelne schwache Kennzahlen niemals als Übertraining diagnostizieren. Ermüdung nur bei mehreren zusammenpassenden Signalen vorsichtig formulieren.
10. Krankheit/Verletzung konservativ behandeln. Keine Diagnose stellen.
11. Bewusst übersprungene Einheiten wertfrei anhand des Grundes einordnen.
12. Wetter/Höhenmeter nur berücksichtigen, wenn sie die Interpretation tatsächlich erklären.
13. Running Index und Pace/HF-Verhältnis als Entwicklungssignale nutzen, aber nicht isoliert überbewerten.
14. Nur maximal zwei wirklich wichtige positive Punkte und zwei Punkte unter "Darauf achten".
15. Genau EINEN konkreten Fokus für die nächste Woche formulieren.
16. Jede Planänderung transparent begründen.
17. ALLE Einheiten der nächsten Woche in nextWeekAdjusted zurückgeben, auch unveränderte (adjusted=false).
18. Intervall-/Tempo-Paces nicht aufgrund einer einzelnen guten Woche aggressiv erhöhen.
19. Bei Zone-2-/Long-Run-Paces nur konservativ ändern und Herzfrequenzkontext mitdenken.
20. Exakte Aussagen nur machen, wenn die Daten sie belegen. Keine Ursachen wie Schlaf, Stress oder Wetter erfinden.
21. Die natürliche Progression des bereits geplanten nächsten Wochenplans nicht als Coach-Anpassung ausgeben.
22. Wenn mindestens eine Einheit adjusted=true ist, darf adjustmentSummary nicht behaupten, alles sei unverändert.
23. Trend schlägt Einzelwert. Größere Anpassungen brauchen meist ein wiederkehrendes Muster oder ein klares Sicherheitssignal.
24. Gesamtbelastung statt nur Läufe: andere Sportarten als Erholungskontext berücksichtigen.
25. Subjektive und objektive Signale gemeinsam interpretieren.
26. planRealityPatterns nur bei wiederkehrenden Mustern verwenden.
27. nextWeekFocus muss genau EINE Hauptaufgabe enthalten, kurz und handlungsorientiert.
28. Planänderungen sparsam einsetzen.
29. Nicht jede Kennzahl erwähnen; nur die 2-3 entscheidenden Signale.
30. Nie interne technische Abläufe erwähnen.

Die deterministisch berechneten Fakten sind die primäre Datenbasis. Wenn Daten fehlen, keine Präzision vortäuschen. Confidence muss die tatsächliche Datenqualität widerspiegeln.`

    const hikingSystem = `Du bist ein professioneller Coach für Marsch- und Wandertraining und analysierst eine abgeschlossene Trainingswoche.

Deine Prioritäten:
1. Zieltyp verstehen: Marsch/Event, Distanzziel, Tages-/Mehrtagestour oder Wandereinstieg.
2. Der wichtigste Maßstab ist nicht Tempo, sondern sichere Belastungsverträglichkeit, Zeit auf den Beinen, Distanz und Erholung.
3. Den Wochen-Check besonders ernst nehmen: Füße/Haut, Blasen oder Druckstellen, Gelenke/Muskulatur und Erholung am Folgetag sind zentrale Anpassungssignale.
4. Bei längeren Zielen zusätzlich Verpflegung und Ausrüstung berücksichtigen, sofern dazu Daten vorliegen.
5. Eine gut verträgliche Woche bedeutet NICHT automatisch, dass zusätzlich zur bereits geplanten Progression gesteigert werden muss.
6. Eine schlecht verträgliche oder verpasste Woche NIEMALS durch einen größeren Sprung in der Folgewoche nachholen.
7. Wenn Füße/Haut deutliche Probleme zeigen, die nächste lange Einheit konservativ reduzieren oder stabilisieren. Blasen sind ein Belastungs-/Ausrüstungssignal und kein Grund, aggressiv weiterzusteigern.
8. Bei deutlichen oder anhaltenden Gelenk-/Muskelsymptomen konservativ reduzieren bzw. Erholung priorisieren. Keine Diagnose stellen.
9. Erholung am Folgetag ist ein wichtiges Signal für die Verträglichkeit langer Einheiten und Back-to-back-Belastungen.
10. Bei Mehrtagestouren ist die Fähigkeit, am Folgetag erneut belastbar zu sein, wichtiger als eine einzelne maximale Trainingsdistanz.
11. Bei 50–100-km-Zielen nicht verlangen, die volle Zieldistanz im Training zu absolvieren. Peak- und Back-to-back-Logik des bestehenden Plans respektieren.
12. Zielgelände und Trainingsumgebung unterscheiden. Wenn das Ziel bergig ist, der Nutzer aber nur flach trainieren kann, KEINE verpflichtenden Höhenmeter erfinden.
13. Nur Trainingsmöglichkeiten empfehlen, die im hikingProfile als verfügbar hinterlegt sind. Fehlen Treppen, Laufband, Studio oder Hügel, normale flache Einheiten als valide Alternative behandeln.
14. Wenn Rucksacktraining vorgesehen ist, Druckstellen und Verträglichkeit höher gewichten als Tempo.
15. Pace und Herzfrequenz sind bei Marsch/Wandern nur Zusatzinformationen und dürfen die Beurteilung nicht dominieren.
16. Wetter/Höhenmeter nur berücksichtigen, wenn sie die Interpretation tatsächlich erklären.
17. Bewusst übersprungene Einheiten wertfrei einordnen.
18. Regenerationswochen sind bewusst leichter und kein Rückschritt.
19. Maximal zwei wirklich wichtige positive Punkte und zwei Punkte unter "Darauf achten".
20. Genau EINEN konkreten Fokus für die nächste Woche formulieren.
21. ALLE Einheiten der nächsten Woche in nextWeekAdjusted zurückgeben, auch unveränderte (adjusted=false).
22. Anpassungen vorzugsweise über Distanz, Dauer, Intensität oder Ausführungshinweise steuern. Keine unnötigen Zusatz-Einheiten erzeugen.
23. Die natürliche Progression der bereits geplanten nächsten Woche nicht als eigene Anpassung verkaufen.
24. Wenn adjusted=true verwendet wird, adjustmentSummary muss die Änderung transparent und konsistent benennen.
25. Trend schlägt Einzelwert; gleichzeitig haben klare Sicherheits-/Beschwerdesignale Vorrang.
26. Keine Ursachen erfinden, keine medizinischen Diagnosen stellen.
27. nextWeekFocus muss genau EINE Hauptaufgabe enthalten und alltagstauglich sein.
28. Wenn die Vorbereitungszeit im Plan als knapp markiert ist, niemals aggressiver steigern, nur um rechnerisch das Ziel zu erreichen.
29. Nie interne technische Abläufe erwähnen.

Die deterministisch berechneten Aktivitätsdaten und der Wochen-Check bilden gemeinsam die Datenbasis. Wenn Daten fehlen, keine Präzision vortäuschen. Confidence muss die tatsächliche Datenqualität widerspiegeln.`

    const system = isHikingPlan ? hikingSystem : runningSystem

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 2600,
          system,
          output_config: {
            format: {
              type: 'json_schema',
              schema: RESPONSE_SCHEMA,
            },
          },
          messages: [
            {
              role: 'user',
              content:
                `Analysiere Woche ${weekNumber}. Hier sind die bereits ` +
                `verdichteten Trainingsdaten:\n${JSON.stringify(coachContext)}`,
            },
          ],
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic Wochenanalyse Fehler:', data)
      throw new Error(
        data?.error?.message ||
        `Anthropic API Fehler ${response.status}`
      )
    }

    const text = data?.content?.find(
      item => item?.type === 'text'
    )?.text

    if (!text) {
      throw new Error('Claude hat keine Analyse zurückgegeben.')
    }

    const result = JSON.parse(text)

    // Sicherheitsnetz gegen widersprüchliche Aussagen wie
    // "alle Einheiten unverändert", obwohl adjusted=true gesetzt wurde.
    const adjustedItems = (result.nextWeekAdjusted || []).filter(
      item => item?.adjusted
    )

    if (
      adjustedItems.length > 0 &&
      /(?:alle.*unverändert|keine\s+anpass|plan\s+bleibt\s+wie)/i.test(
        result.adjustmentSummary || ''
      )
    ) {
      result.adjustmentSummary =
        `Planstruktur bleibt bestehen; ${adjustedItems.length} ` +
        `Einheit${adjustedItems.length === 1 ? '' : 'en'} ` +
        `wurde${adjustedItems.length === 1 ? '' : 'n'} in der Ausführung feinjustiert: ` +
        adjustedItems
          .map(item => item.einheit)
          .filter(Boolean)
          .join(', ')
    }

    // Legacy-Felder beibehalten, damit bestehender App-Code weiterhin funktioniert.
    return res.status(200).json({
      ...result,
      analyse:
        result.weekVerdict?.summary ||
        result.weekVerdict?.headline ||
        '',
      empfehlung: result.recommendation || '',
      anpassung:
        result.adjustmentSummary ||
        'Plan bleibt wie geplant',
      analysisData: {
        version: 2,
        generatedAt: new Date().toISOString(),
        weekNumber,
        phase: coachContext.phase,
        facts: {
          adherence: facts.adherence,
          weekContext: facts.weekContext,
          efficiencyCandidates: facts.efficiencyCandidates,
          chronology: facts.chronology,
          allActivityChronology: facts.allActivityChronology,
          nonRunningLoad: facts.nonRunningLoad,
          tightLoadChains: facts.tightLoadChains,
          planRealityPatterns: facts.planRealityPatterns,
          subjectiveObjectiveSignals: facts.subjectiveObjectiveSignals,
          recoverySpacing: facts.recoverySpacing,
          fatigueSignals: facts.fatigueSignals,
          confidence: facts.confidence,
        },
        coach: result,
      },
    })
  } catch (error) {
    console.error('Wochenanalyse v2 Fehler:', error)

    return res.status(500).json({
      error:
        error?.message ||
        'Wochenanalyse konnte nicht erstellt werden.',
    })
  }
}
