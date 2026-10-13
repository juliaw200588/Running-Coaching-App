import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase.js'
import Auth from './components/Auth.jsx'
import LandingPage from './components/LandingPage.jsx'
import Onboarding from './components/Onboarding.jsx'
import HikingOnboarding from './components/HikingOnboarding.jsx'
import CyclingOnboarding from './components/CyclingOnboarding.jsx'
import MtbOnboarding from './components/MtbOnboarding.jsx'
import SwimmingOnboarding from './components/SwimmingOnboarding.jsx'
import HyroxOnboarding from './components/HyroxOnboarding.jsx'
import HikingWeeklyCheckIn from './components/HikingWeeklyCheckIn.jsx'
import WelcomeOnboarding from './components/WelcomeOnboarding.jsx'
import TrainingPlan from './components/TrainingPlan.jsx'
import Profile from './components/Profile.jsx'
import Laeufe from './components/Laeufe.jsx'
import Notifications from './components/Notifications.jsx'
import BottomNav from './components/BottomNav.jsx'
import Dashboard from './components/Dashboard.jsx'
import Together from './components/Together.jsx'
import { legacyPlanDayKey, planDayKey } from './lib/planDayKey.js'

const WEEK_REMINDER_HOUR = 18

const SHARED_GOAL_PLAN_TARGET_KEY = 'shared_goal_plan_target_v1'

const coachDebug = (...args) => {
  console.log('[WochenCoach]', ...args)
}

const coachDiagnostic = (stage, payload = {}) => {
  const entry = {
    at: new Date().toISOString(),
    stage,
    ...payload,
  }

  console.log('[WochenCoach][DIAG]', entry)

  try {
    const key = 'weekly_coach_diagnostics_v1'
    const current = JSON.parse(localStorage.getItem(key) || '[]')
    const next = [...current, entry].slice(-80)
    localStorage.setItem(key, JSON.stringify(next))
  } catch {}
}

