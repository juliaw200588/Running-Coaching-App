import { useState } from 'react'
import Onboarding from './components/Onboarding.jsx'

function App() {
  const [plan, setPlan] = useState(null)

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '0 auto', padding: 16 }}>
      {!plan ? (
        <Onboarding onPlanGenerated={setPlan} />
      ) : (
        <div>
          <h2>Dein Trainingsplan</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{plan}</pre>
          <button onClick={() => setPlan(null)}>Neu starten</button>
        </div>
      )}
    </div>
  )
}

export default App
