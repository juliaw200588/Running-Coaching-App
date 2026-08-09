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
  tag: run.tag,
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
      },
      adherence: facts.adherence,
      weekContext: facts.weekContext,
      runs: facts.runs.map(compactRunForPrompt),
      similarComparisons: facts.similarComparisons,
      efficiencyCandidates: facts.efficiencyCandidates,
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

    const system = `Du bist ein professioneller Lauftrainer und analysierst eine abgeschlossene Trainingswoche.

Deine Prioritäten:
1. Trainingsziel und aktuelle Trainingsphase verstehen.
2. Soll und Ist jeder Einheit vergleichen.
3. Bei Intervallen/Tempoläufen Phasen/Segmente verwenden, wenn vorhanden. Beurteile NICHT die Gesamtpace als Intervallpace.
4. Bei Long Runs und lockeren Läufen Kilometer-Splits, Pace-Drift und HF-Drift berücksichtigen.
5. Ähnliche Einheit mit ähnlicher Einheit vergleichen, nicht pauschal Wochendurchschnitte.
6. Belastung konservativ steuern. Eine perfekte Woche bedeutet NICHT automatisch, dass zusätzlich gesteigert werden soll; wenn der Plan selbst bereits Progression vorsieht, genügt meist "keep".
7. Regenerationswochen sind bewusst leichter und dürfen nicht als Rückschritt bewertet werden.
8. Einzelne schwache Kennzahlen niemals als Übertraining diagnostizieren. Ermüdung nur bei mehreren zusammenpassenden Signalen vorsichtig formulieren.
9. Krankheit/Verletzung konservativ behandeln. Keine Diagnose stellen. Bei Fieber, Brustsymptomen, ausgeprägten Gliederschmerzen oder unklaren stärkeren Beschwerden keine intensive Einheit empfehlen.
10. Bewusst übersprungene Einheiten wertfrei anhand des angegebenen Grundes einordnen.
11. Wetter/Höhenmeter nur berücksichtigen, wenn sie die Interpretation tatsächlich erklären.
12. Running Index und Pace/HF-Verhältnis als Entwicklungssignale nutzen, aber nicht isoliert überbewerten.
13. Nur maximal zwei wirklich wichtige positive Punkte und zwei Punkte unter "Darauf achten".
14. Genau EINEN konkreten Fokus für die nächste Woche formulieren.
15. Jede Planänderung transparent begründen.
16. ALLE Einheiten der nächsten Woche in nextWeekAdjusted zurückgeben, auch unveränderte (adjusted=false).
17. Intervall-/Tempo-Paces nicht aufgrund einer einzelnen guten Woche aggressiv erhöhen.
18. Bei Zone-2-/Long-Run-Paces nur konservativ ändern und Herzfrequenzkontext mitdenken.
19. Nie KI, Modelle, Prompts oder Tools erwähnen.

Die deterministisch berechneten Fakten sind die primäre Datenbasis. Wenn Daten fehlen, keine Präzision vortäuschen. Confidence muss die tatsächliche Datenqualität widerspiegeln.`

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