const parseLocalPlanDate = (value) => {
  if (!value) return new Date()

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        0,
        0,
        0,
        0
      )
    }
  }

  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`


function PlanSportSelection({ onSelect }) {
  const sports = [
    { id: 'running', icon: '🏃', title: 'Laufen', text: 'Trainiere strukturiert auf deine Laufziele hin.', available: true },
    { id: 'hiking', icon: '🥾', title: 'Marsch & Wandern', text: 'Baue Distanz und Ausdauer Schritt für Schritt auf.', available: true },
    { id: 'cycling', icon: '🚴', title: 'Radfahren', text: 'Mehr Ausdauer für längere Touren und persönliche Ziele.', available: true },
    { id: 'mountain_biking', icon: '🚵', title: 'Mountainbike', text: 'Trainiere Ausdauer, Fahrtechnik und Belastbarkeit fürs Gelände.', available: true },
    { id: 'swimming', icon: '🏊', title: 'Schwimmen', text: 'Entwickle Ausdauer, Technik und längere Distanzen.', available: true },
    { id: 'hyrox', icon: '🏋️', title: 'HYROX', text: 'Verbinde Laufen, Kraft und Race-Stations in einem strukturierten Plan.', available: true },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 52%, #FFF0F5 100%)', padding:'30px 16px 110px', boxSizing:'border-box' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:'sans-serif', fontSize:10, fontWeight:900, letterSpacing:1.25, color:'#C77861', marginBottom:7 }}>TRAININGSPLAN</div>
          <h1 style={{ margin:0, color:'#3D2B1F', fontFamily:"'Georgia', 'Times New Roman', serif", fontSize:'clamp(27px, 6vw, 38px)', lineHeight:1.08 }}>
            Wofür möchtest du trainieren?
          </h1>
          <p style={{ margin:'10px 0 0', maxWidth:560, color:'#8B7467', fontFamily:'sans-serif', fontSize:13, lineHeight:1.6 }}>
            Wähle die Sportart für deinen Trainingsplan. Weitere Pläne kommen Schritt für Schritt dazu.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(230px, 1fr))', gap:12 }}>
          {sports.map(sport => (
            <button
              key={sport.id}
              type="button"
              disabled={!sport.available}
              onClick={() => sport.available && onSelect(sport.id)}
              style={{
                position:'relative', minHeight:150, textAlign:'left', borderRadius:22,
                border:sport.available ? '2px solid #F0D9CC' : '1.5px solid #E8E1DC',
                background:sport.available ? '#FFFFFF' : '#FAF8F6', padding:18,
                cursor:sport.available ? 'pointer' : 'default', opacity:sport.available ? 1 : 0.72,
                boxShadow:sport.available ? '0 10px 30px rgba(78,54,40,0.08)' : 'none'
              }}
            >
              {!sport.available && (
                <span style={{ position:'absolute', top:13, right:13, padding:'5px 8px', borderRadius:999, background:'#F0EAE5', color:'#9B887C', fontFamily:'sans-serif', fontSize:9, fontWeight:900, letterSpacing:.5 }}>
                  IN VORBEREITUNG
                </span>
              )}
              <div style={{ fontSize:32, marginBottom:14 }}>{sport.icon}</div>
              <div style={{ color:'#463328', fontFamily:'sans-serif', fontSize:16, fontWeight:900, marginBottom:6 }}>{sport.title}</div>
              <div style={{ color:'#9A8477', fontFamily:'sans-serif', fontSize:11.5, lineHeight:1.5, paddingRight:8 }}>{sport.text}</div>
              {sport.available && (
                <div style={{ marginTop:15, color:'#D66D53', fontFamily:'sans-serif', fontSize:11, fontWeight:900 }}>Plan erstellen →</div>
              )}
            </button>
          ))}
        </div>

        <p style={{ margin:'18px 4px 0', color:'#B09C91', fontFamily:'sans-serif', fontSize:10.5, lineHeight:1.5 }}>
          Du kannst die App weiterhin ohne Trainingsplan nutzen und jederzeit später hierher zurückkehren.
        </p>
      </div>
    </div>
  )
}


function SharedGoalInviteModal({ invite, busy, error, onAccept, onDecline }) {
  if (!invite) return null

  const sportLabel = {
    running:'Laufen',
    hiking:'Wandern',
    cycling:'Radfahren',
    mountain_biking:'Mountainbike',
    swimming:'Schwimmen',
    hyrox:'HYROX',
  }[invite.sport_type] || 'Training'

  const formattedDate = invite.target_date
    ? new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'short', year:'numeric' })
        .format(new Date(`${invite.target_date}T12:00:00`))
    : null

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:220, background:'rgba(52,37,29,.48)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16
    }}>
      <div style={{
        width:'100%', maxWidth:520, borderRadius:26, background:'#FFFDFC',
        padding:'24px 20px 20px', boxSizing:'border-box',
        boxShadow:'0 20px 60px rgba(55,38,28,.22)', textAlign:'center'
      }}>
        <div style={{
          width:68, height:68, borderRadius:'50%', margin:'0 auto 13px',
          display:'grid', placeItems:'center', fontSize:30,
          background:'linear-gradient(135deg,#FFF0E8,#F0F8F2)', border:'1px solid #EEDFD5'
        }}>🎉</div>

        <div style={{ color:'#D16D55', fontSize:10, fontWeight:900, letterSpacing:1.1, fontFamily:'sans-serif' }}>
          EINLADUNG ZUM GEMEINSAMEN ZIEL
        </div>
        <h2 style={{
          margin:'7px auto 5px', color:'#3D2B1F',
          fontFamily:"'Georgia','Times New Roman',serif", fontSize:27, lineHeight:1.1
        }}>
          {invite.inviter_name
            ? `${invite.inviter_name} lädt dich ein`
            : 'Du wurdest eingeladen'}
        </h2>
        <div style={{
          marginTop:14, borderRadius:20, padding:'17px 15px',
          background:'linear-gradient(145deg,#FFF0E6,#FFF8F3 55%,#F1F8EF)',
          border:'1px solid #F0DDD1', textAlign:'left'
        }}>
          <div style={{ color:'#A66F5A', fontSize:10, fontWeight:900, fontFamily:'sans-serif' }}>
            {sportLabel}
          </div>
          <div style={{
            marginTop:5, color:'#3D2B1F', fontFamily:"'Georgia','Times New Roman',serif",
            fontSize:23, fontWeight:700, lineHeight:1.15
          }}>
            {invite.title}
          </div>
          <div style={{ marginTop:7, color:'#8E776A', fontSize:10.8, lineHeight:1.5, fontFamily:'sans-serif' }}>
            {[formattedDate, invite.target_distance ? `${invite.target_distance} ${invite.target_unit || 'km'}` : null]
              .filter(Boolean).join(' · ') || 'Gemeinsam auf ein Ziel hinarbeiten'}
          </div>
        </div>

        <div style={{ display:'grid', gap:8, marginTop:13, textAlign:'left' }}>
          {[
            'Gemeinsames Ziel & Countdown',
            'Individueller Trainingsplan für dich',
            'Gemeinsame Einheiten planen',
            'Fortschritt teilen, ohne Leistungsranking',
          ].map(text => (
            <div key={text} style={{ color:'#756055', fontSize:10.7, fontFamily:'sans-serif' }}>
              <span style={{ color:'#6E9A7B', fontWeight:900 }}>✓</span> {text}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ marginTop:12, color:'#C6544C', fontSize:11, lineHeight:1.45, fontFamily:'sans-serif' }}>
            {error}
          </div>
        )}

        <button type="button" disabled={busy} onClick={onAccept} style={{
          marginTop:18, width:'100%', border:'none', borderRadius:16, padding:'14px',
          background:'linear-gradient(135deg,#7EC8A4,#5BA88A)', color:'#fff',
          fontWeight:900, cursor:busy ? 'default' : 'pointer', opacity:busy ? .6 : 1
        }}>
          {busy ? 'Wird verbunden…' : 'Beitreten'}
        </button>
        <button type="button" disabled={busy} onClick={onDecline} style={{
          marginTop:9, width:'100%', border:'1.5px solid #E9DDD6', borderRadius:16, padding:'12px',
          background:'#fff', color:'#8D776B', fontWeight:800, cursor:busy ? 'default' : 'pointer'
        }}>
          Ablehnen
        </button>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [plan, setPlan] = useState(null)
  const [planId, setPlanId] = useState(null)
  const [primaryPlan, setPrimaryPlan] = useState(null)
  const [primaryPlanId, setPrimaryPlanId] = useState(null)
  const [viewingSecondaryPlan, setViewingSecondaryPlan] = useState(false)
  const [activeTab, setActiveTab] = useState('training')
  const [showTrainingPlan, setShowTrainingPlan] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [togetherFocusFriends, setTogetherFocusFriends] = useState(0)
  const [togetherRefresh, setTogetherRefresh] = useState(0)
  const [sharedGoalPlanTarget, setSharedGoalPlanTarget] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SHARED_GOAL_PLAN_TARGET_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  const [pendingGoalInvite, setPendingGoalInvite] = useState(null)
  const [goalInviteBusy, setGoalInviteBusy] = useState(false)
  const [goalInviteError, setGoalInviteError] = useState('')

  useEffect(() => {
    try {
      if (sharedGoalPlanTarget?.id) {
        sessionStorage.setItem(
          SHARED_GOAL_PLAN_TARGET_KEY,
          JSON.stringify(sharedGoalPlanTarget)
        )
      } else {
        sessionStorage.removeItem(SHARED_GOAL_PLAN_TARGET_KEY)
      }
    } catch {}
  }, [sharedGoalPlanTarget])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [openWeekAnalysisWeek, setOpenWeekAnalysisWeek] = useState(null)
  const [authEntryMode, setAuthEntryMode] = useState(null)
  const [profileSetupLoading, setProfileSetupLoading] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(null)
  const [selectedPlanSport, setSelectedPlanSport] = useState(null)
  const [pendingHikingCheckIn, setPendingHikingCheckIn] = useState(null)
  const [weeklyCheckInRefresh, setWeeklyCheckInRefresh] = useState(0)
  const weeklyCheckKeyRef = useRef(new Set())

  useEffect(() => {
    window.getWeeklyCoachDiagnostics = () => {
      try {
        return JSON.parse(
          localStorage.getItem('weekly_coach_diagnostics_v1') || '[]'
        )
      } catch {
        return []
      }
    }

    window.clearWeeklyCoachDiagnostics = () => {
      try {
        localStorage.removeItem('weekly_coach_diagnostics_v1')
      } catch {}
    }

    return () => {
      try {
        delete window.getWeeklyCoachDiagnostics
        delete window.clearWeeklyCoachDiagnostics
      } catch {}
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoadingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_OUT') setAuthEntryMode(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadPlan(user.id)
      loadUnreadCount(user.id)
      loadOnboardingStatus(user)

      const channel = supabase
        .channel('unread_notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => setUnreadCount(prev => prev + 1))
        .subscribe()

      return () => supabase.removeChannel(channel)
    } else {
      setPlan(null)
      setPlanId(null)
      setUnreadCount(0)
      setOnboardingCompleted(null)
      setProfileSetupLoading(false)
      setSelectedPlanSport(null)
      setPendingHikingCheckIn(null)
    }
  }, [user])

  // Einladungslinks erst nach Login auswerten.
  // Gemeinsame Ziele werden bewusst NICHT automatisch angenommen:
  // Der Nutzer sieht zuerst, wozu er eingeladen wurde.
  useEffect(() => {
    if (!user?.id) return

    const params = new URLSearchParams(window.location.search)
    const goalInvite = params.get('goalInvite')
    const friendInvite = params.get('friendInvite')
    if (!goalInvite && !friendInvite) return

    let cancelled = false

    const inspectInvite = async () => {
      try {
        if (goalInvite) {
          const { data, error } = await supabase.rpc('preview_shared_goal_invite', {
            invite_token: goalInvite,
          })
          if (error) throw error

          const preview = Array.isArray(data) ? data[0] : data
          if (!preview) throw new Error('invite_invalid_or_expired')

          if (!cancelled) {
            setPendingGoalInvite({ ...preview, token:goalInvite })
            setGoalInviteError('')
          }
          return
        }

        if (friendInvite) {
          const { error } = await supabase.rpc('accept_friend_invite', {
            invite_token: friendInvite,
          })
          if (error) throw error
          if (!cancelled) {
            setActiveTab('together')
            setTogetherFocusFriends(value => value + 1)
          }
          const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`
          window.history.replaceState({}, '', cleanUrl)
        }
      } catch (error) {
        console.error('[Gemeinsam] Einladung konnte nicht geladen werden:', error)
        if (!cancelled) setGoalInviteError('Diese Einladung ist ungültig, abgelaufen oder wurde bereits verwendet.')
      }
    }

    inspectInvite()
    return () => { cancelled = true }
  }, [user?.id])

  const clearInviteUrl = () => {
    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`
    window.history.replaceState({}, '', cleanUrl)
  }

  const acceptPendingGoalInvite = async () => {
    if (!pendingGoalInvite?.token) return
    setGoalInviteBusy(true)
    setGoalInviteError('')

    const { error } = await supabase.rpc('accept_shared_goal_invite', {
      invite_token: pendingGoalInvite.token,
    })

    if (error) {
      console.error('[Gemeinsam] Ziel-Einladung annehmen fehlgeschlagen:', error)
      setGoalInviteError('Die Einladung konnte gerade nicht angenommen werden.')
      setGoalInviteBusy(false)
      return
    }

    setPendingGoalInvite(null)
    setGoalInviteBusy(false)
    clearInviteUrl()
    setActiveTab('together')
    setTogetherRefresh(value => value + 1)
  }

  const declinePendingGoalInvite = async () => {
    if (!pendingGoalInvite?.token) return
    setGoalInviteBusy(true)
    setGoalInviteError('')

    const { error } = await supabase.rpc('decline_shared_goal_invite', {
      invite_token: pendingGoalInvite.token,
    })

    if (error) {
      console.error('[Gemeinsam] Ziel-Einladung ablehnen fehlgeschlagen:', error)
      setGoalInviteError('Die Einladung konnte gerade nicht abgelehnt werden.')
      setGoalInviteBusy(false)
      return
    }

    setPendingGoalInvite(null)
    setGoalInviteBusy(false)
    clearInviteUrl()
  }

  const sharedGoalDraft = goal => {
    const distanceKm = goal?.target_distance != null ? Number(goal.target_distance) : null
    const targetDate = goal?.target_date || ''
    const goalType = goal?.goal_type || 'custom'
    const sport = goal?.sport_type

    if (sport === 'hiking') {
      return {
        key:'hiking-onboarding-draft-v1',
        value:{
          step:1,
          form:{
            goalType:goalType === 'event' ? 'march' : goalType === 'distance' ? 'distance' : '',
            targetDistanceKm:distanceKm ? String(distanceKm) : '',
            customDistance:Boolean(distanceKm && ![20,30,50,100].includes(distanceKm)),
            eventDate:targetDate,
          }
        }
      }
    }

    if (sport === 'cycling') {
      return {
        key:'cycling-onboarding-draft-v1',
        value:{
          step:1,
          form:{
            goalType:goalType === 'event' ? 'event' : goalType === 'distance' ? 'distance' : '',
            targetDistanceKm:distanceKm ? String(distanceKm) : '',
            customDistance:Boolean(distanceKm),
            eventDate:targetDate,
          }
        }
      }
    }

    if (sport === 'mountain_biking') {
      return {
        key:'mtb-onboarding-draft-v1',
        value:{
          step:1,
          form:{
            goalType:goalType === 'event' ? 'event' : goalType === 'distance' ? 'distance' : '',
            targetDistanceKm:distanceKm ? String(distanceKm) : '',
            customDistance:Boolean(distanceKm),
            eventDate:targetDate,
          }
        }
      }
    }

    if (sport === 'swimming') {
      return {
        key:'swimming_onboarding_draft_v2',
        value:{
          step:1,
          form:{
            goalType:goalType === 'event' ? 'event' : goalType === 'distance' ? 'distance' : '',
            targetDistanceM:distanceKm ? String(Math.round(distanceKm * 1000)) : '',
            customDistanceM:distanceKm ? String(Math.round(distanceKm * 1000)) : '',
            eventDate:targetDate,
          }
        }
      }
    }

    if (sport === 'hyrox') {
      return {
        key:'hyrox-onboarding-draft-v1',
        value:{
          step:1,
          form:{
            goalType:targetDate ? 'event' : 'fitness',
            eventDate:targetDate,
          }
        }
      }
    }

    if (sport === 'running') {
      const knownGoal =
        distanceKm != null && Math.abs(distanceKm - 5) < .2 ? '5 km' :
        distanceKm != null && Math.abs(distanceKm - 10) < .2 ? '10 km' :
        distanceKm != null && Math.abs(distanceKm - 21.1) < .5 ? 'Halbmarathon' :
        distanceKm != null && Math.abs(distanceKm - 42.195) < .8 ? 'Marathon' :
        /halbmarathon/i.test(goal?.title || '') ? 'Halbmarathon' :
        /marathon/i.test(goal?.title || '') ? 'Marathon' :
        /10\s*km/i.test(goal?.title || '') ? '10 km' :
        /5\s*km/i.test(goal?.title || '') ? '5 km' : ''

      return {
        key:'running-onboarding-draft-v1',
        value:{
          step:1,
          form:{
            zielTyp:goalType === 'event' ? 'rennen' : goalType === 'distance' ? 'distanz' : '',
            goal:knownGoal,
            raceDate:targetDate,
          }
        }
      }
    }

    return null
  }

  const handleCreatePlanForSharedGoal = goal => {
    if (!goal?.id || !goal?.sport_type) return

    const draft = sharedGoalDraft(goal)
    if (draft) {
      try {
        const existing = JSON.parse(sessionStorage.getItem(draft.key) || 'null')
        sessionStorage.setItem(
          draft.key,
          JSON.stringify({
            ...(existing || {}),
            ...draft.value,
            form:{
              ...(existing?.form || {}),
              ...(draft.value.form || {}),
            }
          })
        )
      } catch (error) {
        console.warn('[Gemeinsam] Onboarding-Vorbelegung konnte nicht gespeichert werden:', error)
      }
    }

    try {
      sessionStorage.setItem(
        SHARED_GOAL_PLAN_TARGET_KEY,
        JSON.stringify(goal)
      )
    } catch {}

    setSharedGoalPlanTarget(goal)
    setSelectedPlanSport(goal.sport_type)
    setActiveTab('training')
    setShowTrainingPlan(true)
    setOpenWeekAnalysisWeek(null)
  }

  const loadProfileName = async (userId) => {
    const { data } = await supabase.from('profiles').select('name').eq('id', userId).single()
    return data?.name || ''
  }

  const loadOnboardingStatus = async (currentUser) => {
    if (!currentUser?.id) {
      setOnboardingCompleted(null)
      setProfileSetupLoading(false)
      return
    }

    setProfileSetupLoading(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (error) throw error

      setOnboardingCompleted(data?.onboarding_completed === true)
    } catch (error) {
      console.error(
        '[App] Onboarding-Status konnte nicht geladen werden:',
        error
      )
      // Bei einem Lesefehler nicht versehentlich die App freigeben.
      setOnboardingCompleted(false)
    } finally {
      setProfileSetupLoading(false)
    }
  }

  const loadPlan = async (userId) => {
    // Der Hauptplan steuert Dashboard und den normalen Training-Reiter.
    // Zusätzliche Pläne aus "Gemeinsam" bleiben separat gespeichert.
    let { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .order('created_at', { ascending:false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[App] Hauptplan konnte nicht geladen werden:', error)
    }

    // Fallback für Altbestände, falls die Migration noch keinen Hauptplan gesetzt hat.
    if (!data) {
      const fallback = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending:false })
        .limit(1)
        .maybeSingle()
      data = fallback.data || null
    }

    if (data) {
      setPlan(data.plan_data)
      setPlanId(data.id)
      setPrimaryPlan(data.plan_data)
      setPrimaryPlanId(data.id)
      setViewingSecondaryPlan(false)
      localStorage.setItem(`runcoaching_plan_${userId}`, JSON.stringify(data.plan_data))
    } else {
      try {
        const saved = localStorage.getItem(`runcoaching_plan_${userId}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          setPlan(parsed)
          setPrimaryPlan(parsed)
        } else {
          setPlan(null)
          setPrimaryPlan(null)
        }
      } catch {
        setPlan(null)
        setPrimaryPlan(null)
      }
      setPlanId(null)
      setPrimaryPlanId(null)
      setViewingSecondaryPlan(false)
    }
  }

  const restorePrimaryPlan = () => {
    if (primaryPlan && primaryPlanId) {
      setPlan(primaryPlan)
      setPlanId(primaryPlanId)
      setViewingSecondaryPlan(false)
      localStorage.setItem(`runcoaching_plan_${user.id}`, JSON.stringify(primaryPlan))
    }
  }

  const handleOpenLinkedPlan = async linkedPlanId => {
    if (!linkedPlanId) return

    if (linkedPlanId === primaryPlanId) {
      restorePrimaryPlan()
      setActiveTab('training')
      setShowTrainingPlan(true)
      return
    }

    const { data, error } = await supabase
      .from('plans')
      .select('id,plan_data')
      .eq('id', linkedPlanId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !data) {
      console.error('[Gemeinsam] Verknüpfter Trainingsplan konnte nicht geöffnet werden:', error)
      return
    }

    setPlan(data.plan_data)
    setPlanId(data.id)
    setViewingSecondaryPlan(true)
    setActiveTab('training')
    setShowTrainingPlan(true)
    setOpenWeekAnalysisWeek(null)
  }

  const handleReturnToDashboard = () => {
    restorePrimaryPlan()
    setShowTrainingPlan(false)
    setOpenWeekAnalysisWeek(null)
  }

  const handleMainTabChange = tab => {
    if (tab === 'training' && viewingSecondaryPlan) {
      restorePrimaryPlan()
      setShowTrainingPlan(false)
    }
    setActiveTab(tab)
  }


