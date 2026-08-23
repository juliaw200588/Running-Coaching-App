import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import Friends from './Friends.jsx'

const DAY_MS = 86400000
const dayKey = (phaseId, weekN, dayIdx) => `${phaseId}_w${weekN}_d${dayIdx}`

const SPORT_META = {
  running: { icon: '🏃', label: 'Laufen' },
  hiking: { icon: '🥾', label: 'Wandern' },
  cycling: { icon: '🚴', label: 'Radfahren' },
  mountain_biking: { icon: '🚵', label: 'Mountainbike' },
  swimming: { icon: '🏊', label: 'Schwimmen' },
  hyrox: { icon: '🏋️', label: 'HYROX' },
}

const GOAL_META = {
  event: { icon:'🏁', label:'Wettkampf / Event', text:'Gemeinsam auf einen festen Termin hintrainieren.' },
  distance: { icon:'🎯', label:'Distanzziel', text:'Eine Strecke gemeinsam erreichen.' },
  consistency: { icon:'🗓️', label:'Zeitraumziel', text:'Bis zu einem gemeinsamen Zeitpunkt zusammen dranbleiben.' },
  custom: { icon:'☆', label:'Freies Ziel', text:'Euer eigenes gemeinsames Vorhaben.' },
}

const localDate = value => {
  if (!value) return null
  if (value instanceof Date) {
    const d = new Date(value)
    d.setHours(0,0,0,0)
    return d
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return new Date(Number(match[1]), Number(match[2])-1, Number(match[3]))
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0,0,0,0)
  return d
}

const formatDate = value => {
  const date = localDate(value)
  if (!date) return null
  return new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'short', year:'numeric' }).format(date)
}

const formatShortDate = value => {
  const date = localDate(value)
  if (!date) return null
  return new Intl.DateTimeFormat('de-DE', { weekday:'short', day:'2-digit', month:'short' }).format(date)
}

const daysUntil = value => {
  const target = localDate(value)
  const today = localDate(new Date())
  if (!target || !today) return null
  return Math.max(0, Math.ceil((target - today) / DAY_MS))
}

const isPastDate = value => {
  const target = localDate(value)
  const today = localDate(new Date())
  return Boolean(target && today && target < today)
}

const getPlanWeeks = plan => {
  const result = []
  for (const phase of plan?.phases || []) {
    for (const week of phase.weeks || []) result.push({ phase, week })
  }
  return result
}

const getCurrentPlanContext = plan => {
  if (!plan?.startDate) return null
  const start = localDate(plan.startDate)
  const today = localDate(new Date())
  if (!start || !today) return null
  const days = Math.floor((today - start) / DAY_MS)
  const weeks = getPlanWeeks(plan)
  if (days < 0) return { beforeStart:true, weeks, start }
  const index = Math.floor(days / 7)
  if (index >= weeks.length) return { completed:true, weeks, start }
  const { phase, week } = weeks[index]
  return { index, phase, week, weeks, start }
}

const normalizeSport = value => {
  const raw = String(value || '').toLowerCase().trim()
  if (/mountain|mtb/.test(raw)) return 'mountain_biking'
  if (/cycle|cycling|rad/.test(raw)) return 'cycling'
  if (/swim|schwimm/.test(raw)) return 'swimming'
  if (/hik|wander|marsch/.test(raw)) return 'hiking'
  if (/hyrox/.test(raw)) return 'hyrox'
  if (/run|lauf/.test(raw)) return 'running'
  return raw || null
}

const inferPlanSport = plan =>
  normalizeSport(
    plan?.sportType ??
    plan?.sport_type ??
    plan?.sport ??
    plan?.meta?.sport ??
    plan?.meta?.sportType ??
    plan?.goal?.sport
  ) || 'running'

const initials = (name='') =>
  name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]?.toUpperCase()).join('') || '♡'

const card = {
  background:'#fff',
  border:'1px solid #EEE3DC',
  borderRadius:20,
  boxShadow:'0 8px 24px rgba(74,52,39,.055)',
  boxSizing:'border-box',
}

function Avatar({ profile, size=42 }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" style={{
      width:size, height:size, borderRadius:'50%', objectFit:'cover',
      border:'2px solid white', boxShadow:'0 3px 10px rgba(72,51,38,.12)'
    }} />
  }

  return <div style={{
    width:size, height:size, borderRadius:'50%', display:'grid', placeItems:'center',
    background:'linear-gradient(135deg,#FFE8D9,#F4F7E9)', color:'#A86652',
    border:'2px solid white', fontWeight:900, fontSize:size*.30, fontFamily:'sans-serif'
  }}>{initials(profile?.name)}</div>
}


const goalDraftKey = userId => `together_goal_draft_${userId || 'anon'}`
const goalModalKey = userId => `together_goal_modal_open_${userId || 'anon'}`

