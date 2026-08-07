import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { loadAndEvaluateAchievements } from '../lib/achievementService.js'
import {
  ACHIEVEMENT_CATEGORIES,
  SPORT_META,
} from '../lib/achievementDefinitions.js'


const RARITY_META = {
  common: { label: 'Gewöhnlich', accent: '#B7AAA1' },
  special: { label: 'Besonders', accent: '#6FAF86' },
  rare: { label: 'Selten', accent: '#6B94D6' },
  epic: { label: 'Außergewöhnlich', accent: '#9B73C4' },
  legendary: { label: 'Legendär', accent: '#D89A42' },
}

const isNewAchievement = unlockedAt => {
  if (!unlockedAt) return false
  const unlocked = new Date(unlockedAt)
  if (Number.isNaN(unlocked.getTime())) return false
  return Date.now() - unlocked.getTime() <= 7 * 24 * 60 * 60 * 1000
}

const CATEGORY_ORDER = [
  'all',
  'milestones',
  'performance',
  'consistency',
  'development',
  'moments',
]

const SPORT_ORDER = [
  'all',
  'running',
  'cycling',
  'mountain_biking',
  'hiking',
  'swimming',
]

const CATEGORY_META = {
  all: { label: 'Übersicht', icon: '🏆' },
  ...ACHIEVEMENT_CATEGORIES,
}

