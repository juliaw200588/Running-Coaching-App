import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const ENVIRONMENT_OPTIONS = [
  ['forest', '🌲', 'Wald'],
  ['coast', '🌊', 'Küste'],
  ['mountain', '🏔️', 'Berge'],
  ['field', '🌾', 'Feld & Wiese'],
  ['beach', '🏖️', 'Strand'],
]

const WEATHER_LABELS = {
  sun: ['☀️', 'Sonne'],
  clouds: ['☁️', 'Bewölkt'],
  rain: ['🌧️', 'Regen'],
  snow: ['❄️', 'Schnee'],
  fog: ['🌫️', 'Nebel'],
  wind: ['💨', 'Wind'],
}

const SUN_LABELS = {
  sunrise: ['🌅', 'Sonnenaufgang'],
  sunset: ['🌄', 'Sonnenuntergang'],
  night: ['🌙', 'Nacht'],
  day: ['☀️', 'Tag'],
}

function contextObject(value) {
  if (!value) return {}

  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

export default function ActivityContextEditor({
  user,
  logId,
  activityContext,
  onSaved,
}) {
  const initial = useMemo(
    () => contextObject(activityContext),
    [activityContext]
  )

  const initialManualTags =
    initial?.environment?.manual_tags || []

  const [manualTags, setManualTags] = useState(
    initialManualTags
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const context = contextObject(activityContext)
  const automaticTags =
    context?.environment?.auto_tags || []
  const weatherTags =
    context?.weather?.tags || []
  const sunPhase =
    context?.sun?.phase || null

  const toggle = key => {
    setManualTags(previous =>
      previous.includes(key)
        ? previous.filter(item => item !== key)
        : [...previous, key]
    )
  }

  const save = async () => {
    if (!user?.id || !logId) return

    setSaving(true)
    setMessage(null)

    try {
      const nextContext = {
        ...context,
        environment: {
          ...(context.environment || {}),
          manual_tags: manualTags,
        },
      }

      const { error } = await supabase
        .from('logs')
        .update({
          activity_context: nextContext,
        })
        .eq('id', logId)
        .eq('user_id', user.id)

      if (error) throw error

      setMessage('Gespeichert')
      onSaved?.(nextContext)
    } catch (error) {
      console.error(
        'Aktivitätsumgebung konnte nicht gespeichert werden:',
        error
      )
      setMessage('Speichern nicht möglich')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 15,
        background: '#FAF6F2',
        border: '1px solid #EEE3DB',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 'bold',
          color: '#5C3D2E',
          marginBottom: 3,
        }}
      >
        🌿 Unterwegs erlebt
      </div>

      <div
        style={{
          fontSize: 9.5,
          color: '#A18A7C',
          lineHeight: 1.45,
          marginBottom: 11,
        }}
      >
        Wetter und Tageszeit werden automatisch ergänzt.
        Landschaften kannst du bei Bedarf bestätigen oder ergänzen.
      </div>

      {(weatherTags.length > 0 || sunPhase) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 12,
          }}
        >
          {weatherTags.map(tag => {
            const meta = WEATHER_LABELS[tag]
            if (!meta) return null

            return (
              <span
                key={tag}
                style={{
                  padding: '5px 8px',
                  borderRadius: 999,
                  background: '#EEF7F2',
                  color: '#4C8566',
                  fontSize: 9,
                  fontWeight: 'bold',
                }}
              >
                {meta[0]} {meta[1]}
              </span>
            )
          })}

          {sunPhase && SUN_LABELS[sunPhase] && (
            <span
              style={{
                padding: '5px 8px',
                borderRadius: 999,
                background: '#FFF4E6',
                color: '#B77837',
                fontSize: 9,
                fontWeight: 'bold',
              }}
            >
              {SUN_LABELS[sunPhase][0]}{' '}
              {SUN_LABELS[sunPhase][1]}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          fontSize: 9,
          color: '#A18A7C',
          marginBottom: 7,
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Landschaft
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 7,
        }}
      >
        {ENVIRONMENT_OPTIONS.map(([key, icon, label]) => {
          const selected =
            manualTags.includes(key) ||
            automaticTags.includes(key)

          const automatic = automaticTags.includes(key)

          return (
            <button
              key={key}
              type="button"
              disabled={automatic}
              onClick={() => toggle(key)}
              style={{
                padding: '7px 9px',
                borderRadius: 999,
                border: selected
                  ? '1.5px solid #6FAF86'
                  : '1px solid #E2D7D0',
                background: selected
                  ? '#EDF8F1'
                  : '#FFFFFF',
                color: selected
                  ? '#4C8566'
                  : '#927D70',
                fontSize: 9.5,
                fontWeight: 'bold',
                cursor: automatic
                  ? 'default'
                  : 'pointer',
                opacity: automatic ? 0.8 : 1,
              }}
            >
              {icon} {label}
              {automatic ? ' · erkannt' : ''}
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          marginTop: 11,
        }}
      >
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: 'none',
            background: saving
              ? '#E8DED7'
              : 'linear-gradient(135deg,#7EC8A4,#5BA88A)',
            color: saving ? '#A18A7C' : 'white',
            fontSize: 10,
            fontWeight: 'bold',
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Speichere…' : 'Speichern'}
        </button>

        {message && (
          <span
            style={{
              fontSize: 9.5,
              color:
                message === 'Gespeichert'
                  ? '#5B9273'
                  : '#B85464',
            }}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  )
}
