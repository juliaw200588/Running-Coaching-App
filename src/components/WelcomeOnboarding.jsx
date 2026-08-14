import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const SPORT_OPTIONS = [
  {
    id: 'running',
    icon: '🏃',
    label: 'Laufen',
    sub: 'Läufe, Wettkämpfe und deine Entwicklung',
  },
  {
    id: 'cycling',
    icon: '🚴',
    label: 'Radfahren',
    sub: 'Straße, Gravel und längere Touren',
  },
  {
    id: 'mountain_biking',
    icon: '🚵',
    label: 'Mountainbike',
    sub: 'Trails, Höhenmeter und Ausdauer',
  },
  {
    id: 'hiking',
    icon: '🥾',
    label: 'Wandern & Marsch',
    sub: 'Lange Distanzen und gemeinsame Ziele',
  },
  {
    id: 'swimming',
    icon: '🏊',
    label: 'Schwimmen',
    sub: 'Ausdauer, Technik und längere Strecken',
  },
]

const GENDER_OPTIONS = [
  { id: 'w', icon: '♀', label: 'Weiblich' },
  { id: 'm', icon: '♂', label: 'Männlich' },
  { id: 'd', icon: '○', label: 'Neutral / keine Angabe' },
]

export default function WelcomeOnboarding({ user, onCompleted }) {
  const defaultName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    ''

  const [name, setName] = useState(defaultName)
  const [geschlecht, setGeschlecht] = useState('')
  const [sportarten, setSportarten] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const canFinish = useMemo(
    () =>
      Boolean(name.trim()) &&
      Boolean(geschlecht) &&
      sportarten.length > 0,
    [name, geschlecht, sportarten]
  )

  const toggleSport = sportId => {
    setSportarten(current =>
      current.includes(sportId)
        ? current.filter(id => id !== sportId)
        : [...current, sportId]
    )
  }

  const handleFinish = async () => {
    if (!canFinish || !user?.id) return

    setSaving(true)
    setError(null)

    try {
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          name: name.trim(),
          geschlecht,
          sportarten,
          onboarding_completed: true,
        })

      if (saveError) throw saveError

      onCompleted?.({
        name: name.trim(),
        geschlecht,
        sportarten,
      })
    } catch (saveError) {
      console.error(
        '[WelcomeOnboarding] Profil konnte nicht gespeichert werden:',
        saveError
      )
      setError(
        'Deine Angaben konnten gerade nicht gespeichert werden. Bitte versuche es erneut.'
      )
    } finally {
      setSaving(false)
    }
  }

  const cardStyle = {
    background: 'white',
    borderRadius: 24,
    padding: 22,
    border: '1px solid #F0E4DC',
    boxShadow: '0 10px 34px rgba(78,54,40,0.08)',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(160deg, #FFF8F0 0%, #F0FAF4 52%, #FFF0F5 100%)',
        color: '#3D2B1F',
        fontFamily: "'Georgia', 'Times New Roman', serif",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '34px 18px 44px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <img
            src="/route-icon.png"
            alt=""
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              marginBottom: 12,
              boxShadow: '0 8px 24px rgba(255,140,105,0.22)',
            }}
          />

          <div
            style={{
              fontFamily: 'sans-serif',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1.35,
              color: '#C77861',
              marginBottom: 7,
            }}
          >
            WILLKOMMEN
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 31,
              lineHeight: 1.08,
            }}
          >
            Mach die App zu deiner.
          </h1>

          <p
            style={{
              maxWidth: 410,
              margin: '11px auto 0',
              color: '#8B7467',
              fontFamily: 'sans-serif',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Ein paar Angaben reichen für den Start. Einen Trainingsplan
            kannst du jederzeit später hinzufügen.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <section style={cardStyle}>
            <div
              style={{
                fontFamily: 'sans-serif',
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1,
                color: '#B69C8D',
                marginBottom: 7,
              }}
            >
              1 · WIE DÜRFEN WIR DICH NENNEN?
            </div>

            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Dein Name"
              autoComplete="given-name"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1.5px solid #EADDD5',
                background: '#FFF9F5',
                borderRadius: 14,
                padding: '13px 15px',
                fontSize: 16,
                color: '#3D2B1F',
                outline: 'none',
                fontFamily: 'sans-serif',
              }}
            />
          </section>

          <section style={cardStyle}>
            <div
              style={{
                fontFamily: 'sans-serif',
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1,
                color: '#B69C8D',
                marginBottom: 10,
              }}
            >
              2 · WELCHES PROFIL PASST ZU DIR?
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {GENDER_OPTIONS.map(option => {
                const selected = geschlecht === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setGeschlecht(option.id)}
                    style={{
                      minHeight: 84,
                      borderRadius: 15,
                      border: `2px solid ${
                        selected ? '#FF8C69' : '#EFE4DD'
                      }`,
                      background: selected ? '#FFF3ED' : '#fff',
                      color: selected ? '#D8684D' : '#765F52',
                      cursor: 'pointer',
                      padding: '10px 7px',
                    }}
                  >
                    <div style={{ fontSize: 23, marginBottom: 6 }}>
                      {option.icon}
                    </div>
                    <div
                      style={{
                        fontFamily: 'sans-serif',
                        fontSize: 10,
                        fontWeight: 800,
                        lineHeight: 1.25,
                      }}
                    >
                      {option.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section style={cardStyle}>
            <div
              style={{
                fontFamily: 'sans-serif',
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1,
                color: '#B69C8D',
                marginBottom: 6,
              }}
            >
              3 · WELCHE SPORTARTEN GEHÖREN ZU DIR?
            </div>

            <p
              style={{
                margin: '0 0 13px',
                fontFamily: 'sans-serif',
                fontSize: 11,
                lineHeight: 1.5,
                color: '#A18B7E',
              }}
            >
              Mehrfachauswahl möglich. Du kannst das später jederzeit
              in deinem Profil ändern.
            </p>

            <div style={{ display: 'grid', gap: 9 }}>
              {SPORT_OPTIONS.map(option => {
                const selected = sportarten.includes(option.id)

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleSport(option.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '42px 1fr 24px',
                      gap: 11,
                      alignItems: 'center',
                      textAlign: 'left',
                      borderRadius: 16,
                      border: `2px solid ${
                        selected ? '#7EC8A4' : '#EFE6E0'
                      }`,
                      background: selected ? '#F2FAF5' : '#fff',
                      padding: '11px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 13,
                        display: 'grid',
                        placeItems: 'center',
                        background: selected ? '#E2F3E8' : '#FFF6F1',
                        fontSize: 21,
                      }}
                    >
                      {option.icon}
                    </div>

                    <div>
                      <div
                        style={{
                          fontFamily: 'sans-serif',
                          fontSize: 13,
                          fontWeight: 850,
                          color: '#463328',
                        }}
                      >
                        {option.label}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontFamily: 'sans-serif',
                          fontSize: 10,
                          lineHeight: 1.35,
                          color: '#A48D80',
                        }}
                      >
                        {option.sub}
                      </div>
                    </div>

                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        background: selected ? '#69B88D' : '#F2EAE5',
                        color: '#fff',
                        fontSize: 12,
                        fontFamily: 'sans-serif',
                        fontWeight: 900,
                      }}
                    >
                      {selected ? '✓' : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: '11px 14px',
              borderRadius: 13,
              background: '#FDECEA',
              border: '1px solid #F5C4CC',
              color: '#B85464',
              fontFamily: 'sans-serif',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleFinish}
          disabled={!canFinish || saving}
          style={{
            width: '100%',
            marginTop: 18,
            padding: '16px 18px',
            borderRadius: 18,
            border: 'none',
            background:
              canFinish && !saving
                ? 'linear-gradient(135deg,#FF8C69,#FF6B9D)'
                : '#EDE5DF',
            color: canFinish && !saving ? '#fff' : '#B7A399',
            boxShadow:
              canFinish && !saving
                ? '0 10px 28px rgba(255,107,157,0.25)'
                : 'none',
            cursor: canFinish && !saving ? 'pointer' : 'default',
            fontFamily: 'sans-serif',
            fontWeight: 900,
            fontSize: 15,
          }}
        >
          {saving ? '⏳ Wird eingerichtet…' : 'App einrichten →'}
        </button>

        <p
          style={{
            textAlign: 'center',
            margin: '12px 18px 0',
            color: '#B09C91',
            fontFamily: 'sans-serif',
            fontSize: 10.5,
            lineHeight: 1.45,
          }}
        >
          Du startest ohne Trainingsplan. Einen Plan kannst du später
          über deinen Trainingsbereich hinzufügen.
        </p>
      </div>
    </div>
  )
}
