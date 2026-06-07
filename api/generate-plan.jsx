export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { goalTime, previousTime, weeksUntilRace, runsPerWeek } = req.body

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Erstelle einen ${weeksUntilRace}-wöchigen Halbmarathon-Trainingsplan.
Zielzeit: ${goalTime}h
Bisherige Zeit: ${previousTime}
Läufe pro Woche: ${runsPerWeek}
Antworte auf Deutsch, strukturiert nach Wochen.`
      }]
    })
  })

  const data = await response.json()
  res.status(200).json({ plan: data.content[0].text })
}
