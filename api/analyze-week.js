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
      },
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

    const system = `Du bist ein professioneller Lauftrainer und analysierst eine abgeschlossene Trainingswoche.

Deine Prioritäten:
1. Trainingsziel und aktuelle Trainingsphase verstehen.
2. Soll und Ist jeder Einheit vergleichen.
3. PLANTAG UND TATSÄCHLICHER TAG SIND NICHT DASSELBE: "plannedTag" ist nur der vorgesehene Tag, "actualDate"/"actualWeekday" ist die echte Durchführung. Aussagen über Reihenfolge, Erholung, "am Donnerstag", "48 Stunden Pause" usw. IMMER ausschließlich aus actualDate/actualWeekday und weekChronology ableiten. Nie unterstellen, dass am Plantag trainiert wurde.
4. Bei Intervallen/Tempoläufen Phasen/Segmente verwenden, wenn vorhanden. Beurteile NICHT die Gesamtpace als Intervallpace.
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
20. Exakte Aussagen wie "doppelter Umfang gegenüber Vorwoche" NUR machen, wenn adherence.previousWeekActualKm und actualKmChangeVsPreviousWeekPercent diese Aussage tatsächlich belegen. Sonst qualitativ formulieren.
21. Kausalität vorsichtig formulieren: Ein höherer Puls nach einer dicht aufeinanderfolgenden Belastung KANN zu Restermüdung passen, ist aber kein Beweis. Wetter, Schlaf, Stress und Tagesform nicht erfinden.
22. Die NATÜRLICHE Progression des bereits geplanten nächsten Wochenplans nicht als eigene Coach-Anpassung ausgeben. Als Coach-Änderung nur das bezeichnen, was in nextWeekAdjusted tatsächlich adjusted=true erhält.
23. Konsistenz ist Pflicht: Wenn mindestens eine Einheit adjusted=true ist, darf adjustmentSummary NICHT "alle Einheiten unverändert" oder "keine Anpassung" behaupten. Wenn die Planstruktur gleich bleibt, aber Ausführungshinweise verändert werden, genau so formulieren: "Planstruktur bleibt bestehen; Ausführung wurde feinjustiert."
24. TREND SCHLÄGT EINZELWERT: Einen einzelnen ungewöhnlichen Running Index, Pulswert, Pace-Drift oder schlechten Lauf nicht allein als Grund für eine größere Planänderung verwenden. Größere Anpassungen brauchen in der Regel ein wiederkehrendes Muster über mehrere Einheiten/Wochen ODER ein klares Sicherheits-/Verletzungssignal.
25. ERFOLG BEDEUTET NICHT AUTOMATISCH STEIGERN: Eine sehr gute Woche darf ausdrücklich zu "stabilisieren" führen. Steigere nur, wenn Periodisierung, nächste Planwoche und Erholung dafür sprechen.
26. GESAMTBELASTUNG STATT NUR LÄUFE: allActivityChronology/nonRunningLoad/tightLoadChains berücksichtigen. Relevante Rad-, MTB-, Wander- oder Schwimmeinheiten können die Erholung zwischen Läufen beeinflussen. Sie sind Kontext, nicht automatisch negativ.
27. SUBJEKTIV + OBJEKTIV SPIEGELN: subjectiveObjectiveSignals nutzen. Wenn Körpergefühl und Messwerte übereinstimmen, steigt die Aussagekraft. Wenn sie widersprechen, diesen Widerspruch benennen und konservativ interpretieren.
28. KAUSALITÄTSSTUFEN sprachlich sauber trennen:
   - klare wiederholte Evidenz: "zeigt / spricht klar dafür"
   - plausible Indizien: "spricht dafür / passt zu"
   - mehrere mögliche Ursachen: "könnte eine Erklärung sein"
   Keine nicht vorhandenen Ursachen wie Schlaf, Stress oder Wetter erfinden.
29. PLAN VS. REALITÄT: planRealityPatterns nur bei wiederkehrenden Mustern verwenden. Wenn geplante und tatsächliche Trainingstage wiederholt abweichen, nicht tadeln. Prüfe stattdessen, ob dadurch ungünstige Belastungsketten entstehen und erwähne ggf., dass die künftige Planverteilung besser an den realen Alltag angepasst werden könnte.
30. WOCHENFOKUS RADIKAL PRIORISIEREN: nextWeekFocus muss genau EINE Hauptaufgabe enthalten. title kurz und handlungsorientiert (idealerweise 3-7 Wörter). text maximal 2 kurze Sätze. Keine zweite oder dritte Nebenaufgabe hineinpacken.
31. PLANÄNDERUNGEN sparsam einsetzen: Wenn die nächste Woche bereits eine natürliche Progression enthält und nur leichte/mehrdeutige Ermüdungssignale vorliegen, eher vorhandene Progression beibehalten und Ausführung präzisieren als zusätzliche Belastung hinzufügen.
32. INFORMATIONSDISZIPLIN: Nicht jede verfügbare Kennzahl muss erwähnt werden. Maximal die 2-3 Signale hervorheben, die die Entscheidung für die nächste Woche wirklich beeinflussen.

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
