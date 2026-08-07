import { useEffect, useMemo, useState } from 'react'

const RARITY_META = {
  common: { label: 'Gewöhnlich', accent: '#B7AAA1' },
  special: { label: 'Besonders', accent: '#6FAF86' },
  rare: { label: 'Selten', accent: '#6B94D6' },
  epic: { label: 'Außergewöhnlich', accent: '#9B73C4' },
  legendary: { label: 'Legendär', accent: '#D89A42' },
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

export default function AchievementUnlockModal({
  open,
  achievements = [],
  onClose,
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  const current = achievements[index] || null
  const rarity = useMemo(
    () => RARITY_META[current?.rarity] || RARITY_META.common,
    [current]
  )

  if (!open || !current) return null

  const total = achievements.length
  const isLast = index >= total - 1

  const next = () => {
    if (isLast) {
      onClose?.()
      return
    }
    setIndex(previous => previous + 1)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'grid',
        placeItems: 'center',
        padding: 18,
        background: 'rgba(42,28,20,0.66)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <style>{`
        @keyframes achievementPop {
          0% { transform: translateY(22px) scale(.94); opacity: 0; }
          70% { transform: translateY(-3px) scale(1.01); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes achievementPulse {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 390,
          borderRadius: 28,
          padding: '26px 22px 20px',
          background:
            'linear-gradient(145deg,#FFFDF9 0%,#FFF4ED 48%,#F4FBF7 100%)',
          border: `1px solid ${rarity.accent}44`,
          boxShadow: '0 24px 70px rgba(61,43,31,0.26)',
          textAlign: 'center',
          fontFamily: 'sans-serif',
          animation: 'achievementPop 360ms ease-out',
        }}
      >
        <div
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: '#AA8F7D',
            fontWeight: 'bold',
          }}
        >
          {total > 1
            ? `${total} neue Erfolge · ${index + 1} von ${total}`
            : 'Neuer Erfolg'}
        </div>

        <div
          style={{
            width: 86,
            height: 86,
            margin: '18px auto 12px',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 40,
            background: `${rarity.accent}18`,
            border: `2px solid ${rarity.accent}55`,
            boxShadow: `0 12px 34px ${rarity.accent}22`,
            animation: 'achievementPulse 900ms ease-in-out',
          }}
        >
          {current.icon}
        </div>

        <div
          style={{
            display: 'inline-block',
            marginBottom: 10,
            padding: '5px 9px',
            borderRadius: 999,
            background: `${rarity.accent}18`,
            color: rarity.accent,
            fontSize: 9,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          {rarity.label}
        </div>

        <div
          style={{
            fontFamily: "'Georgia','Times New Roman',serif",
            fontSize: 24,
            lineHeight: 1.16,
            color: '#3D2B1F',
            fontWeight: 'bold',
          }}
        >
          {current.title}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12.5,
            lineHeight: 1.55,
            color: '#876F61',
            fontStyle: 'italic',
          }}
        >
          {current.story || current.description}
        </div>

        {current.unlockedAt && (
          <div
            style={{
              marginTop: 17,
              padding: '11px 13px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid #EFE3DA',
              color: '#9A8476',
              fontSize: 10.5,
            }}
          >
            Erreicht am {formatDate(current.unlockedAt)}
          </div>
        )}

        <button
          type="button"
          onClick={next}
          style={{
            width: '100%',
            marginTop: 18,
            padding: '13px 14px',
            border: 'none',
            borderRadius: 15,
            background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)',
            color: 'white',
            fontSize: 13,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {isLast ? 'Fertig' : 'Weiter'}
        </button>
      </div>
    </div>
  )
}
