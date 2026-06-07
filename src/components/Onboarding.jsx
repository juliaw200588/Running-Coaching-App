import { useState } from 'react'

export default function Onboarding({ onPlanGenerated }) {
  const [form, setForm] = useState({
    goalTime: '2:05',
    previousTime: '2:14:38',
    weeksUntilRace: 16,
    runsPerWeek: 3,
  })
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Erstelle einen ${form.weeksUntilRace}-wöchigen Halbmarathon-Trainingsplan.
Zielzeit: ${form.goalTime}h
Bisherige Zeit: ${form.previousTime}
Läufe pro Woche: ${form.runsPerWeek}
Antworte auf Deutsch, strukturiert nach Wochen.`
          }]
        })
      })
      const data = await response.json()
      onPlanGenerated(data.content[0].text)
    } catch (e) {
      onPlanGenerated('Fehler beim Laden. Bitte erneut versuchen.')
    }
    setLoading(false)
  }

  return (
    <div>
      <h1>🏃‍♀️ Run Coaching App</h1>
      <label>Zielzeit (h:mm)<br />
        <input value={form.goalTime}
          onChange={e => setForm({...form, goalTime: e.target.value})} />

      </label><br /><br />
      <label>Bisherige HM-Zeit<br />
        <input value={form.previousTime}
          onChange={e => setForm({...form, previousTime: e.target.value})} />
      </label><br /><br />
      <label>Wochen bis zum Rennen<br />
        <input type="number" value={form.weeksUntilRace}
          onChange={e => setForm({...form, weeksUntilRace: e.target.value})} />
      </label><br /><br />
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Wird generiert...' : 'Plan generieren'}
      </button>
    </div>
  )
}