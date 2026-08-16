const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
const round25=v=>Math.max(25,Math.round(Number(v||0)/25)*25)
export const SWIM_PLAN_VERSION='swim-v1'

export const getRecommendedSwimmingWeeks=form=>{
  const goal=form.goalType
  const target=Number(form.targetDistanceM||0)
  const continuous=Number(form.currentContinuousM||0)
  const total=Number(form.currentSessionM||0)
  if(goal==='beginner') return 8
  if(goal==='fitness') return total>=2000?8:10
  if(goal==='distance'||goal==='event'){
    const baseline=Math.max(continuous,total*0.45,100)
    const ratio=target>0?target/baseline:1
    if(target>=5000||ratio>=6) return 20
    if(target>=3000||ratio>=4) return 16
    if(target>=1500||ratio>=2.5) return 12
    return 10
  }
  return 10
}

export const buildSwimmingPlanGuardrails=form=>{
  const target=round25(form.targetDistanceM)
  const currentContinuous=round25(form.currentContinuousM)
  const currentSession=round25(form.currentSessionM)
  const weeks=clamp(Number(form.weeksUntilGoal||10),6,24)
  const units=clamp(Number(form.unitsPerWeek||3),2,4)
  return {
    version:SWIM_PLAN_VERSION,
    targetDistanceM:target||null,
    currentContinuousM:currentContinuous||null,
    currentSessionM:currentSession||null,
    weeks,unitsPerWeek:units,
    shortPreparation:Boolean(['distance','event'].includes(form.goalType)&&target>0&&currentContinuous>0&&target/currentContinuous>=4&&weeks<=10),
    rules:[
      'Technikqualität hat Vorrang vor bloßer Metersteigerung.',
      'Progression entsteht aus Gesamtumfang, längeren zusammenhängenden Abschnitten, passenden Pausen und Technik unter Ermüdung.',
      'Bei knapper Vorbereitungszeit keine aggressiven Sprünge erzwingen.',
      'Hilfsmittel nur verwenden, wenn sie laut Eingabe verfügbar sind.',
      'Freiwasser nur einplanen, wenn sichere Trainingsmöglichkeit vorhanden ist.'
    ]
  }
}
