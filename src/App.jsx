import { useState, useEffect } from 'react'
import Onboarding from './components/Onboarding.jsx'
import TrainingPlan from './components/TrainingPlan.jsx'

function App() {
  const [plan, setPlan] = useState(() => {
    try {
      const saved = localStorage.getItem('runcoaching_plan')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const handlePlanGenerated = (newPlan) => {
    localStorage.setItem('runcoaching_plan', JSON.stringify(newPlan))
    setPlan(newPlan)
  }

  const handleReset = () => {
    localStorage.removeItem('runcoaching_plan')
    setPlan(null)
  }

  return plan
    ? <TrainingPlan plan={plan} onReset={handleReset} />
    : <Onboarding onPlanGenerated={handlePlanGenerated} />
}

export default App