import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const SPORT_META = {
  running: { icon: '🏃', label: 'Laufen' },
  hiking: { icon: '🥾', label: 'Wandern' },
  cycling: { icon: '🚴', label: 'Radfahren' },
  mountain_biking: { icon: '🚵', label: 'Mountainbike' },
  swimming: { icon: '🏊', label: 'Schwimmen' },
  hyrox: { icon: '🏋️', label: 'HYROX' },
}

const formatDate = (value) => {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const daysUntil = (value) => {
  if (!value) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${value}T00:00:00`)
  return Math.max(0, Math.ceil((target - today) / 86400000))
}

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '♡'

function Avatar({ profile, size = 42 }) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt=""
        style={{
          width:size, height:size, borderRadius:'50%', objectFit:'cover',
          border:'2px solid rgba(255,255,255,.9)', boxShadow:'0 3px 10px rgba(72,51,38,.10)'
        }}
      />
    )
  }

  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', display:'grid', placeItems:'center',
      background:'linear-gradient(135deg,#FFE8D9,#F4F7E9)', color:'#A86652',
      border:'2px solid rgba(255,255,255,.9)', fontWeight:900, fontSize:size*.30,
      fontFamily:'sans-serif',
    }}>
      {initials(profile?.name)}
    </div>
  )
}

function CreateGoalModal({ user, onClose, onCreated }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    sport_type:'running',
    goal_type:'event',
    title:'',
    target_date:'',
    target_distance:'',
    description:'',
  })

  const patch = values => setForm(current => ({ ...current, ...values }))

  const createGoal = async () => {
    if (!form.title.trim()) {
      setError('Gib deinem gemeinsamen Ziel bitte einen Namen.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: goal, error: goalError } = await supabase
        .from('shared_goals')
        .insert({
          created_by:user.id,
          title:form.title.trim(),
          goal_type:form.goal_type,
          sport_type:form.sport_type,
          target_date:form.target_date || null,
          target_distance:form.target_distance ? Number(form.target_distance) : null,
          target_unit:form.target_distance ? 'km' : null,
          description:form.description.trim() || null,
        })
        .select()
        .single()

      if (goalError) throw goalError

      const { error: memberError } = await supabase
        .from('shared_goal_members')
        .insert({
          goal_id:goal.id,
          user_id:user.id,
          role:'owner',
          status:'active',
        })

      if (memberError) throw memberError

      onCreated?.(goal)
    } catch (e) {
      console.error('[Gemeinsam] Ziel konnte nicht erstellt werden:', e)
      setError('Das gemeinsame Ziel konnte gerade nicht erstellt werden.')
    } finally {
      setSaving(false)
    }
  }

  const sport = SPORT_META[form.sport_type] || SPORT_META.running

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:180, background:'rgba(42,30,23,.38)',
      display:'flex', alignItems:'flex-end', justifyContent:'center',
    }}>
      <div style={{
        width:'100%', maxWidth:720, maxHeight:'92vh', overflowY:'auto',
        borderRadius:'28px 28px 0 0', background:'#FFFDFC',
        boxShadow:'0 -18px 50px rgba(54,37,27,.18)',
        padding:'18px 18px calc(24px + env(safe-area-inset-bottom,0px))',
      }}>
        <div style={{ width:48, height:5, borderRadius:99, background:'#E7DCD5', margin:'0 auto 16px' }} />
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:1.2, fontWeight:900, color:'#D56D55', fontFamily:'sans-serif' }}>
              {step} · {step === 1 ? 'ZIEL' : step === 2 ? 'DETAILS' : 'GEMEINSAM'}
            </div>
            <h2 style={{
              margin:'6px 0 4px', color:'#3D2B1F',
              fontFamily:"'Georgia','Times New Roman',serif", fontSize:27, lineHeight:1.1
            }}>
              {step === 1 ? 'Was verbindet euch?' : step === 2 ? 'Mach das Ziel konkret.' : 'Bereit für euren Weg.'}
            </h2>
            <p style={{ margin:0, color:'#947E72', fontSize:12, lineHeight:1.55, fontFamily:'sans-serif' }}>
              Jeder trainiert individuell. Das Ziel erlebt ihr gemeinsam.
            </p>
          </div>
          <button onClick={onClose} type="button" style={{
            border:'none', background:'#F6F0EC', width:36, height:36, borderRadius:'50%',
            cursor:'pointer', color:'#7D695D', fontSize:18
          }}>×</button>
        </div>

        {step === 1 && (
          <>
            <div style={{ marginTop:20, fontSize:11, fontWeight:900, color:'#725F54', fontFamily:'sans-serif' }}>
              SPORTART
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:10, marginTop:10 }}>
              {Object.entries(SPORT_META).filter(([id]) => id !== 'hyrox').map(([id, item]) => {
                const active = form.sport_type === id
                return (
                  <button key={id} type="button" onClick={() => patch({ sport_type:id })}
                    style={{
                      border:active ? '2px solid #FF9678' : '1.5px solid #EADFD8',
                      background:active ? '#FFF2EC' : '#fff',
                      borderRadius:18, padding:'14px 12px', textAlign:'left', cursor:'pointer'
                    }}>
                    <div style={{ fontSize:23 }}>{item.icon}</div>
                    <div style={{ marginTop:6, color:'#4A382E', fontSize:13, fontWeight:900, fontFamily:'sans-serif' }}>{item.label}</div>
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop:18, fontSize:11, fontWeight:900, color:'#725F54', fontFamily:'sans-serif' }}>
              ZIELART
            </div>
            <div style={{ display:'grid', gap:9, marginTop:9 }}>
              {[
                ['event','🏁','Wettkampf / Event','Gemeinsam auf einen festen Termin hintrainieren.'],
                ['distance','🎯','Distanzziel','Eine Strecke gemeinsam erreichen.'],
                ['consistency','✨','Gemeinsamer Zeitraum','Über mehrere Wochen gemeinsam dranbleiben.'],
                ['custom','♡','Freies Ziel','Euer eigenes gemeinsames Vorhaben.'],
              ].map(([id, icon, title, text]) => {
                const active = form.goal_type === id
                return (
                  <button key={id} type="button" onClick={() => patch({ goal_type:id })}
                    style={{
                      display:'flex', gap:12, alignItems:'center', textAlign:'left', cursor:'pointer',
                      border:active ? '2px solid #FF9678' : '1.5px solid #EADFD8',
                      background:active ? '#FFF6F1' : '#fff', borderRadius:17, padding:'12px 13px'
                    }}>
                    <div style={{ width:38, height:38, borderRadius:13, background:'#FFF0E7', display:'grid', placeItems:'center', fontSize:18 }}>{icon}</div>
                    <div>
                      <div style={{ color:'#4A382E', fontWeight:900, fontSize:12.5, fontFamily:'sans-serif' }}>{title}</div>
                      <div style={{ color:'#9A8578', fontSize:10.5, marginTop:2, lineHeight:1.4, fontFamily:'sans-serif' }}>{text}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <div style={{ marginTop:20, display:'grid', gap:13 }}>
            <label style={{ fontFamily:'sans-serif', fontSize:11, fontWeight:900, color:'#725F54' }}>
              NAME DES ZIELS
              <input value={form.title} onChange={e => patch({ title:e.target.value })}
                placeholder={`${sport.label} – unser gemeinsames Ziel`}
                style={{
                  marginTop:7, width:'100%', boxSizing:'border-box', padding:'13px 14px',
                  borderRadius:15, border:'1.5px solid #EADFD8', fontSize:13, color:'#49372C',
                  outline:'none', background:'#fff'
                }} />
            </label>

            <label style={{ fontFamily:'sans-serif', fontSize:11, fontWeight:900, color:'#725F54' }}>
              ZIELDATUM <span style={{ color:'#B39F94', fontWeight:600 }}>(optional)</span>
              <input type="date" value={form.target_date} onChange={e => patch({ target_date:e.target.value })}
                style={{
                  marginTop:7, width:'100%', boxSizing:'border-box', padding:'13px 14px',
                  borderRadius:15, border:'1.5px solid #EADFD8', fontSize:13, color:'#49372C',
                  outline:'none', background:'#fff'
                }} />
            </label>

            {(form.goal_type === 'distance' || form.goal_type === 'event') && (
              <label style={{ fontFamily:'sans-serif', fontSize:11, fontWeight:900, color:'#725F54' }}>
                DISTANZ <span style={{ color:'#B39F94', fontWeight:600 }}>(optional)</span>
                <div style={{ position:'relative', marginTop:7 }}>
                  <input inputMode="decimal" value={form.target_distance} onChange={e => patch({ target_distance:e.target.value.replace(',','.') })}
                    placeholder="z. B. 21,1"
                    style={{
                      width:'100%', boxSizing:'border-box', padding:'13px 48px 13px 14px',
                      borderRadius:15, border:'1.5px solid #EADFD8', fontSize:13, color:'#49372C',
                      outline:'none', background:'#fff'
                    }} />
                  <span style={{ position:'absolute', right:14, top:14, color:'#A28C80', fontSize:12 }}>km</span>
                </div>
              </label>
            )}

            <label style={{ fontFamily:'sans-serif', fontSize:11, fontWeight:900, color:'#725F54' }}>
              KURZE NOTIZ <span style={{ color:'#B39F94', fontWeight:600 }}>(optional)</span>
              <textarea value={form.description} onChange={e => patch({ description:e.target.value })}
                placeholder="Was macht dieses Ziel für euch besonders?"
                rows={3}
                style={{
                  marginTop:7, width:'100%', resize:'vertical', boxSizing:'border-box',
                  padding:'13px 14px', borderRadius:15, border:'1.5px solid #EADFD8',
                  fontSize:13, color:'#49372C', outline:'none', background:'#fff',
                  fontFamily:'sans-serif'
                }} />
            </label>
          </div>
        )}

        {step === 3 && (
          <div style={{
            marginTop:22, padding:18, borderRadius:22,
            background:'linear-gradient(145deg,#FFF0E5,#FFF8F2 54%,#F2F8EF)',
            border:'1px solid #F3D9CA'
          }}>
            <div style={{ fontSize:30 }}>{sport.icon}</div>
            <div style={{
              marginTop:9, fontFamily:"'Georgia','Times New Roman',serif",
              fontSize:23, fontWeight:700, color:'#3D2B1F'
            }}>{form.title || 'Euer gemeinsames Ziel'}</div>
            <div style={{ marginTop:8, color:'#8D776A', fontSize:12, lineHeight:1.55, fontFamily:'sans-serif' }}>
              Das Ziel wird zunächst für dich angelegt. Anschließend kannst du direkt einen sicheren Einladungslink teilen.
            </div>
            <div style={{
              marginTop:14, padding:'11px 12px', borderRadius:14,
              background:'rgba(255,255,255,.75)', color:'#7B665A', fontSize:11.5, fontFamily:'sans-serif'
            }}>
              ♡ Gemeinsames Ziel · individuelle Trainingssteuerung
            </div>
          </div>
        )}

        {error && <div style={{ marginTop:14, color:'#C6544C', fontSize:11.5, fontFamily:'sans-serif' }}>{error}</div>}

        <div style={{ display:'flex', gap:9, marginTop:20 }}>
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} disabled={saving}
              style={{
                flex:1, border:'1.5px solid #E5D9D2', background:'#fff', color:'#735E52',
                borderRadius:16, padding:'13px 12px', fontWeight:900, cursor:'pointer'
              }}>
              Zurück
            </button>
          )}
          <button type="button"
            onClick={() => step < 3 ? setStep(step + 1) : createGoal()}
            disabled={saving}
            style={{
              flex:2, border:'none', color:'#fff', borderRadius:16, padding:'14px 12px',
              fontWeight:900, cursor:saving ? 'default' : 'pointer',
              background:'linear-gradient(135deg,#FF8C69,#FF6B78)',
              boxShadow:'0 8px 20px rgba(255,112,91,.22)'
            }}>
            {step < 3 ? 'Weiter' : saving ? 'Wird erstellt…' : 'Gemeinsames Ziel erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Together({ user }) {
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState([])
  const [membersByGoal, setMembersByGoal] = useState({})
  const [profilesById, setProfilesById] = useState({})
  const [showCreate, setShowCreate] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!user?.id) return
    setLoading(true)

    try {
      const { data: memberships, error: membershipError } = await supabase
        .from('shared_goal_members')
        .select('goal_id, user_id, role, plan_id, status')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (membershipError) throw membershipError

      const ids = [...new Set((memberships || []).map(row => row.goal_id))]
      if (!ids.length) {
        setGoals([])
        setMembersByGoal({})
        setLoading(false)
        return
      }

      const [{ data: goalRows, error: goalError }, { data: memberRows, error: memberError }] = await Promise.all([
        supabase.from('shared_goals').select('*').in('id', ids).neq('status', 'archived').order('target_date', { ascending:true, nullsFirst:false }),
        supabase.from('shared_goal_members').select('goal_id, user_id, role, plan_id, status').in('goal_id', ids).eq('status', 'active'),
      ])

      if (goalError) throw goalError
      if (memberError) throw memberError

      const grouped = {}
      ;(memberRows || []).forEach(row => {
        grouped[row.goal_id] ||= []
        grouped[row.goal_id].push(row)
      })

      setGoals(goalRows || [])
      setMembersByGoal(grouped)

      const userIds = [...new Set((memberRows || []).map(row => row.user_id))]
      if (userIds.length) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', userIds)

        const profileMap = {}
        ;(profileRows || []).forEach(profile => { profileMap[profile.id] = profile })
        setProfilesById(profileMap)
      }
    } catch (e) {
      console.error('[Gemeinsam] Daten konnten nicht geladen werden:', e)
      // Falls die Migration noch nicht ausgeführt ist, bleibt der Screen als Empty State nutzbar.
      setGoals([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.id])

  const createInvite = async (goalId) => {
    setMessage('')
    try {
      const { data, error } = await supabase
        .from('shared_goal_invites')
        .insert({ goal_id:goalId, invited_by:user.id })
        .select('token')
        .single()

      if (error) throw error

      const link = `${window.location.origin}${window.location.pathname}?goalInvite=${data.token}`
      if (navigator.share) {
        await navigator.share({
          title:'Gemeinsames Trainingsziel',
          text:'Trainiere mit mir auf ein gemeinsames Ziel hin.',
          url:link,
        })
      } else {
        await navigator.clipboard.writeText(link)
        setMessage('Einladungslink wurde kopiert.')
      }
    } catch (e) {
      if (e?.name === 'AbortError') return
      console.error('[Gemeinsam] Einladung konnte nicht erstellt werden:', e)
      setMessage('Einladungslink konnte gerade nicht erstellt werden.')
    }
  }

  const primaryGoal = useMemo(() => {
    if (!goals.length) return null
    return goals.find(goal => goal.status === 'active') || goals[0]
  }, [goals])

  const otherGoals = primaryGoal ? goals.filter(goal => goal.id !== primaryGoal.id) : []

  const renderGoalCard = (goal, compact = false) => {
    const sport = SPORT_META[goal.sport_type] || { icon:'♡', label:'Gemeinsam' }
    const members = membersByGoal[goal.id] || []
    const others = members.filter(member => member.user_id !== user.id)
    const remaining = daysUntil(goal.target_date)

    return (
      <div key={goal.id} style={{
        borderRadius:compact ? 20 : 26, overflow:'hidden',
        border:'1.5px solid #F1D8C9',
        background:compact ? '#fff' : 'linear-gradient(145deg,#FFE9DB 0%,#FFF6EE 52%,#EEF7EE 100%)',
        boxShadow:'0 12px 34px rgba(82,56,42,.08)'
      }}>
        <div style={{ padding:compact ? 15 : 20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'flex-start' }}>
            <div>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:6, padding:'5px 9px',
                borderRadius:999, background:compact ? '#FFF2EA' : 'rgba(255,255,255,.72)',
                color:'#C96951', fontSize:9.5, fontWeight:900, fontFamily:'sans-serif'
              }}>
                {sport.icon} GEMEINSAMES ZIEL
              </div>
              <h2 style={{
                margin:'10px 0 5px', color:'#3B2A20',
                fontFamily:"'Georgia','Times New Roman',serif",
                fontSize:compact ? 19 : 27, lineHeight:1.08
              }}>
                {goal.title}
              </h2>
              <div style={{ color:'#8D7669', fontSize:11.5, fontFamily:'sans-serif', lineHeight:1.55 }}>
                {[formatDate(goal.target_date), remaining != null ? `Noch ${remaining} Tage` : null].filter(Boolean).join(' · ') || sport.label}
              </div>
            </div>
            <div style={{
              width:42, height:42, borderRadius:15, display:'grid', placeItems:'center',
              background:'rgba(255,255,255,.70)', fontSize:20
            }}>♡</div>
          </div>

          {!compact && (
            <>
              <div style={{ marginTop:18, display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:9 }}>
                {[{ user_id:user.id }, ...others].slice(0, 2).map((member, index) => {
                  const profile = profilesById[member.user_id] || (member.user_id === user.id ? { name:'Du' } : { name:'Trainingspartner' })
                  return (
                    <div key={`${member.user_id}-${index}`} style={{
                      background:'rgba(255,255,255,.80)', borderRadius:17, padding:12,
                      display:'flex', alignItems:'center', gap:9
                    }}>
                      <Avatar profile={profile} size={38} />
                      <div style={{ minWidth:0 }}>
                        <div style={{ color:'#49372C', fontSize:11.5, fontWeight:900, fontFamily:'sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {member.user_id === user.id ? 'Du' : (profile?.name || 'Trainingspartner')}
                        </div>
                        <div style={{ color:'#9A8578', fontSize:9.8, marginTop:2, fontFamily:'sans-serif' }}>
                          {member.user_id === user.id ? 'Dein individueller Weg' : 'Eigener Trainingsweg'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{
                marginTop:10, padding:'12px 13px', borderRadius:16,
                background:'rgba(255,255,255,.72)', color:'#786357',
                fontSize:11, lineHeight:1.5, fontFamily:'sans-serif'
              }}>
                {others.length
                  ? '♡ Ihr verfolgt dasselbe Ziel – eure Trainingspläne bleiben individuell.'
                  : 'Lade jemanden ein und macht aus deinem Ziel euer gemeinsames Ziel.'}
              </div>
            </>
          )}

          <button type="button" onClick={() => createInvite(goal.id)} style={{
            width:'100%', marginTop:compact ? 12 : 14, border:'none', borderRadius:15,
            background:compact ? '#FFF1E9' : 'linear-gradient(135deg,#FF8C69,#FF6B78)',
            color:compact ? '#C96851' : '#fff', padding:'12px 14px', fontWeight:900,
            cursor:'pointer', fontFamily:'sans-serif', fontSize:11.5
          }}>
            + Person zu diesem Ziel einladen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(160deg,#FFF8F0 0%,#F2FAF4 52%,#FFF0F5 100%)',
      padding:'34px 16px 120px', boxSizing:'border-box'
    }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div>
          <div style={{ color:'#CC755E', fontSize:10, fontWeight:900, letterSpacing:1.2, fontFamily:'sans-serif' }}>
            GEMEINSAM
          </div>
          <div style={{ marginTop:4 }}>
            <h1 style={{
              margin:0, color:'#3D2B1F', fontFamily:"'Georgia','Times New Roman',serif",
              fontSize:'clamp(30px,7vw,42px)', lineHeight:1.05
            }}>Gemeinsam</h1>
          </div>
          <p style={{ margin:'8px 0 0', color:'#8F796C', fontSize:12.5, lineHeight:1.55, fontFamily:'sans-serif' }}>
            Ziele verbinden. Training bleibt individuell.
          </p>
        </div>

        {loading ? (
          <div style={{ marginTop:26, color:'#AA9488', fontSize:12, fontFamily:'sans-serif' }}>Lade deine gemeinsamen Ziele…</div>
        ) : primaryGoal ? (
          <div style={{ marginTop:24 }}>{renderGoalCard(primaryGoal)}</div>
        ) : (
          <div style={{
            marginTop:24, borderRadius:26, minHeight:360,
            border:'1.5px solid #EED7CA', boxShadow:'0 14px 38px rgba(70,49,37,.12)',
            position:'relative', overflow:'hidden',
            backgroundImage:"url('/gemeinsam-hero-v1.png')",
            backgroundSize:'cover',
            backgroundPosition:'center',
          }}>
            <div style={{
              position:'absolute', inset:0,
              background:'linear-gradient(90deg, rgba(36,27,22,.82) 0%, rgba(36,27,22,.65) 34%, rgba(36,27,22,.26) 60%, rgba(36,27,22,.05) 100%)'
            }} />
            <div style={{
              position:'relative', zIndex:1, minHeight:360, boxSizing:'border-box',
              padding:'24px 22px', display:'flex', flexDirection:'column',
              justifyContent:'center', alignItems:'flex-start'
            }}>
              <div style={{
                fontSize:10, fontWeight:900, letterSpacing:1.15,
                color:'#FFB197', fontFamily:'sans-serif'
              }}>
                EUER NÄCHSTES ZIEL
              </div>
              <h2 style={{
                margin:'10px 0 10px', maxWidth:390, color:'#FFFFFF',
                fontFamily:"'Georgia','Times New Roman',serif",
                fontSize:'clamp(27px,5vw,34px)', lineHeight:1.08,
                textShadow:'0 2px 14px rgba(0,0,0,.20)'
              }}>
                Gemeinsam ist manches Ziel leichter.
              </h2>
              <p style={{
                margin:0, maxWidth:410, color:'rgba(255,255,255,.88)',
                fontSize:12.5, lineHeight:1.65, fontFamily:'sans-serif',
                textShadow:'0 1px 8px rgba(0,0,0,.20)'
              }}>
                Trainiert auf dasselbe Ziel hin, bleibt aber in euren Plänen individuell. Gemeinsame Einheiten verbinden eure Wege.
              </p>
              <button type="button" onClick={() => setShowCreate(true)} style={{
                marginTop:20, border:'none', borderRadius:16, padding:'14px 18px',
                minWidth:'min(340px, 100%)',
                color:'#fff', fontWeight:900, cursor:'pointer', fontFamily:'sans-serif',
                background:'linear-gradient(135deg,#FF8C69,#FF6B78)',
                boxShadow:'0 9px 22px rgba(255,112,91,.30)'
              }}>
                + Gemeinsames Ziel erstellen
              </button>
            </div>
          </div>
        )}

        {otherGoals.length > 0 && (
          <section style={{ marginTop:24 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
              <h3 style={{ margin:0, color:'#4A382E', fontFamily:"'Georgia','Times New Roman',serif", fontSize:20 }}>Weitere Ziele</h3>
              <button type="button" onClick={() => setShowCreate(true)} style={{
                border:'none', background:'transparent', color:'#D16D55', fontWeight:900, fontSize:10.5, cursor:'pointer'
              }}>+ Neues Ziel</button>
            </div>
            <div style={{ display:'grid', gap:10, marginTop:11 }}>
              {otherGoals.map(goal => renderGoalCard(goal, true))}
            </div>
          </section>
        )}

        {primaryGoal && (
          <section style={{ marginTop:24 }}>
            <h3 style={{ margin:'0 0 10px', color:'#4A382E', fontFamily:"'Georgia','Times New Roman',serif", fontSize:20 }}>
              Als Nächstes gemeinsam
            </h3>
            <div style={{
              border:'1.5px solid #E8E0DA', background:'rgba(255,255,255,.86)',
              borderRadius:19, padding:15, display:'flex', alignItems:'center', gap:12
            }}>
              <div style={{ width:43, height:43, borderRadius:14, display:'grid', placeItems:'center', background:'#FFF0E7', fontSize:19 }}>🏃</div>
              <div>
                <div style={{ color:'#4A382E', fontSize:12, fontWeight:900, fontFamily:'sans-serif' }}>Gemeinsame Einheit planen</div>
                <div style={{ color:'#9B8679', fontSize:10.5, marginTop:3, lineHeight:1.45, fontFamily:'sans-serif' }}>
                  Verknüpft später eure individuellen Einheiten zu einem gemeinsamen Training.
                </div>
              </div>
            </div>
          </section>
        )}

        {message && (
          <div style={{
            position:'fixed', left:'50%', transform:'translateX(-50%)', bottom:88, zIndex:160,
            background:'#443329', color:'#fff', padding:'10px 14px', borderRadius:999,
            fontSize:10.5, fontFamily:'sans-serif', boxShadow:'0 8px 24px rgba(0,0,0,.16)',
            whiteSpace:'nowrap', maxWidth:'86vw', overflow:'hidden', textOverflow:'ellipsis'
          }}>{message}</div>
        )}

        {showCreate && (
          <CreateGoalModal
            user={user}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false)
              load()
            }}
          />
        )}
      </div>
    </div>
  )
}