// Wöchentliche Analyse
//
// MULTI-PLAN:
// Jeder gespeicherte Plan wird unabhängig geprüft. Ein noch unvollständiger
// gemeinsamer/Zusatzplan darf den Wochen-Coach des fertigen Hauptplans
// niemals blockieren.
useEffect(() => {
  if (!user?.id) return undefined

  coachDiagnostic('multi-plan-effect-mounted', {
    userId:user.id,
  })

  let disposed = false
  let retryTimer = null
  let eveningTimer = null

  const loadWeeklyPlans = async () => {
    const { data, error } = await supabase
      .from('plans')
      .select('id, plan_data, is_primary, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending:false })

    if (error) {
      console.error('[WochenCoach] Pläne konnten nicht geladen werden:', error)
      coachDiagnostic('load-plans-error', {
        message:error.message || String(error),
        code:error.code || null,
      })
      return []
    }

    const rows = (data || []).filter(row => row?.id && row?.plan_data)

    coachDiagnostic('load-plans-success', {
      count:rows.length,
      plans:rows.map(row => ({
        id:row.id,
        isPrimary:Boolean(row.is_primary),
        startDate:row.plan_data?.startDate || null,
      })),
    })

    return rows
  }

  const getCheckContext = (targetPlan, targetPlanId, today) => {
    const startDate = parseLocalPlanDate(targetPlan?.startDate || today)
    const todayLocal = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )

    const daysSinceStart = Math.floor(
      (todayLocal - startDate) / 86400000
    )

    if (daysSinceStart < 0) return null

    const dayInWeek = daysSinceStart % 7
    const isLastDay = dayInWeek === 6
    const currentWeekInPlan = Math.floor(daysSinceStart / 7)

    // Am letzten Tag kann die laufende Woche ausgewertet werden.
    // An allen späteren Tagen wird die unmittelbar vorherige Woche geprüft.
    const analyzeWeek = isLastDay
      ? currentWeekInPlan
      : currentWeekInPlan - 1

    if (analyzeWeek < 0) return null

    const weekStartDate = new Date(startDate)
    weekStartDate.setDate(
      weekStartDate.getDate() + (analyzeWeek * 7)
    )

    return {
      startDate,
      planStartStr: formatLocalDate(startDate),
      weekStartStr: formatLocalDate(weekStartDate),
      currentWeekInPlan,
      analyzeWeek,
      isLastDay,
      isFirstDaysNextWeek:
        !isLastDay &&
        (dayInWeek === 0 || dayInWeek === 1 || dayInWeek === 2) &&
        daysSinceStart > 0,
      lastAnalysisKey:
        `last_week_analysis_${user.id}_${targetPlanId}`,
    }
  }

  const runSinglePlanCheck = async (
    row,
    today,
    reason = 'app'
  ) => {
    if (disposed || !row?.id || !row?.plan_data) return

    const targetPlanId = row.id
    const targetPlan = row.plan_data
    const context = getCheckContext(
      targetPlan,
      targetPlanId,
      today
    )

    if (!context) {
      coachDiagnostic('plan-no-check-context', {
        planId:targetPlanId,
        startDate:targetPlan?.startDate || null,
      })
      return
    }

    coachDiagnostic('plan-check-context', {
      planId:targetPlanId,
      isPrimary:Boolean(row.is_primary),
      weekStart:context.weekStartStr,
      analyzeWeek:context.analyzeWeek,
      currentWeekInPlan:context.currentWeekInPlan,
      isLastDay:context.isLastDay,
    })

    const runKey =
      `${user.id}_${targetPlanId}_${context.weekStartStr}_` +
      `${context.isLastDay ? 'last' : 'catchup'}`

    if (weeklyCheckKeyRef.current.has(runKey)) {
      coachDebug(
        'Multi-Plan-Prüfung läuft bereits.',
        runKey
      )
      return
    }

    weeklyCheckKeyRef.current.add(runKey)

    coachDebug('Multi-Plan-Prüfung gestartet.', {
      trigger:reason,
      planId:targetPlanId,
      isPrimary:Boolean(row.is_primary),
      analyzeWeekIndex:context.analyzeWeek,
      weekStart:context.weekStartStr,
    })

    try {
      coachDiagnostic('run-weekly-check-call', {
        planId:targetPlanId,
        weekStart:context.weekStartStr,
        analyzeWeek:context.analyzeWeek,
        reason,
      })

      await runWeeklyCheck(
        user,
        targetPlan,
        today,
        context.currentWeekInPlan,
        context.lastAnalysisKey,
        context.isLastDay,
        context.weekStartStr,
        context.planStartStr,
        reason,
        context.analyzeWeek,
        context.currentWeekInPlan,
        targetPlanId
      )
    } finally {
      weeklyCheckKeyRef.current.delete(runKey)
    }
  }

  const runCheck = async (reason = 'app') => {
    if (disposed) return

    const rows = await loadWeeklyPlans()
    if (disposed || rows.length === 0) return

    const today = new Date()

    // Bewusst nacheinander: So vermeiden wir mehrere gleichzeitige
    // Analyse-API-Aufrufe auf einem mobilen Browser. Jeder Plan hat
    // trotzdem seinen eigenen DB-Claim.
    for (const row of rows) {
      if (disposed) return
      await runSinglePlanCheck(row, today, reason)
    }
  }

  const queueCheck = (reason) => {
    if (disposed) return
    if (retryTimer) clearTimeout(retryTimer)

    retryTimer = setTimeout(
      () => runCheck(reason),
      700
    )
  }

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      runCheck('visible')
    }
  }

  const handleFocus = () => runCheck('focus')

  // Direkt nach Login/App-Start alle Pläne prüfen.
  runCheck('startup')

  // Falls die App tagsüber geöffnet bleibt, um 18 Uhr nochmals alle
  // Pläne prüfen. Relevant ist das insbesondere am letzten Trainingstag.
  const now = new Date()
  if (now.getHours() < WEEK_REMINDER_HOUR) {
    const evening = new Date(now)
    evening.setHours(WEEK_REMINDER_HOUR, 0, 0, 0)

    eveningTimer = setTimeout(
      () => runCheck('evening'),
      Math.max(1000, evening.getTime() - now.getTime())
    )
  }

  window.addEventListener('focus', handleFocus)
  document.addEventListener(
    'visibilitychange',
    handleVisibility
  )

  // Jede Log-/Skip-Änderung kann GENAU EINEN der Pläne vollständig machen.
  // Deshalb anschließend wieder alle Pläne unabhängig prüfen.
  const logsChannel = supabase
    .channel(`weekly_check_logs_${user.id}`)
    .on(
      'postgres_changes',
      {
        event:'*',
        schema:'public',
        table:'logs',
        filter:`user_id=eq.${user.id}`,
      },
      () => queueCheck('log-change')
    )
    .subscribe()

  const skippedChannel = supabase
    .channel(`weekly_check_skipped_${user.id}`)
    .on(
      'postgres_changes',
      {
        event:'*',
        schema:'public',
        table:'skipped_days',
        filter:`user_id=eq.${user.id}`,
      },
      () => queueCheck('skip-change')
    )
    .subscribe()

  const plansChannel = supabase
    .channel(`weekly_check_plans_${user.id}`)
    .on(
      'postgres_changes',
      {
        event:'*',
        schema:'public',
        table:'plans',
        filter:`user_id=eq.${user.id}`,
      },
      () => queueCheck('plan-change')
    )
    .subscribe()

  return () => {
    disposed = true

    if (retryTimer) clearTimeout(retryTimer)
    if (eveningTimer) clearTimeout(eveningTimer)

    window.removeEventListener('focus', handleFocus)
    document.removeEventListener(
      'visibilitychange',
      handleVisibility
    )

    supabase.removeChannel(logsChannel)
    supabase.removeChannel(skippedChannel)
    supabase.removeChannel(plansChannel)

    weeklyCheckKeyRef.current.clear()
  }
}, [user?.id, weeklyCheckInRefresh])

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  }


