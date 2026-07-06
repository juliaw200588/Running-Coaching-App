export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { weekLogs, plannedDays, weekNumber, plan, nextWeekDays, previousAnalyses, schuhWarnung, isRegenWeek, nextIsRegenWeek, currentHFMax, aktuelleWochenKm } = req.body

  try {
    const loggedCount = weekLogs.filter(l => l.logged).length
    const plannedCount = plannedDays.length
    const missedDays = plannedDays.filter(d => !weekLogs.find(l => l.key === d.key && l.logged))

    const logsDetail = weekLogs
      .filter(l => l.logged)
      .map(l => `- ${l.tag} ${l.einheit}: ${l.pace ? `Pace ${l.pace}` : ''} ${l.km ? `/ ${l.km}` : ''} ${l.bpm ? `/ HF ${l.bpm}` : ''} ${l.note ? `/ Notiz: "${l.note}"` : ''}`)
      .join('\n')

    const plannedDetail = plannedDays
      .map(d => `- ${d.tag} ${d.einheit}: ${d.details}`)
      .join('\n')

    const missedDetail = missedDays.length > 0
      ? `Ausgefallene Einheiten:\n${missedDays.map(d => `- ${d.tag} ${d.einheit}`).join('\n')}`
      : 'Alle Einheiten absolviert!'

    const nextWeekDetail = nextWeekDays
      ? nextWeekDays.map(d => `- ${d.tag} ${d.einheit}: ${d.details}`).join('\n')
      : 'Letzte Woche des Plans'

    const previousContext = previousAnalyses?.length > 0
      ? `\nVorherige Wochen (Kontext):\n${previousAnalyses.map(a => `- Woche ${a.week_number}: ${a.analysis} → ${a.next_week_adjustment || 'keine Anpassung'}`).join('\n')}`
      : ''

    const hfContext = currentHFMax
      ? `\nAktuelle maximale Herzfrequenz: ${currentHFMax} bpm. Zone 2: ${Math.round(currentHFMax*0.6)}-${Math.round(currentHFMax*0.7)} bpm, Zone 4: ${Math.round(currentHFMax*0.8)}-${Math.round(currentHFMax*0.9)} bpm`
      : ''
    const kmContext = aktuelleWochenKm
      ? `\nAktuelle Wochenkilometer laut Profil: ${aktuelleWochenKm} km`
      : ''
    const regenContext = isRegenWeek
      ? '
⚡ Diese Woche war eine Regenerationswoche – niedrigerer Umfang ist normal und gewollt.'
      : ''
    const nextRegenContext = nextIsRegenWeek
      ? '
💤 Nächste Woche ist eine Regenerationswoche – Umfang soll bewusst reduziert bleiben, keine Steigerung!'
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
- Pace zu schnell → Details anpassen, Zone 2 betonen
- Einheiten ausgefallen → Umfang reduzieren, Regeneration
- Eine Woche perfekt → leichte Steigerung möglich (5-10% mehr Umfang oder leicht intensiver)
- Mehrere Wochen perfekt → etwas mehr Steigerung (bis 10%), nächste Stufe der Periodisierung
- Eine Woche schlecht/ausgefallen → sofort anpassen, nicht abwarten
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
