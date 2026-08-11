import { useEffect, useState } from 'react'
import {
  TRAINING_EFFORT_OPTIONS,
  TRAINING_RECOVERY_OPTIONS,
  parseTrainingFeedback,
} from '../lib/trainingFeedback.js'

export default function TrainingFeedbackModal({ open, feeling, note = '', saving = false, onClose, onSave }) {
  const [effort, setEffort] = useState('')
  const [recovery, setRecovery] = useState('')
  const [noteValue, setNoteValue] = useState('')

  useEffect(() => {
    if (!open) return
    const current = parseTrainingFeedback(feeling)
    setEffort(current.effort || '')
    setRecovery(current.recovery || '')
    setNoteValue(note || '')
  }, [open, feeling, note])

  if (!open) return null

  const optionButton = (item, selected, onClick) => (
    <button
      key={item.value}
      type="button"
      onClick={onClick}
      style={{
        padding:'11px 8px',
        borderRadius:14,
        border:selected ? '2px solid #FF8C69' : '1.5px solid #F0E2D8',
        background:selected ? '#FFF3EC' : '#FFFDFC',
        color:selected ? '#B85F45' : '#6F5A50',
        fontSize:11,
        fontWeight:800,
        cursor:'pointer',
        fontFamily:'sans-serif',
        display:'grid',
        gap:4,
        placeItems:'center',
        minHeight:66,
      }}
    >
      <span style={{fontSize:21}}>{item.emoji}</span>
      <span>{item.label}</span>
    </button>
  )

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(60,30,20,.45)',zIndex:150,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
      <div style={{background:'#fff',borderRadius:'28px 28px 0 0',padding:'20px 18px 38px',width:'100%',maxWidth:520,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 -8px 40px rgba(255,140,105,.18)'}}>
        <div style={{width:36,height:4,background:'#F0E8E0',borderRadius:99,margin:'0 auto 17px'}} />
        <div style={{fontSize:20,fontWeight:850,color:'#3D2B1F',fontFamily:'Georgia, serif'}}>Wie war dein Training?</div>
        <div style={{fontSize:11,color:'#A48C7D',fontFamily:'sans-serif',marginTop:5,lineHeight:1.45}}>Zwei kurze Angaben helfen deinem Wochen-Coach, Messwerte und Körpergefühl gemeinsam einzuordnen.</div>

        <div style={{marginTop:18}}>
          <div style={{fontSize:10,fontWeight:900,color:'#9B8071',letterSpacing:.7,fontFamily:'sans-serif',marginBottom:8}}>WIE HAT ES SICH ANGEFÜHLT?</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:7}}>
            {TRAINING_EFFORT_OPTIONS.map(item => optionButton(item, effort === item.value, () => setEffort(item.value)))}
          </div>
        </div>

        <div style={{marginTop:18}}>
          <div style={{fontSize:10,fontWeight:900,color:'#9B8071',letterSpacing:.7,fontFamily:'sans-serif',marginBottom:8}}>WIE FÜHLST DU DICH DANACH?</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:7}}>
            {TRAINING_RECOVERY_OPTIONS.map(item => optionButton(item, recovery === item.value, () => setRecovery(item.value)))}
          </div>
        </div>

        <div style={{marginTop:18}}>
          <div style={{fontSize:10,fontWeight:900,color:'#9B8071',letterSpacing:.7,fontFamily:'sans-serif',marginBottom:6}}>ETWAS BESONDERES? <span style={{fontWeight:500,color:'#C5B1A5'}}>optional</span></div>
          <textarea
            value={noteValue}
            onChange={event => setNoteValue(event.target.value)}
            placeholder="Kurze Notiz …"
            rows={2}
            style={{width:'100%',padding:'11px 12px',borderRadius:13,border:'1.5px solid #F0E2D8',fontSize:13,color:'#3D2B1F',resize:'none',outline:'none',boxSizing:'border-box',background:'#FFF9F5',fontFamily:'sans-serif'}}
          />
        </div>

        <div style={{display:'flex',gap:8,marginTop:18}}>
          <button type="button" onClick={onClose} disabled={saving} style={{flex:1,padding:14,borderRadius:16,border:'1.5px solid #F0E2D8',background:'#fff',color:'#A58D80',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'sans-serif'}}>Später</button>
          <button
            type="button"
            onClick={() => onSave?.({ effort, recovery, note: noteValue.trim() })}
            disabled={!effort || !recovery || saving}
            style={{flex:2,padding:14,borderRadius:16,border:'none',background:!effort || !recovery || saving ? '#E8DED8' : 'linear-gradient(135deg,#FF8C69,#FF6F91)',color:'#fff',fontSize:13,fontWeight:850,cursor:!effort || !recovery || saving ? 'default' : 'pointer',fontFamily:'sans-serif'}}
          >
            {saving ? 'Speichere…' : 'Fertig ✓'}
          </button>
        </div>
      </div>
    </div>
  )
}
