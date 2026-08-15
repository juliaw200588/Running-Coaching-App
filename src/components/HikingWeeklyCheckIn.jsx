import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const options = {
  feet_status: [
    ['good','Füße unauffällig'],
    ['sensitive','Druckstellen / empfindlich'],
    ['blisters','Blasen / deutliche Probleme'],
  ],
  recovery_status: [
    ['good','Am Folgetag gut erholt'],
    ['medium','Noch deutlich müde'],
    ['poor','Länger als erwartet beeinträchtigt'],
  ],
  body_status: [
    ['good','Keine relevanten Beschwerden'],
    ['mild','Leichte Beschwerden'],
    ['strong','Deutlich / anhaltend'],
  ],
  nutrition_status: [
    ['good','Hat gut funktioniert'],
    ['mixed','Teilweise gut'],
    ['poor','Hat nicht gut funktioniert'],
    ['not_tested','Nicht getestet'],
  ],
  equipment_status: [
    ['good','Schuhe / Ausrüstung passen'],
    ['mixed','Kleine Probleme'],
    ['poor','Sollte angepasst werden'],
    ['not_tested','Nicht relevant / nicht getestet'],
  ],
}

export default function HikingWeeklyCheckIn({
  open,
  user,
  weekNumber,
  weekStart,
  onSaved,
  onClose,
}) {
  const [form, setForm] = useState({
    feet_status:'',
    recovery_status:'',
    body_status:'',
    nutrition_status:'',
    equipment_status:'',
    note:'',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const canSave =
    form.feet_status &&
    form.recovery_status &&
    form.body_status

  const save = async () => {
    if (!canSave || !user?.id) return

    setSaving(true)
    setError(null)

    try {
      const { error: saveError } = await supabase
        .from('week_checkins')
        .upsert({
          user_id:user.id,
          week_number:weekNumber,
          week_start:weekStart,
          plan_sport:'hiking',
          ...form,
        }, { onConflict:'user_id,week_start' })

      if (saveError) throw saveError
      onSaved?.()
    } catch (e) {
      console.error('[HikingWeeklyCheckIn] Speichern fehlgeschlagen:', e)
      setError('Dein Wochen-Check konnte gerade nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  const block = (field, title, items, optional=false) => (
    <div style={{marginBottom:18}}>
      <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,letterSpacing:.8,color:'#9B8173',textTransform:'uppercase',marginBottom:8}}>
        {title}{optional && <span style={{fontWeight:600,textTransform:'none',letterSpacing:0,color:'#C4B1A6'}}> · optional</span>}
      </div>
      <div style={{display:'grid',gap:7}}>
        {items.map(([id,label]) => {
          const selected=form[field]===id
          return (
            <button key={id} type="button" onClick={() => setForm(current => ({...current,[field]:id}))}
              style={{padding:'11px 12px',borderRadius:12,border:`1.5px solid ${selected?'#7EC8A4':'#EEE3DC'}`,background:selected?'#F2FAF5':'#fff',color:selected?'#4F9476':'#79695F',fontFamily:'sans-serif',fontSize:10.8,fontWeight:800,textAlign:'left',cursor:'pointer'}}>
              {selected?'✓ ':''}{label}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div style={{position:'fixed',inset:0,zIndex:140,background:'rgba(42,33,28,.55)',display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div style={{width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto',background:'#FFFDFC',borderRadius:'26px 26px 0 0',padding:'22px 20px 34px',boxShadow:'0 -10px 40px rgba(0,0,0,.16)'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:18}}>
          <div>
            <div style={{fontFamily:'sans-serif',fontSize:9.5,fontWeight:900,letterSpacing:1,color:'#6D927B'}}>WOCHEN-CHECK · WOCHE {weekNumber}</div>
            <h2 style={{fontFamily:"'Georgia','Times New Roman',serif",fontSize:23,lineHeight:1.08,color:'#3D2B1F',margin:'6px 0 5px'}}>Wie hat dein Körper die Woche vertragen?</h2>
            <p style={{fontFamily:'sans-serif',fontSize:10.5,lineHeight:1.5,color:'#9A8478',margin:0}}>Deine Rückmeldung hilft dabei, die nächste Woche konservativ und passend weiterzuführen.</p>
          </div>
          <button type="button" onClick={onClose} style={{border:'none',background:'#F3ECE8',width:32,height:32,borderRadius:'50%',cursor:'pointer',color:'#8F796D'}}>×</button>
        </div>

        {block('feet_status','Füße & Haut',options.feet_status)}
        {block('body_status','Gelenke & Muskulatur',options.body_status)}
        {block('recovery_status','Erholung am Folgetag',options.recovery_status)}
        {block('nutrition_status','Verpflegung',options.nutrition_status,true)}
        {block('equipment_status','Ausrüstung',options.equipment_status,true)}

        <div style={{marginBottom:18}}>
          <div style={{fontFamily:'sans-serif',fontSize:10,fontWeight:900,letterSpacing:.8,color:'#9B8173',textTransform:'uppercase',marginBottom:7}}>Möchtest du noch etwas ergänzen? <span style={{fontWeight:600,textTransform:'none',letterSpacing:0,color:'#C4B1A6'}}>optional</span></div>
          <textarea value={form.note} onChange={e => setForm(current => ({...current,note:e.target.value}))}
            placeholder="z. B. Blase am rechten Fuß, neue Schuhe, Verpflegung war zu wenig …"
            style={{width:'100%',minHeight:80,boxSizing:'border-box',resize:'vertical',padding:'12px 13px',borderRadius:13,border:'1.5px solid #EADFD8',background:'#FFF9F5',fontFamily:'sans-serif',fontSize:12,color:'#3D2B1F',outline:'none'}} />
        </div>

        {error && <div style={{marginBottom:12,padding:'10px 12px',borderRadius:11,background:'#FDECEA',color:'#B85464',fontFamily:'sans-serif',fontSize:10.5}}>{error}</div>}

        <button type="button" disabled={!canSave||saving} onClick={save}
          style={{width:'100%',padding:15,borderRadius:16,border:'none',background:canSave&&!saving?'linear-gradient(135deg,#7EC8A4,#5BA88A)':'#EDE7E3',color:canSave&&!saving?'#fff':'#B7A69C',fontFamily:'sans-serif',fontWeight:900,fontSize:13,cursor:canSave&&!saving?'pointer':'default'}}>
          {saving?'Wird gespeichert…':'Wochen-Check abschließen →'}
        </button>
      </div>
    </div>
  )
}