const releaseWeekAnalysisClaim = async (userId, weekStart, planId = null) => {
  try {
    await supabase
      .from('week_analysis_claims')
      .delete()
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .eq('status', 'running')
      .match(planId ? { plan_id: planId } : {})
  } catch (error) {
    console.warn('[WochenCoach] Claim konnte nicht freigegeben werden:', error)
  }
}

const claimWeekAnalysis = async ({ userId, weekNumber, weekStart, planId = null }) => {
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  try {
    await supabase
      .from('week_analysis_claims')
      .delete()
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .eq('status', 'running')
      .match(planId ? { plan_id: planId } : {})
      .lt('claimed_at', staleBefore)
  } catch (error) {
    console.warn('[WochenCoach] Veralteter Claim konnte nicht bereinigt werden:', error)
  }

  const { error } = await supabase
    .from('week_analysis_claims')
    .insert({
      user_id: userId,
      week_number: weekNumber,
      week_start: weekStart,
      plan_id: planId,
      status: 'running',
    })

  if (!error) {
    coachDiagnostic('claim-created', {
      planId,
      weekStart,
      weekNumber,
    })
    coachDebug('Analyse-Claim erfolgreich gesetzt.', { weekNumber, weekStart })
    return true
  }

  coachDiagnostic('claim-insert-error', {
    planId,
    weekStart,
    weekNumber,
    code:error.code || null,
    message:error.message || String(error),
    details:error.details || null,
  })

  if (error.code === '23505') {
    coachDebug(
      'Analyse-Claim bereits vorhanden – kein zweiter Claude-Aufruf.',
      { weekNumber, weekStart }
    )
    return false
  }

  console.error('[WochenCoach] Analyse-Claim konnte nicht gesetzt werden:', error)
  return false
}

  const runWeeklyCheck = async (
    user,
    plan,
    today,
    currentWeekInPlan,
    lastAnalysisKey,
    isLastDay,
    weekStartStr,
    planStartStr,
    triggerReason = 'unknown',
    forcedAnalyzeWeek = null,
    liveWeekInPlan = null,
    targetPlanId = null
  ) => {
    try {
      if (!targetPlanId) {
        console.error('[WochenCoach] plan_id fehlt – Analyse wird nicht gestartet.')
        coachDiagnostic('abort-missing-plan-id', {})
        return
      }

      coachDiagnostic('run-weekly-check-entered', {
        planId:targetPlanId,
        weekStart:weekStartStr,
        forcedAnalyzeWeek,
        currentWeekInPlan,
      })

      coachDebug('runWeeklyCheck()', {
        triggerReason,
        targetPlanId:targetPlanId,
        currentWeekInPlan,
        isLastDay,
        weekStartStr,
      })

      // Logs aus Supabase laden für genaue Analyse
      let logs = {}
      let activityHistory = []
      try {
        const { data: supaLogs } = await supabase
          .from('logs')
          .select('*')
          .eq('user_id', user.id)

        if (supaLogs && supaLogs.length > 0) {
          activityHistory = supaLogs
            .filter(log => log.actual_date)
            .map(log => ({
              id: log.id,
              day_key: log.day_key || null,
              actual_date: log.actual_date || null,
              uhrzeit: log.uhrzeit || null,
              sport_type: log.sport_type || 'running',
              km: log.km || null,
              pace: log.pace || null,
              bpm: log.bpm || null,
              hf_max: log.hf_max || null,
              duration_seconds: log.duration_seconds || null,
              moving_time_seconds: log.moving_time_seconds || null,
              training_load: log.training_load || null,
              recovery_time: log.recovery_time || null,
              note: log.note || null,
              gefuehl: log.gefuehl || null,
              elevation_gain: log.elevation_gain || log.hoehenmeter || null,
              activity_context: log.activity_context || null,
            }))

          supaLogs.forEach(l => {
            logs[l.day_key] = {
              id: l.id,
              day_key: l.day_key,
              pace: l.pace || '',
              km: l.km || '',
              bpm: l.bpm || '',
              note: l.note || '',
              running_index: l.running_index || '',
              cadence: l.cadence || '',
              actual_date: l.actual_date || '',
              uhrzeit: l.uhrzeit || '',
              hf_max: l.hf_max || '',
              hoehenmeter: l.hoehenmeter || '',
              elevation_gain: l.elevation_gain || '',
              gefuehl: l.gefuehl || '',
              training_load: l.training_load || '',
              recovery_time: l.recovery_time || '',
              duration_seconds: l.duration_seconds || null,
              moving_time_seconds: l.moving_time_seconds || null,
              km_splits: l.km_splits || null,
              run_segments: l.run_segments || null,
              activity_context: l.activity_context || null,
              sport_type: l.sport_type || 'running',
              source: l.source || null,
            }
          })
        } else {
          logs = JSON.parse(localStorage.getItem('laufplan_logs') || '{}')
        }
      } catch {
        logs = JSON.parse(localStorage.getItem('laufplan_logs') || '{}')
      }

      // Übersprungene Tage laden (bewusst ausgelassen, sollen die Analyse nicht blockieren)
      let skipped = {}
      try {
        const { data: skippedData } = await supabase.from('skipped_days').select('day_key, reason').eq('user_id', user.id)
        if (skippedData) {
          skippedData.forEach(s => { skipped[s.day_key] = s.reason || '' })
        }
      } catch (e) { console.error('Skipped Days laden fehlgeschlagen:', e) }

      const startDate = parseLocalPlanDate(plan.startDate || today)
      const analyzeWeek = Number.isInteger(forcedAnalyzeWeek)
        ? forcedAnalyzeWeek
        : (isLastDay ? currentWeekInPlan : currentWeekInPlan - 1)

      let currentPhase = null
      let currentWeek = null
      let nextPhase = null
      let nextWeek = null
      let weekIndex = 0

      for (const phase of plan.phases || []) {
        for (const week of phase.weeks || []) {
          if (weekIndex === analyzeWeek) { currentPhase = phase; currentWeek = week }
          if (weekIndex === analyzeWeek + 1) { nextPhase = phase; nextWeek = week }
          weekIndex++
        }
      }

      if (!currentPhase || !currentWeek) {
        coachDiagnostic('abort-week-not-found', {
          planId:targetPlanId,
          analyzeWeek,
        })
        coachDebug('Abbruch: Trainingswoche im Plan nicht gefunden.', {
          analyzeWeek,
          phases: (plan.phases || []).map(phase => ({
            id: phase.id,
            weeks: (phase.weeks || []).map(week => week.n),
          })),
        })
        return
      }

      coachDebug('Trainingswoche gefunden.', {
        phase: currentPhase.id,
        phaseLabel: currentPhase.label,
        weekNumber: currentWeek.n,
      })

      // Geräteübergreifende Prüfung: läuft die App auf mehreren Geräten/Browsern (z.B.
      // Handy + PC), hat jedes sein EIGENES localStorage - eines "weiß" nicht, dass das
      // andere schon analysiert hat. Die Datenbank ist die einzige gemeinsame, verlässliche
      // Quelle. Diese Prüfung ist der eigentliche Fix für wiederholte Analysen derselben Woche.
      const { data: existingAnalyses, error: existingAnalysisError } =
        await supabase
          .from('week_analyses')
          .select('id, week_start, plan_id')
          .eq('user_id', user.id)
          .eq('week_number', currentWeek.n)

      if (existingAnalysisError) {
        console.error(
          'Wochenanalyse-Status konnte nicht geprüft werden:',
          existingAnalysisError
        )
        coachDiagnostic('abort-existing-analysis-query-error', {
          planId:targetPlanId,
          message:existingAnalysisError.message || String(existingAnalysisError),
          code:existingAnalysisError.code || null,
        })
        return
      }

      // Neue Analysen speichern den echten Wochenstart.
      // Alte Analysen speicherten an dieser Stelle versehentlich den
      // Planstart. Beides wird für den aktuellen Plan akzeptiert,
      // damit alte Wochen nicht erneut analysiert werden.
      const rowsForWeek = existingAnalyses || []

      const exactWeekMatch = rowsForWeek.some(
        row => row.week_start === weekStartStr && row.plan_id === targetPlanId
      )

      const legacyFirstWeekMatch = false

      coachDebug('DB-Prüfung week_analyses.', {
        weekNumber: currentWeek.n,
        expectedWeekStart: weekStartStr,
        planStart: planStartStr,
        rows: rowsForWeek,
        exactWeekMatch,
        legacyFirstWeekMatch,
      })

      if (exactWeekMatch || legacyFirstWeekMatch) {
        coachDiagnostic('abort-already-analyzed', {
          planId:targetPlanId,
          weekStart:weekStartStr,
          weekNumber:currentWeek.n,
        })
        coachDebug('Abbruch: Diese Trainingswoche ist bereits analysiert.')
        localStorage.setItem(lastAnalysisKey, String(analyzeWeek))
        return
      }

      const plannedDays = currentWeek.days
        .map((d, di) => ({
          ...d,
          key: planDayKey(targetPlanId, currentPhase.id, currentWeek.n, di),
          legacyKey: legacyPlanDayKey(currentPhase.id, currentWeek.n, di),
        }))
        .filter(d => !d.optional)

      // Ab jetzt strikt planbezogen:
      // Logs/Skip-Status eines alten Plans dürfen nie in einen neu erstellten Plan hineinrutschen.
      // Legacy-Keys bleiben in der DB erhalten, werden aber nicht mehr automatisch übernommen.
      const weekLogs = plannedDays.map(d => {
        const log = logs[d.key] || null
        const skip = skipped[d.key] !== undefined
          ? skipped[d.key]
          : undefined

        return {
          ...d,
          logged: !!log,
          skipped: !log && skip !== undefined,
          skipReason: skip || '',
          ...(log || {}),
        }
      })

      // Frühere echte Einheiten aus dem Plan als Vergleichsbasis laden.
      // So kann die Analyse z.B. Intervall mit Intervall und Long Run mit Long Run vergleichen.
      const historyLogs = []
      for (const phase of plan.phases || []) {
        for (const week of phase.weeks || []) {
          for (let di = 0; di < (week.days || []).length; di += 1) {
            const day = week.days[di]
            if (day.optional) continue

            const key = planDayKey(targetPlanId, phase.id, week.n, di)
            const log = logs[key] || null

            if (!log || !log.actual_date) continue

            historyLogs.push({
              ...day,
              key,
              phaseId: phase.id,
              phaseLabel: phase.label,
              weekNumber: week.n,
              logged: true,
              skipped: false,
              ...log,
            })
          }
        }
      }

      // Nur Tage, die WEDER geloggt NOCH bewusst übersprungen wurden, blockieren die Analyse.
      const unloggedCount = weekLogs.filter(l => !l.logged && !l.skipped).length

      coachDiagnostic('completeness-check', {
        planId:targetPlanId,
        weekStart:weekStartStr,
        weekNumber:currentWeek.n,
        plannedCount:plannedDays.length,
        loggedCount:weekLogs.filter(item => item.logged).length,
        skippedCount:weekLogs.filter(item => item.skipped).length,
        unloggedCount,
        days:weekLogs.map(item => ({
          key:item.key,
          tag:item.tag,
          einheit:item.einheit,
          logged:item.logged,
          skipped:item.skipped,
          actual_date:item.actual_date || null,
        })),
      })

      coachDebug('Vollständigkeitsprüfung.', {
        plannedCount: plannedDays.length,
        loggedCount: weekLogs.filter(item => item.logged).length,
        skippedCount: weekLogs.filter(item => item.skipped).length,
        unloggedCount,
        days: weekLogs.map(item => ({
          key: item.key,
          tag: item.tag,
          einheit: item.einheit,
          logged: item.logged,
          skipped: item.skipped,
          actual_date: item.actual_date || null,
        })),
      })

// Erinnerung bleibt erhalten:
// - Am letzten Tag der Trainingswoche erst ab 18:00 Uhr.
//   So kann ein für Sonntag geplanter Lauf tagsüber noch normal stattfinden.
// - Im Nachholfenster (die ersten drei Tage der Folgewoche) weiterhin
//   höchstens einmal pro Tag, falls noch etwas ungeklärt ist.
if (unloggedCount > 0) {
  coachDiagnostic('abort-week-incomplete', {
    planId:targetPlanId,
    weekStart:weekStartStr,
    unloggedCount,
  })

  const isSundayEvening =
    isLastDay && today.getHours() >= WEEK_REMINDER_HOUR

  const isCatchupDay = !isLastDay

  // Sonntag vor 18 Uhr: noch keine Erinnerung.
  if (!isSundayEvening && !isCatchupDay) {
    coachDebug('Offene Einheit vorhanden, Sonntag noch vor Erinnerungszeit.', {
      hour: today.getHours(),
      reminderHour: WEEK_REMINDER_HOUR,
    })
    return
  }

  const reminderDedupKey =
    `last_week_reminder_${user.id}_${targetPlanId}_${weekStartStr}`

  const todayLocalStr = formatLocalDate(today)
  const lastReminderDate =
    localStorage.getItem(reminderDedupKey)

  if (lastReminderDate === todayLocalStr) {
    coachDebug('Erinnerung wurde heute bereits gesendet.')
    return
  }

  const { error: reminderError } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      type: 'week_reminder',
      message:
        `⏰ Woche ${currentWeek.n}: Noch ${unloggedCount} ` +
        `Einheit${unloggedCount > 1 ? 'en' : ''} nicht eingetragen – ` +
        `trag ${unloggedCount > 1 ? 'sie' : 'sie'} ein oder markiere ` +
        `die Einheit als übersprungen, damit dein Wochen-Coach starten kann.`,
      from_user_id: user.id,
    })

  if (!reminderError) {
    coachDebug('Wochen-Erinnerung gesendet.', {
      weekNumber: currentWeek.n,
      unloggedCount,
    })
    localStorage.setItem(
      reminderDedupKey,
      todayLocalStr
    )
    setUnreadCount(prev => prev + 1)
  } else {
    console.error(
      'Wochen-Erinnerung konnte nicht gespeichert werden:',
      reminderError
    )
  }

  return
}


