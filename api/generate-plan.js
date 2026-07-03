export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, zielTyp, niveau, goal, goalTime, previousTime, startDate, weeksUntilRace, runsPerWeek } = req.body

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

  const systemPrompt = `Du bist ein professioneller Lauftrainer. Erstelle einen personalisierten Trainingsplan als JSON.

Antworte NUR mit validem JSON, kein Markdown, keine Erklärungen.

Das JSON muss exakt diesem Schema folgen:
{
  "title": "12-Wochen Trainingsplan",
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
- Spezifisch: accent #e11d48, light #fff1f2, mid #fda4af, soft #ffe4e6
- Tapering: accent #7c3aed, light #f5f3ff, mid #c4b5fd, soft #ede9fe

Wichtige Regeln:
- Passe den Plan vollständig an Niveau, Ziel und Zeiten an
- Bei Anfänger: sanfter Einstieg, viel Gehen erlaubt, kurze Distanzen, langsame Paces
- Bei Fortgeschritten: ausgewogener Mix aus Tempo und Ausdauer
- Bei Erfahren: anspruchsvolle Intervalle, Tempodauerläufe, höhere Paces
- Bei "starten": kein Rennen, Fokus auf Gewohnheit aufbauen, Laufen/Gehen Wechsel
- Nutze genau ${runsPerWeek} Pflichtläufe pro Woche (optional: 1 zusätzlicher)
- Verwende KEINE Fahrtspiele als Trainingseinheit – nutze stattdessen Intervalle oder Tempodauerläufe
- Berechne alle Datumsangaben ab Startdatum ${startDate}
- Regenerationswochen (regen: true) alle 4 Wochen
- Letzte Woche: race: true (außer bei zielTyp "starten")`

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
Name: ${name || 'Läufer/in'}
Niveau: ${niveauBeschreibung}
Ziel: ${name || 'die Person'} ${zielBeschreibung}
${distanzInfo}
${zeitInfo}
Läufe pro Woche: ${runsPerWeek}
Startdatum: ${startDate}`
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
