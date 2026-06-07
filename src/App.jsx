import { useState } from 'react'
import Onboarding from './components/Onboarding.jsx'
import TrainingPlan from './components/TrainingPlan.jsx'

function App() {
  const [plan, setPlan] = useState(null)

  return plan
    ? <TrainingPlan plan={plan} onReset={() => setPlan(null)} />
    : <Onboarding onPlanGenerated={setPlan} />
}

export default App