// Bei Marsch-/Wanderplänen kommt vor der Analyse ein kurzer Wochen-Check.
let weekCheckIn = null
if (String(plan?.sport_type || plan?.plan_type || '').includes('hiking')) {
  const { data: checkInData, error: checkInError } = await supabase
    .from('week_checkins')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStartStr)
    .maybeSingle()

  if (checkInError) {
    console.error('[WochenCoach] Hiking Wochen-Check konnte nicht geladen werden:', checkInError)
    return
  }

  if (!checkInData) {
    // Nur für den aktuell sichtbaren Hiking-Plan ein Modal öffnen.
    // Ein im Hintergrund geprüfter Hiking-Zusatzplan darf die UI nicht übernehmen.
    if (targetPlanId === planId) {
      setPendingHikingCheckIn({
        planId:targetPlanId,
        weekNumber:currentWeek.n,
        weekStart:weekStartStr,
      })
    }
    coachDebug('Warte auf Marsch-/Wander-Wochen-Check.', {
      weekNumber: currentWeek.n,
      weekStart: weekStartStr,
    })
    return
  }

  weekCheckIn = checkInData
}

// Die Woche ist vollständig. Noch VOR dem Analyse-Aufruf
// gewinnt genau EIN Trigger/Tab/Gerät den atomaren Wochen-Claim.
coachDiagnostic('before-claim', {
  planId:targetPlanId,
  weekStart:weekStartStr,
  weekNumber:currentWeek.n,
})

