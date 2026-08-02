import React, { useState } from 'react'

const formatDuration = (seconds) => {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value < 0) return '–'

  const minutes = Math.floor(value / 60)
  const secs = Math.round(value % 60)

  return `${minutes}:${String(secs).padStart(2, '0')} min`
}

export default function SplitAccordion({
  splits = [],
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen)

  if (!Array.isArray(splits) || splits.length === 0) return null

  return (
    <div
      style={{
        marginBottom: 18,
        border: '1px solid #F0E8E0',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'white',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        style={{
          width: '100%',
          border: 'none',
          background: '#FFF8F5',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 'bold',
              color: '#8B6B5A',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Kilometer-Splits
          </div>

          <div
            style={{
              fontSize: 10,
              color: '#B8A090',
              marginTop: 2,
            }}
          >
            {splits.length} vollständige Kilometer
          </div>
        </div>

        <div
          style={{
            color: '#C4A882',
            fontSize: 16,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </div>
      </button>

      {open && (
        <div>
          {splits.map((split, index) => {
            const isLast = index === splits.length - 1

            return (
              <div
                key={split?.km ?? index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '54px minmax(0,1fr) minmax(0,1fr)',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  borderBottom: isLast ? 'none' : '1px solid #F5EDE8',
                  fontFamily: 'sans-serif',
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    color: '#8B6B5A',
                    fontWeight: 'bold',
                  }}
                >
                  km {split?.km ?? index + 1}
                </span>

                <span
                  style={{
                    color: '#3D2B1F',
                    fontWeight: 'bold',
                  }}
                >
                  {split?.pace || formatDuration(split?.dauerSek)}
                </span>

                <span
                  style={{
                    color: '#B85464',
                    textAlign: 'right',
                  }}
                >
                  {split?.hfAvg != null ? `❤️ ${split.hfAvg}` : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