const formatDate = value => {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatNumber = value =>
  Number(value || 0).toLocaleString('de-DE', {
    maximumFractionDigits: 1,
  })


const formatPaceSeconds = value => {
  const total = Number(value)
  if (!Number.isFinite(total)) return null

  const minutes = Math.floor(total / 60)
  const seconds = String(Math.round(total % 60)).padStart(2, '0')
  return `${minutes}:${seconds} min/km`
}

const formatProgressValue = (value, unit) => {
  if (value == null) return '0'

  const formatted = formatNumber(value)
  return unit ? `${formatted} ${unit}` : formatted
}


const getProgressText = achievement => {
  if (!achievement?.progress) return null

  const { current, target, remaining } = achievement.progress

  if (achievement.metric === 'pace_under_seconds') {
    const targetPace = formatPaceSeconds(target)

    if (achievement.unlocked) {
      return `${targetPace} erreicht`
    }

    if (current == null) {
      return `Noch kein Lauf über mindestens ${achievement.minDistanceKm || 3} km mit verwertbarer Pace.`
    }

    const currentPace = formatPaceSeconds(current)
    const secondsRemaining = Math.max(
      0,
      Math.ceil(remaining || 0)
    )

    return `Beste Pace bisher: ${currentPace} · Noch ${secondsRemaining} Sek./km bis unter ${targetPace.replace(' min/km', '')}`
  }

  const unit = achievement.unit || ''

  if (achievement.unlocked) {
    return `${formatProgressValue(target, unit)} erreicht`
  }

  if (typeof target !== 'number') return null

  return `${formatProgressValue(current, unit)} von ${formatProgressValue(
    target,
    unit
  )}`
}

const getCardState = achievement => {
  if (achievement.unlocked) return 'unlocked'
  if (achievement.visibility === 'secret') return 'secret'
  if (achievement.visibility === 'hinted') return 'hinted'
  return 'locked'
}

function ProgressBar({ percent = 0, unlocked = false }) {
  return (
    <div
      style={{
        width: '100%',
        height: 7,
        borderRadius: 999,
        background: '#F1E8E1',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, percent))}%`,
          height: '100%',
          borderRadius: 999,
          background: unlocked
            ? 'linear-gradient(90deg,#77C39A,#4EAB7A)'
            : 'linear-gradient(90deg,#FFB47A,#FF7D74)',
          transition: 'width 0.35s ease',
        }}
      />
    </div>
  )
}

function AchievementCard({ achievement }) {
  const state = getCardState(achievement)
  const unlockedDate = formatDate(achievement.unlockedAt)
  const rarity =
    RARITY_META[achievement.rarity] || RARITY_META.common
  const isNew =
    achievement.unlocked && isNewAchievement(achievement.unlockedAt)

  if (state === 'secret') {
    return (
      <div
        style={{
          minHeight: 170,
          borderRadius: 18,
          padding: 16,
          background:
            'linear-gradient(145deg,rgba(248,244,241,0.96),rgba(235,229,225,0.96))',
          border: '1px solid #E7DDD6',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          fontFamily: 'sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#E8DFD8',
            display: 'grid',
            placeItems: 'center',
            fontSize: 23,
            marginBottom: 10,
          }}
        >
          ❓
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 'bold',
            color: '#7F6D62',
          }}
        >
          Verborgener Erfolg
        </div>

        <div
          style={{
            marginTop: 5,
            fontSize: 11,
            color: '#AA9A90',
            lineHeight: 1.4,
          }}
        >
          Wird sichtbar, wenn du ihn entdeckst.
        </div>
      </div>
    )
  }

  const isUnlocked = state === 'unlocked'
  const isHinted = state === 'hinted'

  return (
    <div
      style={{
        minHeight: 170,
        borderRadius: 18,
        padding: 15,
        background: isUnlocked
          ? 'linear-gradient(145deg,#FFFFFF 0%,#FFF9F3 100%)'
          : '#FFFFFF',
        border: isUnlocked
          ? '1px solid #F4D8B9'
          : '1px solid #EDE4DE',
        boxShadow: isUnlocked
          ? '0 8px 22px rgba(157,112,74,0.10)'
          : 'none',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
        opacity: isHinted ? 0.9 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            flexShrink: 0,
            borderRadius: 13,
            display: 'grid',
            placeItems: 'center',
            fontSize: 21,
            background: isUnlocked ? '#FFF0DE' : '#F5F0EC',
          }}
        >
          {isHinted && !isUnlocked ? '✨' : achievement.icon}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isNew && (
            <div
              style={{
                padding: '4px 7px',
                borderRadius: 999,
                background: '#FFF0D9',
                color: '#C17A3A',
                fontSize: 9,
                fontWeight: 'bold',
              }}
            >
              ✨ NEU
            </div>
          )}

        <div
          style={{
            padding: '4px 7px',
            borderRadius: 999,
            background: isUnlocked ? '#EAF8F0' : '#F5F0EC',
            color: isUnlocked ? '#3E8B66' : '#9B897E',
            fontSize: 9,
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
          }}
        >
          {isUnlocked ? '✓ ERREICHT' : 'NOCH OFFEN'}
        </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 11,
          fontSize: 14,
          lineHeight: 1.25,
          fontWeight: 'bold',
          color: '#3D2B1F',
        }}
      >
        {isHinted && !isUnlocked ? achievement.title : achievement.title}
      </div>

      <div
        style={{
          marginTop: 5,
          minHeight: 30,
          fontSize: 10.5,
          lineHeight: 1.45,
          color: '#947F71',
        }}
      >
        {isHinted && !isUnlocked ? (
          'Die genaue Bedingung bleibt noch verborgen.'
        ) : (
          <>
            <div
              style={{
                color: '#8E6F5F',
                lineHeight: 1.48,
              }}
            >
              {achievement.story || achievement.description}
            </div>

            {achievement.story &&
              achievement.description &&
              achievement.story !== achievement.description && (
                <div
                  style={{
                    marginTop: 6,
                    color: '#B09A8C',
                    fontSize: 9.4,
                    lineHeight: 1.4,
                  }}
                >
                  {achievement.description}
                </div>
              )}
          </>
        )}
      </div>

      <div
        style={{
          marginTop: 8,
          display: 'inline-flex',
          alignSelf: 'flex-start',
          padding: '4px 7px',
          borderRadius: 999,
          background: `${rarity.accent}14`,
          color: rarity.accent,
          fontSize: 8.5,
          fontWeight: 'bold',
        }}
      >
        {rarity.label}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 10 }}>
        {!isUnlocked && !isHinted && (
          <>
            <ProgressBar percent={achievement.progress?.percent || 0} />
            <div
              style={{
                marginTop: 6,
                fontSize: 9.5,
                color: '#A59184',
              }}
            >
              {getProgressText(achievement)}
            </div>
          </>
        )}

        {isHinted && !isUnlocked && (
          <div
            style={{
              fontSize: 9.5,
              color: '#A59184',
            }}
          >
            Entdecke diesen Erfolg auf deinem Weg.
          </div>
        )}

        {isUnlocked && (
          <div
            style={{
              fontSize: 9.5,
              color: '#4E9870',
              fontWeight: 'bold',
            }}
          >
            {unlockedDate
              ? `Erreicht am ${unlockedDate}`
              : 'Erreicht'}
          </div>
        )}
      </div>
    </div>
  )
}

function NextAchievement({ achievement }) {
  if (!achievement) return null

  const remaining = achievement.progress?.remaining
  const unit = achievement.unit || ''

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg,#FFF6EC 0%,#FFF0F4 52%,#F1FAF5 100%)',
        border: '1px solid #F2DDD0',
        borderRadius: 18,
        padding: 15,
        marginBottom: 15,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#A78773',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: 0.7,
        }}
      >
        Nächster Erfolg
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          marginTop: 9,
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            fontSize: 23,
            background: 'rgba(255,255,255,0.78)',
          }}
        >
          {achievement.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              color: '#3D2B1F',
              fontWeight: 'bold',
            }}
          >
            {achievement.title}
          </div>

          <div
            style={{
              marginTop: 3,
              fontSize: 10,
              color: '#967F70',
            }}
          >
            {remaining != null
              ? `Noch ${formatProgressValue(remaining, unit)}`
              : achievement.story || achievement.description}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 11 }}>
        <ProgressBar percent={achievement.progress?.percent || 0} />
      </div>
    </div>
  )
}

export default function Achievements({ user }) {
  const [loading, setLoading] = useState(true)
  const [evaluation, setEvaluation] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [sportFilter, setSportFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    if (!user?.id) return undefined

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setErrorMessage(null)

      try {
        const result = await loadAndEvaluateAchievements({
          supabase,
          userId: user.id,
        })

        if (!cancelled) {
          setEvaluation(result)
        }
      } catch (error) {
        console.error('Erfolge konnten nicht geladen werden:', error)

        if (!cancelled) {
          setErrorMessage(
            'Die Erfolge konnten gerade nicht geladen werden.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const activeSports = useMemo(() => {
    const sports = evaluation?.activeSports || []

    return SPORT_ORDER.filter(
      sport => sport === 'all' || sports.includes(sport)
    )
  }, [evaluation])

  const visibleAchievements = useMemo(() => {
    const achievements = evaluation?.achievements || []

    return achievements.filter(achievement => {
      const sportMatches =
        sportFilter === 'all' || achievement.sport === sportFilter

      const categoryMatches =
        categoryFilter === 'all' ||
        achievement.category === categoryFilter

      return sportMatches && categoryMatches
    })
  }, [evaluation, sportFilter, categoryFilter])

  const nextAchievement = useMemo(() => {
    return (evaluation?.locked || [])
      .filter(achievement => achievement.visibility !== 'secret')
      .filter(
        achievement =>
          sportFilter === 'all' || achievement.sport === sportFilter
      )
      .sort(
        (a, b) =>
          (b.progress?.percent || 0) - (a.progress?.percent || 0)
      )[0]
  }, [evaluation, sportFilter])

  if (loading) {
    return (
      <div
        style={{
          padding: '52px 20px',
          textAlign: 'center',
          color: '#A88F80',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>🏆</div>
        <div style={{ fontSize: 12 }}>Erfolge werden ausgewertet…</div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div
        style={{
          padding: '36px 18px',
          textAlign: 'center',
          color: '#B85464',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontSize: 12 }}>{errorMessage}</div>
      </div>
    )
  }

  const unlockedCount = evaluation?.summary?.unlocked || 0
  const totalCount = evaluation?.summary?.total || 0
  const percent = evaluation?.summary?.percent || 0

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <div
        style={{
          borderRadius: 20,
          padding: 17,
          marginBottom: 14,
          background:
            'linear-gradient(135deg,#FFF4E8 0%,#FFF1F5 55%,#EFF9F3 100%)',
          border: '1px solid #F1DDD0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 'bold',
                color: '#3D2B1F',
              }}
            >
              🏆 Deine Erfolge
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                color: '#947F71',
                lineHeight: 1.4,
              }}
            >
              Eine Sammlung deiner persönlichen Meilensteine.
            </div>
          </div>

          <div
            style={{
              minWidth: 58,
              padding: '8px 9px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.72)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: '#C26A50',
              }}
            >
              {percent} %
            </div>

            <div
              style={{
                marginTop: 2,
                fontSize: 8.5,
                color: '#A78D7D',
              }}
            >
              freigeschaltet
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <ProgressBar percent={percent} unlocked={percent === 100} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              color: '#A18A7B',
              fontSize: 9.5,
            }}
          >
            <span>{unlockedCount} freigeschaltet</span>
            <span>{totalCount} verfügbar</span>
          </div>
        </div>
      </div>

      <NextAchievement achievement={nextAchievement} />

      <div
        style={{
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
          paddingBottom: 6,
          marginBottom: 8,
          scrollbarWidth: 'none',
        }}
      >
        {activeSports.map(sport => {
          const meta = SPORT_META[sport]
          const active = sportFilter === sport

          return (
            <button
              key={sport}
              type="button"
              onClick={() => setSportFilter(sport)}
              style={{
                flex: '0 0 auto',
                padding: '8px 11px',
                borderRadius: 999,
                border: active
                  ? '1.5px solid #FF8C69'
                  : '1px solid #E7DDD6',
                background: active ? '#FFF2EB' : '#FFFFFF',
                color: active ? '#C16045' : '#89756A',
                fontSize: 10,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {meta?.icon} {meta?.label}
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 7,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 11,
          scrollbarWidth: 'none',
        }}
      >
        {CATEGORY_ORDER.map(category => {
          const meta = CATEGORY_META[category]
          const active = categoryFilter === category

          return (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              style={{
                flex: '0 0 auto',
                padding: '7px 10px',
                borderRadius: 10,
                border: active
                  ? '1.5px solid #A98BC2'
                  : '1px solid #E8E0EA',
                background: active ? '#F7F1FC' : '#FFFFFF',
                color: active ? '#75578D' : '#917E9D',
                fontSize: 9.5,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {meta?.icon} {meta?.label}
            </button>
          )
        })}
      </div>

      {visibleAchievements.length === 0 ? (
        <div
          style={{
            padding: '38px 18px',
            textAlign: 'center',
            borderRadius: 18,
            background: '#FFFFFF',
            border: '1px solid #EEE5DF',
            color: '#A38E81',
            fontSize: 11,
          }}
        >
          In diesem Bereich sind noch keine Erfolge verfügbar.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          {visibleAchievements.map(achievement => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
            />
          ))}
        </div>
      )}
    </div>
  )
}