const claimAcquired = await claimWeekAnalysis({
  userId: user.id,
  weekNumber: currentWeek.n,
  weekStart: weekStartStr,
  planId: targetPlanId,
})

coachDiagnostic('after-claim', {
  planId:targetPlanId,
  weekStart:weekStartStr,
  claimAcquired:Boolean(claimAcquired),
})

if (!claimAcquired) return

// Aktuelle Profilwerte laden (HFmax könnte aktualisiert worden sein)
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('max_hf, ruhe_hf, wochen_km, geburtsdatum, geschlecht')
        .eq('id', user.id)
        .single()

      // HFmax aktuell berechnen
      let currentHFMax = null
      if (currentProfile?.max_hf) {
        currentHFMax = currentProfile.max_hf
      } else if (currentProfile?.geburtsdatum) {
        const age = new Date().getFullYear() - new Date(currentProfile.geburtsdatum).getFullYear()
        currentHFMax = Math.round(208 - 0.7 * age)
      }

      // Vorherige Analysen laden für Kontext
      const { data: previousAnalysisRows } = await supabase
        .from('week_analyses')
        .select('week_number, week_start, plan_id, analysis, recommendation, next_week_adjustment, analysis_data')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(8)

      const previousAnalyses = (previousAnalysisRows || [])
        .filter(row => row.week_start < weekStartStr)
        .filter(row => row.plan_id === targetPlanId || (!row.plan_id && row.week_start >= planStartStr))
        .slice(0, 4)

      // Schuhzustand laden
      const { data: schuhe } = await supabase
        .from('shoes')
        .select('marke, modell, start_km, max_km')
        .eq('user_id', user.id)

      const schuhWarnung = schuhe
        ?.filter(s => (s.start_km / s.max_km) >= 0.8)
        .map(s => `${s.marke} ${s.modell}: ${Math.round(s.start_km)}/${s.max_km} km (${Math.round((s.start_km/s.max_km)*100)}%)`)
        .join(', ')

      const nextWeekDays = nextWeek
        ? nextWeek.days
            .map((d, di) => ({
              ...d,
              key: planDayKey(targetPlanId, nextPhase.id, nextWeek.n, di),
            }))
            .filter(d => !d.optional)
        : null

      const isRegenWeek = !!currentWeek.regen
      const nextIsRegenWeek = !!nextWeek?.regen

      coachDebug('Starte /api/analyze-week.', {
        weekNumber: currentWeek.n,
        historyLogs: historyLogs.length,
        nextWeek: nextWeek?.n || null,
        isRegenWeek,
        nextIsRegenWeek,
      })

      const response = await fetch('/api/analyze-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          planId: targetPlanId,
          weekLogs,
          plannedDays,
          weekNumber: currentWeek.n,
          weekStart: weekStartStr,
          plan,
          nextWeekDays,
          previousAnalyses: previousAnalyses || [],
          historyLogs,
          activityHistory,
          schuhWarnung: schuhWarnung || null,
          currentHFMax: currentHFMax || null,
          currentRuheHF: currentProfile?.ruhe_hf || null,
          aktuelleWochenKm: currentProfile?.wochen_km || null,
          isRegenWeek,
          nextIsRegenWeek,
          currentPhase: {
            id: currentPhase.id,
            label: currentPhase.label,
            description: currentPhase.description,
          },
          weekCheckIn: weekCheckIn || null,
        })
      })

      const result = await response.json()

      if (!response.ok || result?.error) {
        console.error(
          'Wochen-Coach API Fehler:',
          result?.error || response.status
        )
        await releaseWeekAnalysisClaim(user.id, weekStartStr, targetPlanId)
        return
      }

      if (!result.analyse) {
        console.error(
          'Wochen-Coach hat keine verwertbare Analyse geliefert.',
          { triggerReason, result }
        )
        await releaseWeekAnalysisClaim(user.id, weekStartStr, targetPlanId)
        return
      }

      coachDebug('API-Analyse erfolgreich empfangen.', {
        weekNumber: currentWeek.n,
        verdict: result?.weekVerdict?.status || null,
        hasAnalysisData: Boolean(result.analysisData),
      })

      // Eine verspätet nachgeholte Analyse darf den Rückblick erzeugen,
      // aber keine inzwischen vergangene Folgewoche rückwirkend verändern.
      const nextWeekIsCurrent =
        Number.isInteger(liveWeekInPlan) &&
        liveWeekInPlan === analyzeWeek + 1

      // Plan anpassen
      if (nextWeek && nextWeekIsCurrent && result.nextWeekAdjusted?.length > 0) {
        // Immer den tatsächlich analysierten Plan anpassen – nicht pauschal
        // den im localStorage liegenden Hauptplan.
        const currentPlan = JSON.parse(JSON.stringify(plan || {}))
        let adjusted = false

        for (const phase of currentPlan.phases || []) {
          for (const week of phase.weeks || []) {
            if (week.n === nextWeek.n) {
              week.days = week.days.map((day) => {
                if (day.optional) return day
                const adjustedDay = result.nextWeekAdjusted.find(a => a.tag === day.tag)
                if (adjustedDay?.adjusted && adjustedDay?.day) {
                  adjusted = true
                  const { key: _transientKey, ...resolvedDay } = adjustedDay.day
                  return {
                    ...day,
                    ...resolvedDay,
                    adjusted: true,
                    adjustmentReason: adjustedDay.adjustmentReason || resolvedDay.adjustmentReason || '',
                  }
                }
                return day
              })
            }
          }
        }

        if (adjusted) {
          // In Supabase speichern
          await supabase
            .from('plans')
            .update({ plan_data:currentPlan })
            .eq('id', targetPlanId)
            .eq('user_id', user.id)

          // UI/LocalStorage nur aktualisieren, wenn genau dieser Plan gerade
          // im Training-Reiter angezeigt wird. Andere Pläne bleiben unsichtbar
          // im Hintergrund sauber aktualisiert.
          if (targetPlanId === planId) {
            localStorage.setItem(
              `runcoaching_plan_${user.id}`,
              JSON.stringify(currentPlan)
            )
            setPlan(currentPlan)

            if (targetPlanId === primaryPlanId) {
              setPrimaryPlan(currentPlan)
            }
          }
        }
      }

      // Analyse in Supabase speichern.
      // week_start ist jetzt der tatsächliche Start dieser Trainingswoche
      // und nicht mehr versehentlich der Start des gesamten Plans.
      const { error: analysisInsertError } = await supabase
        .from('week_analyses')
        .insert({
          user_id: user.id,
          week_number: currentWeek.n,
          week_start: weekStartStr,
          plan_id: targetPlanId,
          analysis: result.analyse,
          recommendation: result.empfehlung,
          next_week_adjustment: result.anpassung,
          analysis_data: result.analysisData || null,
        })

      if (analysisInsertError) {
        console.error(
          'Wochenanalyse konnte nicht gespeichert werden:',
          analysisInsertError
        )
        await releaseWeekAnalysisClaim(user.id, weekStartStr, targetPlanId)
        return
      }

      coachDebug('Wochenanalyse gespeichert.', {
        weekNumber: currentWeek.n,
        weekStart: weekStartStr,
      })

      await supabase
        .from('week_analysis_claims')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('week_start', weekStartStr)
        .match(targetPlanId ? { plan_id: targetPlanId } : {})

      // Glocke = Hinweis. Die vollständige Analyse bleibt dauerhaft bei der Woche im Trainingsplan.
      const planLabel =
        plan?.planName ||
        plan?.title ||
        plan?.name ||
        'Trainingsplan'

      const message =
        `📊 ${planLabel}: Deine Analyse für Woche ${currentWeek.n} ist fertig. ` +
        `Öffne die Woche im Trainingsplan, um deinen Wochen-Coach anzusehen.`

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'week_analysis',
          message,
          from_user_id: user.id,
          week_number: currentWeek.n,
          week_start: weekStartStr,
          plan_id: targetPlanId,
        })

      if (notificationError) {
        console.error(
          'Wochenanalyse-Benachrichtigung konnte nicht gespeichert werden:',
          notificationError
        )
      } else {
        setUnreadCount(prev => prev + 1)
      }

      // Nur noch Cache/Kompatibilität. Dieser Wert blockiert keine Analyse mehr.
      localStorage.setItem(lastAnalysisKey, String(analyzeWeek))

    } catch (e) {
      console.error('Wochenanalyse Fehler:', e)
      if (weekStartStr) {
        await releaseWeekAnalysisClaim(user.id, weekStartStr, targetPlanId)
      }
    }
  }


  // Zweiter, plan-state-basierter Catch-up-Trigger.
  // Er läuft erst dann, wenn der konkrete Plan und seine planId im App-State
  // vorhanden sind. So verpassen wir den Wochen-Check nicht beim frühen Login.
  useEffect(() => {
    if (!user?.id || !plan || !planId) return undefined

    let cancelled = false
    const timers = []

    const runPrimaryCatchUp = async (reason) => {
      if (cancelled) return

      try {
        const today = new Date()
        const startDate = parseLocalPlanDate(plan.startDate || today)
        const todayLocal = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        )

        const daysSinceStart = Math.floor(
          (todayLocal - startDate) / 86400000
        )

        if (daysSinceStart < 0) {
          coachDiagnostic('fallback-before-plan-start', {
            planId,
            reason,
          })
          return
        }

        const dayInWeek = daysSinceStart % 7
        const isLastDay = dayInWeek === 6
        const currentWeekInPlan = Math.floor(daysSinceStart / 7)
        const analyzeWeek = isLastDay
          ? currentWeekInPlan
          : currentWeekInPlan - 1

        if (analyzeWeek < 0) {
          coachDiagnostic('fallback-no-completed-week', {
            planId,
            reason,
          })
          return
        }

        const weekStartDate = new Date(startDate)
        weekStartDate.setDate(
          weekStartDate.getDate() + analyzeWeek * 7
        )

        const weekStartStr = formatLocalDate(weekStartDate)
        const planStartStr = formatLocalDate(startDate)

        coachDiagnostic('fallback-run', {
          planId,
          reason,
          weekStart:weekStartStr,
          analyzeWeek,
          currentWeekInPlan,
          isLastDay,
        })

        await runWeeklyCheck(
          user,
          plan,
          today,
          currentWeekInPlan,
          `last_week_analysis_${user.id}_${planId}`,
          isLastDay,
          weekStartStr,
          planStartStr,
          `fallback-${reason}`,
          analyzeWeek,
          currentWeekInPlan,
          planId
        )
      } catch (error) {
        console.error('[WochenCoach] Fallback-Catch-up Fehler:', error)
        coachDiagnostic('fallback-error', {
          planId,
          reason,
          message:error?.message || String(error),
        })
      }
    }

    runPrimaryCatchUp('immediate')
    timers.push(setTimeout(() => runPrimaryCatchUp('retry-2s'), 2000))
    timers.push(setTimeout(() => runPrimaryCatchUp('retry-8s'), 8000))

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [
    user?.id,
    planId,
    plan?.startDate,
    weeklyCheckInRefresh,
  ])

  const loadUnreadCount = async (userId) => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    setUnreadCount(count || 0)
  }

  const handlePlanGenerated = async (newPlan) => {
    let targetGoal = sharedGoalPlanTarget

    // Falls während des Onboardings neu geladen wurde, bleibt der Gemeinsam-Kontext erhalten.
    if (!targetGoal?.id) {
      try {
        const raw = sessionStorage.getItem(SHARED_GOAL_PLAN_TARGET_KEY)
        if (raw) targetGoal = JSON.parse(raw)
      } catch {}
    }

    const hadPrimaryPlan = Boolean(primaryPlanId && primaryPlan)

    const profileName = await loadProfileName(user.id)
    if (profileName) newPlan.name = profileName

    // Ein Gemeinsam-Plan wird nur dann Hauptplan, wenn noch gar kein Hauptplan existiert.
    // Wichtig: Ein vorhandener Plan wird bei Planerstellung NIEMALS automatisch gelöscht.
    const makePrimary = !hadPrimaryPlan

    if (makePrimary) {
      await supabase
        .from('plans')
        .update({ is_primary:false })
        .eq('user_id', user.id)
        .eq('is_primary', true)
    }

    const { data, error:planInsertError } = await supabase
      .from('plans')
      .insert({
        user_id:user.id,
        plan_data:newPlan,
        is_primary:makePrimary,
      })
      .select()
      .single()

    if (planInsertError || !data) {
      console.error('[App] Trainingsplan konnte nicht gespeichert werden:', planInsertError)
      return
    }

    const newPlanId = data.id

    if (targetGoal?.id) {
      const { error:linkError } = await supabase
        .from('shared_goal_members')
        .update({ plan_id:newPlanId })
        .eq('goal_id', targetGoal.id)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (linkError) {
        console.error('[Gemeinsam] Neuer Plan konnte nicht mit Ziel verbunden werden:', linkError)
      }

      try {
        sessionStorage.removeItem(SHARED_GOAL_PLAN_TARGET_KEY)
      } catch {}

      setSharedGoalPlanTarget(null)
      setTogetherRefresh(value => value + 1)

      if (makePrimary) {
        setPlan(newPlan)
        setPlanId(newPlanId)
        setPrimaryPlan(newPlan)
        setPrimaryPlanId(newPlanId)
        setViewingSecondaryPlan(false)
        localStorage.setItem(`runcoaching_plan_${user.id}`, JSON.stringify(newPlan))
      } else {
        // Bestehender Hauptplan bleibt unverändert.
        setPlan(primaryPlan)
        setPlanId(primaryPlanId)
        setViewingSecondaryPlan(false)
        localStorage.setItem(`runcoaching_plan_${user.id}`, JSON.stringify(primaryPlan))
      }

      setSelectedPlanSport(null)
      setShowTrainingPlan(false)
      setActiveTab('together')
      return
    }

    // Auch außerhalb von "Gemeinsam" wird ein vorhandener Plan nicht mehr stillschweigend gelöscht.
    // Wenn bereits ein Hauptplan existiert, bleibt er Hauptplan und der neue Plan wird als Zusatzplan gespeichert.
    if (hadPrimaryPlan) {
      setPlan(primaryPlan)
      setPlanId(primaryPlanId)
      setViewingSecondaryPlan(false)
      localStorage.setItem(`runcoaching_plan_${user.id}`, JSON.stringify(primaryPlan))
    } else {
      setPlan(newPlan)
      setPlanId(newPlanId)
      setPrimaryPlan(newPlan)
      setPrimaryPlanId(newPlanId)
      setViewingSecondaryPlan(false)
      localStorage.setItem(`runcoaching_plan_${user.id}`, JSON.stringify(newPlan))
    }

    setSelectedPlanSport(null)
    setShowTrainingPlan(false)
  }

  const handleReset = async () => {
    if (viewingSecondaryPlan) {
      if (planId) {
        await supabase
          .from('shared_goal_members')
          .update({ plan_id:null })
          .eq('user_id', user.id)
          .eq('plan_id', planId)

        await supabase.from('plans').delete().eq('id', planId)
      }
      restorePrimaryPlan()
      setSelectedPlanSport(null)
      setOpenWeekAnalysisWeek(null)
      setShowTrainingPlan(false)
      setTogetherRefresh(value => value + 1)
      return
    }

    // "Neuen Plan erstellen" darf einen Plan, der zu einem gemeinsamen Ziel gehört,
    // nicht löschen. Er bleibt als Zusatzplan bestehen und ist weiterhin über
    // "Gemeinsam" erreichbar. Der danach erstellte persönliche Plan wird Hauptplan.
    if (primaryPlanId) {
      const { data: sharedMembership, error: sharedMembershipError } = await supabase
        .from('shared_goal_members')
        .select('goal_id')
        .eq('user_id', user.id)
        .eq('plan_id', primaryPlanId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (sharedMembershipError) {
        console.error('[App] Verknüpfung des aktuellen Plans konnte nicht geprüft werden:', sharedMembershipError)
        return
      }

      if (sharedMembership?.goal_id) {
        const { error: demoteError } = await supabase
          .from('plans')
          .update({ is_primary:false })
          .eq('id', primaryPlanId)
          .eq('user_id', user.id)

        if (demoteError) {
          console.error('[App] Gemeinsamer Plan konnte nicht zum Zusatzplan gemacht werden:', demoteError)
          return
        }

        localStorage.removeItem(`runcoaching_plan_${user.id}`)
        setPlan(null)
        setPlanId(null)
        setPrimaryPlan(null)
        setPrimaryPlanId(null)
        setViewingSecondaryPlan(false)
        setSelectedPlanSport(null)
        setOpenWeekAnalysisWeek(null)
        setShowTrainingPlan(true)
        setTogetherRefresh(value => value + 1)
        return
      }

      // Nur ein rein persönlicher Hauptplan wird beim bewussten Neuerstellen ersetzt.
      await supabase.from('plans').delete().eq('id', primaryPlanId).eq('user_id', user.id)
    }

    localStorage.removeItem(`runcoaching_plan_${user.id}`)
    setPlan(null)
    setPlanId(null)
    setPrimaryPlan(null)
    setPrimaryPlanId(null)
    setViewingSecondaryPlan(false)
    setSelectedPlanSport(null)
    setOpenWeekAnalysisWeek(null)
    setShowTrainingPlan(true)
  }

  const handleOpenNotifications = () => {
    setShowNotifications(true)
    setUnreadCount(0)
  }


const handleOpenWeekAnalysisFromNotification = (weekNumber) => {
  const parsedWeek = Number(weekNumber)
  if (!Number.isFinite(parsedWeek)) return

  setShowNotifications(false)
  setActiveTab('training')
  setShowTrainingPlan(true)
  setOpenWeekAnalysisWeek(parsedWeek)
}

const handleOpenTrainingPartnersFromNotification = () => {
  setShowNotifications(false)
  setActiveTab('together')
  setTogetherFocusFriends(value => value + 1)
}

  if (loadingAuth) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', fontFamily: 'sans-serif', color: '#C4A882', fontSize: 14 }}>
      ⏳ Lade…
    </div>
  )

  if (!user) {
    if (authEntryMode) {
      return (
        <Auth
          initialMode={authEntryMode}
          onBack={() => setAuthEntryMode(null)}
        />
      )
    }

    return (
      <LandingPage
        onLogin={() => setAuthEntryMode('login')}
        onRegister={() => setAuthEntryMode('register')}
      />
    )
  }

  if (profileSetupLoading || onboardingCompleted === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)', fontFamily: 'sans-serif', color: '#C4A882', fontSize: 14 }}>
        ⏳ Profil wird vorbereitet…
      </div>
    )
  }

  if (!onboardingCompleted) {
    return (
      <WelcomeOnboarding
        user={user}
        onCompleted={() => setOnboardingCompleted(true)}
      />
    )
  }

  return (
    <>
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 110 }}>
        <button onClick={handleOpenNotifications}
          style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: '1.5px solid #FFE0CC', boxShadow: '0 2px 12px rgba(255,140,105,0.2)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          🔔
          {unreadCount > 0 && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#FF6B9D', color: 'white', fontSize: 10, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', border: '2px solid white' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      </div>

      {showNotifications && (
        <Notifications
          user={user}
          onClose={() => setShowNotifications(false)}
          onOpenWeekAnalysis={handleOpenWeekAnalysisFromNotification}
          onOpenTrainingPartners={handleOpenTrainingPartnersFromNotification}
        />
      )}

      <SharedGoalInviteModal
        invite={pendingGoalInvite}
        busy={goalInviteBusy}
        error={goalInviteError}
        onAccept={acceptPendingGoalInvite}
        onDecline={declinePendingGoalInvite}
      />

      <HikingWeeklyCheckIn
        open={Boolean(pendingHikingCheckIn)}
        user={user}
        weekNumber={pendingHikingCheckIn?.weekNumber}
        weekStart={pendingHikingCheckIn?.weekStart}
        onClose={() => setPendingHikingCheckIn(null)}
        onSaved={() => {
          setPendingHikingCheckIn(null)
          setWeeklyCheckInRefresh(value => value + 1)
        }}
      />

      <div style={{ paddingBottom: 78 }}>
        {activeTab === 'training' && (
          showTrainingPlan
            ? (
              <div>
                <div style={{ position: 'relative', zIndex: 20, padding: '10px 14px 0', maxWidth: 720, margin: '0 auto' }}>
                  <button
                    type="button"
                    onClick={handleReturnToDashboard}
                    style={{ border: '1px solid #EADFD8', background: 'rgba(255,255,255,0.94)', color: '#765F52', borderRadius: 999, padding: '8px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(75,52,39,0.07)' }}
                  >
                    ← Dashboard
                  </button>
                </div>
                {sharedGoalPlanTarget && !plan && (
                  <div style={{
                    maxWidth:720, margin:'10px auto 8px', padding:'0 16px',
                    boxSizing:'border-box'
                  }}>
                    <div style={{
                      padding:'11px 13px', borderRadius:15,
                      background:'linear-gradient(135deg,#FFF2EA,#F2F8F2)',
                      border:'1px solid #F0DDD1', color:'#786155',
                      fontSize:10.8, lineHeight:1.5, fontFamily:'sans-serif'
                    }}>
                      <b>Gemeinsames Ziel:</b> {sharedGoalPlanTarget.title}
                      {sharedGoalPlanTarget.target_date ? ` · ${sharedGoalPlanTarget.target_date}` : ''}
                      <br />
                      Die bekannten Zieldaten sind bereits übernommen. Ergänze jetzt nur noch deine persönlichen Trainingsangaben.
                    </div>
                  </div>
                )}

                {viewingSecondaryPlan && !sharedGoalPlanTarget && (
                  <div style={{ maxWidth:720, margin:'10px auto 8px', padding:'0 16px', boxSizing:'border-box' }}>
                    <div style={{
                      display:'flex', justifyContent:'space-between', gap:10, alignItems:'center',
                      padding:'10px 12px', borderRadius:14,
                      background:'#F2F8F4', border:'1px solid #CEE5D6',
                      color:'#5D7968', fontSize:10.5, fontFamily:'sans-serif'
                    }}>
                      <span><b>Zusätzlicher Plan</b> · mit einem gemeinsamen Ziel verknüpft</span>
                      <button type="button" onClick={handleReturnToDashboard} style={{
                        border:'none', background:'transparent', color:'#C86D55',
                        fontWeight:900, cursor:'pointer', fontSize:10
                      }}>Hauptplan öffnen →</button>
                    </div>
                  </div>
                )}

                {sharedGoalPlanTarget ? (
                  selectedPlanSport === 'running' ? (
                    <Onboarding onPlanGenerated={handlePlanGenerated} />
                  ) : selectedPlanSport === 'hiking' ? (
                    <HikingOnboarding onPlanGenerated={handlePlanGenerated} />
                  ) : selectedPlanSport === 'cycling' ? (
                    <CyclingOnboarding onPlanGenerated={handlePlanGenerated} />
                  ) : selectedPlanSport === 'mountain_biking' ? (
                    <MtbOnboarding onPlanGenerated={handlePlanGenerated} />
                  ) : selectedPlanSport === 'swimming' ? (
                    <SwimmingOnboarding onPlanGenerated={handlePlanGenerated} />
                  ) : selectedPlanSport === 'hyrox' ? (
                    <HyroxOnboarding onPlanGenerated={handlePlanGenerated} />
                  ) : (
                    <PlanSportSelection onSelect={setSelectedPlanSport} />
                  )
                ) : plan ? (
                  <TrainingPlan
                    plan={plan}
                    onReset={handleReset}
                    user={user}
                    planId={planId}
                    allowLegacyDayKeys={!viewingSecondaryPlan}
                    openWeekAnalysis={openWeekAnalysisWeek}
                    onWeekAnalysisOpened={() => setOpenWeekAnalysisWeek(null)}
                  />
                ) : selectedPlanSport === 'running' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}
                      >
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <Onboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : selectedPlanSport === 'hiking' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}
                      >
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <HikingOnboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : selectedPlanSport === 'cycling' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}
                      >
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <CyclingOnboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : selectedPlanSport === 'mountain_biking' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}
                      >
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <MtbOnboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : selectedPlanSport === 'swimming' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button type="button" onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}>
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <SwimmingOnboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : selectedPlanSport === 'hyrox' ? (
                  <div>
                    <div style={{ maxWidth:720, margin:'0 auto', padding:'4px 16px 0' }}>
                      <button type="button" onClick={() => setSelectedPlanSport(null)}
                        style={{ border:'none', background:'transparent', color:'#B07A68', fontSize:11, fontWeight:800, cursor:'pointer', padding:'8px 0', fontFamily:'sans-serif' }}>
                        ← Andere Sportart wählen
                      </button>
                    </div>
                    <HyroxOnboarding onPlanGenerated={handlePlanGenerated} />
                  </div>
                ) : (
                  <PlanSportSelection onSelect={setSelectedPlanSport} />
                )}
              </div>
            )
            : (
              <Dashboard
                user={user}
                plan={plan}
                planId={planId}
                allowLegacyDayKeys={!viewingSecondaryPlan}
                onOpenTraining={() => setShowTrainingPlan(true)}
                onOpenActivities={() => setActiveTab('activities')}
                onOpenProfile={() => setActiveTab('profile')}
                onOpenWeekAnalysis={(weekNumber) => {
                  setOpenWeekAnalysisWeek(Number(weekNumber))
                  setShowTrainingPlan(true)
                }}
              />
            )
        )}
        {activeTab === 'activities' && <Laeufe user={user} plan={plan} planId={planId} allowLegacyDayKeys={!viewingSecondaryPlan} />}
        {activeTab === 'together' && (
          <Together
            user={user}
            plan={plan}
            planId={planId}
            focusFriends={togetherFocusFriends}
            refreshToken={togetherRefresh}
            onCreatePlanForGoal={handleCreatePlanForSharedGoal}
            onOpenLinkedPlan={handleOpenLinkedPlan}
          />
        )}
        {activeTab === 'profile' && (
          <Profile
            user={user}
            plan={plan}
            onOpenActivities={() => setActiveTab('activities')}
          />
        )}
      </div>

      <BottomNav activeTab={activeTab} onChange={handleMainTabChange} />
    </>
  )
}

export default App
