import { useEffect, useState } from 'react'

const palette = {
  ink: '#3D2B1F',
  muted: '#8E7769',
  coral: '#FF8066',
  coralDark: '#D9614D',
  cream: '#FFF9F4',
  soft: '#FBF6F1',
  line: '#EEDFD5',
  green: '#5C9276',
  lavender: '#80699A',
}

const shell = {
  maxWidth: 1180,
  margin: '0 auto',
  padding: '0 22px',
  boxSizing: 'border-box',
}

const pill = {
  border: `1px solid ${palette.line}`,
  background: 'rgba(255,255,255,.88)',
  borderRadius: 999,
  padding: '9px 13px',
  fontFamily: 'sans-serif',
  fontSize: 12,
  fontWeight: 800,
  color: palette.ink,
}

const miniCard = {
  border: `1px solid ${palette.line}`,
  background: '#fff',
  borderRadius: 18,
  boxShadow: '0 18px 45px rgba(62,43,31,.08)',
}

function AppPhone({ variant = 'dashboard' }) {
  const dashboard = variant === 'dashboard'
  const activity = variant === 'activity'

  return (
    <div className="lp-phone">
      <div className="lp-phone-notch" />
      <div
        className="lp-phone-screen"
        style={{
          minHeight:
            variant === 'dashboard'
              ? 500
              : variant === 'activity'
                ? 475
                : variant === 'coach'
                  ? 455
                  : 430,
        }}
      >
        {dashboard && (
          <>
            <div style={{fontSize:11,fontFamily:'sans-serif',fontWeight:800,color:'#9B8578'}}>Guten Morgen 👋</div>
            <div className="lp-preview-hero">
              <div className="lp-preview-hero-overlay" />
              <div style={{position:'relative',zIndex:1}}>
                <div style={{fontSize:8,fontFamily:'sans-serif',fontWeight:900,letterSpacing:1}}>HEUTE STEHT AN</div>
                <div style={{fontSize:19,fontWeight:850,lineHeight:1.05,marginTop:5}}>Tempodauerlauf</div>
                <div style={{fontSize:9,fontFamily:'sans-serif',marginTop:7,opacity:.92}}>5 km kontrolliert · Zone 4</div>
              </div>
            </div>
            <div className="lp-daily-card">
              <div style={{fontSize:8,fontWeight:900,letterSpacing:.7,color:palette.green,fontFamily:'sans-serif'}}>DEIN TAG</div>
              <div style={{fontSize:13,fontWeight:850,marginTop:5}}>Alles im grünen Bereich.</div>
              <div style={{fontSize:8.5,lineHeight:1.45,color:palette.muted,fontFamily:'sans-serif',marginTop:5}}>Geh wie geplant in deine heutige Einheit.</div>
            </div>
            <div className="lp-week-card">
              <div style={{display:'flex',justifyContent:'space-between',fontFamily:'sans-serif'}}>
                <strong style={{fontSize:10}}>Diese Woche</strong>
                <span style={{fontSize:9,color:palette.muted}}>2 von 3</span>
              </div>
              <div style={{height:6,borderRadius:99,background:'#F2E9E3',marginTop:10,overflow:'hidden'}}>
                <div style={{height:'100%',width:'67%',background:'linear-gradient(90deg,#FF9C75,#E77A77)'}} />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:11}}>
                {['✓ Intervalle','✓ Locker','Sa · Long'].map((x,i)=><div key={x} style={{padding:'7px 5px',borderRadius:10,background:i<2?'#EEF8F2':'#FFF5EF',fontSize:7.5,fontFamily:'sans-serif',textAlign:'center',color:i<2?'#4F8E70':'#A66F59'}}>{x}</div>)}
              </div>
            </div>
          </>
        )}

        {activity && (
          <>
            <div style={{fontSize:9,fontFamily:'sans-serif',fontWeight:900,color:'#A17662',letterSpacing:.7}}>DEINE AKTIVITÄT</div>
            <div style={{fontSize:17,fontWeight:850,marginTop:5}}>Langer Lauf</div>
            <div className="lp-map-faux">
              <div className="lp-route-line" />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:7,marginTop:9}}>
              {[
                ['DISTANZ','15,0 km'],
                ['PACE','8:00 min/km'],
                ['Ø HF','141 bpm'],
                ['DAUER','2:00 h'],
              ].map(([a,b])=><div key={a} style={{...miniCard,padding:10,boxShadow:'none'}}>
                <div style={{fontSize:6.5,letterSpacing:.8,color:'#AE9789',fontWeight:900,fontFamily:'sans-serif'}}>{a}</div>
                <div style={{fontSize:11.5,fontWeight:850,marginTop:4}}>{b}</div>
              </div>)}
            </div>
            <div className="lp-mini-elevation">
              <svg viewBox="0 0 260 72" width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lpFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#79C29A" stopOpacity=".45"/>
                    <stop offset="100%" stopColor="#79C29A" stopOpacity=".05"/>
                  </linearGradient>
                </defs>
                <path d="M0 67 C22 64,30 55,50 52 C69 50,72 31,89 27 C105 24,111 10,123 8 C139 11,145 43,165 48 C184 54,196 45,211 42 C226 46,235 58,260 60 L260 72 L0 72 Z" fill="url(#lpFill)" />
                <path d="M0 67 C22 64,30 55,50 52 C69 50,72 31,89 27 C105 24,111 10,123 8 C139 11,145 43,165 48 C184 54,196 45,211 42 C226 46,235 58,260 60" fill="none" stroke="#58A978" strokeWidth="2.3"/>
              </svg>
            </div>
          </>
        )}

        {variant === 'coach' && (
          <>
            <div style={{fontSize:9,fontFamily:'sans-serif',fontWeight:900,color:'#A17662',letterSpacing:.7}}>WOCHEN-COACH</div>
            <div style={{fontSize:19,fontWeight:850,lineHeight:1.06,marginTop:7}}>Woche 5 im Rückblick</div>
            <div style={{...miniCard,padding:13,marginTop:13,background:'#FFF7F1',boxShadow:'none'}}>
              <div style={{fontSize:7,fontWeight:900,color:'#C8684D',letterSpacing:.8,fontFamily:'sans-serif'}}>COACH-FAZIT</div>
              <div style={{fontSize:13,fontWeight:850,lineHeight:1.16,marginTop:6}}>Starke Woche – technisch sauber absolviert.</div>
              <div style={{fontSize:8,lineHeight:1.5,color:palette.muted,fontFamily:'sans-serif',marginTop:7}}>Alle geplanten Einheiten geschafft. Tempo und langer Lauf zeigen eine gute Kontrolle.</div>
            </div>
            <div style={{...miniCard,padding:13,marginTop:9,boxShadow:'none'}}>
              <div style={{fontSize:7,fontWeight:900,color:palette.green,letterSpacing:.8,fontFamily:'sans-serif'}}>DAS LIEF GUT</div>
              <div style={{fontSize:8.5,lineHeight:1.5,color:palette.muted,fontFamily:'sans-serif',marginTop:7}}>✓ Intervalle im Zielbereich<br/>✓ Long Run gleichmäßig<br/>✓ Plan vollständig</div>
            </div>
            <div style={{...miniCard,padding:13,marginTop:9,background:'#F7F2FA',boxShadow:'none'}}>
              <div style={{fontSize:7,fontWeight:900,color:palette.lavender,letterSpacing:.8,fontFamily:'sans-serif'}}>FOKUS NÄCHSTE WOCHE</div>
              <div style={{fontSize:11,fontWeight:850,marginTop:6}}>Tempo kontrolliert steigern.</div>
            </div>
          </>
        )}

        {variant === 'adapt' && (
          <>
            <div style={{fontSize:9,fontFamily:'sans-serif',fontWeight:900,color:'#80699A',letterSpacing:.7}}>DEINE NÄCHSTE WOCHE</div>
            <div style={{fontSize:19,fontWeight:850,lineHeight:1.06,marginTop:7}}>Plan sinnvoll angepasst</div>

            <div style={{...miniCard,padding:13,marginTop:14,background:'#F7F2FA',boxShadow:'none'}}>
              <div style={{fontSize:7,fontWeight:900,color:'#80699A',letterSpacing:.8,fontFamily:'sans-serif'}}>WARUM</div>
              <div style={{fontSize:11.5,fontWeight:850,lineHeight:1.3,marginTop:6}}>Gute Woche – aber leichte Ermüdungssignale.</div>
            </div>

            <div style={{display:'grid',gap:8,marginTop:10}}>
              {[
                ['Di','Tempodauerlauf','5 km · kontrolliert'],
                ['Do','Locker','35 min · bewusst leicht'],
                ['Sa','Langer Lauf','16 km · +1 km'],
              ].map(([day,title,meta], index) => (
                <div key={title} style={{...miniCard,padding:'11px 12px',boxShadow:'none',display:'grid',gridTemplateColumns:'32px 1fr',gap:9,alignItems:'center',background:index===1?'#F1F8F3':'#fff'}}>
                  <div style={{width:30,height:30,borderRadius:11,display:'grid',placeItems:'center',background:index===1?'#DFF1E6':'#FFF1EA',fontSize:8,fontWeight:900,fontFamily:'sans-serif',color:index===1?'#4E8B6B':'#B56D57'}}>{day}</div>
                  <div>
                    <div style={{fontSize:10.5,fontWeight:850}}>{title}</div>
                    <div style={{fontSize:7.5,fontFamily:'sans-serif',color:palette.muted,marginTop:2}}>{meta}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginTop:11,padding:'11px 12px',borderRadius:15,background:'#FFF7F1',border:'1px solid #F0DCCF',fontFamily:'sans-serif',fontSize:8.5,lineHeight:1.45,color:'#966E5C'}}>
              ✓ Belastung gesteuert · ✓ Erholung berücksichtigt
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function LandingPage({ onLogin, onRegister }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [planSlide, setPlanSlide] = useState(0)
  const [slideTouchStart, setSlideTouchStart] = useState(null)

  const planSlides = [
    {
      step: '01 · PLANEN',
      variant: 'dashboard',
      title: 'Wissen, was ansteht.',
      text: 'Dein Training fügt sich in deine Woche und dein Ziel ein.',
    },
    {
      step: '02 · TRAINIEREN',
      variant: 'activity',
      title: 'Aus Plan wird Training.',
      text: 'Synchronisierte oder eingetragene Aktivitäten verbinden sich mit deiner Trainingswoche.',
    },
    {
      step: '03 · VERSTEHEN',
      variant: 'coach',
      title: 'Verstehen, bevor es weitergeht.',
      text: 'Am Ende der Woche siehst du, was gut lief und worauf es als Nächstes ankommt.',
    },
    {
      step: '04 · ANPASSEN',
      variant: 'adapt',
      title: 'Dein Plan entwickelt sich mit dir.',
      text: 'Wenn es sinnvoll ist, wird die nächste Woche passend zu deiner Entwicklung angepasst.',
    },
  ]

  const changePlanSlide = direction => {
    setPlanSlide(current => {
      const next = current + direction
      if (next < 0) return planSlides.length - 1
      if (next >= planSlides.length) return 0
      return next
    })
  }

  const handleSlideTouchEnd = event => {
    if (slideTouchStart == null) return
    const end = event.changedTouches?.[0]?.clientX
    if (typeof end === 'number') {
      const diff = slideTouchStart - end
      if (Math.abs(diff) > 45) changePlanSlide(diff > 0 ? 1 : -1)
    }
    setSlideTouchStart(null)
  }

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMenuOpen(false)
  }

  return (
    <div className="landing-page">
      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; }
        .landing-page { min-height:100vh; background:${palette.cream}; color:${palette.ink}; overflow-x:hidden; }
        .lp-serif { font-family: Georgia, "Times New Roman", serif; }
        .lp-sans { font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .lp-nav { position:absolute; z-index:20; top:0; left:0; right:0; padding:22px 0; }
        .lp-nav-inner { max-width:1180px; margin:0 auto; padding:0 22px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
        .lp-brand { display:flex; align-items:center; gap:10px; color:#fff; text-decoration:none; font-family:Georgia,serif; font-size:18px; font-weight:800; text-shadow:0 2px 12px rgba(0,0,0,.2); }
        .lp-brand img { width:34px; height:34px; border-radius:50%; box-shadow:0 4px 14px rgba(0,0,0,.18); }
        .lp-navlinks { display:flex; align-items:center; gap:23px; }
        .lp-navlink { border:0; background:transparent; color:rgba(255,255,255,.92); font-weight:750; font-size:12px; cursor:pointer; font-family:sans-serif; text-shadow:0 1px 10px rgba(0,0,0,.28); }
        .lp-nav-cta { border:1px solid rgba(255,255,255,.48); background:rgba(255,255,255,.15); backdrop-filter:blur(10px); color:#fff; border-radius:999px; padding:10px 15px; font-size:12px; font-weight:850; cursor:pointer; }
        .lp-menu { display:none; }
        .lp-hero { min-height:92svh; position:relative; display:flex; align-items:flex-end; background-image:linear-gradient(180deg,rgba(21,24,20,.10) 0%,rgba(20,20,18,.08) 30%,rgba(25,22,19,.72) 100%),url("/hero/running/easy/02.webp"); background-size:cover; background-position:center 42%; }
        .lp-hero::after { content:""; position:absolute; inset:auto 0 0; height:120px; background:linear-gradient(180deg,transparent,rgba(15,12,10,.22)); pointer-events:none; }
        .lp-hero-content { position:relative; z-index:2; max-width:1180px; width:100%; margin:0 auto; padding:160px 22px 58px; color:#fff; }
        .lp-hero-copy { max-width:710px; }
        .lp-kicker { font-family:sans-serif; font-size:11px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase; }
        .lp-hero h1 { font-family:Georgia,serif; font-size:clamp(50px,7vw,86px); line-height:.96; letter-spacing:-2.8px; margin:12px 0 18px; max-width:760px; }
        .lp-hero-lead { font-family:sans-serif; font-size:clamp(18px,2vw,25px); line-height:1.35; font-weight:760; margin:0; max-width:720px; }
        .lp-hero-sub { font-family:sans-serif; font-size:14px; line-height:1.65; color:rgba(255,255,255,.86); max-width:610px; margin:16px 0 0; }
        .lp-actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:24px; }
        .lp-primary { border:0; border-radius:999px; padding:14px 20px; color:#fff; background:linear-gradient(135deg,#FF8B70,#FF668F); font-size:13px; font-family:sans-serif; font-weight:900; cursor:pointer; box-shadow:0 12px 32px rgba(255,103,139,.32); }
        .lp-secondary { border:1px solid rgba(255,255,255,.42); border-radius:999px; padding:13px 18px; color:#fff; background:rgba(255,255,255,.10); backdrop-filter:blur(9px); font-size:12px; font-family:sans-serif; font-weight:850; cursor:pointer; }
        .lp-sports { display:flex; flex-wrap:wrap; align-items:center; gap:7px 12px; margin-top:25px; font-family:sans-serif; color:rgba(255,255,255,.9); font-size:11px; font-weight:760; }
        .lp-plan-note { width:100%; color:rgba(255,255,255,.66); font-size:9.5px; margin-top:2px; font-weight:600; }
        .lp-section { padding:100px 0; scroll-margin-top:30px; }
        .lp-section-head { max-width:780px; margin:0 auto 48px; text-align:center; padding:0 20px; }
        .lp-eyebrow { font-family:sans-serif; color:#C8684D; font-size:10px; font-weight:950; letter-spacing:1.5px; text-transform:uppercase; }
        .lp-title { font-family:Georgia,serif; font-size:clamp(36px,5vw,58px); line-height:1.02; letter-spacing:-1.3px; margin:10px 0 14px; }
        .lp-copy { font-family:sans-serif; color:${palette.muted}; font-size:15px; line-height:1.7; margin:0; }
        .lp-daily-grid { max-width:1060px; margin:0 auto; padding:0 22px; display:grid; grid-template-columns:minmax(310px,470px) 1fr; gap:80px; align-items:center; }
        .lp-phone { width:min(100%,355px); margin:0 auto; border:9px solid #342923; border-radius:44px; background:#342923; padding:7px; box-shadow:0 28px 70px rgba(56,38,28,.18); position:relative; }
        .lp-phone-notch { position:absolute; z-index:4; top:11px; left:50%; transform:translateX(-50%); width:90px; height:18px; border-radius:0 0 14px 14px; background:#342923; }
        .lp-phone-screen { background:linear-gradient(180deg,#FFF9F4,#F7FBF8); border-radius:31px; min-height:570px; padding:38px 16px 18px; overflow:hidden; }
        .lp-preview-hero { min-height:180px; border-radius:20px; margin-top:12px; padding:15px; display:flex; align-items:flex-end; color:white; position:relative; overflow:hidden; background-image:url("/hero/running/tempo/02.webp"); background-size:cover; background-position:center; }
        .lp-preview-hero-overlay { position:absolute; inset:0; background:linear-gradient(180deg,rgba(10,12,10,.02),rgba(25,22,19,.72)); }
        .lp-daily-card, .lp-week-card { background:#fff; border:1px solid ${palette.line}; border-radius:16px; padding:12px; margin-top:10px; }
        .lp-feature-lines { display:grid; gap:30px; }
        .lp-feature-line { display:grid; grid-template-columns:46px 1fr; gap:15px; align-items:start; }
        .lp-feature-icon { width:46px; height:46px; border-radius:16px; display:grid; place-items:center; font-size:20px; background:#FFF0E9; border:1px solid #F7D8C8; }
        .lp-feature-line h3 { font-family:Georgia,serif; margin:1px 0 6px; font-size:22px; }
        .lp-feature-line p { font-family:sans-serif; color:${palette.muted}; font-size:13px; line-height:1.55; margin:0; }
        .lp-loop { background:linear-gradient(180deg,#FFF7F1 0%,#FFFBF8 100%); border-top:1px solid #F4E6DE; border-bottom:1px solid #F4E6DE; }
        .lp-flow { display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:8px; margin-top:22px; font-family:sans-serif; font-size:10px; font-weight:950; letter-spacing:.8px; color:#A3705C; }
        .lp-flow span { background:#fff; border:1px solid #EFDACF; border-radius:999px; padding:8px 11px; }
        .lp-slider-wrap { max-width:760px; margin:48px auto 0; padding:0 22px; }
        .lp-slider-stage { position:relative; display:grid; grid-template-columns:54px minmax(0,1fr) 54px; gap:16px; align-items:center; }
        .lp-slide-arrow { width:48px; height:48px; border-radius:50%; border:1px solid #E8D8CF; background:rgba(255,255,255,.82); color:#9E6E59; font-size:24px; cursor:pointer; box-shadow:0 10px 26px rgba(76,48,33,.07); }
        .lp-slide { min-width:0; text-align:center; touch-action:pan-y; }
        .lp-slide-phone { max-width:330px; margin:0 auto; }
        .lp-step { font-family:sans-serif; color:#C8684D; font-weight:950; font-size:9px; letter-spacing:1.2px; margin-bottom:10px; }
        .lp-step-title { font-family:Georgia,serif; font-size:26px; margin:18px 0 7px; }
        .lp-step-copy { font-family:sans-serif; color:${palette.muted}; font-size:12.5px; line-height:1.55; max-width:420px; margin:0 auto; }
        .lp-slide-dots { display:flex; justify-content:center; gap:8px; margin-top:19px; }
        .lp-slide-dot { width:8px; height:8px; border-radius:50%; border:0; padding:0; background:#DDCEC5; cursor:pointer; transition:all .2s ease; }
        .lp-slide-dot.active { width:24px; border-radius:99px; background:#D36C55; }
        .lp-slide-tabs { display:flex; justify-content:center; flex-wrap:wrap; gap:7px; margin:0 auto 22px; }
        .lp-slide-tab { border:1px solid #E8D7CD; background:#fff; color:#A17360; border-radius:999px; padding:8px 11px; font-family:sans-serif; font-size:9px; font-weight:900; letter-spacing:.55px; cursor:pointer; }
        .lp-slide-tab.active { background:#FFF0E8; border-color:#F1BDA8; color:#C45F48; }

        .lp-insight-section { background:linear-gradient(180deg,#FFF9F4 0%,#F6FBF7 100%); }
        .lp-insight-grid { max-width:1080px; margin:0 auto; padding:0 22px; display:grid; grid-template-columns:1fr 1fr; gap:58px; align-items:center; }
        .lp-insight-cards { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .lp-insight-card { border:1px solid #E6DDD6; background:#fff; border-radius:22px; padding:18px; min-height:142px; box-shadow:0 16px 38px rgba(62,43,31,.055); }
        .lp-insight-label { font-family:sans-serif; font-size:8px; font-weight:950; letter-spacing:1px; color:#A48B7E; text-transform:uppercase; }
        .lp-insight-value { font-family:Georgia,serif; font-size:27px; font-weight:800; margin-top:9px; }
        .lp-insight-note { font-family:sans-serif; font-size:10px; line-height:1.45; color:${palette.muted}; margin-top:7px; }
        .lp-insight-highlight { grid-column:1/-1; background:linear-gradient(135deg,#FFF5EE,#F5F2FB); }

        .lp-swim-break { max-width:1080px; min-height:420px; margin:0 auto 10px; border-radius:34px; overflow:hidden; position:relative; display:flex; align-items:flex-end; background-image:linear-gradient(180deg,rgba(12,28,34,.06),rgba(12,26,31,.62)),url("/hero/swimming/01.webp"); background-size:cover; background-position:center 48%; box-shadow:0 24px 60px rgba(33,57,62,.10); }
        .lp-swim-break-content { position:relative; z-index:2; padding:38px 40px; color:#fff; max-width:700px; }
        .lp-swim-break-content .lp-kicker { color:rgba(255,255,255,.88); }
        .lp-swim-break-content h2 { font-family:Georgia,serif; font-size:clamp(38px,5vw,60px); line-height:1; letter-spacing:-1.4px; margin:9px 0 0; }
        .lp-swim-break-wrap { padding:0 22px 90px; background:linear-gradient(180deg,#F6FBF7 0%,#FFFCF9 100%); }

        .lp-story-section { background:#FFFCF9; }
        .lp-story-grid { max-width:1080px; margin:0 auto; padding:0 22px; display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .lp-story-card { border:1px solid #E7DBD3; background:#fff; border-radius:26px; padding:24px; box-shadow:0 18px 44px rgba(67,47,36,.06); min-height:390px; }
        .lp-story-card h3 { font-family:Georgia,serif; font-size:31px; margin:8px 0 10px; }
        .lp-story-card p { font-family:sans-serif; font-size:12.5px; line-height:1.6; color:${palette.muted}; }
        .lp-achievement-row { display:grid; grid-template-columns:54px 1fr; gap:12px; align-items:center; margin-top:14px; padding:13px; border-radius:18px; background:#FFF8F3; border:1px solid #F2DED1; }
        .lp-achievement-icon { width:54px; height:54px; border-radius:17px; display:grid; place-items:center; font-size:26px; background:#FFF0E4; }
        .lp-timeline { margin-top:18px; position:relative; padding-left:25px; }
        .lp-timeline::before { content:""; position:absolute; left:7px; top:3px; bottom:4px; width:2px; background:#E7DAD1; }
        .lp-timeline-item { position:relative; padding:0 0 17px 12px; }
        .lp-timeline-item::before { content:""; position:absolute; left:-23px; top:3px; width:12px; height:12px; border-radius:50%; background:#fff; border:3px solid #D9856B; }
        .lp-timeline-date { font-family:sans-serif; font-size:8px; color:#AC9385; }
        .lp-timeline-title { font-size:13px; font-weight:850; margin-top:2px; }

        .lp-together { max-width:1080px; margin:0 auto; padding:92px 22px; display:grid; grid-template-columns:1.05fr .95fr; gap:52px; align-items:center; }
        .lp-together-visual { border-radius:30px; background:linear-gradient(135deg,#F7F1FA,#FFF6EF); border:1px solid #E8D8E9; padding:22px; box-shadow:0 22px 50px rgba(66,49,75,.07); }
        .lp-goal-card { background:#fff; border:1px solid #E8DDD7; border-radius:22px; padding:18px; }
        .lp-person-progress { margin-top:14px; }
        .lp-person-head { display:flex; justify-content:space-between; align-items:center; gap:12px; font-family:sans-serif; font-size:11px; }
        .lp-progress { height:8px; border-radius:99px; overflow:hidden; background:#EFE6E1; margin-top:7px; }
        .lp-progress > div { height:100%; border-radius:99px; background:linear-gradient(90deg,#FF9B73,#FF6F83); }

        .lp-connect-section { background:#F7FAF7; padding:88px 22px; }
        .lp-connect-box { max-width:900px; margin:0 auto; text-align:center; }
        .lp-provider-row { display:flex; justify-content:center; flex-wrap:wrap; gap:12px; margin-top:28px; }
        .lp-provider { min-width:150px; padding:17px 20px; border-radius:20px; background:#fff; border:1px solid #DCE7DE; font-family:sans-serif; }
        .lp-provider strong { display:block; font-size:14px; }
        .lp-provider span { display:block; margin-top:4px; font-size:9px; color:#9B8A80; }
        .lp-provider.soon { opacity:.62; }

        .lp-final { min-height:66svh; display:flex; align-items:flex-end; position:relative; background-image:linear-gradient(180deg,rgba(28,24,19,.12),rgba(24,20,17,.72)),url("/hero/hiking/03.webp"); background-size:cover; background-position:center; }
        .lp-final-content { width:100%; max-width:1180px; margin:0 auto; padding:70px 22px 55px; color:#fff; }
        .lp-final h2 { font-family:Georgia,serif; font-size:clamp(42px,6vw,72px); line-height:1; letter-spacing:-1.7px; max-width:720px; margin:0 0 14px; }
        .lp-final p { font-family:sans-serif; font-size:16px; line-height:1.55; max-width:570px; color:rgba(255,255,255,.86); }
        .lp-map-faux { height:150px; border-radius:16px; margin-top:13px; position:relative; overflow:hidden; background:linear-gradient(135deg,#DCEEDC,#DCEBFA 52%,#F4E6D8); }
        .lp-map-faux::before, .lp-map-faux::after { content:""; position:absolute; width:180px; height:2px; background:rgba(255,255,255,.9); transform:rotate(-22deg); left:-15px; top:70px; box-shadow:0 28px 0 rgba(255,255,255,.55),70px -48px 0 rgba(255,255,255,.48); }
        .lp-route-line { position:absolute; width:78px; height:94px; border:3px solid #FF8066; border-radius:47% 53% 58% 42% / 55% 36% 64% 45%; left:50%; top:50%; transform:translate(-50%,-50%) rotate(17deg); }
        .lp-mini-elevation { height:82px; margin-top:11px; background:#fff; border:1px solid ${palette.line}; border-radius:16px; padding:9px; }
        .lp-break { min-height:72svh; position:relative; display:flex; align-items:flex-end; background-image:linear-gradient(180deg,rgba(22,25,19,.05),rgba(19,19,17,.65)),url("/hero/cycling/01.webp"); background-size:cover; background-position:center; }
        .lp-break-content { position:relative; z-index:2; max-width:1180px; width:100%; margin:0 auto; padding:70px 22px 55px; color:#fff; }
        .lp-break-content h2 { font-family:Georgia,serif; font-size:clamp(42px,6vw,72px); line-height:1; letter-spacing:-1.7px; margin:0 0 14px; max-width:800px; }
        .lp-break-content p { max-width:650px; font-family:sans-serif; font-size:17px; line-height:1.55; color:rgba(255,255,255,.88); }
        @media (max-width: 820px) {
          .lp-navlinks { display:none; }
          .lp-menu { display:block; position:relative; }
          .lp-menu-button { width:40px; height:40px; border-radius:50%; border:1px solid rgba(255,255,255,.5); background:rgba(255,255,255,.12); color:white; font-size:18px; }
          .lp-menu-pop { position:absolute; top:48px; right:0; width:190px; padding:8px; background:rgba(255,249,244,.98); border:1px solid #EEDFD5; border-radius:17px; box-shadow:0 20px 50px rgba(52,38,30,.2); }
          .lp-menu-pop button { width:100%; border:0; background:transparent; text-align:left; padding:10px 11px; border-radius:10px; color:${palette.ink}; font-family:sans-serif; font-weight:800; }
          .lp-hero { min-height:90svh; background-position:58% center; }
          .lp-hero-content { padding-top:130px; padding-bottom:38px; }
          .lp-hero h1 { font-size:clamp(48px,14vw,66px); letter-spacing:-2px; }
          .lp-hero-lead { font-size:18px; max-width:560px; }
          .lp-hero-sub { font-size:12.5px; max-width:520px; }
          .lp-section { padding:76px 0; }
          .lp-section-head { margin-bottom:36px; }
          .lp-daily-grid { grid-template-columns:1fr; gap:45px; padding:0 18px; }
          .lp-feature-lines { max-width:520px; margin:0 auto; }
          .lp-slider-stage { grid-template-columns:1fr; }
          .lp-slide-arrow { display:none; }
          .lp-flow { gap:6px; }
          .lp-break { min-height:62svh; background-position:58% center; }
          .lp-insight-grid { grid-template-columns:1fr; gap:36px; }
          .lp-story-grid { grid-template-columns:1fr; }
          .lp-swim-break { min-height:360px; border-radius:26px; background-position:center 45%; }
          .lp-swim-break-content { padding:30px 26px; }
          .lp-together { grid-template-columns:1fr; gap:32px; padding-top:72px; padding-bottom:72px; }
        }
        @media (max-width: 520px) {
          .lp-nav { padding:15px 0; }
          .lp-nav-inner { padding:0 16px; }
          .lp-brand { font-size:15px; }
          .lp-brand img { width:30px; height:30px; }
          .lp-hero { min-height:88svh; }
          .lp-hero-content { padding-left:18px; padding-right:18px; padding-bottom:28px; }
          .lp-hero h1 { font-size:47px; max-width:330px; }
          .lp-hero-lead { font-size:17px; line-height:1.34; max-width:350px; }
          .lp-hero-sub { font-size:12px; line-height:1.55; max-width:350px; }
          .lp-actions { margin-top:19px; }
          .lp-primary, .lp-secondary { padding:12px 15px; }
          .lp-sports { font-size:9.5px; gap:6px 9px; }
          .lp-plan-note { font-size:8.5px; }
          .lp-title { font-size:39px; }
          .lp-copy { font-size:13px; }
          .lp-section-head { padding:0 18px; }
          .lp-phone { width:min(88vw,330px); }
          .lp-phone-screen { min-height:0 !important; }
          .lp-feature-line h3 { font-size:20px; }
          .lp-feature-line p { font-size:12px; }
          .lp-slider-wrap { padding:0 16px; }
          .lp-slide-phone { max-width:315px; }
          .lp-slide-tabs { margin-left:-4px; margin-right:-4px; }
          .lp-slide-tab { padding:7px 9px; font-size:8px; }
          .lp-insight-grid, .lp-story-grid { padding:0 16px; }
          .lp-swim-break-wrap { padding:0 16px 72px; }
          .lp-swim-break { min-height:330px; border-radius:22px; background-position:58% center; }
          .lp-swim-break-content { padding:25px 22px; }
          .lp-swim-break-content h2 { font-size:39px; }
          .lp-insight-cards { grid-template-columns:1fr; }
          .lp-insight-highlight { grid-column:auto; }
          .lp-story-card { padding:20px; min-height:0; }
          .lp-together { padding-left:16px; padding-right:16px; }
          .lp-connect-section { padding-left:16px; padding-right:16px; }
          .lp-provider { min-width:130px; }
          .lp-final { min-height:60svh; }
          .lp-final-content { padding:55px 18px 38px; }
          .lp-break-content { padding:55px 18px 36px; }
          .lp-break-content h2 { font-size:44px; }
          .lp-break-content p { font-size:14px; }
        }
      `}</style>

      <header className="lp-nav">
        <div className="lp-nav-inner">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="lp-brand"
            style={{border:0,background:'transparent',cursor:'pointer',padding:0}}
          >
            <img src="/route-icon.png" alt="" />
            <span>Run Coaching</span>
          </button>

          <nav className="lp-navlinks">
            <button className="lp-navlink" onClick={() => go('dein-tag')}>Training</button>
            <button className="lp-navlink" onClick={() => go('so-funktionierts')}>So funktioniert's</button>
            <button className="lp-navlink" onClick={() => go('multisport')}>Dein Sport</button>
            <button className="lp-navlink" onClick={onLogin}>Anmelden</button>
            <button className="lp-nav-cta" onClick={onRegister}>Jetzt starten</button>
          </nav>

          <div className="lp-menu">
            <button
              type="button"
              className="lp-menu-button"
              onClick={() => setMenuOpen(value => !value)}
              aria-label="Menü öffnen"
            >
              ☰
            </button>
            {menuOpen && (
              <div className="lp-menu-pop">
                <button onClick={() => go('dein-tag')}>Training</button>
                <button onClick={() => go('so-funktionierts')}>So funktioniert's</button>
                <button onClick={() => go('multisport')}>Dein Sport</button>
                <button onClick={onLogin}>Anmelden</button>
                <button
                  onClick={onRegister}
                  style={{background:'linear-gradient(135deg,#FF8B70,#FF668F)',color:'#fff'}}
                >
                  Jetzt starten
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-content">
            <div className="lp-hero-copy">
              <div className="lp-kicker">DEINE PERSÖNLICHE TRAININGSBEGLEITUNG</div>
              <h1>Dein Training.<br/>Dein Weg.</h1>
              <p className="lp-hero-lead">
                <strong>Ein Plan, der dich begleitet.</strong><br/>
                Verstehe deine Entwicklung. Erreiche dein Ziel.
              </p>
              <p className="lp-hero-sub">
                Trainiere passend zu deinem Ziel und deinem Alltag. Behalte deine
                Fortschritte im Blick und erlebe, wie aus einzelnen Einheiten
                dein sportlicher Weg entsteht.
              </p>

              <div className="lp-actions">
                <button className="lp-primary" onClick={onRegister}>Jetzt starten →</button>
                <button className="lp-secondary" onClick={onLogin}>Bereits dabei? Anmelden</button>
              </div>

              <div className="lp-sports">
                <span>🏃 Laufen</span>
                <span>🥾 Wandern & Marsch</span>
                <span>🚴 Radfahren</span>
                <span>🚵 MTB</span>
                <span>🏊 Schwimmen</span>
                <div className="lp-plan-note">
                  Trainingspläne aktuell für Laufen · weitere Sportarten folgen
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="dein-tag" className="lp-section">
          <div className="lp-section-head">
            <div className="lp-eyebrow">DEIN TAG</div>
            <h2 className="lp-title">Heute zählt, was für dich ansteht.</h2>
            <p className="lp-copy">
              Dein Training, deine Woche und eine leichte Orientierung für heute –
              auf einen Blick und ohne dich durch Zahlen suchen zu müssen.
            </p>
          </div>

          <div className="lp-daily-grid">
            <AppPhone variant="dashboard" />

            <div className="lp-feature-lines">
              <div className="lp-feature-line">
                <div className="lp-feature-icon">🎯</div>
                <div>
                  <h3>Training im Blick</h3>
                  <p>Deine heutige Einheit steht im Mittelpunkt. Klar und ohne unnötige Ablenkung.</p>
                </div>
              </div>
              <div className="lp-feature-line">
                <div className="lp-feature-icon" style={{background:'#F1F8F3',borderColor:'#D9EBDD'}}>📅</div>
                <div>
                  <h3>Woche verstehen</h3>
                  <p>Sieh, wo du gerade in deinem Plan stehst – und was noch vor dir liegt.</p>
                </div>
              </div>
              <div className="lp-feature-line">
                <div className="lp-feature-icon" style={{background:'#F7F2FA',borderColor:'#E7DCEE'}}>🌿</div>
                <div>
                  <h3>Orientierung bekommen</h3>
                  <p>Ein kurzer Impuls hilft dir, deinen heutigen Trainingstag einzuordnen.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="so-funktionierts" className="lp-section lp-loop">
          <div className="lp-section-head">
            <div className="lp-eyebrow">DEIN PLAN</div>
            <h2 className="lp-title">
              Ein Plan ist gut.<br/>Einer, der dich begleitet, ist besser.
            </h2>
            <p className="lp-copy">
              Dein Training endet nicht mit einem Haken hinter einer Einheit.
              Plan, tatsächliches Training und deine Entwicklung greifen ineinander.
            </p>
            <div className="lp-flow">
              <span>PLANEN</span> → <span>TRAINIEREN</span> → <span>VERSTEHEN</span> → <span>ANPASSEN</span>
            </div>
          </div>

          <div className="lp-slider-wrap">
            <div className="lp-slide-tabs">
              {planSlides.map((slide, index) => (
                <button
                  key={slide.step}
                  type="button"
                  className={`lp-slide-tab ${planSlide === index ? 'active' : ''}`}
                  onClick={() => setPlanSlide(index)}
                >
                  {slide.step.replace(/^\d+ · /, '')}
                </button>
              ))}
            </div>

            <div className="lp-slider-stage">
              <button
                type="button"
                className="lp-slide-arrow"
                onClick={() => changePlanSlide(-1)}
                aria-label="Vorheriger Schritt"
              >
                ‹
              </button>

              <div
                className="lp-slide"
                onTouchStart={event =>
                  setSlideTouchStart(event.touches?.[0]?.clientX ?? null)
                }
                onTouchEnd={handleSlideTouchEnd}
              >
                <div className="lp-step">{planSlides[planSlide].step}</div>
                <div className="lp-slide-phone">
                  <AppPhone variant={planSlides[planSlide].variant} />
                </div>
                <h3 className="lp-step-title">{planSlides[planSlide].title}</h3>
                <p className="lp-step-copy">{planSlides[planSlide].text}</p>
              </div>

              <button
                type="button"
                className="lp-slide-arrow"
                onClick={() => changePlanSlide(1)}
                aria-label="Nächster Schritt"
              >
                ›
              </button>
            </div>

            <div className="lp-slide-dots" aria-label="Schritte">
              {planSlides.map((slide, index) => (
                <button
                  key={slide.step}
                  type="button"
                  className={`lp-slide-dot ${planSlide === index ? 'active' : ''}`}
                  onClick={() => setPlanSlide(index)}
                  aria-label={`Schritt ${index + 1}: ${slide.step}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="multisport" className="lp-break">
          <div className="lp-break-content">
            <div className="lp-kicker">DEIN SPORT</div>
            <h2>Sport ist mehr als ein Trainingsplan.</h2>
            <p>
              Der spontane Ride. Die lange Wanderung. Der Lauf am Meer.
              <strong> Alles gehört zu deinem sportlichen Weg.</strong>
            </p>
          </div>
        </section>

        <section id="entwicklung" className="lp-section lp-insight-section">
          <div className="lp-section-head">
            <div className="lp-eyebrow">DEINE ENTWICKLUNG</div>
            <h2 className="lp-title">Nicht mehr Daten. Mehr Bedeutung.</h2>
            <p className="lp-copy">
              Sieh nicht nur, was du gemacht hast. Erkenne, wie sich dein Training
              über Wochen und Monate verändert.
            </p>
          </div>

          <div className="lp-insight-grid">
            <div className="lp-insight-cards">
              <div className="lp-insight-card">
                <div className="lp-insight-label">Tempo & Effizienz</div>
                <div className="lp-insight-value">↗ 12 Sek./km</div>
                <div className="lp-insight-note">
                  Deine durchschnittliche Laufpace entwickelt sich in die richtige Richtung.
                </div>
              </div>

              <div className="lp-insight-card">
                <div className="lp-insight-label">Umfang</div>
                <div className="lp-insight-value">131,2 km</div>
                <div className="lp-insight-note">
                  Alle Sportarten in deinem ausgewählten Zeitraum zusammen.
                </div>
              </div>

              <div className="lp-insight-card lp-insight-highlight">
                <div className="lp-insight-label">Verstehen statt nur messen</div>
                <div className="lp-insight-value" style={{fontSize:23}}>
                  Gleiche Belastung. Besseres Tempo.
                </div>
                <div className="lp-insight-note" style={{fontSize:11}}>
                  Fortschritt zeigt sich nicht nur in Bestzeiten. Auch Herzfrequenz,
                  Trainingsumfang, Höhenmeter und Konstanz erzählen deine Entwicklung.
                </div>
              </div>
            </div>

            <div>
              <div className="lp-eyebrow">IM BLICK</div>
              <h3 className="lp-title" style={{fontSize:'clamp(31px,4vw,48px)',textAlign:'left'}}>
                Erkenne, was sich wirklich verändert.
              </h3>
              <p className="lp-copy">
                Tempo und Effizienz. Belastung und Umfang. Herzfrequenz und Höhenmeter.
                Deine App bringt diese Perspektiven zusammen, ohne dich mit einzelnen
                Kennzahlen allein zu lassen.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-swim-break-wrap" aria-label="Sportlicher Entwicklungs-Moment">
          <div className="lp-swim-break">
            <div className="lp-swim-break-content">
              <div className="lp-kicker">DEINE ENTWICKLUNG</div>
              <h2>Fortschritt sieht für jeden anders aus.</h2>
            </div>
          </div>
        </section>

        <section className="lp-section lp-story-section">
          <div className="lp-section-head">
            <div className="lp-eyebrow">DEIN WEG</div>
            <h2 className="lp-title">Jeder Fortschritt verdient einen Moment.</h2>
            <p className="lp-copy">
              Nicht nur Wettkämpfe zählen. Auch erste Male, neue Distanzen,
              besondere Touren und deine persönliche Konstanz.
            </p>
          </div>

          <div className="lp-story-grid">
            <div className="lp-story-card">
              <div className="lp-eyebrow">ERFOLGE & SAMMLUNGEN</div>
              <h3>Sieh, was du geschafft hast.</h3>
              <p>
                Aus einzelnen Einheiten entstehen Meilensteine – vom ersten Training
                bis zu langen Distanzen, Bestleistungen und besonderen Momenten.
              </p>

              <div className="lp-achievement-row">
                <div className="lp-achievement-icon">🏅</div>
                <div>
                  <div style={{fontFamily:'sans-serif',fontSize:8,color:'#A78F82'}}>NEUER MEILENSTEIN</div>
                  <div style={{fontSize:14,fontWeight:850,marginTop:3}}>100 Radkilometer</div>
                  <div style={{fontFamily:'sans-serif',fontSize:9,color:palette.muted,marginTop:3}}>Erreicht auf deinem bisherigen Weg.</div>
                </div>
              </div>

              <div className="lp-achievement-row" style={{background:'#F5F9F5',borderColor:'#DDEADF'}}>
                <div className="lp-achievement-icon" style={{background:'#EAF5ED'}}>🌦️</div>
                <div>
                  <div style={{fontFamily:'sans-serif',fontSize:8,color:'#7D9B85'}}>SAMMLUNG</div>
                  <div style={{fontSize:14,fontWeight:850,marginTop:3}}>Wetter · 3 von 6</div>
                  <div style={{fontFamily:'sans-serif',fontSize:9,color:palette.muted,marginTop:3}}>Dein Sport kennt mehr als Sonnenschein.</div>
                </div>
              </div>
            </div>

            <div className="lp-story-card" style={{background:'linear-gradient(180deg,#FFFFFF,#FBF8FC)'}}>
              <div className="lp-eyebrow" style={{color:'#80699A'}}>MEIN SPORTLICHER WEG</div>
              <h3>Aus Training wird Geschichte.</h3>
              <p>
                Deine besonderen Momente bleiben nicht zwischen Statistiken versteckt.
                Sie werden Teil deiner persönlichen Timeline.
              </p>

              <div className="lp-timeline">
                <div className="lp-timeline-item">
                  <div className="lp-timeline-date">09. AUGUST</div>
                  <div className="lp-timeline-title">🚴 100 Radkilometer</div>
                </div>
                <div className="lp-timeline-item">
                  <div className="lp-timeline-date">09. AUGUST</div>
                  <div className="lp-timeline-title">🌫️ Im Nebel unterwegs</div>
                </div>
                <div className="lp-timeline-item">
                  <div className="lp-timeline-date">08. AUGUST</div>
                  <div className="lp-timeline-title">☀️ Sonnenmoment</div>
                </div>
                <div className="lp-timeline-item">
                  <div className="lp-timeline-date">07. AUGUST</div>
                  <div className="lp-timeline-title">🏃 Neuer längster Lauf</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-together">
          <div>
            <div className="lp-eyebrow" style={{color:'#80699A'}}>GEMEINSAME ZIELE · PERSPEKTIVISCH</div>
            <h2 className="lp-title" style={{textAlign:'left'}}>
              Manche Ziele sind gemeinsam noch besser.
            </h2>
            <p className="lp-copy">
              Trainiert später gemeinsam für dasselbe Ziel und bleibt trotzdem
              bei eurem eigenen Leistungsstand. Ein gemeinsames Ziel muss nicht
              bedeuten, dass jede Einheit identisch ist.
            </p>
          </div>

          <div className="lp-together-visual">
            <div className="lp-goal-card">
              <div style={{fontFamily:'sans-serif',fontSize:8,fontWeight:950,letterSpacing:1,color:'#80699A'}}>GEMEINSAMES ZIEL</div>
              <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:850,marginTop:6}}>🥾 50-km-Marsch</div>
              <div style={{fontFamily:'sans-serif',fontSize:9,color:palette.muted,marginTop:4}}>Noch 8 Wochen</div>

              <div className="lp-person-progress">
                <div className="lp-person-head"><strong>👩 Julia</strong><span>78 %</span></div>
                <div className="lp-progress"><div style={{width:'78%'}} /></div>
              </div>

              <div className="lp-person-progress">
                <div className="lp-person-head"><strong>👩 Freundin</strong><span>69 %</span></div>
                <div className="lp-progress"><div style={{width:'69%'}} /></div>
              </div>

              <div style={{marginTop:15,padding:'11px 12px',borderRadius:14,background:'#F7F2FA',fontFamily:'sans-serif',fontSize:9,color:'#7B6684',lineHeight:1.45}}>
                Dasselbe Ziel · individuelle Trainingsbelastung
              </div>
            </div>
          </div>
        </section>

        <section className="lp-connect-section">
          <div className="lp-connect-box">
            <div className="lp-eyebrow" style={{color:'#5C9276'}}>VERBINDEN</div>
            <h2 className="lp-title">Dein Training kommt mit.</h2>
            <p className="lp-copy">
              Synchronisiere Aktivitäten und finde sie direkt in deinem Training,
              deiner Entwicklung und deinem sportlichen Weg wieder.
            </p>

            <div className="lp-provider-row">
              <div className="lp-provider">
                <strong>⌚ Polar</strong>
                <span>bereits verfügbar</span>
              </div>
              <div className="lp-provider soon">
                <strong>Strava</strong>
                <span>geplant</span>
              </div>
              <div className="lp-provider soon">
                <strong>Garmin</strong>
                <span>geplant</span>
              </div>
              <div className="lp-provider soon">
                <strong>Weitere</strong>
                <span>folgen</span>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-final-content">
            <div className="lp-kicker">DEIN NÄCHSTER SCHRITT</div>
            <h2>Bereit für deinen Weg?</h2>
            <p>
              Dein Ziel beginnt nicht irgendwann. Sondern dort, wo du heute stehst.
              Starte mit deinem Training und mach deine Entwicklung sichtbar.
            </p>
            <div className="lp-actions">
              <button className="lp-primary" onClick={onRegister}>Jetzt starten →</button>
              <button className="lp-secondary" onClick={onLogin}>Anmelden</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage
