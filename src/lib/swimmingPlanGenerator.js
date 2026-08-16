const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
const round25=v=>Math.max(25,Math.round(Number(v||0)/25)*25)
export const SWIM_PLAN_VERSION='swim-v1'

export const getRecommendedSwimmingWeeks=form=>{
  const goal=form.goalType
  const target=Number(form.targetDistanceM||0)
  const continuous=Number(form.currentContinuousM||0)
  const total=Number(form.currentSessionM||0)
  const units=Math.max(2,Math.min(4,Number(form.unitsPerWeek||3)))
  const continuousGoal=form.continuousGoal!=='no'

  if(goal==='beginner') return units>=3?8:10
  if(goal==='fitness') return total>=2000?(units>=3?8:10):(units>=3?10:12)

  if(goal==='distance'||goal==='event'){
    let weeks=
      target<=500?8:
      target<=1000?9:
      target<=1500?10:
      target<=2000?12:
      target<=3000?14:
      target<=5000?16:
      target<=7500?18:20

    const baseline=continuousGoal
      ? Math.max(continuous,50)
      : Math.max(total,250)

    const ratio=target>0?target/baseline:1

    if(ratio>10) weeks+=4
    else if(ratio>6) weeks+=2
    else if(ratio>3) weeks+=1
    else if(ratio<=1.5) weeks-=2

    if(total>=target*0.8) weeks-=1
    if(units===2) weeks+=2
    if(units===4) weeks-=1

    weeks=Math.max(8,Math.min(24,weeks))
    return weeks%2===0?weeks:weeks+1
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
