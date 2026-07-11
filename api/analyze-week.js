export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { weekLogs, plannedDays, weekNumber, plan, nextWeekDays, previousAnalyses, schuhWarnung, isRegenWeek, nextIsRegenWeek, currentHFMax, currentRuheHF, aktuelleWochenKm } = req.body

  try {
    const loggedCount = weekLogs.filter(l => l.logged).length
    const skippedCount = weekLogs.filter(l => l.skipped).length
    const plannedCount = plannedDays.length
    const missedDays = plannedDays.filter(d => !weekLogs.find(l => l.key === d.key && (l.logged || l.skipped)))

    const logsDetail = weekLogs
      .filter(l => l.logged)
      .map(l => `- ${l.tag} ${l.einheit}: ${l.pace ? `Pace ${l.pace}` : ''} ${l.km ? `/ ${l.km}` : ''} ${l.bpm ? `/ HF ${l.bpm}` : ''}${l.running_index ? ` / Running Index ${l.running_index}` : ''}${l.cadence ? ` / Kadenz ${l.cadence} spm` : ''} ${l.note ? `/ Notiz: "${l.note}"` : ''}`)
      .join('\n')

    const skippedDetail = skippedCount > 0
      ? `\nBewusst übersprungene Einheiten (NICHT als Versagen werten, sondern als bewusste Entscheidung respektieren):\n${weekLogs.filter(l => l.skipped).map(l => `- ${l.tag} ${l.einheit}${l.skipReason ? ` (Grund: "${l.skipReason}")` : ' (kein Grund angegeben)'}`).join('\n')}`
      : ''

    const plannedDetail = plannedDays
      .map(d => `- ${d.tag} ${d.einheit}: ${d.details}`)
      .join('\n')

    const missedDetail = missedDays.length > 0
      ? `Ausgefallene Einheiten (weder geloggt noch bewusst übersprungen - hier nachfragen/sanft ansprechen):\n${missedDays.map(d => `- ${d.tag} ${d.einheit}`).join('\n')}`
      : (skippedCount > 0 ? 'Alle übrigen Einheiten absolviert!' : 'Alle Einheiten absolviert!')

    const nextWeekDetail = nextWeekDays
      ? nextWeekDays.map(d => `- ${d.tag} ${d.einheit}: ${d.details}`).join('\n')
      : 'Letzte Woche des Plans'

    const previousContext = previousAnalyses?.length > 0
      ? `\nVorherige Wochen (Kontext):\n${previousAnalyses.map(a => `- Woche ${a.week_number}: ${a.analysis} → ${a.next_week_adjustment || 'keine Anpassung'}`).join('\n')}`
      : ''

    const karvonenZone = (pct) => Math.round((currentHFMax - currentRuheHF) * pct + currentRuheHF)
    const hfContext = currentHFMax
      ? (currentRuheHF
          ? `\nAktuelle maximale Herzfrequenz: ${currentHFMax} bpm, Ruhe-HF: ${currentRuheHF} bpm (Herzfrequenzreserve-Methode). Zone 2: ${karvonenZone(0.6)}-${karvonenZone(0.7)} bpm, Zone 4: ${karvonenZone(0.8)}-${karvonenZone(0.9)} bpm`
          : `\nAktuelle maximale Herzfrequenz: ${currentHFMax} bpm. Zone 2: ${Math.round(currentHFMax*0.6)}-${Math.round(currentHFMax*0.7)} bpm, Zone 4: ${Math.round(currentHFMax*0.8)}-${Math.round(currentHFMax*0.9)} bpm`)
      : ''
    const kmContext = aktuelleWochenKm
      ? `\nAktuelle Wochenkilometer laut Profil: ${aktuelleWochenKm} km`
      : ''
    const regenContext = isRegenWeek
      ? '\n⚡ Diese Woche war eine Regenerationswoche – niedrigerer Umfang ist normal und gewollt.'
      : ''
    const nextRegenContext = nextIsRegenWeek
      ? '\n💤 Nächste Woche ist eine Regenerationswoche – Umfang soll bewusst reduziert bleiben, keine Steigerung!'
      : ''
    const schuhContext = schuhWarnung
      ? `\n⚠️ Schuhwarnung: ${schuhWarnung} – Schuhe nähern sich dem Ende ihrer Laufzeit!`
      : ''

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system: `Du bist ein professioneller Lauftrainer. Analysiere die Trainingswoche mit Blick auf die letzten Wochen und passe die nächste Woche konkret an.

Antworte NUR mit validem JSON ohne Markdown:
{
  "analyse": "2-3 Sätze ehrliche Auswertung – was lief gut, was weniger. Erkenne Muster über mehrere Wochen.",
  "empfehlung": "1-2 konkrete motivierende Empfehlungen für nächste Woche",
  "anpassung": "Kurze Beschreibung was nächste Woche angepasst wird (oder 'Plan bleibt wie geplant')",
  "emoji": "🔥 super / ✅ gut / 💪 solide / 😴 Erholung nötig / ⚠️ Achtung",
  "nextWeekAdjusted": [
    {
      "tag": "Di",
      "einheit": "Intervalle",
      "details": "konkret angepasste Details",
      "adjusted": true,
      "adjustmentReason": "kurzer Grund"
    }
  ]
}

Anpassungsregeln:
- HF dauerhaft zu hoch (mehrere Wochen) → stärker reduzieren
- Running Index über mehrere Wochen steigend → objektives Zeichen für Fitnessfortschritt, positiv erwähnen, auch wenn sich die Person selbst unsicher fühlt. Fallend oder stagnierend über mehrere Wochen bei hohem Trainingsumfang → möglicher Hinweis auf Übertraining, in der Analyse ansprechen und ggf. mehr Erholung einbauen
- Pace zu schnell → Details anpassen, Zone 2 betonen
- Einheiten ausgefallen (weder geloggt noch bewusst übersprungen) → Umfang reduzieren, Regeneration, sanft nachfragen was los war
- Einheiten BEWUSST übersprungen (mit oder ohne Grund) → NICHT wie ein Versagen behandeln! Das war eine informierte Entscheidung der Person, keine Nachlässigkeit. Erkenne es wertschätzend an ("Gut, dass du auf deinen Körper gehört hast" bei Krankheit/Verletzung, oder einfach neutral "Diese Woche hattest du weniger Zeit" bei anderen Gründen).
  - Bei ERKÄLTUNG/INFEKT als Grund: wende die "Above-the-neck-Regel" an. Symptome nur oberhalb des Halses (Schnupfen, leichtes Halskratzen) → nächste Woche kann normal/nur leicht vorsichtiger weitergehen. Symptome unterhalb des Halses (Fieber, Gliederschmerzen, Husten, Brustschmerzen) oder unklar → deutlich vorsichtiger wieder einsteigen, erste Einheit(en) nächste Woche nur locker/kurz, keine Intervalle/Tempo.
  - Bei VERLETZUNG als Grund: konservativer wieder aufbauen, nicht da weitermachen wo der Plan stand. In der Empfehlung kurz erwähnen, dass schmerzfreies Alternativtraining (Schwimmen, Radfahren, Aquajogging) die Fitness in der Zwischenzeit erhalten kann, aber Ruhe/ärztliche Abklärung bei anhaltenden Schmerzen Vorrang hat.
  - Bei anderen Gründen (Zeitmangel etc.): normal weitermachen, keine Dramatisierung.
- Eine Woche perfekt → leichte Steigerung möglich (5-10% mehr Umfang oder leicht intensiver)
- Mehrere Wochen perfekt → etwas mehr Steigerung (bis 10%), nächste Stufe der Periodisierung
- Eine Woche schlecht/ausgefallen (unentschuldigt) → sofort anpassen, nicht abwarten

PACE-ANPASSUNG basierend auf HF und Notizen:
- HF bei Zone 2 Lauf zu hoch (>70% HFmax oder Notiz "Puls hoch/anstrengend") → Zone 2 Pace um 10-15 sec/km reduzieren (langsamer)
- HF bei Zone 2 Lauf zu niedrig (<60% HFmax oder Notiz "sehr leicht/zu leicht") → Zone 2 Pace um 10 sec/km erhöhen (schneller)
- HF bei Intervallen/Tempo passt → Pace beibehalten
- Keine HF-Daten aber Notiz "zu schnell/anstrengend" → Pace reduzieren
- Keine HF-Daten aber Notiz "sehr leicht" → Pace erhöhen
- Passe NUR Zone 2 und Langer Lauf Paces an – Intervall/Tempo Paces bleiben stabil
- Schreibe die neue Pace explizit in die Details (z.B. "Zone 2 (8:10-8:40 min/km)" statt nur "Zone 2")
- Erschöpfung in Notizen → Erholung priorisieren
- Schuhwarnung vorhanden → explizit in Empfehlung erwähnen
- Regenerationswoche (isRegenWeek): niedrigerer Umfang ist gewollt, keine Kritik daran
- Nächste Woche Regen (nextIsRegenWeek): KEINE Steigerung vorschlagen, Umfang bewusst niedrig lassen
- Konservativ anpassen – Verletzungsprävention hat Vorrang
- ALLE Einheiten zurückgeben, auch unveränderte (adjusted: false)
- Nie auf KI oder Tools verweisen`,

        messages: [{
          role: 'user',
          content: `Woche ${weekNumber} Analyse:

Geplante Einheiten (${plannedCount}):
${plannedDetail}

Absolvierte Einheiten (${loggedCount}/${plannedCount}):
${logsDetail || 'Keine Logs vorhanden'}
${skippedDetail}

${missedDetail}
${previousContext}
${hfContext}
${kmContext}
${regenContext}
${nextRegenContext}
${schuhContext}

Nächste Woche (bitte anpassen falls nötig):
${nextWeekDetail}

Plan: ${plan?.title || 'Trainingsplan'}, Ziel: ${plan?.goal || 'unbekannt'}`
        }]
      })
    })

    const data = await response.json()
    const text = data.content[0].text
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
