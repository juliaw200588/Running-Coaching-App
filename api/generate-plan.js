export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { goalTime, previousTime, weeksUntilRace, runsPerWeek, name } = req.body

  const systemPrompt = `Du bist ein professioneller Lauftrainer. Erstelle einen personalisierten Halbmarathon-Trainingsplan als JSON.

Antworte NUR mit validem JSON, kein Markdown, keine Erklärungen.

Das JSON muss exakt diesem Schema folgen:
{
  "title": "16-Wochen Trainingsplan",
  "goal": "2:05h",
  "startDate": "2026-06-07",
  "phases": [
    {
      "id": "basis",
      "label": "Basisphase",
      "sub": "Wo. 1–4",
      "icon": "🌱",
      "dateRange": "7. Jun – 5. Jul",
      "description": "Kurze Beschreibung der Phase",
      "accent": "#059669",
      "light": "#ecfdf5",
      "mid": "#a7f3d0",
      "soft": "#d1fae5",
      "weeks": [
        {
          "n": 1,
          "dateRange": "07.06. – 13.06.",
          "days": [
            { "tag": "Di", "einheit": "Locker", "details": "30 min @ 7:00–7:15 min/km" },
            { "tag": "Do", "einheit": "Dauerlauf", "details": "40 min @ 6:45 min/km" },
            { "tag": "Sa", "einheit": "Langer Lauf", "details": "12 km @ 6:30 min/km" },
            { "tag": "So", "einheit": "Spazieren", "details": "kein Laufen", "optional": true }
          ]
        }
      ]
    }
  ]
}

Farben pro Phase:
- Basisphase: accent #059669, light #ecfdf5, mid #a7f3d0, soft #d1fae5
- Entwicklung: accent #d97706, light #fffbeb, mid #fcd34d, soft #fef3c7
- HM-spezifisch: accent #e11d48, light #fff1f2, mid #fda4af, soft #ffe4e6
- Tapering: accent #7c3aed, light #f5f3ff, mid #c4b5fd, soft #ede9fe

Wichtige Regeln:
- Passe die Phasen sinnvoll an die Anzahl der Wochen an
- Nutze genau ${runsPerWeek} Pflichtläufe pro Woche (optional: 1 zusätzlicher lockerer Lauf)
- Passe Paces an die bisherige Zeit ${previousTime} und Zielzeit ${goalTime}h an
- Heute ist der 07.06.2026, berechne Datumsangaben ab heute
- Regenerationswochen (regen: true) alle 4 Wochen
- Letzte Woche: race: true
- Einheitentypen: Locker, Dauerlauf, Fahrtspiel, Intervalle, Tempodauerlauf, HM-Pace Intervalle, Langer Lauf, Pause, Spazieren, Lauf mit HM-Pace, Locker + Strides, 🏁 RENNTAG`

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
          content: `Erstelle einen ${weeksUntilRace}-wöchigen Halbmarathon-Trainingsplan.
Name: ${name || 'Läuferin'}
Zielzeit: ${goalTime}h
Bisherige HM-Zeit: ${previousTime}
Läufe pro Woche: ${runsPerWeek}
Startdatum: 07.06.2026`
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
