import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const zeitenConfig = {
  '5 km': {
    'Anfänger':        { zielzeit: 'z. B. 0:40', bisherige: 'z. B. 0:50' },
    'Fortgeschritten': { zielzeit: 'z. B. 0:28', bisherige: 'z. B. 0:32' },
    'Erfahren':        { zielzeit: 'z. B. 0:22', bisherige: 'z. B. 0:25' },
  },
  '10 km': {
    'Anfänger':        { zielzeit: 'z. B. 1:20', bisherige: 'z. B. 1:35' },
    'Fortgeschritten': { zielzeit: 'z. B. 0:58', bisherige: 'z. B. 1:08' },
    'Erfahren':        { zielzeit: 'z. B. 0:46', bisherige: 'z. B. 0:52' },
  },
  'Halbmarathon': {
    'Anfänger':        { zielzeit: 'z. B. 2:45', bisherige: 'z. B. 3:00' },
    'Fortgeschritten': { zielzeit: 'z. B. 2:05', bisherige: 'z. B. 2:20' },
    'Erfahren':        { zielzeit: 'z. B. 1:45', bisherige: 'z. B. 1:55' },
  },
  'Marathon': {
    'Anfänger':        { zielzeit: 'z. B. 5:30', bisherige: 'z. B. 6:00' },
    'Fortgeschritten': { zielzeit: 'z. B. 4:15', bisherige: 'z. B. 4:45' },
    'Erfahren':        { zielzeit: 'z. B. 3:30', bisherige: 'z. B. 3:50' },
  },
}

const zielOptionen = [
  {
    id: 'rennen',
    icon: '🏁',
    label: 'Ich trainiere für ein Rennen',
    sub: 'Gezielt auf deinen Wettkampf vorbereiten',
  },
  {
    id: 'distanz',
    icon: '🎯',
    label: 'Ich möchte eine Distanz schaffen',
    sub: 'Dein persönliches Distanzziel erreichen',
  },
  {
    id: 'starten',
    icon: '🌱',
    label: 'Ich möchte mit Laufen anfangen',
    sub: 'Schritt für Schritt ins Laufen einsteigen',
  },
]

const niveauOptionen = [
  {
    id: 'Anfänger',
    icon: '🌱',
    label: 'Ich starte gerade',
    sub: 'Ich laufe selten oder noch nicht regelmäßig',
  },
  {
    id: 'Fortgeschritten',
    icon: '📈',
    label: 'Ich laufe regelmäßig',
    sub: 'Laufen gehört bereits zu meiner Woche',
  },
  {
    id: 'Erfahren',
    icon: '⚡',
    label: 'Ich trainiere ambitioniert',
    sub: 'Ich kenne strukturierte Einheiten oder Wettkampftraining',
  },
]

const haeufigkeitOptionen = [
  { id: '0', label: 'Noch gar nicht' },
  { id: '1', label: '1× pro Woche' },
  { id: '2', label: '2× pro Woche' },
  { id: '3', label: '3× pro Woche' },
  { id: '4plus', label: '4× oder häufiger' },
]

const DISTANCES = ['5 km', '10 km', 'Halbmarathon', 'Marathon']

const todayIso = () => new Date().toISOString().split('T')[0]