const loadGoalDraft = userId => {
  try {
    const raw = sessionStorage.getItem(goalDraftKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const clearGoalDraft = userId => {
  try {
    sessionStorage.removeItem(goalDraftKey(userId))
    sessionStorage.removeItem(goalModalKey(userId))
  } catch {}
}

function CreateGoalModal({ user, plan, planId, onClose, onCreated }) {
  const restoredDraft = useMemo(() => loadGoalDraft(user?.id), [user?.id])

  const [step, setStep] = useState(() => {
    const restoredStep = Number(restoredDraft?.step)
    return [1,2,3].includes(restoredStep) ? restoredStep : 1
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(() => ({
    sport_type: restoredDraft?.form?.sport_type || inferPlanSport(plan) || 'running',
    goal_type: restoredDraft?.form?.goal_type || 'event',
    title: restoredDraft?.form?.title || '',
    target_date: restoredDraft?.form?.target_date || '',
    target_distance: restoredDraft?.form?.target_distance || '',
    description: restoredDraft?.form?.description || '',
  }))

  const patch = values => setForm(current => ({ ...current, ...values }))

  useEffect(() => {
    if (!user?.id) return
    try {
      sessionStorage.setItem(
        goalDraftKey(user.id),
        JSON.stringify({ step, form })
      )
      sessionStorage.setItem(goalModalKey(user.id), '1')
    } catch {}
  }, [user?.id, step, form])
  const selectedSport = SPORT_META[form.sport_type] || SPORT_META.running
  const selectedGoal = GOAL_META[form.goal_type] || GOAL_META.event

  const canUseCurrentPlan = Boolean(planId && plan && inferPlanSport(plan) === form.sport_type)

  const validateDetails = () => {
    if (!form.title.trim()) {
      return 'Gib eurem gemeinsamen Ziel bitte einen Namen.'
    }
    if (form.goal_type === 'event' && !form.target_date) {
      return 'Für einen Wettkampf oder ein Event brauchen wir ein Zieldatum.'
    }
    if (form.goal_type === 'distance' && (!form.target_distance || Number(form.target_distance) <= 0)) {
      return 'Gib bitte die gemeinsame Zieldistanz an.'
    }
    if (form.target_date && isPastDate(form.target_date)) {
      return 'Das Zieldatum darf nicht in der Vergangenheit liegen.'
    }
    return ''
  }

  const createGoal = async () => {
    const validationError = validateDetails()
    if (validationError) {
      setError(validationError)
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
          plan_id: canUseCurrentPlan ? planId : null,
        })

      if (memberError) throw memberError
      clearGoalDraft(user?.id)
      onCreated?.(goal)
    } catch (e) {
      console.error('[Gemeinsam] Ziel konnte nicht erstellt werden:', e)
      setError('Das gemeinsame Ziel konnte gerade nicht erstellt werden.')
    } finally {
      setSaving(false)
    }
  }

  const next = () => {
    setError('')
    if (step === 2) {
      const validationError = validateDetails()
      if (validationError) {
        setError(validationError)
        return
      }
    }
    setStep(current => Math.min(3, current + 1))
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:180, background:'rgba(42,30,23,.42)',
      display:'flex', alignItems:'flex-end', justifyContent:'center'
    }}>
      <div style={{
        width:'100%', maxWidth:720, maxHeight:'92vh', overflowY:'auto',
        borderRadius:'28px 28px 0 0', background:'#FFFDFC',
        boxShadow:'0 -18px 50px rgba(54,37,27,.18)',
        padding:'18px 18px calc(24px + env(safe-area-inset-bottom,0px))'
      }}>
        <div style={{ width:48, height:5, borderRadius:99, background:'#E7DCD5', margin:'0 auto 16px' }} />

        <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:1.2, fontWeight:900, color:'#D56D55', fontFamily:'sans-serif' }}>
              {step} · {step === 1 ? 'ZIEL' : step === 2 ? 'DETAILS' : 'TRAININGSPARTNER'}
            </div>
            <h2 style={{
              margin:'6px 0 4px', color:'#3D2B1F',
              fontFamily:"'Georgia','Times New Roman',serif", fontSize:27, lineHeight:1.1
            }}>
              {step === 1 ? 'Worauf möchtet ihr gemeinsam hinarbeiten?' : step === 2 ? 'Macht euer Ziel konkret.' : 'Euer Ziel. Eure eigenen Wege.'}
            </h2>
            <p style={{ margin:0, color:'#947E72', fontSize:12, lineHeight:1.55, fontFamily:'sans-serif' }}>
              Gleiche Sportart, gemeinsames Ziel – aber jeder trainiert passend zum eigenen Leistungsstand.
            </p>
          </div>
          <button onClick={onClose} type="button" style={{
            border:'none', background:'#F6F0EC', width:36, height:36, borderRadius:'50%',
            cursor:'pointer', color:'#7D695D', fontSize:18, flex:'0 0 auto'
          }}>×</button>
        </div>

        {step === 1 && (
          <>
            <div style={{ marginTop:20, fontSize:11, fontWeight:900, color:'#725F54', fontFamily:'sans-serif' }}>SPORTART</div>
            <div className="together-sports-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:9, marginTop:9 }}>
              {Object.entries(SPORT_META).map(([id,item]) => {
                const active = form.sport_type === id
                return <button key={id} type="button" onClick={() => patch({ sport_type:id })}
                  style={{
                    minHeight:92, border:active ? '2px solid #FF8C69' : '1.5px solid #EADFD8',
                    background:active ? '#FFF2EC' : '#fff', borderRadius:17,
                    padding:'12px 10px', cursor:'pointer', textAlign:'center'
                  }}>
                  <div style={{ fontSize:24 }}>{item.icon}</div>
                  <div style={{ marginTop:7, fontSize:11.5, fontWeight:900, color:'#49372C', fontFamily:'sans-serif' }}>{item.label}</div>
                </button>
              })}
            </div>

            <div style={{ marginTop:18, fontSize:11, fontWeight:900, color:'#725F54', fontFamily:'sans-serif' }}>ZIELART</div>
            <div style={{ display:'grid', gap:8, marginTop:8 }}>
              {Object.entries(GOAL_META).map(([id,item]) => {
                const active = form.goal_type === id
                return <button key={id} type="button" onClick={() => patch({ goal_type:id })}
                  style={{
                    display:'flex', alignItems:'center', gap:12, textAlign:'left', cursor:'pointer',
                    border:active ? '2px solid #FF8C69' : '1.5px solid #EADFD8',
                    background:active ? '#FFF5EF' : '#fff', borderRadius:16, padding:'11px 12px'
                  }}>
                  <div style={{ width:38, height:38, borderRadius:13, display:'grid', placeItems:'center', background:'#FFF0E7', fontSize:18 }}>{item.icon}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ color:'#49372C', fontSize:12, fontWeight:900, fontFamily:'sans-serif' }}>{item.label}</div>
                    <div style={{ color:'#9B8578', fontSize:10.2, marginTop:2, lineHeight:1.4, fontFamily:'sans-serif' }}>{item.text}</div>
                  </div>
                </button>
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <div style={{ marginTop:20, display:'grid', gap:13 }}>
            <div style={{
              display:'flex', alignItems:'center', gap:10, padding:'11px 12px',
              borderRadius:15, background:'#FFF6F0', color:'#80685B', fontFamily:'sans-serif', fontSize:11
            }}>
              <span style={{ fontSize:20 }}>{selectedSport.icon}</span>
              <div><b>{selectedSport.label}</b> · {selectedGoal.label}</div>
            </div>

            <label style={{ fontFamily:'sans-serif', fontSize:11, fontWeight:900, color:'#725F54' }}>
              NAME DES ZIELS
              <input value={form.title} onChange={e => patch({ title:e.target.value })}
                placeholder={form.goal_type === 'event' ? 'z. B. Halbmarathon Hamburg' : 'z. B. Unser gemeinsames Ziel'}
                style={{
                  marginTop:7, width:'100%', boxSizing:'border-box', padding:'13px 14px',
                  borderRadius:15, border:'1.5px solid #EADFD8', fontSize:13, color:'#49372C',
                  outline:'none', background:'#fff'
                }} />
            </label>

            <label style={{ fontFamily:'sans-serif', fontSize:11, fontWeight:900, color:'#725F54' }}>
              ZIELDATUM {form.goal_type === 'event'
                ? <span style={{ color:'#D36F58', fontWeight:800 }}>(erforderlich)</span>
                : <span style={{ color:'#B39F94', fontWeight:600 }}>(optional)</span>}
              <input type="date" value={form.target_date} onChange={e => patch({ target_date:e.target.value })}
                style={{
                  marginTop:7, width:'100%', boxSizing:'border-box', padding:'13px 14px',
                  borderRadius:15, border:'1.5px solid #EADFD8', fontSize:13, color:'#49372C',
                  outline:'none', background:'#fff'
                }} />
            </label>

            {(form.goal_type === 'distance' || form.goal_type === 'event') && (
              <label style={{ fontFamily:'sans-serif', fontSize:11, fontWeight:900, color:'#725F54' }}>
                DISTANZ {form.goal_type === 'distance'
                  ? <span style={{ color:'#D36F58', fontWeight:800 }}>(erforderlich)</span>
                  : <span style={{ color:'#B39F94', fontWeight:600 }}>(optional)</span>}
                <div style={{ position:'relative', marginTop:7 }}>
                  <input inputMode="decimal" value={form.target_distance}
                    onChange={e => patch({ target_distance:e.target.value.replace(',','.') })}
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
              <textarea rows={3} value={form.description} onChange={e => patch({ description:e.target.value })}
                placeholder="Was macht dieses Ziel für euch besonders?"
                style={{
                  marginTop:7, width:'100%', resize:'vertical', boxSizing:'border-box',
                  padding:'13px 14px', borderRadius:15, border:'1.5px solid #EADFD8',
                  fontSize:13, color:'#49372C', outline:'none', background:'#fff', fontFamily:'sans-serif'
                }} />
            </label>
          </div>
        )}

        {step === 3 && (
          <div style={{ marginTop:20 }}>
            <div style={{
              padding:17, borderRadius:20,
              background:'linear-gradient(145deg,#FFF0E5,#FFF8F2 54%,#F2F8EF)',
              border:'1px solid #F3D9CA'
            }}>
              <div style={{ fontSize:28 }}>{selectedSport.icon}</div>
              <div style={{
                marginTop:8, fontFamily:"'Georgia','Times New Roman',serif",
                fontSize:23, fontWeight:700, color:'#3D2B1F'
              }}>{form.title || 'Euer gemeinsames Ziel'}</div>
              <div style={{ marginTop:7, color:'#8D776A', fontSize:11.5, lineHeight:1.55, fontFamily:'sans-serif' }}>
                Nach dem Erstellen öffnet sich direkt die Einladung. Dein Trainingspartner entscheidet selbst, ob er dem Ziel beitreten möchte.
              </div>
            </div>

            <div style={{ display:'grid', gap:8, marginTop:11 }}>
              <div style={{ ...card, padding:'12px 13px', fontSize:11, color:'#786357', fontFamily:'sans-serif' }}>
                ✓ Gemeinsames Ziel und Countdown
              </div>
              <div style={{ ...card, padding:'12px 13px', fontSize:11, color:'#786357', fontFamily:'sans-serif' }}>
                ✓ Individuelle Trainingspläne für jeden
              </div>
              <div style={{ ...card, padding:'12px 13px', fontSize:11, color:'#786357', fontFamily:'sans-serif' }}>
                ✓ Gemeinsame Einheiten können später miteinander verknüpft werden
              </div>
            </div>

            {canUseCurrentPlan && (
              <div style={{
                marginTop:11, padding:'11px 12px', borderRadius:14,
                background:'#EFF8F2', color:'#5E806A', fontSize:10.8, lineHeight:1.5, fontFamily:'sans-serif'
              }}>
                Dein aktueller {selectedSport.label}-Plan wird automatisch mit deinem gemeinsamen Ziel verbunden.
              </div>
            )}
          </div>
        )}

        {error && <div style={{ marginTop:13, color:'#C6544C', fontSize:11.5, fontFamily:'sans-serif' }}>{error}</div>}

        <div style={{ display:'flex', gap:9, marginTop:20 }}>
          {step > 1 && <button type="button" onClick={() => setStep(step-1)} disabled={saving}
            style={{ flex:1, border:'1.5px solid #E5D9D2', background:'#fff', color:'#735E52', borderRadius:16, padding:'13px 12px', fontWeight:900, cursor:'pointer' }}>
            Zurück
          </button>}
          <button type="button" onClick={() => step < 3 ? next() : createGoal()} disabled={saving}
            style={{
              flex:2, border:'none', color:'#fff', borderRadius:16, padding:'14px 12px',
              fontWeight:900, cursor:saving ? 'default' : 'pointer',
              background:'linear-gradient(135deg,#FF8C69,#FF6B78)',
              boxShadow:'0 8px 20px rgba(255,112,91,.22)'
            }}>
            {step < 3 ? 'Weiter' : saving ? 'Wird erstellt…' : 'Ziel erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}


function InviteGoalModal({ goal, user, onClose }) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [friends, setFriends] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [sentNames, setSentNames] = useState([])

  useEffect(() => {
    let cancelled = false

    const loadFriends = async () => {
      setLoadingFriends(true)
      try {
        const { data:friendships, error:friendshipError } = await supabase
          .from('friendships')
          .select('sender_id,receiver_id')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .eq('status','accepted')

        if (friendshipError) throw friendshipError

        const ids = [...new Set((friendships || []).map(row =>
          row.sender_id === user.id ? row.receiver_id : row.sender_id
        ))]

        if (!ids.length) {
          if (!cancelled) setFriends([])
          return
        }

        const [{ data:profiles, error:profileError }, { data:members }] = await Promise.all([
          supabase.from('profiles').select('id,name,avatar_url').in('id', ids),
          supabase.from('shared_goal_members').select('user_id').eq('goal_id', goal.id).eq('status','active'),
        ])

        if (profileError) throw profileError
        const memberIds = new Set((members || []).map(row => row.user_id))

        if (!cancelled) {
          setFriends((profiles || []).filter(profile => !memberIds.has(profile.id)))
        }
      } catch (e) {
        console.error('[Gemeinsam] Trainingspartner konnten nicht geladen werden:', e)
        if (!cancelled) setError('Deine Trainingspartner konnten gerade nicht geladen werden.')
      } finally {
        if (!cancelled) setLoadingFriends(false)
      }
    }

    loadFriends()
    return () => { cancelled = true }
  }, [user.id, goal.id])

  const toggleFriend = id => {
    setSelectedIds(current =>
      current.includes(id) ? current.filter(value => value !== id) : [...current, id]
    )
  }

  const inviteSelected = async () => {
    if (!selectedIds.length) return
    setBusy(true)
    setError('')

    const { error:inviteError } = await supabase.rpc('invite_friends_to_shared_goal', {
      p_goal_id:goal.id,
      p_user_ids:selectedIds,
    })

    if (inviteError) {
      console.error('[Gemeinsam] Direkte Einladungen fehlgeschlagen:', inviteError)
      setError('Die ausgewählten Trainingspartner konnten gerade nicht eingeladen werden.')
      setBusy(false)
      return
    }

    const names = friends
      .filter(friend => selectedIds.includes(friend.id))
      .map(friend => friend.name || 'Trainingspartner')

    setSentNames(names)
    setFriends(current => current.filter(friend => !selectedIds.includes(friend.id)))
    setSelectedIds([])
    setBusy(false)
  }

  const buildInvite = async () => {
    const { data, error:inviteError } = await supabase
      .from('shared_goal_invites')
      .insert({ goal_id:goal.id, invited_by:user.id })
      .select('token, expires_at')
      .single()

    if (inviteError) throw inviteError
    return {
      link:`${window.location.origin}${window.location.pathname}?goalInvite=${data.token}`,
      expiresAt:data.expires_at,
    }
  }

  const share = async () => {
    setBusy(true)
    setError('')
    try {
      const invite = await buildInvite()

      if (navigator.share) {
        try {
          await navigator.share({
            title:goal.title,
            text:`Trainiere mit mir auf „${goal.title}“ hin.`,
            url:invite.link,
          })
          return
        } catch (shareError) {
          if (shareError?.name === 'AbortError') return
        }
      }

      await navigator.clipboard.writeText(invite.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (e) {
      console.error('[Gemeinsam] Einladungslink konnte nicht erstellt werden:', e)
      setError('Der Einladungslink konnte gerade nicht erstellt werden.')
    } finally {
      setBusy(false)
    }
  }

  const selectedLabel =
    selectedIds.length === 1
      ? '1 Trainingspartner einladen'
      : `${selectedIds.length} Trainingspartner einladen`

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:190, background:'rgba(42,30,23,.46)',
      display:'flex', alignItems:'flex-end', justifyContent:'center'
    }}>
      <div style={{
        width:'100%', maxWidth:720, maxHeight:'92vh', overflowY:'auto',
        borderRadius:'28px 28px 0 0', background:'#FFFDFC',
        padding:'18px 18px calc(24px + env(safe-area-inset-bottom,0px))',
        boxShadow:'0 -18px 50px rgba(54,37,27,.18)'
      }}>
        <div style={{ width:48, height:5, borderRadius:99, background:'#E7DCD5', margin:'0 auto 16px' }} />
        <div style={{ textAlign:'center' }}>
          <div style={{
            width:62, height:62, margin:'0 auto 12px', borderRadius:'50%',
            display:'grid', placeItems:'center', fontSize:27,
            background:'linear-gradient(135deg,#FFF0E8,#F1F8EF)', border:'1px solid #F0DED2'
          }}>👥</div>
          <div style={{ fontSize:10, letterSpacing:1.15, fontWeight:900, color:'#D16D55', fontFamily:'sans-serif' }}>
            TRAININGSPARTNER EINLADEN
          </div>
          <h2 style={{
            margin:'6px auto 7px', color:'#3D2B1F', maxWidth:470,
            fontFamily:"'Georgia','Times New Roman',serif", fontSize:27, lineHeight:1.1
          }}>
            {goal.title}
          </h2>
          <p style={{ margin:'0 auto', maxWidth:490, color:'#927B6E', fontSize:11.5, lineHeight:1.55, fontFamily:'sans-serif' }}>
            Lade bestehende Trainingspartner direkt in der App ein – oder teile einen Link mit jemandem, mit dem du noch nicht verbunden bist.
          </p>
        </div>

        {sentNames.length > 0 && (
          <div style={{
            marginTop:15, padding:'11px 13px', borderRadius:14,
            background:'#EFF8F2', border:'1px solid #CFE8D8',
            color:'#578169', fontSize:10.8, lineHeight:1.5, fontFamily:'sans-serif'
          }}>
            ✓ Einladung gesendet an {sentNames.join(', ')}.
          </div>
        )}

        <div style={{ marginTop:18 }}>
          <div style={{
            fontSize:10, fontWeight:900, letterSpacing:1,
            color:'#826B5F', fontFamily:'sans-serif', marginBottom:9
          }}>
            DEINE TRAININGSPARTNER
          </div>

          {loadingFriends ? (
            <div style={{ ...card, padding:16, color:'#A28C80', fontSize:11, fontFamily:'sans-serif' }}>
              Lade Trainingspartner…
            </div>
          ) : friends.length === 0 ? (
            <div style={{ ...card, padding:16, color:'#9A8275', fontSize:10.8, lineHeight:1.5, fontFamily:'sans-serif' }}>
              Aktuell ist kein weiterer Trainingspartner direkt auswählbar. Nutze unten den Einladungslink.
            </div>
          ) : (
            <div style={{ display:'grid', gap:8 }}>
              {friends.map(friend => {
                const selected = selectedIds.includes(friend.id)
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => toggleFriend(friend.id)}
                    style={{
                      ...card, padding:'11px 12px', cursor:'pointer',
                      display:'flex', alignItems:'center', gap:11, textAlign:'left',
                      border:selected ? '2px solid #FF8C69' : '1px solid #EEE3DC',
                      background:selected ? '#FFF4EE' : '#fff'
                    }}
                  >
                    <Avatar profile={friend} size={40} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        color:'#49372C', fontSize:11.8, fontWeight:900,
                        fontFamily:'sans-serif', whiteSpace:'nowrap',
                        overflow:'hidden', textOverflow:'ellipsis'
                      }}>
                        {friend.name || 'Trainingspartner'}
                      </div>
                      <div style={{ color:'#A08A7D', fontSize:9.8, marginTop:2, fontFamily:'sans-serif' }}>
                        Direkt in der App einladen
                      </div>
                    </div>
                    <div style={{
                      width:25, height:25, borderRadius:'50%', display:'grid', placeItems:'center',
                      border:selected ? 'none' : '1.5px solid #DCCBC1',
                      background:selected ? 'linear-gradient(135deg,#FF8C69,#FF6B78)' : '#fff',
                      color:'#fff', fontSize:13, fontWeight:900
                    }}>
                      {selected ? '✓' : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {selectedIds.length > 0 && (
            <button type="button" onClick={inviteSelected} disabled={busy} style={{
              marginTop:10, width:'100%', border:'none', borderRadius:16, padding:'14px 15px',
              color:'#fff', fontWeight:900, cursor:busy ? 'default' : 'pointer',
              background:'linear-gradient(135deg,#7EC8A4,#5BA88A)',
              opacity:busy ? .65 : 1, boxShadow:'0 8px 20px rgba(91,168,138,.18)'
            }}>
              {busy ? 'Einladung wird gesendet…' : selectedLabel}
            </button>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0 14px' }}>
          <div style={{ height:1, flex:1, background:'#EEE4DE' }} />
          <span style={{ color:'#B39D90', fontSize:9.5, fontWeight:800, fontFamily:'sans-serif' }}>ODER</span>
          <div style={{ height:1, flex:1, background:'#EEE4DE' }} />
        </div>

        <div style={{ ...card, padding:'13px 14px' }}>
          <div style={{ color:'#49372C', fontSize:11.5, fontWeight:900, fontFamily:'sans-serif' }}>
            🔗 Per Link einladen
          </div>
          <div style={{ color:'#9B8578', fontSize:10.2, marginTop:3, lineHeight:1.45, fontFamily:'sans-serif' }}>
            Für Personen, mit denen du noch nicht als Trainingspartner verbunden bist.
          </div>
          <button type="button" onClick={share} disabled={busy} style={{
            marginTop:11, width:'100%', border:'none', borderRadius:14, padding:'12px 14px',
            color:'#fff', fontWeight:900, cursor:busy ? 'default' : 'pointer',
            background:'linear-gradient(135deg,#FF8C69,#FF6B78)',
            opacity:busy ? .65 : 1
          }}>
            {busy ? 'Link wird erstellt…' : copied ? '✓ Link kopiert' : 'Einladungslink teilen'}
          </button>
        </div>

        {error && <div style={{ marginTop:11, color:'#C6544C', fontSize:11.2, fontFamily:'sans-serif' }}>{error}</div>}

        <button type="button" onClick={onClose} style={{
          marginTop:10, width:'100%', border:'1.5px solid #E9DDD6', borderRadius:16,
          padding:'12px 14px', background:'#fff', color:'#8A7468', fontWeight:800, cursor:'pointer'
        }}>
          Fertig
        </button>
      </div>
    </div>
  )
}

function CreateSessionModal({ goal, user, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!title.trim() || !date) {
      setError('Bitte gib der Einheit einen Namen und ein Datum.')
      return
    }
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('shared_sessions').insert({
      goal_id:goal.id,
      created_by:user.id,
      title:title.trim(),
      sport_type:goal.sport_type || null,
      scheduled_date:date,
      note:note.trim() || null,
    })
    setSaving(false)
    if (insertError) {
      console.error('[Gemeinsam] Einheit konnte nicht erstellt werden:', insertError)
      setError('Die gemeinsame Einheit konnte gerade nicht gespeichert werden.')
      return
    }
    onCreated?.()
  }

  return <div style={{
    position:'fixed', inset:0, zIndex:185, background:'rgba(42,30,23,.42)',
    display:'flex', alignItems:'flex-end', justifyContent:'center'
  }}>
    <div style={{
      width:'100%', maxWidth:720, borderRadius:'28px 28px 0 0', background:'#FFFDFC',
      padding:'18px 18px calc(24px + env(safe-area-inset-bottom,0px))',
      boxShadow:'0 -18px 50px rgba(54,37,27,.18)'
    }}>
      <div style={{ width:48, height:5, borderRadius:99, background:'#E7DCD5', margin:'0 auto 16px' }} />
      <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
        <div>
          <div style={{ color:'#D16C54', fontSize:10, letterSpacing:1, fontWeight:900, fontFamily:'sans-serif' }}>GEMEINSAME EINHEIT</div>
          <h2 style={{ margin:'6px 0 4px', fontFamily:"'Georgia','Times New Roman',serif", color:'#3D2B1F', fontSize:25 }}>Wann trainiert ihr zusammen?</h2>
          <div style={{ color:'#947E72', fontSize:11.5, fontFamily:'sans-serif' }}>Jeder behält seine eigene Trainingsvorgabe.</div>
        </div>
        <button onClick={onClose} type="button" style={{ border:'none', background:'#F6F0EC', width:36, height:36, borderRadius:'50%', cursor:'pointer' }}>×</button>
      </div>

      <div style={{ display:'grid', gap:12, marginTop:18 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="z. B. Langer Lauf"
          style={{ padding:'13px 14px', borderRadius:15, border:'1.5px solid #EADFD8', fontSize:13, outline:'none' }} />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ padding:'13px 14px', borderRadius:15, border:'1.5px solid #EADFD8', fontSize:13, outline:'none' }} />
        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
          placeholder="Optional: Uhrzeit, Treffpunkt oder Hinweis"
          style={{ padding:'13px 14px', borderRadius:15, border:'1.5px solid #EADFD8', fontSize:13, outline:'none', resize:'vertical', fontFamily:'sans-serif' }} />
      </div>

      {error && <div style={{ color:'#C6544C', fontSize:11.5, marginTop:10, fontFamily:'sans-serif' }}>{error}</div>}

      <button type="button" onClick={save} disabled={saving} style={{
        marginTop:16, width:'100%', border:'none', borderRadius:16, padding:'14px',
        color:'#fff', fontWeight:900, cursor:'pointer',
        background:'linear-gradient(135deg,#FF8C69,#FF6B78)'
      }}>{saving ? 'Speichert…' : 'Gemeinsame Einheit planen'}</button>
    </div>
  </div>
}

export default function Together({ user, plan, planId, focusFriends = 0, refreshToken = 0, onCreatePlanForGoal }) {
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState([])
  const [membersByGoal, setMembersByGoal] = useState({})
  const [profilesById, setProfilesById] = useState({})
  const [sessionsByGoal, setSessionsByGoal] = useState({})
  const [showCreate, setShowCreate] = useState(() => {
    try {
      return sessionStorage.getItem(goalModalKey(user?.id)) === '1'
    } catch {
      return false
    }
  })
  const [sessionGoal, setSessionGoal] = useState(null)
  const [inviteGoal, setInviteGoal] = useState(null)
  const [goalMenuOpen, setGoalMenuOpen] = useState(false)
  const [goalActionBusy, setGoalActionBusy] = useState(false)
  const [planLinkBusy, setPlanLinkBusy] = useState(false)
  const [pendingDirectInvites, setPendingDirectInvites] = useState([])
  const [pendingInviteBusy, setPendingInviteBusy] = useState(null)
  const [message, setMessage] = useState('')
  const friendsSectionRef = useRef(null)

  const openCreate = () => {
    try {
      sessionStorage.setItem(goalModalKey(user?.id), '1')
    } catch {}
    setShowCreate(true)
  }

  const closeCreate = () => {
    clearGoalDraft(user?.id)
    setShowCreate(false)
  }

  useEffect(() => {
    if (!user?.id) return
    try {
      if (sessionStorage.getItem(goalModalKey(user.id)) === '1') {
        setShowCreate(true)
      }
    } catch {}
  }, [user?.id])

  useEffect(() => {
    if (!focusFriends) return
    const timer = window.setTimeout(() => {
      friendsSectionRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [focusFriends])

  const currentPlanContext = useMemo(() => getCurrentPlanContext(plan), [plan])

  const buildOwnSnapshot = async () => {
    if (!user?.id || !plan || !currentPlanContext || currentPlanContext.beforeStart || currentPlanContext.completed) return null

    const { phase, week, weeks } = currentPlanContext
    const planned = (week?.days || [])
      .map((day, index) => ({ ...day, key:dayKey(phase.id, week.n, index) }))
      .filter(day => !day.optional)

    const [{ data:logs }, { data:skipped }] = await Promise.all([
      supabase.from('logs').select('day_key').eq('user_id', user.id).in('day_key', planned.map(day => day.key)),
      supabase.from('skipped_days').select('day_key').eq('user_id', user.id).in('day_key', planned.map(day => day.key)),
    ])

    const completedKeys = new Set((logs || []).map(row => row.day_key))
    const skippedKeys = new Set((skipped || []).map(row => row.day_key))
    const completed = planned.filter(day => completedKeys.has(day.key)).length
    const decided = planned.filter(day => completedKeys.has(day.key) || skippedKeys.has(day.key)).length

    return {
      week_number: week.n,
      total_weeks: weeks.length,
      week_completed: completed,
      week_planned: planned.length,
      week_decided: decided,
      progress_status: decided >= planned.length && planned.length ? 'Woche abgeschlossen' : 'Im Plan',
      progress_updated_at:new Date().toISOString(),
    }
  }

  const load = async () => {
    if (!user?.id) return
    setLoading(true)

    try {
      const { data:pendingRows, error:pendingError } = await supabase.rpc('list_pending_shared_goal_invites')
      if (pendingError) throw pendingError
      setPendingDirectInvites(Array.isArray(pendingRows) ? pendingRows : [])

      const { data:memberships, error:membershipError } = await supabase
        .from('shared_goal_members')
        .select('goal_id,user_id,role,status,plan_id,share_progress,share_next_session,week_number,total_weeks,week_completed,week_planned,week_decided,progress_status,progress_updated_at')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (membershipError) throw membershipError

      const ids = [...new Set((memberships || []).map(row => row.goal_id))]
      if (!ids.length) {
        setGoals([])
        setMembersByGoal({})
        setSessionsByGoal({})
        setLoading(false)
        return
      }

      const [{ data:goalRows, error:goalError }, { data:memberRows, error:memberError }, { data:sessionRows, error:sessionError }] = await Promise.all([
        supabase.from('shared_goals').select('*').in('id', ids).neq('status','archived').order('target_date', { ascending:true, nullsFirst:false }),
        supabase.from('shared_goal_members').select('goal_id,user_id,role,status,plan_id,share_progress,share_next_session,week_number,total_weeks,week_completed,week_planned,week_decided,progress_status,progress_updated_at').in('goal_id', ids).eq('status','active'),
        supabase.from('shared_sessions').select('*').in('goal_id', ids).gte('scheduled_date', new Date().toISOString().slice(0,10)).order('scheduled_date', { ascending:true }),
      ])

      if (goalError) throw goalError
      if (memberError) throw memberError
      if (sessionError) throw sessionError

      const groupedMembers = {}
      ;(memberRows || []).forEach(row => {
        groupedMembers[row.goal_id] ||= []
        groupedMembers[row.goal_id].push(row)
      })

      const groupedSessions = {}
      ;(sessionRows || []).forEach(row => {
        groupedSessions[row.goal_id] ||= []
        groupedSessions[row.goal_id].push(row)
      })

      setGoals(goalRows || [])
      setMembersByGoal(groupedMembers)
      setSessionsByGoal(groupedSessions)

      const userIds = [...new Set((memberRows || []).map(row => row.user_id))]
      if (userIds.length) {
        const { data:profileRows } = await supabase.from('profiles').select('id,name,avatar_url').in('id', userIds)
        const map = {}
        ;(profileRows || []).forEach(profile => { map[profile.id] = profile })
        setProfilesById(map)
      }

      const snapshot = await buildOwnSnapshot()
      if (snapshot) {
        const goalById = Object.fromEntries((goalRows || []).map(goal => [goal.id, goal]))
        const currentSport = inferPlanSport(plan)
        const ownRows = (memberships || []).filter(row => {
          const goal = goalById[row.goal_id]
          const sportMatches = !goal?.sport_type || goal.sport_type === currentSport
          const planMatches = !row.plan_id || row.plan_id === planId
          return sportMatches && planMatches
        })
        if (ownRows.length) {
          await Promise.all(ownRows.map(row =>
            supabase.from('shared_goal_members')
              .update({ ...snapshot, plan_id:row.plan_id || planId || null })
              .eq('goal_id', row.goal_id)
              .eq('user_id', user.id)
          ))
          setMembersByGoal(current => {
            const next = { ...current }
            ownRows.forEach(row => {
              next[row.goal_id] = (next[row.goal_id] || []).map(member =>
                member.user_id === user.id ? { ...member, ...snapshot, plan_id:member.plan_id || planId || null } : member
              )
            })
            return next
          })
        }
      }
    } catch (e) {
      console.error('[Gemeinsam] Daten konnten nicht geladen werden:', e)
      setMessage('Die gemeinsamen Ziele konnten gerade nicht vollständig geladen werden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.id, planId, refreshToken])


  const acceptDirectInvite = async invite => {
    setPendingInviteBusy(invite.token)
    setMessage('')
    const { error } = await supabase.rpc('accept_shared_goal_invite', {
      invite_token:invite.token,
    })

    if (error) {
      console.error('[Gemeinsam] Direkte Ziel-Einladung annehmen fehlgeschlagen:', error)
      setMessage('Die Einladung konnte gerade nicht angenommen werden.')
      setPendingInviteBusy(null)
      return
    }

    setPendingInviteBusy(null)
    setMessage(`Du bist „${invite.title}“ beigetreten.`)
    await load()
  }

  const declineDirectInvite = async invite => {
    setPendingInviteBusy(invite.token)
    setMessage('')
    const { error } = await supabase.rpc('decline_shared_goal_invite', {
      invite_token:invite.token,
    })

    if (error) {
      console.error('[Gemeinsam] Direkte Ziel-Einladung ablehnen fehlgeschlagen:', error)
      setMessage('Die Einladung konnte gerade nicht abgelehnt werden.')
      setPendingInviteBusy(null)
      return
    }

    setPendingInviteBusy(null)
    setPendingDirectInvites(current => current.filter(item => item.token !== invite.token))
  }

  const connectCurrentPlan = async goal => {
    if (!planId || !plan) return
    setPlanLinkBusy(true)
    setMessage('')

    const { error } = await supabase
      .from('shared_goal_members')
      .update({ plan_id:planId })
      .eq('goal_id', goal.id)
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (error) {
      console.error('[Gemeinsam] Plan verbinden fehlgeschlagen:', error)
      setMessage('Der Trainingsplan konnte gerade nicht verbunden werden.')
      setPlanLinkBusy(false)
      return
    }

    setMembersByGoal(current => ({
      ...current,
      [goal.id]:(current[goal.id] || []).map(member =>
        member.user_id === user.id ? { ...member, plan_id:planId } : member
      )
    }))
    setPlanLinkBusy(false)
    setMessage('Dein Trainingsplan ist jetzt mit dem gemeinsamen Ziel verbunden.')
  }

  const startPlanForGoal = goal => {
    if (typeof onCreatePlanForGoal !== 'function') {
      setMessage('Der Trainingsplan kann gerade nicht gestartet werden.')
      return
    }
    onCreatePlanForGoal(goal)
  }

  const currentMembership = goalId =>
    (membersByGoal[goalId] || []).find(member => member.user_id === user.id)

  const manageInvite = goal => {
    setGoalMenuOpen(false)
    setInviteGoal(goal)
  }

  const archiveGoal = async goal => {
    if (!window.confirm(`„${goal.title}“ wirklich löschen? Dein persönlicher Trainingsplan bleibt erhalten.`)) return

    setGoalActionBusy(true)
    setMessage('')
    const { error } = await supabase.rpc('archive_shared_goal', { p_goal_id:goal.id })

    if (error) {
      console.error('[Gemeinsam] Ziel löschen fehlgeschlagen:', error)
      setMessage('Das gemeinsame Ziel konnte gerade nicht gelöscht werden.')
      setGoalActionBusy(false)
      return
    }

    setGoalMenuOpen(false)
    setGoalActionBusy(false)
    setMessage('Das gemeinsame Ziel wurde gelöscht. Dein persönlicher Trainingsplan bleibt erhalten.')
    await load()
  }

  const leaveGoal = async goal => {
    if (!window.confirm(`„${goal.title}“ wirklich verlassen? Dein persönlicher Trainingsplan bleibt erhalten.`)) return

    setGoalActionBusy(true)
    setMessage('')
    const { error } = await supabase.rpc('leave_shared_goal', { p_goal_id:goal.id })

    if (error) {
      console.error('[Gemeinsam] Ziel verlassen fehlgeschlagen:', error)
      setMessage('Das gemeinsame Ziel konnte gerade nicht verlassen werden.')
      setGoalActionBusy(false)
      return
    }

    setGoalMenuOpen(false)
    setGoalActionBusy(false)
    setMessage('Du hast das gemeinsame Ziel verlassen. Dein persönlicher Trainingsplan bleibt erhalten.')
    await load()
  }

  const primaryGoal = useMemo(() => {
    if (!goals.length) return null
    return goals.find(goal => goal.status === 'active') || goals[0]
  }, [goals])

  const otherGoals = primaryGoal ? goals.filter(goal => goal.id !== primaryGoal.id) : []

  const createInvite = async goalId => {
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

  const renderProgress = member => {
    const profile = profilesById[member.user_id] || { name:member.user_id === user.id ? 'Du' : 'Trainingspartner' }
    const planned = Number(member.week_planned || 0)
    const completed = Number(member.week_completed || 0)
    const week = member.week_number
    const total = member.total_weeks
    const percent = planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : null

    return <div key={member.user_id} style={{ ...card, padding:13, minWidth:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        <Avatar profile={profile} size={36} />
        <div style={{ minWidth:0 }}>
          <div style={{ color:'#49372C', fontSize:11.5, fontWeight:900, fontFamily:'sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {member.user_id === user.id ? 'Du' : (profile.name || 'Trainingspartner')}
          </div>
          <div style={{ color:'#9A8578', fontSize:9.8, marginTop:2, fontFamily:'sans-serif' }}>
            {week && total ? `Woche ${week} von ${total}` : 'Individueller Trainingsweg'}
          </div>
        </div>
      </div>

      {planned > 0 ? <>
        <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginTop:11, fontFamily:'sans-serif' }}>
          <span style={{ color:'#806B5E', fontSize:10.2 }}>{completed} von {planned} erledigt</span>
          <span style={{ color:'#5E806A', fontSize:10.2, fontWeight:900 }}>{member.progress_status || 'Im Plan'}</span>
        </div>
        <div style={{ height:6, borderRadius:99, background:'#F0E9E4', overflow:'hidden', marginTop:7 }}>
          <div style={{ width:`${percent}%`, height:'100%', borderRadius:99, background:'linear-gradient(90deg,#FF8C69,#7FCBA2)' }} />
        </div>
      </> : member.user_id === user.id ? (
        <div style={{ marginTop:10 }}>
          <div style={{ color:'#9A8578', fontSize:10.2, lineHeight:1.45, fontFamily:'sans-serif' }}>
            Noch kein passender Plan mit diesem Ziel verbunden.
          </div>

          {primaryGoal && plan && planId && inferPlanSport(plan) === primaryGoal.sport_type ? (
            <button
              type="button"
              disabled={planLinkBusy}
              onClick={() => connectCurrentPlan(primaryGoal)}
              style={{
                marginTop:9, width:'100%', border:'1.5px solid #BFDCCB',
                borderRadius:12, padding:'9px 10px', background:'#F1F8F4',
                color:'#578169', fontSize:10.2, fontWeight:900,
                cursor:planLinkBusy ? 'default' : 'pointer',
                opacity:planLinkBusy ? .6 : 1, fontFamily:'sans-serif'
              }}
            >
              {planLinkBusy ? 'Wird verbunden…' : '✓ Bestehenden Plan verbinden'}
            </button>
          ) : primaryGoal ? (
            <button
              type="button"
              onClick={() => startPlanForGoal(primaryGoal)}
              style={{
                marginTop:9, width:'100%', border:'none', borderRadius:12,
                padding:'10px 11px', color:'#fff', fontSize:10.4, fontWeight:900,
                cursor:'pointer', fontFamily:'sans-serif',
                background:'linear-gradient(135deg,#FF8C69,#FF6B78)'
              }}
            >
              Trainingsplan erstellen →
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop:10, color:'#9A8578', fontSize:10.2, lineHeight:1.45, fontFamily:'sans-serif' }}>
          Der Trainingspartner teilt aktuell keinen Wochenfortschritt.
        </div>
      )}
    </div>
  }

  return (
    <>
      <style>{`
        @media (max-width:620px) {
          .together-hero { min-height:440px !important; background-position:58% center !important; }
          .together-hero-content { min-height:440px !important; padding:28px 20px !important; justify-content:flex-end !important; }
          .together-sports-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
          .together-progress-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
        }
        @media (max-width:390px) {
          .together-progress-grid { grid-template-columns:1fr !important; }
        }
      `}</style>

      <div style={{
        minHeight:'100vh',
        background:'linear-gradient(160deg,#FFF8F0 0%,#F2FAF4 52%,#FFF0F5 100%)',
        padding:'34px 16px 120px', boxSizing:'border-box'
      }}>
        <div style={{ maxWidth:720, margin:'0 auto' }}>
          <div>
            <div style={{ color:'#CC755E', fontSize:10, fontWeight:900, letterSpacing:1.2, fontFamily:'sans-serif' }}>GEMEINSAM</div>
            <h1 style={{
              margin:'4px 0 0', color:'#3D2B1F', fontFamily:"'Georgia','Times New Roman',serif",
              fontSize:'clamp(30px,7vw,42px)', lineHeight:1.05
            }}>Trainingspartner</h1>
            <p style={{ margin:'8px 0 0', color:'#8F796C', fontSize:12.5, lineHeight:1.55, fontFamily:'sans-serif' }}>
              Ziele verbinden. Training bleibt individuell.
            </p>
          </div>

          {!loading && pendingDirectInvites.length > 0 && (
            <section style={{ marginTop:22 }}>
              <div style={{ color:'#CC755E', fontSize:10, fontWeight:900, letterSpacing:1.1, fontFamily:'sans-serif' }}>
                EINLADUNGEN FÜR DICH
              </div>
              <h3 style={{
                margin:'5px 0 11px', color:'#4A382E',
                fontFamily:"'Georgia','Times New Roman',serif", fontSize:21
              }}>
                Möchtest du mittrainieren?
              </h3>

              <div style={{ display:'grid', gap:9 }}>
                {pendingDirectInvites.map(invite => (
                  <div key={invite.token} style={{
                    ...card, padding:15,
                    background:'linear-gradient(145deg,#FFF7F1,#FFFFFF 62%,#F3FAF5)'
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                      <Avatar profile={{
                        name:invite.inviter_name,
                        avatar_url:invite.inviter_avatar_url
                      }} size={42} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'#A66F5A', fontSize:9.5, fontWeight:900, fontFamily:'sans-serif' }}>
                          {invite.inviter_name || 'Ein Trainingspartner'} lädt dich ein
                        </div>
                        <div style={{
                          color:'#3D2B1F', fontSize:16, marginTop:2,
                          fontFamily:"'Georgia','Times New Roman',serif", fontWeight:700
                        }}>
                          {invite.title}
                        </div>
                        <div style={{ color:'#9A8478', fontSize:10, marginTop:3, fontFamily:'sans-serif' }}>
                          {[
                            (SPORT_META[invite.sport_type] || {}).label,
                            formatDate(invite.target_date)
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:8, marginTop:13 }}>
                      <button
                        type="button"
                        disabled={pendingInviteBusy === invite.token}
                        onClick={() => declineDirectInvite(invite)}
                        style={{
                          flex:1, border:'1.5px solid #E8DDD6', borderRadius:13,
                          padding:'10px 11px', background:'#fff', color:'#917B6F',
                          fontWeight:850, cursor:'pointer'
                        }}
                      >
                        Ablehnen
                      </button>
                      <button
                        type="button"
                        disabled={pendingInviteBusy === invite.token}
                        onClick={() => acceptDirectInvite(invite)}
                        style={{
                          flex:1.5, border:'none', borderRadius:13, padding:'10px 11px',
                          background:'linear-gradient(135deg,#7EC8A4,#5BA88A)',
                          color:'#fff', fontWeight:900, cursor:'pointer',
                          opacity:pendingInviteBusy === invite.token ? .6 : 1
                        }}
                      >
                        {pendingInviteBusy === invite.token ? '…' : 'Beitreten'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {loading ? (
            <div style={{ marginTop:26, color:'#AA9488', fontSize:12, fontFamily:'sans-serif' }}>Lade deine gemeinsamen Ziele…</div>
          ) : !primaryGoal ? (
            <>
              <div className="together-hero" style={{
                marginTop:24, borderRadius:26, minHeight:430,
                border:'1.5px solid #EED7CA', boxShadow:'0 14px 38px rgba(70,49,37,.12)',
                position:'relative', overflow:'hidden',
                backgroundImage:"url('/gemeinsam-hero-v2.png')",
                backgroundSize:'cover', backgroundPosition:'center center'
              }}>
                <div style={{
                  position:'absolute', inset:0,
                  background:'linear-gradient(90deg,rgba(29,23,20,.90) 0%,rgba(29,23,20,.76) 27%,rgba(29,23,20,.48) 45%,rgba(29,23,20,.14) 64%,rgba(29,23,20,0) 82%)'
                }} />
                <div className="together-hero-content" style={{
                  position:'relative', zIndex:1, minHeight:430, boxSizing:'border-box',
                  padding:'34px 28px', display:'flex', flexDirection:'column',
                  justifyContent:'center', alignItems:'flex-start'
                }}>
                  <div style={{ fontSize:10, fontWeight:900, letterSpacing:1.15, color:'#FFB197', fontFamily:'sans-serif' }}>EUER NÄCHSTES ZIEL</div>
                  <h2 style={{
                    margin:'10px 0 12px', maxWidth:430, color:'#fff',
                    fontFamily:"'Georgia','Times New Roman',serif",
                    fontSize:'clamp(30px,5.2vw,40px)', lineHeight:1.08,
                    textShadow:'0 2px 14px rgba(0,0,0,.20)'
                  }}>Gemeinsam ist manches Ziel leichter.</h2>
                  <p style={{
                    margin:0, maxWidth:430, color:'rgba(255,255,255,.92)',
                    fontSize:13, lineHeight:1.7, fontFamily:'sans-serif'
                  }}>
                    Trainiert auf dasselbe Ziel hin, bleibt aber in euren Plänen individuell. Gemeinsame Einheiten verbinden eure Wege.
                  </p>
                  <button type="button" onClick={openCreate} style={{
                    marginTop:22, border:'none', borderRadius:16, padding:'15px 20px',
                    minWidth:'min(350px,100%)', color:'#fff', fontWeight:900, cursor:'pointer',
                    background:'linear-gradient(135deg,#FF8C69,#FF6B78)',
                    boxShadow:'0 9px 22px rgba(255,112,91,.30)'
                  }}>
                    + Gemeinsames Ziel erstellen
                  </button>
                </div>
              </div>

              <section style={{ marginTop:24 }}>
                <div style={{ color:'#CC755E', fontSize:10, fontWeight:900, letterSpacing:1.1, fontFamily:'sans-serif' }}>SO FUNKTIONIERT'S</div>
                <h3 style={{ margin:'5px 0 12px', color:'#4A382E', fontFamily:"'Georgia','Times New Roman',serif", fontSize:21 }}>
                  Dasselbe Ziel. Dein eigener Plan.
                </h3>
                <div style={{ display:'grid', gap:9 }}>
                  {[
                    ['1','🎯','Ziel wählen','Entscheidet euch für dieselbe Sportart und ein gemeinsames Ziel.'],
                    ['2','🔗','Trainingspartner einladen','Teile einen sicheren Link mit der Person, mit der du trainieren möchtest.'],
                    ['3','✨','Individuell trainieren','Jeder behält seinen eigenen Plan – gemeinsame Einheiten verbinden euch.'],
                  ].map(([n,icon,title,text]) => <div key={n} style={{ ...card, padding:'13px 14px', display:'flex', gap:12, alignItems:'center' }}>
                    <div style={{ width:42, height:42, borderRadius:14, background:'#FFF1E9', display:'grid', placeItems:'center', fontSize:18 }}>{icon}</div>
                    <div>
                      <div style={{ color:'#49372C', fontSize:11.5, fontWeight:900, fontFamily:'sans-serif' }}>{n}. {title}</div>
                      <div style={{ color:'#9B8679', fontSize:10.3, marginTop:3, lineHeight:1.45, fontFamily:'sans-serif' }}>{text}</div>
                    </div>
                  </div>)}
                </div>
              </section>
            </>
          ) : (
            <>
              <section style={{
                position:'relative', marginTop:24, borderRadius:26, overflow:'hidden',
                border:'1.5px solid #EED7CA', boxShadow:'0 14px 38px rgba(70,49,37,.12)',
                background:"linear-gradient(90deg,rgba(28,22,19,.86),rgba(28,22,19,.45)),url('/gemeinsam-hero-v2.png') center/cover"
              }}>
                <button type="button" aria-label="Ziel verwalten" onClick={() => setGoalMenuOpen(value => !value)} style={{
                  position:'absolute', top:14, right:14, zIndex:3, width:38, height:38, borderRadius:'50%',
                  border:'1px solid rgba(255,255,255,.28)', background:'rgba(28,22,19,.38)',
                  color:'#fff', fontSize:22, lineHeight:1, cursor:'pointer', backdropFilter:'blur(8px)'
                }}>⋯</button>

                {goalMenuOpen && (
                  <div style={{
                    position:'absolute', top:58, right:14, zIndex:4, width:220, padding:7,
                    borderRadius:16, background:'rgba(255,253,252,.98)', boxShadow:'0 14px 34px rgba(42,29,22,.24)',
                    border:'1px solid #E9DDD6', fontFamily:'sans-serif'
                  }}>
                    <button type="button" onClick={() => manageInvite(primaryGoal)} style={{
                      width:'100%', border:'none', background:'transparent', textAlign:'left', padding:'10px 11px',
                      borderRadius:10, color:'#5F4B40', fontWeight:800, cursor:'pointer', fontSize:10.5
                    }}>👥 Trainingspartner einladen</button>

                    {currentMembership(primaryGoal.id)?.role === 'owner' ? (
                      <button type="button" disabled={goalActionBusy} onClick={() => archiveGoal(primaryGoal)} style={{
                        width:'100%', border:'none', background:'#FFF3F1', textAlign:'left', padding:'10px 11px',
                        borderRadius:10, color:'#C95F58', fontWeight:900, cursor:'pointer', fontSize:10.5
                      }}>🗑 Gemeinsames Ziel löschen</button>
                    ) : (
                      <button type="button" disabled={goalActionBusy} onClick={() => leaveGoal(primaryGoal)} style={{
                        width:'100%', border:'none', background:'#FFF3F1', textAlign:'left', padding:'10px 11px',
                        borderRadius:10, color:'#C95F58', fontWeight:900, cursor:'pointer', fontSize:10.5
                      }}>↩ Gemeinsames Ziel verlassen</button>
                    )}
                  </div>
                )}

                <div style={{ padding:'22px 20px 20px', minHeight:260, boxSizing:'border-box', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                  <div style={{ display:'inline-flex', alignSelf:'flex-start', padding:'5px 9px', borderRadius:999, background:'rgba(255,255,255,.16)', color:'#FFD0BE', fontSize:9.5, fontWeight:900, fontFamily:'sans-serif' }}>
                    {(SPORT_META[primaryGoal.sport_type] || {icon:'♡'}).icon} EUER ZIEL
                  </div>
                  <h2 style={{ margin:'10px 0 6px', color:'#fff', fontFamily:"'Georgia','Times New Roman',serif", fontSize:29, lineHeight:1.08 }}>
                    {primaryGoal.title}
                  </h2>
                  <div style={{ color:'rgba(255,255,255,.86)', fontSize:11.5, fontFamily:'sans-serif' }}>
                    {[formatDate(primaryGoal.target_date), daysUntil(primaryGoal.target_date) != null ? `Noch ${daysUntil(primaryGoal.target_date)} Tage` : null].filter(Boolean).join(' · ') || 'Euer gemeinsamer Weg'}
                  </div>

                  <div style={{ display:'flex', alignItems:'center', marginTop:15 }}>
                    {(membersByGoal[primaryGoal.id] || []).slice(0,4).map((member,index) =>
                      <div key={member.user_id} style={{ marginLeft:index ? -8 : 0 }}>
                        <Avatar profile={profilesById[member.user_id] || { name:member.user_id === user.id ? 'Du' : 'Trainingspartner' }} size={35} />
                      </div>
                    )}
                    <div style={{ marginLeft:10, color:'rgba(255,255,255,.90)', fontSize:10.5, fontFamily:'sans-serif' }}>
                      {(membersByGoal[primaryGoal.id] || []).length > 1
                        ? `${(membersByGoal[primaryGoal.id] || []).length} Trainingspartner`
                        : 'Noch allein – lade deinen Trainingspartner ein'}
                    </div>
                  </div>
                </div>
              </section>

              <section style={{ marginTop:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                  <div>
                    <div style={{ color:'#CC755E', fontSize:10, fontWeight:900, letterSpacing:1.1, fontFamily:'sans-serif' }}>EURE WOCHE</div>
                    <h3 style={{ margin:'4px 0 0', color:'#4A382E', fontFamily:"'Georgia','Times New Roman',serif", fontSize:21 }}>Jeder auf seinem Weg.</h3>
                  </div>
                </div>
                <div className="together-progress-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:9, marginTop:11 }}>
                  {(membersByGoal[primaryGoal.id] || []).map(renderProgress)}
                </div>
              </section>

              <section style={{ marginTop:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                  <h3 style={{ margin:0, color:'#4A382E', fontFamily:"'Georgia','Times New Roman',serif", fontSize:21 }}>Nächste gemeinsame Einheit</h3>
                  <button type="button" onClick={() => setSessionGoal(primaryGoal)} style={{
                    border:'none', background:'transparent', color:'#D16D55', fontSize:10.5, fontWeight:900, cursor:'pointer'
                  }}>+ Planen</button>
                </div>

                {(sessionsByGoal[primaryGoal.id] || []).length ? (
                  <div style={{ ...card, padding:15, marginTop:10, display:'flex', gap:12, alignItems:'center' }}>
                    <div style={{ width:46, height:46, borderRadius:15, background:'#FFF0E7', display:'grid', placeItems:'center', fontSize:20 }}>
                      {(SPORT_META[primaryGoal.sport_type] || {icon:'🏃'}).icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#49372C', fontSize:12, fontWeight:900, fontFamily:'sans-serif' }}>
                        {(sessionsByGoal[primaryGoal.id] || [])[0].title}
                      </div>
                      <div style={{ color:'#9A8578', fontSize:10.5, marginTop:3, fontFamily:'sans-serif' }}>
                        {formatShortDate((sessionsByGoal[primaryGoal.id] || [])[0].scheduled_date)}
                      </div>
                      {(sessionsByGoal[primaryGoal.id] || [])[0].note && <div style={{ color:'#806B5E', fontSize:10, marginTop:4, lineHeight:1.4, fontFamily:'sans-serif' }}>
                        {(sessionsByGoal[primaryGoal.id] || [])[0].note}
                      </div>}
                    </div>
                    <div style={{ color:'#6D9879', fontSize:10, fontWeight:900, fontFamily:'sans-serif' }}>Gemeinsam geplant</div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setSessionGoal(primaryGoal)} style={{
                    ...card, width:'100%', marginTop:10, padding:15, display:'flex', alignItems:'center', gap:12,
                    textAlign:'left', cursor:'pointer'
                  }}>
                    <div style={{ width:46, height:46, borderRadius:15, background:'#FFF0E7', display:'grid', placeItems:'center', fontSize:20 }}>🤝</div>
                    <div>
                      <div style={{ color:'#49372C', fontSize:12, fontWeight:900, fontFamily:'sans-serif' }}>Gemeinsame Einheit planen</div>
                      <div style={{ color:'#9A8578', fontSize:10.4, marginTop:3, lineHeight:1.45, fontFamily:'sans-serif' }}>
                        Verbindet zwei individuelle Trainingseinheiten zu einem gemeinsamen Termin.
                      </div>
                    </div>
                  </button>
                )}
              </section>

              <section style={{ marginTop:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                  <h3 style={{ margin:0, color:'#4A382E', fontFamily:"'Georgia','Times New Roman',serif", fontSize:21 }}>Trainingspartner</h3>
                  <button type="button" onClick={() => manageInvite(primaryGoal)} style={{
                    border:'none', background:'transparent', color:'#D16D55', fontSize:10.5, fontWeight:900, cursor:'pointer'
                  }}>+ Einladen</button>
                </div>
                <div style={{ ...card, padding:'13px 14px', marginTop:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:13, overflowX:'auto', paddingBottom:2 }}>
                    {(membersByGoal[primaryGoal.id] || []).map(member => {
                      const profile = profilesById[member.user_id] || { name:member.user_id === user.id ? 'Du' : 'Trainingspartner' }
                      return <div key={member.user_id} style={{ minWidth:58, textAlign:'center' }}>
                        <Avatar profile={profile} size={43} />
                        <div style={{ marginTop:5, color:'#735F53', fontSize:9.8, fontWeight:800, fontFamily:'sans-serif', whiteSpace:'nowrap' }}>
                          {member.user_id === user.id ? 'Du' : (profile.name || 'Partner')}
                        </div>
                      </div>
                    })}
                    <button type="button" onClick={() => manageInvite(primaryGoal)} style={{
                      minWidth:58, border:'none', background:'transparent', cursor:'pointer', textAlign:'center'
                    }}>
                      <div style={{ width:43, height:43, margin:'0 auto', borderRadius:'50%', border:'1.5px dashed #D8C7BC', color:'#D16D55', display:'grid', placeItems:'center', fontSize:22 }}>+</div>
                      <div style={{ marginTop:5, color:'#A18779', fontSize:9.5, fontWeight:800, fontFamily:'sans-serif' }}>Einladen</div>
                    </button>
                  </div>
                </div>
              </section>

              {otherGoals.length > 0 && (
                <section style={{ marginTop:24 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <h3 style={{ margin:0, color:'#4A382E', fontFamily:"'Georgia','Times New Roman',serif", fontSize:21 }}>Weitere gemeinsame Ziele</h3>
                    <button type="button" onClick={openCreate} style={{ border:'none', background:'transparent', color:'#D16D55', fontSize:10.5, fontWeight:900, cursor:'pointer' }}>+ Neu</button>
                  </div>
                  <div style={{ display:'grid', gap:9, marginTop:10 }}>
                    {otherGoals.map(goal => <div key={goal.id} style={{ ...card, padding:'13px 14px', display:'flex', alignItems:'center', gap:11 }}>
                      <div style={{ width:42, height:42, borderRadius:14, background:'#FFF0E7', display:'grid', placeItems:'center', fontSize:19 }}>
                        {(SPORT_META[goal.sport_type] || {icon:'♡'}).icon}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'#49372C', fontSize:11.5, fontWeight:900, fontFamily:'sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{goal.title}</div>
                        <div style={{ color:'#9A8578', fontSize:10, marginTop:3, fontFamily:'sans-serif' }}>
                          {daysUntil(goal.target_date) != null ? `Noch ${daysUntil(goal.target_date)} Tage` : 'Gemeinsames Ziel'}
                        </div>
                      </div>
                      <button type="button" onClick={() => manageInvite(goal)} style={{ border:'none', background:'#FFF2EA', color:'#C96851', borderRadius:12, padding:'8px 10px', fontSize:9.5, fontWeight:900, cursor:'pointer' }}>Einladen</button>
                    </div>)}
                  </div>
                </section>
              )}
            </>
          )}

          <section ref={friendsSectionRef} style={{ marginTop:28, scrollMarginTop:18 }}>
            <div style={{ color:'#CC755E', fontSize:10, fontWeight:900, letterSpacing:1.1, fontFamily:'sans-serif' }}>
              TRAININGSPARTNER
            </div>
            <h3 style={{ margin:'5px 0 5px', color:'#4A382E', fontFamily:"'Georgia','Times New Roman',serif", fontSize:21 }}>
              Gemeinsam trainiert es sich leichter.
            </h3>
            <p style={{ margin:'0 0 13px', color:'#987F72', fontSize:10.8, lineHeight:1.5, fontFamily:'sans-serif' }}>
              Finde Trainingspartner, beantworte Anfragen oder lade jemanden ein.
            </p>
            <div style={{ ...card, padding:14 }}>
              <Friends user={user} />
            </div>
          </section>

          {message && <div style={{
            position:'fixed', left:'50%', transform:'translateX(-50%)', bottom:88, zIndex:160,
            background:'#443329', color:'#fff', padding:'10px 14px', borderRadius:999,
            fontSize:10.5, fontFamily:'sans-serif', boxShadow:'0 8px 24px rgba(0,0,0,.16)',
            maxWidth:'86vw', textAlign:'center'
          }}>{message}</div>}

          {showCreate && <CreateGoalModal
            user={user}
            plan={plan}
            planId={planId}
            onClose={closeCreate}
            onCreated={(goal) => {
              clearGoalDraft(user?.id)
              setShowCreate(false)
              setInviteGoal(goal)
              load()
            }}
          />}

          {inviteGoal && <InviteGoalModal
            goal={inviteGoal}
            user={user}
            onClose={() => setInviteGoal(null)}
          />}

          {sessionGoal && <CreateSessionModal
            goal={sessionGoal}
            user={user}
            onClose={() => setSessionGoal(null)}
            onCreated={() => { setSessionGoal(null); load() }}
          />}
        </div>
      </div>
    </>
  )
}
