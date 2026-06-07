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
      const response = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      onPlanGenerated(data.plan)
    } catch (e) {
      onPlanGenerated('Fehler: ' + e.message)
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
      <label>Läufe pro Woche<br />
        <input type="number" value={form.runsPerWeek}
          onChange={e => setForm({...form, runsPerWeek: e.target.value})} />
      </label><br /><br />
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Wird generiert...' : 'Plan generieren'}
      </button>
    </div>
  )
}