const weeksBetween = (startValue, endValue) => {
  if (!startValue || !endValue) return null
  const start = new Date(`${startValue}T12:00:00`)
  const end = new Date(`${endValue}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const days = Math.floor((end - start) / 86400000)
  if (days < 7) return 0
  return Math.floor(days / 7)
}

const recommendedWeeks = form => {
  if (form.zielTyp === 'starten') return 8

  const byGoal = {
    '5 km': form.niveau === 'Anfänger' ? 12 : 8,
    '10 km': 12,
    'Halbmarathon': form.niveau === 'Erfahren' ? 12 : 16,
    'Marathon': 20,
  }

  return byGoal[form.goal] || 12
}

export default function Onboarding({ onPlanGenerated }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    zielTyp: '',
    niveau: '',
    goal: '',
    goalTime: '',
    previousTime: '',
    raceDate: '',
    startDate: todayIso(),
    weeksUntilRace: 12,
    runsPerWeek: 3,
    currentRunsPerWeek: '',
    alter: '',
    aktuelleWochenKm: '',
    verletzungen: '',
    hasConsiderations: 'nein',
    maxHF: '',
    ruheHF: '',
    geschlecht: '',
    wohnort: '',
  })
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user?.id) return

        const { data } = await supabase
          .from('profiles')
          .select('name,geschlecht,geburtsdatum,wohnort,max_hf,ruhe_hf,wochen_km')
          .eq('id', user.id)
          .maybeSingle()

        if (!active) return

        const birthDate = data?.geburtsdatum ? new Date(`${data.geburtsdatum}T12:00:00`) : null
        const age = birthDate && !Number.isNaN(birthDate.getTime())
          ? Math.max(
              0,
              new Date().getFullYear() -
                birthDate.getFullYear() -
                (new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) <
                new Date(new Date().getFullYear(), birthDate.getMonth(), birthDate.getDate())
                  ? 1
                  : 0)
            )
          : ''

        setForm(current => ({
          ...current,
          name: data?.name || user.user_metadata?.name || current.name,
          geschlecht: data?.geschlecht || current.geschlecht,
          wohnort: data?.wohnort || current.wohnort,
          alter: age || current.alter,
          maxHF: data?.max_hf ? String(data.max_hf) : current.maxHF,
          ruheHF: data?.ruhe_hf ? String(data.ruhe_hf) : current.ruheHF,
          aktuelleWochenKm: data?.wochen_km ? String(data.wochen_km) : current.aktuelleWochenKm,
        }))
      } catch (profileError) {
        console.warn('[RunningOnboarding] Profildaten konnten nicht vorgeladen werden:', profileError)
      } finally {
        if (active) setProfileLoading(false)
      }
    }

    loadProfile()
    return () => {
      active = false
    }
  }, [])

  const showDistanz = form.zielTyp !== 'starten'
  const showZeiten = showDistanz && Boolean(form.goal)
  const zeiten =
    zeitenConfig[form.goal]?.[form.niveau] ||
    { zielzeit: 'z. B. 2:05', bisherige: 'z. B. 2:20' }

  const estimatedMaxHF = useMemo(() => {
    const age = Number(form.alter)
    if (!Number.isFinite(age) || age <= 0) return null
    return Math.round(220 - age)
  }, [form.alter])

  const raceWeeks = useMemo(
    () => weeksBetween(form.startDate, form.raceDate),
    [form.startDate, form.raceDate]
  )

  const recommendation = useMemo(() => recommendedWeeks(form), [
    form.zielTyp,
    form.goal,
    form.niveau,
  ])

  useEffect(() => {
    if (form.zielTyp === 'rennen' && raceWeeks != null && raceWeeks > 0) {
      setForm(current =>
        current.weeksUntilRace === raceWeeks
          ? current
          : { ...current, weeksUntilRace: raceWeeks }
      )
    }
  }, [form.zielTyp, raceWeeks])

  useEffect(() => {
    if (!form.zielTyp || form.zielTyp === 'rennen') return

    const nextWeeks = recommendedWeeks(form)
    setForm(current =>
      current.weeksUntilRace === nextWeeks
        ? current
        : { ...current, weeksUntilRace: nextWeeks }
    )
  }, [form.zielTyp, form.goal, form.niveau])

  const handleGoalType = zielTyp => {
    setForm(current => ({
      ...current,
      zielTyp,
      goal: zielTyp === 'starten' ? '' : current.goal,
      goalTime: zielTyp === 'starten' ? '' : current.goalTime,
      previousTime: zielTyp === 'starten' ? '' : current.previousTime,
      raceDate: zielTyp === 'rennen' ? current.raceDate : '',
      weeksUntilRace: zielTyp === 'starten' ? 8 : current.weeksUntilRace,
    }))
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      onPlanGenerated(data.plan)
    } catch (e) {
      setError('Fehler: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 14,
    border: '1.5px solid #F0E0D0',
    fontSize: 16,
    color: '#3D2B1F',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#FFF8F5',
    fontFamily: 'sans-serif',
  }

  const labelStyle = {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#A98D7E',
    textTransform: 'uppercase',
    letterSpacing: 1,
    display: 'block',
    marginBottom: 7,
    fontFamily: 'sans-serif',
  }

  const optLabel = {
    fontSize: 10,
    color: '#D4C4B8',
    fontWeight: 'normal',
    letterSpacing: 0,
    textTransform: 'none',
    marginLeft: 6,
  }

  const panelStyle = {
    background: 'white',
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 6px 30px rgba(87,61,46,0.08)',
    border: '1px solid #EEE1D8',
  }

  const canProceedStep1 =
    Boolean(form.zielTyp) &&
    Boolean(form.niveau) &&
    (!showDistanz || Boolean(form.goal)) &&
    (form.zielTyp !== 'rennen' || (Boolean(form.raceDate) && raceWeeks > 0))

  const canProceedStep2 =
    Boolean(form.currentRunsPerWeek)

  const canGenerate =
    Boolean(form.startDate) &&
    Boolean(form.runsPerWeek) &&
    (form.zielTyp !== 'rennen' || (raceWeeks != null && raceWeeks > 0))

  const progress = [
    { n: 1, label: 'Ziel' },
    { n: 2, label: 'Training' },
    { n: 3, label: 'Plan' },
  ]

  const selectedGoal = zielOptionen.find(option => option.id === form.zielTyp)
  const selectedLevel = niveauOptionen.find(option => option.id === form.niveau)

  return (
    <div
      style={{
        fontFamily: "'Georgia', 'Times New Roman', serif",
        background:
          'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 50%, #FFF0F5 100%)',
        minHeight: '100vh',
      }}
    >
      <header
        style={{
          minHeight: 238,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'flex-end',
          background: '#5F7568',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url("/hero/running/easy/02.webp")',
            backgroundSize: 'cover',
            backgroundPosition: 'center 56%',
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg,rgba(23,27,24,.72) 0%,rgba(25,25,22,.40) 52%,rgba(22,21,19,.12) 78%), linear-gradient(180deg,rgba(18,20,18,.06),rgba(22,20,18,.64))',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: 720,
            margin: '0 auto',
            boxSizing: 'border-box',
            padding: '34px 20px 24px',
            color: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: 'rgba(255,248,240,.94)',
                border: '1px solid rgba(255,255,255,.72)',
                boxShadow: '0 4px 14px rgba(0,0,0,.16)',
              }}
            >
              <img
                src="/route-icon.png"
                alt=""
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'block',
                }}
              />
            </div>

            <div
              style={{
                fontFamily: 'sans-serif',
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.4,
                opacity: 0.92,
              }}
            >
              DEIN TRAININGSPLAN
            </div>
          </div>

          <h1
            style={{
              margin: '7px 0 4px',
              fontSize: 31,
              lineHeight: 1.06,
            }}
          >
            Laufen
          </h1>

          <p
            style={{
              margin: 0,
              fontFamily: 'sans-serif',
              fontSize: 12,
              lineHeight: 1.5,
              opacity: 0.9,
            }}
          >
            Wir bauen deinen Plan passend zu deinem Ziel und deinem aktuellen Training.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginTop: 18,
              maxWidth: 390,
            }}
          >
            {progress.map(item => {
              const active = step === item.n
              const done = step > item.n

              return (
                <div key={item.n}>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 99,
                      background:
                        active || done
                          ? '#FFFFFF'
                          : 'rgba(255,255,255,.28)',
                    }}
                  />
                  <div
                    style={{
                      marginTop: 6,
                      fontFamily: 'sans-serif',
                      fontSize: 9.5,
                      fontWeight: active ? 900 : 700,
                      opacity: active || done ? 1 : 0.7,
                    }}
                  >
                    {item.n} · {item.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '24px 18px 42px',
        }}
      >
        {profileLoading && (
          <div
            style={{
              fontFamily: 'sans-serif',
              fontSize: 11,
              color: '#A88F80',
              marginBottom: 12,
            }}
          >
            Profil wird übernommen…
          </div>
        )}

        {step === 1 && (
          <section style={panelStyle}>
            <div style={{ marginBottom: 24 }}>
              <div style={labelStyle}>Was ist dein Ziel?</div>

              <div style={{ display: 'grid', gap: 10 }}>
                {zielOptionen.map(option => {
                  const selected = form.zielTyp === option.id

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleGoalType(option.id)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '42px 1fr 24px',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 15px',
                        borderRadius: 16,
                        border: `2px solid ${selected ? '#FF8C69' : '#EEE4DE'}`,
                        background: selected ? '#FFF5F0' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 23 }}>{option.icon}</span>

                      <span>
                        <span
                          style={{
                            display: 'block',
                            fontFamily: 'sans-serif',
                            fontSize: 13.5,
                            fontWeight: 850,
                            color: selected ? '#D96D51' : '#3D2B1F',
                          }}
                        >
                          {option.label}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontFamily: 'sans-serif',
                            fontSize: 10.5,
                            color: '#AE9587',
                            marginTop: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {option.sub}
                        </span>
                      </span>

                      <span
                        style={{
                          color: selected ? '#FF8C69' : '#E1D5CE',
                          fontFamily: 'sans-serif',
                          fontWeight: 900,
                        }}
                      >
                        {selected ? '✓' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={labelStyle}>Wo stehst du gerade?</div>

              <div style={{ display: 'grid', gap: 9 }}>
                {niveauOptionen.map(option => {
                  const selected = form.niveau === option.id

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setForm(current => ({ ...current, niveau: option.id }))
                      }
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '42px 1fr 24px',
                        alignItems: 'center',
                        gap: 12,
                        padding: '13px 15px',
                        borderRadius: 16,
                        border: `2px solid ${selected ? '#7EC8A4' : '#EEE4DE'}`,
                        background: selected ? '#F2FAF5' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{option.icon}</span>

                      <span>
                        <span
                          style={{
                            display: 'block',
                            fontFamily: 'sans-serif',
                            fontSize: 13,
                            fontWeight: 850,
                            color: selected ? '#4E9877' : '#3D2B1F',
                          }}
                        >
                          {option.label}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontFamily: 'sans-serif',
                            fontSize: 10.5,
                            color: '#AE9587',
                            marginTop: 2,
                            lineHeight: 1.4,
                          }}
                        >
                          {option.sub}
                        </span>
                      </span>

                      <span style={{ color: '#65AF8A', fontWeight: 900 }}>
                        {selected ? '✓' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {showDistanz && (
              <div style={{ marginBottom: 22 }}>
                <div style={labelStyle}>
                  {form.zielTyp === 'rennen' ? 'Renndistanz' : 'Deine Zieldistanz'}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DISTANCES.map(distance => {
                    const selected = form.goal === distance

                    return (
                      <button
                        key={distance}
                        type="button"
                        onClick={() =>
                          setForm(current => ({
                            ...current,
                            goal: distance,
                            goalTime: '',
                            previousTime: '',
                          }))
                        }
                        style={{
                          background: selected ? '#FF8C69' : '#fff',
                          color: selected ? '#fff' : '#8B735F',
                          border: `2px solid ${selected ? '#FF8C69' : '#EEE3DC'}`,
                          borderRadius: 12,
                          padding: '10px 13px',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontFamily: 'sans-serif',
                          fontWeight: 850,
                        }}
                      >
                        {distance}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {form.zielTyp === 'rennen' && (
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Wann ist dein Rennen?</label>
                <input
                  type="date"
                  min={form.startDate || todayIso()}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={form.raceDate}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      raceDate: event.target.value,
                    }))
                  }
                />

                {form.raceDate && raceWeeks === 0 && (
                  <div
                    style={{
                      marginTop: 7,
                      fontFamily: 'sans-serif',
                      fontSize: 10.5,
                      color: '#B8674E',
                    }}
                  >
                    Zwischen Planstart und Rennen sollte mindestens eine Trainingswoche liegen.
                  </div>
                )}
              </div>
            )}

            {showZeiten && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginBottom: 22,
                }}
              >
                <div>
                  <label style={labelStyle}>
                    Zielzeit <span style={optLabel}>optional</span>
                  </label>
                  <input
                    style={inputStyle}
                    placeholder={zeiten.zielzeit}
                    value={form.goalTime}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        goalTime: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Bisherige Zeit <span style={optLabel}>optional</span>
                  </label>
                  <input
                    style={inputStyle}
                    placeholder={zeiten.bisherige}
                    value={form.previousTime}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        previousTime: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {showZeiten && !form.goalTime && !form.previousTime && (
              <div
                style={{
                  marginBottom: 22,
                  padding: '10px 13px',
                  background: '#F2FAF5',
                  border: '1px solid #CFE9D9',
                  borderRadius: 12,
                  fontSize: 11,
                  color: '#5A9275',
                  fontFamily: 'sans-serif',
                  lineHeight: 1.5,
                }}
              >
                Ohne Zeitangabe liegt der Fokus auf dem sicheren Erreichen deiner Distanz.
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              style={{
                width: '100%',
                padding: 16,
                borderRadius: 17,
                border: 'none',
                background: canProceedStep1
                  ? 'linear-gradient(135deg,#FF8C69,#FF6B9D)'
                  : '#EEE7E2',
                color: canProceedStep1 ? '#fff' : '#BCA99D',
                fontFamily: 'sans-serif',
                fontSize: 14,
                fontWeight: 900,
                cursor: canProceedStep1 ? 'pointer' : 'default',
              }}
            >
              Weiter zu deinem Training →
            </button>
          </section>
        )}

        {step === 2 && (
          <section style={panelStyle}>
            <div
              style={{
                marginBottom: 22,
                padding: '11px 13px',
                borderRadius: 13,
                background: '#FFF7F2',
                fontFamily: 'sans-serif',
                fontSize: 10.5,
                color: '#8B7467',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#D76C51' }}>
                {selectedGoal?.icon} {selectedGoal?.label}
              </strong>
              {form.goal ? ` · ${form.goal}` : ''}
              {selectedLevel ? ` · ${selectedLevel.label}` : ''}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={labelStyle}>Wie oft läufst du aktuell?</div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0,1fr))',
                  gap: 8,
                }}
              >
                {haeufigkeitOptionen.map(option => {
                  const selected = form.currentRunsPerWeek === option.id

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setForm(current => ({
                          ...current,
                          currentRunsPerWeek: option.id,
                        }))
                      }
                      style={{
                        padding: '11px 9px',
                        borderRadius: 12,
                        border: `2px solid ${selected ? '#7EC8A4' : '#EFE4DD'}`,
                        background: selected ? '#F2FAF5' : '#fff',
                        color: selected ? '#4F9576' : '#8D776A',
                        fontFamily: 'sans-serif',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>
                Aktuelle Wochenkilometer <span style={optLabel}>optional</span>
              </label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                placeholder="z. B. 20"
                value={form.aktuelleWochenKm}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    aktuelleWochenKm: event.target.value,
                  }))
                }
              />
              <div
                style={{
                  marginTop: 6,
                  fontFamily: 'sans-serif',
                  fontSize: 10.5,
                  color: '#B4A095',
                }}
              >
                Ein ungefährer Durchschnitt der letzten Wochen reicht.
              </div>
            </div>

            <div
              style={{
                margin: '0 -4px 24px',
                padding: '18px 16px',
                borderRadius: 18,
                background: '#F7FAF8',
                border: '1px solid #DDEAE2',
              }}
            >
              <div
                style={{
                  fontFamily: 'sans-serif',
                  fontSize: 10,
                  fontWeight: 900,
                  color: '#5B8B70',
                  letterSpacing: 1,
                  marginBottom: 13,
                }}
              >
                DEINE TRAININGSINTENSITÄT
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Alter <span style={optLabel}>optional</span>
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  min="14"
                  max="100"
                  placeholder="z. B. 38"
                  value={form.alter}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      alter: event.target.value,
                    }))
                  }
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>
                  Maximale Herzfrequenz (bpm) <span style={optLabel}>optional</span>
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  min="80"
                  max="240"
                  placeholder={
                    estimatedMaxHF
                      ? `Falls unbekannt: grob ca. ${estimatedMaxHF}`
                      : 'z. B. 192'
                  }
                  value={form.maxHF}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      maxHF: event.target.value,
                    }))
                  }
                />
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: 'sans-serif',
                    fontSize: 10.5,
                    lineHeight: 1.45,
                    color: '#A99387',
                  }}
                >
                  Wenn du deinen individuellen Wert kennst, trage ihn ein. Andernfalls kann er nur grob anhand deines Alters geschätzt werden.
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  Ruheherzfrequenz (bpm) <span style={optLabel}>optional</span>
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  min="30"
                  max="130"
                  placeholder="z. B. 47"
                  value={form.ruheHF}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      ruheHF: event.target.value,
                    }))
                  }
                />
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: 'sans-serif',
                    fontSize: 10.5,
                    lineHeight: 1.45,
                    color: '#A99387',
                  }}
                >
                  Am besten in Ruhe, zum Beispiel morgens vor dem Aufstehen, gemessen.
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid #E1EBE5',
                  fontFamily: 'sans-serif',
                  fontSize: 10.5,
                  lineHeight: 1.5,
                  color: '#6D8175',
                }}
              >
                Die Angaben sind freiwillig. Je mehr verlässliche Herzfrequenzdaten vorliegen, desto individueller können die Trainingsbereiche eingeordnet werden.
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={labelStyle}>
                Gibt es etwas, das wir berücksichtigen sollen?{' '}
                <span style={optLabel}>optional</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'nein', label: 'Nein' },
                  { id: 'ja', label: 'Ja' },
                ].map(option => {
                  const selected = form.hasConsiderations === option.id

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setForm(current => ({
                          ...current,
                          hasConsiderations: option.id,
                          verletzungen:
                            option.id === 'nein' ? '' : current.verletzungen,
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: 11,
                        borderRadius: 12,
                        border: `2px solid ${selected ? '#FFB079' : '#EFE3DC'}`,
                        background: selected ? '#FFF7EF' : '#fff',
                        color: selected ? '#B97042' : '#9A8377',
                        fontFamily: 'sans-serif',
                        fontSize: 12,
                        fontWeight: 850,
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>

              {form.hasConsiderations === 'ja' && (
                <textarea
                  style={{
                    ...inputStyle,
                    minHeight: 82,
                    resize: 'vertical',
                    marginTop: 10,
                    lineHeight: 1.45,
                  }}
                  placeholder="z. B. wiederkehrende Beschwerden oder etwas, das deine Trainingsplanung beeinflusst"
                  value={form.verletzungen}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      verletzungen: event.target.value,
                    }))
                  }
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: 9 }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: 15,
                  borderRadius: 16,
                  border: '1.5px solid #E8DDD6',
                  background: '#fff',
                  color: '#A18B7E',
                  fontFamily: 'sans-serif',
                  fontWeight: 850,
                  cursor: 'pointer',
                }}
              >
                ← Zurück
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                style={{
                  flex: 2,
                  padding: 15,
                  borderRadius: 16,
                  border: 'none',
                  background: canProceedStep2
                    ? 'linear-gradient(135deg,#FF8C69,#FF6B9D)'
                    : '#EEE7E2',
                  color: canProceedStep2 ? '#fff' : '#BCA99D',
                  fontFamily: 'sans-serif',
                  fontWeight: 900,
                  cursor: canProceedStep2 ? 'pointer' : 'default',
                }}
              >
                Weiter zu deinem Plan →
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section style={panelStyle}>
            <div
              style={{
                marginBottom: 22,
                padding: '11px 13px',
                borderRadius: 13,
                background: '#F2FAF5',
                fontFamily: 'sans-serif',
                fontSize: 10.5,
                color: '#688070',
                lineHeight: 1.5,
              }}
            >
              Fast geschafft. Jetzt legen wir nur noch fest, wann und wie oft du trainieren möchtest.
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Startdatum des Plans</label>
              <input
                type="date"
                min={todayIso()}
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.startDate}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>

            {form.zielTyp === 'rennen' ? (
              <div
                style={{
                  marginBottom: 22,
                  padding: '15px 16px',
                  borderRadius: 15,
                  background: '#FFF7F0',
                  border: '1px solid #F2DED0',
                  fontFamily: 'sans-serif',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    color: '#B56E4E',
                    letterSpacing: 0.7,
                  }}
                >
                  DEINE VORBEREITUNGSZEIT
                </div>
                <div
                  style={{
                    fontSize: 21,
                    fontWeight: 900,
                    color: '#4B372C',
                    marginTop: 5,
                  }}
                >
                  {raceWeeks != null && raceWeeks > 0
                    ? `${raceWeeks} Wochen`
                    : 'Bitte Renndatum prüfen'}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: '#9B8376',
                    lineHeight: 1.45,
                    marginTop: 4,
                  }}
                >
                  Die Dauer ergibt sich aus deinem Planstart und deinem Renndatum.
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 22 }}>
                <div
                  style={{
                    ...labelStyle,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span>Planlänge</span>
                  <span
                    style={{
                      color: '#5E9A79',
                      textTransform: 'none',
                      letterSpacing: 0,
                    }}
                  >
                    Empfehlung: {recommendation} Wochen
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 7,
                  }}
                >
                  {[8, 12, 16, 20].map(weeks => {
                    const selected = form.weeksUntilRace === weeks
                    const recommended = recommendation === weeks

                    return (
                      <button
                        key={weeks}
                        type="button"
                        onClick={() =>
                          setForm(current => ({
                            ...current,
                            weeksUntilRace: weeks,
                          }))
                        }
                        style={{
                          position: 'relative',
                          padding: '12px 5px',
                          borderRadius: 12,
                          border: `2px solid ${
                            selected ? '#FF8C69' : '#EDE2DA'
                          }`,
                          background: selected ? '#FFF2EC' : '#fff',
                          color: selected ? '#D66C51' : '#9B8477',
                          fontFamily: 'sans-serif',
                          fontSize: 11.5,
                          fontWeight: 900,
                          cursor: 'pointer',
                        }}
                      >
                        {weeks} Wo.
                        {recommended && (
                          <span
                            style={{
                              display: 'block',
                              marginTop: 3,
                              fontSize: 7.5,
                              color: '#5F9A79',
                            }}
                          >
                            empfohlen
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 26 }}>
              <label style={labelStyle}>Wie oft möchtest du pro Woche laufen?</label>

              <div style={{ display: 'flex', gap: 8 }}>
                {[3, 4, 5].map(runs => {
                  const selected = form.runsPerWeek === runs

                  return (
                    <button
                      key={runs}
                      type="button"
                      onClick={() =>
                        setForm(current => ({
                          ...current,
                          runsPerWeek: runs,
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: '12px 0',
                        borderRadius: 12,
                        border: `2px solid ${
                          selected ? '#7EC8A4' : '#EDE2DA'
                        }`,
                        background: selected ? '#F0FAF4' : '#fff',
                        color: selected ? '#4E9877' : '#9B8477',
                        fontFamily: 'sans-serif',
                        fontSize: 13,
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      {runs}×
                    </button>
                  )
                })}
              </div>
            </div>

            <div
              style={{
                marginBottom: 22,
                padding: '14px 15px',
                borderRadius: 15,
                background: '#F8F5FA',
                border: '1px solid #E8DFEC',
                fontFamily: 'sans-serif',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: '#80699A',
                  letterSpacing: 0.7,
                }}
              >
                DEIN PLAN
              </div>

              <div
                style={{
                  marginTop: 7,
                  display: 'grid',
                  gap: 5,
                  fontSize: 10.5,
                  color: '#756574',
                }}
              >
                <div>
                  {selectedGoal?.icon} {selectedGoal?.label}
                  {form.goal ? ` · ${form.goal}` : ''}
                </div>
                <div>
                  📅 {form.weeksUntilRace} Wochen · {form.runsPerWeek} Läufe pro Woche
                </div>
                <div>
                  📈 Ausgangspunkt: {selectedLevel?.label || form.niveau}
                </div>
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '12px 14px',
                  background: '#FDECEA',
                  border: '1px solid #F5C4CC',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#B85464',
                  fontFamily: 'sans-serif',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 9 }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 15,
                  borderRadius: 16,
                  border: '1.5px solid #E8DDD6',
                  background: '#fff',
                  color: '#A18B7E',
                  fontFamily: 'sans-serif',
                  fontWeight: 850,
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                ← Zurück
              </button>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !canGenerate}
                style={{
                  flex: 2,
                  padding: 15,
                  borderRadius: 16,
                  border: 'none',
                  background:
                    loading || !canGenerate
                      ? '#EEE7E2'
                      : 'linear-gradient(135deg,#FF8C69,#FF6B9D)',
                  color:
                    loading || !canGenerate ? '#BCA99D' : '#fff',
                  fontFamily: 'sans-serif',
                  fontWeight: 900,
                  cursor:
                    loading || !canGenerate ? 'default' : 'pointer',
                  boxShadow:
                    loading || !canGenerate
                      ? 'none'
                      : '0 8px 22px rgba(255,107,157,.22)',
                }}
              >
                {loading ? '⏳ Plan wird erstellt…' : 'Trainingsplan erstellen →'}
              </button>
            </div>

            {loading && (
              <p
                style={{
                  textAlign: 'center',
                  fontSize: 10.5,
                  color: '#AD988C',
                  marginTop: 11,
                  fontFamily: 'sans-serif',
                }}
              >
                Einen Moment – dein Plan wird vorbereitet.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
