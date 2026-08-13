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
      <div className="lp-phone-screen">
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
      </div>
    </div>
  )
}

function LandingPage({ onLogin, onRegister }) {
  const [menuOpen, setMenuOpen] = useState(false)

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
        .lp-phones-row { max-width:1050px; margin:55px auto 0; padding:0 22px; display:grid; grid-template-columns:repeat(3,1fr); gap:22px; align-items:end; }
        .lp-phone-card { text-align:center; }
        .lp-phone-card:nth-child(2) { transform:translateY(-18px); }
        .lp-step { font-family:sans-serif; color:#C8684D; font-weight:950; font-size:9px; letter-spacing:1.2px; margin-bottom:9px; }
        .lp-step-title { font-family:Georgia,serif; font-size:23px; margin:17px 0 7px; }
        .lp-step-copy { font-family:sans-serif; color:${palette.muted}; font-size:12px; line-height:1.55; max-width:290px; margin:0 auto; }
        .lp-adapt { max-width:760px; margin:46px auto 0; padding:0 22px; text-align:center; }
        .lp-adapt-box { border:1px solid #E4D3EA; background:#F7F1FA; border-radius:22px; padding:20px; }
        .lp-adapt h3 { font-family:Georgia,serif; font-size:25px; margin:0 0 7px; color:#685178; }
        .lp-adapt p { font-family:sans-serif; font-size:13px; line-height:1.6; color:#8B758F; margin:0; }
        .lp-map-faux { height:150px; border-radius:16px; margin-top:13px; position:relative; overflow:hidden; background:linear-gradient(135deg,#DCEEDC,#DCEBFA 52%,#F4E6D8); }
        .lp-map-faux::before, .lp-map-faux::after { content:""; position:absolute; width:180px; height:2px; background:rgba(255,255,255,.9); transform:rotate(-22deg); left:-15px; top:70px; box-shadow:0 28px 0 rgba(255,255,255,.55),70px -48px 0 rgba(255,255,255,.48); }
        .lp-route-line { position:absolute; width:78px; height:94px; border:3px solid #FF8066; border-radius:47% 53% 58% 42% / 55% 36% 64% 45%; left:50%; top:50%; transform:translate(-50%,-50%) rotate(17deg); }
        .lp-mini-elevation { height:82px; margin-top:11px; background:#fff; border:1px solid ${palette.line}; border-radius:16px; padding:9px; }
        .lp-break { min-height:72svh; position:relative; display:flex; align-items:flex-end; background-image:linear-gradient(180deg,rgba(22,25,19,.05),rgba(19,19,17,.65)),url("/hero/cycling/01.webp"); background-size:cover; background-position:center; }
        .lp-break-content { position:relative; z-index:2; max-width:1180px; width:100%; margin:0 auto; padding:70px 22px 55px; color:#fff; }
        .lp-break-content h2 { font-family:Georgia,serif; font-size:clamp(42px,6vw,72px); line-height:1; letter-spacing:-1.7px; margin:0 0 14px; max-width:800px; }
        .lp-break-content p { max-width:650px; font-family:sans-serif; font-size:17px; line-height:1.55; color:rgba(255,255,255,.88); }
        .lp-soon { padding:80px 22px 100px; text-align:center; background:#FFF9F4; }
        .lp-soon h2 { font-family:Georgia,serif; font-size:clamp(32px,4vw,48px); margin:0 0 12px; }
        .lp-soon p { font-family:sans-serif; color:${palette.muted}; max-width:620px; margin:0 auto 22px; line-height:1.65; font-size:14px; }
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
          .lp-phones-row { grid-template-columns:1fr; gap:54px; max-width:470px; }
          .lp-phone-card:nth-child(2) { transform:none; }
          .lp-flow { gap:6px; }
          .lp-break { min-height:62svh; background-position:58% center; }
        }
        @media (max-width: 520px) {
          .lp-nav { padding:15px 0; }
          .lp-nav-inner { padding:0 16px; }
          .lp-brand { font-size:15px; }
          .lp-brand img { width:30px; height:30px; }
          .lp-hero { min-height:88svh; }
          .lp-hero-content { padding-left:18px; padding-right:18px; padding-bottom:28px; }
          .lp-hero h1 { font-size:51px; max-width:330px; }
          .lp-hero-lead { font-size:17px; line-height:1.34; max-width:350px; }
          .lp-hero-sub { font-size:12px; line-height:1.55; max-width:350px; }
          .lp-actions { margin-top:19px; }
          .lp-primary, .lp-secondary { padding:12px 15px; }
          .lp-sports { font-size:9.5px; gap:6px 9px; }
          .lp-plan-note { font-size:8.5px; }
          .lp-title { font-size:39px; }
          .lp-copy { font-size:13px; }
          .lp-section-head { padding:0 18px; }
          .lp-phone { width:min(92vw,345px); }
          .lp-phone-screen { min-height:545px; }
          .lp-feature-line h3 { font-size:20px; }
          .lp-feature-line p { font-size:12px; }
          .lp-phones-row { padding:0 16px; }
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

          <div className="lp-phones-row">
            <div className="lp-phone-card">
              <div className="lp-step">01 · PLANEN</div>
              <AppPhone variant="dashboard" />
              <h3 className="lp-step-title">Wissen, was ansteht.</h3>
              <p className="lp-step-copy">
                Dein Training fügt sich in deine Woche und dein Ziel ein.
              </p>
            </div>

            <div className="lp-phone-card">
              <div className="lp-step">02 · TRAINIEREN</div>
              <AppPhone variant="activity" />
              <h3 className="lp-step-title">Aus Plan wird Training.</h3>
              <p className="lp-step-copy">
                Synchronisierte oder eingetragene Aktivitäten verbinden sich mit deiner Trainingswoche.
              </p>
            </div>

            <div className="lp-phone-card">
              <div className="lp-step">03 · VERSTEHEN</div>
              <AppPhone variant="coach" />
              <h3 className="lp-step-title">Verstehen, bevor es weitergeht.</h3>
              <p className="lp-step-copy">
                Am Ende der Woche siehst du, was gut lief und worauf es als Nächstes ankommt.
              </p>
            </div>
          </div>

          <div className="lp-adapt">
            <div className="lp-adapt-box">
              <h3>↻ Anpassen</h3>
              <p>
                Wenn es sinnvoll ist, entwickelt sich dein Plan mit dir weiter –
                statt starr an einer einmal erstellten Woche festzuhalten.
              </p>
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

        <section className="lp-soon">
          <div className="lp-eyebrow">DAS IST ERST DER ANFANG</div>
          <h2>Dein Training an einem Ort.</h2>
          <p>
            Im nächsten Ausbau der Landingpage zeigen wir Entwicklung,
            Erfolge, deinen sportlichen Weg und die Verbindung deiner Trainingsdaten.
          </p>
          <button className="lp-primary" onClick={onRegister}>Jetzt starten →</button>
        </section>
      </main>
    </div>
  )
}

export default LandingPage
