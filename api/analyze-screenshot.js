export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { base64Data, mediaType } = req.body

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
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: `Lauf-App Screenshot (Polar, Garmin, Strava, Adidas Running o.ä.).
Extrahiere die Daten und antworte NUR mit diesem JSON, kein Markdown, keine Erklärung:
{"pace":"Ø Pace z.B. 6:19 min/km","km":"Distanz z.B. 14,2 km","bpm":"Ø HF z.B. 158 bpm","note":"Kurze Info z.B. 2:14h · Zone 4"}
Fehlende Werte als leerer String.` }
          ]
        }]
      })
    })

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message })

    const text = data.content[0].text
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    res.status(200).json({ result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
