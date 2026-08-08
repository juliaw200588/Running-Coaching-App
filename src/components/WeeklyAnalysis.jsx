const STATUS_META = {
  excellent: { icon: '🔥', label: 'Starke Woche', bg: '#FFF1E7', color: '#C66B43' },
  good: { icon: '✅', label: 'Gute Woche', bg: '#EDF8F2', color: '#4E8D69' },
  solid: { icon: '💪', label: 'Solide Woche', bg: '#F2F5FC', color: '#657BAA' },
  recovery_needed: { icon: '😴', label: 'Erholung im Fokus', bg: '#F5F0FB', color: '#8469A0' },
  attention: { icon: '⚠️', label: 'Achtsam steuern', bg: '#FFF4E4', color: '#B47B32' },
}

const TREND_ICON = {
  up: '↗',
  stable: '→',
  down: '↘',
  unclear: '·',
}

function Section({ title, icon, children, accent = '#8B6B5A' }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 16,
        background: '#FFFFFF',
        border: '1px solid #EFE5DE',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 'bold',
          color: accent,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          fontFamily: 'sans-serif',
        }}
      >
        {icon} {title}
      </div>
      {children}
    </div>
  )
}

export default function WeeklyAnalysis({
  analysis,
  weekNumber,
  onClose,
}) {
  if (!analysis) return null

  const data =
    analysis.analysis_data?.coach ||
    analysis.analysis_data?.coachResponse ||
    null

  if (!data) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 150,
          background: 'rgba(60,30,20,0.42)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 560,
            maxHeight: '88vh',
            overflowY: 'auto',
            borderRadius: '28px 28px 0 0',
            background: '#FFFDFC',
            padding: '22px 20px 42px',
          }}
        >
          <div style={{ width: 38, height: 4, borderRadius: 99, background: '#EADFD7', margin: '0 auto 18px' }} />
          <h3 style={{ margin: 0, color: '#3D2B1F', fontSize: 20 }}>
            📊 Woche {weekNumber}
          </h3>
          <p style={{ color: '#8B6B5A', lineHeight: 1.6, fontSize: 13 }}>
            {analysis.analysis}
          </p>
          {analysis.recommendation && (
            <p style={{ color: '#5B9273', lineHeight: 1.6, fontSize: 13 }}>
              {analysis.recommendation}
            </p>
          )}
          <button
            onClick={onClose}
            style={{
              width: '100%',
              marginTop: 16,
              padding: 13,
              borderRadius: 14,
              border: 'none',
              background: '#F5EDE8',
              color: '#8B6B5A',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Schließen
          </button>
        </div>
      </div>
    )
  }

  const status =
    STATUS_META[data.weekVerdict?.status] ||
    STATUS_META.solid

  const confidenceLabel =
    data.confidence?.level === 'high'
      ? 'Hohe Datenbasis'
      : data.confidence?.level === 'medium'
        ? 'Mittlere Datenbasis'
        : 'Eingeschränkte Datenbasis'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        background: 'rgba(60,30,20,0.42)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: '28px 28px 0 0',
          background: 'linear-gradient(180deg,#FFFDFC,#FFF8F3)',
          padding: '18px 18px 44px',
          boxShadow: '0 -12px 42px rgba(84,51,35,0.18)',
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 99, background: '#EADFD7', margin: '0 auto 16px' }} />

        <div
          style={{
            padding: 17,
            borderRadius: 19,
            background: status.bg,
            border: `1px solid ${status.color}22`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: '#A18A7C',
                  fontFamily: 'sans-serif',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: 0.7,
                }}
              >
                Wochen-Coach · Woche {weekNumber}
              </div>
              <div
                style={{
                  marginTop: 5,
                  color: '#3D2B1F',
                  fontSize: 19,
                  fontWeight: 'bold',
                  lineHeight: 1.25,
                }}
              >
                {status.icon} {data.weekVerdict?.headline}
              </div>
            </div>

            <span
              style={{
                flexShrink: 0,
                padding: '5px 8px',
                borderRadius: 999,
                background: '#FFFFFFAA',
                color: status.color,
                fontSize: 9,
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
              }}
            >
              {status.label}
            </span>
          </div>

          <div
            style={{
              marginTop: 10,
              color: '#785E50',
              fontSize: 12,
              lineHeight: 1.55,
              fontFamily: 'sans-serif',
            }}
          >
            {data.weekVerdict?.summary}
          </div>
        </div>

        <Section title="Das lief gut" icon="🟢" accent="#4E8D69">
          {(data.positive || []).map((text, index) => (
            <div
              key={index}
              style={{
                fontSize: 11.5,
                lineHeight: 1.5,
                color: '#6F5B50',
                marginTop: index ? 7 : 0,
              }}
            >
              {text}
            </div>
          ))}
        </Section>

        <Section title="Darauf achten" icon="⚠️" accent="#B47B32">
          {(data.attention || []).length ? (
            data.attention.map((text, index) => (
              <div
                key={index}
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: '#6F5B50',
                  marginTop: index ? 7 : 0,
                }}
              >
                {text}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 11.5, color: '#8E7A6E' }}>
              Aktuell kein besonderer Warnpunkt.
            </div>
          )}
        </Section>

        <Section title="Deine Entwicklung" icon="📈" accent="#657BAA">
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: '#6F5B50',
              marginBottom: 9,
            }}
          >
            {data.development?.summary}
          </div>

          {(data.development?.signals || []).map((signal, index) => (
            <div
              key={`${signal.metric}-${index}`}
              style={{
                display: 'flex',
                gap: 8,
                padding: '7px 0',
                borderTop: index ? '1px solid #F2EAE5' : 'none',
              }}
            >
              <span
                style={{
                  width: 22,
                  flexShrink: 0,
                  color:
                    signal.trend === 'up'
                      ? '#4E8D69'
                      : signal.trend === 'down'
                        ? '#B47B32'
                        : '#8E7A6E',
                  fontWeight: 'bold',
                }}
              >
                {TREND_ICON[signal.trend] || '·'}
              </span>
              <div
                style={{
                  fontSize: 10.8,
                  lineHeight: 1.45,
                  color: '#6F5B50',
                }}
              >
                {signal.text}
              </div>
            </div>
          ))}
        </Section>

        <Section title="Warum der Plan so weitergeht" icon="🧠" accent="#80679B">
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              color: '#6F5B50',
            }}
          >
            {data.planDecision?.reason}
          </div>
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 11,
              background: '#F7F2FB',
              color: '#80679B',
              fontSize: 10.5,
              fontWeight: 'bold',
            }}
          >
            {data.adjustmentSummary}
          </div>
        </Section>

        <div
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 18,
            background: 'linear-gradient(135deg,#FFF1E6,#FFF8EF)',
            border: '1px solid #FFDCC3',
          }}
        >
          <div
            style={{
              color: '#C66B43',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.7,
              fontWeight: 'bold',
              fontFamily: 'sans-serif',
            }}
          >
            🎯 Dein Fokus für nächste Woche
          </div>
          <div
            style={{
              marginTop: 5,
              color: '#3D2B1F',
              fontSize: 14,
              fontWeight: 'bold',
            }}
          >
            {data.nextWeekFocus?.title}
          </div>
          <div
            style={{
              marginTop: 5,
              color: '#7A6254',
              fontSize: 11.5,
              lineHeight: 1.5,
            }}
          >
            {data.nextWeekFocus?.text}
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: '9px 11px',
            borderRadius: 12,
            background: '#F7F3F0',
            color: '#9A877A',
            fontSize: 9.5,
            lineHeight: 1.4,
          }}
        >
          <strong>{confidenceLabel}</strong>
          {data.confidence?.reason
            ? ` · ${data.confidence.reason}`
            : ''}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 15,
            padding: 13,
            borderRadius: 14,
            border: 'none',
            background: '#F0E7E1',
            color: '#806D62',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Schließen
        </button>
      </div>
    </div>
  )
}
