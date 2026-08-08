const STATUS_META = {
  excellent: {
    icon: '🔥',
    label: 'Starke Woche',
    bg: 'linear-gradient(135deg,#FFF3E9,#FFF9F3)',
    accent: '#C66B43',
    soft: '#FFF0E4',
  },
  good: {
    icon: '✅',
    label: 'Gute Woche',
    bg: 'linear-gradient(135deg,#F0F9F4,#FBFFFC)',
    accent: '#4E8D69',
    soft: '#EAF6EF',
  },
  solid: {
    icon: '💪',
    label: 'Solide Woche',
    bg: 'linear-gradient(135deg,#F3F6FC,#FBFCFF)',
    accent: '#657BAA',
    soft: '#EEF2FA',
  },
  recovery_needed: {
    icon: '😴',
    label: 'Erholung im Fokus',
    bg: 'linear-gradient(135deg,#F7F1FB,#FEFCFF)',
    accent: '#8469A0',
    soft: '#F1EAF7',
  },
  attention: {
    icon: '⚠️',
    label: 'Achtsam steuern',
    bg: 'linear-gradient(135deg,#FFF5E9,#FFFDF8)',
    accent: '#B47B32',
    soft: '#FFF0D8',
  },
}

const TREND_META = {
  up: {
    icon: '↗',
    label: 'verbessert',
    color: '#4E8D69',
    bg: '#EEF8F2',
  },
  stable: {
    icon: '→',
    label: 'stabil',
    color: '#6F7D89',
    bg: '#F2F5F7',
  },
  down: {
    icon: '↘',
    label: 'beobachten',
    color: '#B47B32',
    bg: '#FFF4E4',
  },
  unclear: {
    icon: '·',
    label: 'noch offen',
    color: '#9A877A',
    bg: '#F7F3F0',
  },
}

const METRIC_LABELS = {
  aerobic_efficiency: 'Aerobe Fitness',
  interval_quality: 'Intervallqualität',
  endurance: 'Ausdauer',
  load_tolerance: 'Belastbarkeit',
  recovery: 'Regeneration',
  running_index: 'Running Index',
  pace: 'Pace',
  heart_rate: 'Herzfrequenz',
  consistency: 'Konstanz',
  cadence: 'Kadenz',
}

function friendlyMetricLabel(metric) {
  if (!metric) return 'Entwicklung'

  if (METRIC_LABELS[metric]) return METRIC_LABELS[metric]

  return String(metric)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function Section({ title, icon, accent, children, background = '#FFFFFF' }) {
  return (
    <div
      style={{
        marginTop: 13,
        padding: 15,
        borderRadius: 18,
        background,
        border: '1px solid #EFE5DE',
        boxShadow: '0 3px 14px rgba(94,68,53,0.035)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 9,
          fontFamily: 'sans-serif',
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 'bold',
            color: accent,
            textTransform: 'uppercase',
            letterSpacing: 0.65,
          }}
        >
          {title}
        </div>
      </div>

      {children}
    </div>
  )
}

function InsightItem({ text, positive = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 7,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 18,
          height: 18,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: positive ? '#EAF6EF' : '#FFF3E1',
          color: positive ? '#4E8D69' : '#B47B32',
          fontSize: 9,
          fontWeight: 'bold',
          marginTop: 1,
        }}
      >
        {positive ? '✓' : '!'}
      </span>

      <div
        style={{
          color: '#6F5B50',
          fontSize: 11.5,
          lineHeight: 1.5,
          fontFamily: 'sans-serif',
        }}
      >
        {text}
      </div>
    </div>
  )
}

export default function WeeklyAnalysis({
  analysis,
  weekNumber,
  onClose,
}) {
  if (!analysis) return null

  const analysisData = analysis.analysis_data || null
  const data =
    analysisData?.coach ||
    analysisData?.coachResponse ||
    null

  const nextWeekNumber = Number(weekNumber) + 1

  // Alte Wochenanalysen ohne analysis_data weiterhin sauber anzeigen.
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
        onClick={onClose}
      >
        <div
          onClick={event => event.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 560,
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '28px 28px 0 0',
            background: '#FFFDFC',
            padding: '18px 20px 42px',
            boxShadow: '0 -12px 42px rgba(84,51,35,0.18)',
          }}
        >
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 99,
              background: '#EADFD7',
              margin: '0 auto 17px',
            }}
          />

          <div
            style={{
              color: '#3D2B1F',
              fontSize: 20,
              fontWeight: 'bold',
              lineHeight: 1.25,
            }}
          >
            🏃 Woche {weekNumber} im Rückblick
          </div>

          <div
            style={{
              marginTop: 4,
              color: '#A18A7C',
              fontSize: 10.5,
              lineHeight: 1.45,
              fontFamily: 'sans-serif',
            }}
          >
            Dein bisheriger Wochenbericht
          </div>

          <Section
            title="Coach-Fazit"
            icon="🔥"
            accent="#C66B43"
            background="linear-gradient(135deg,#FFF5EC,#FFFDFC)"
          >
            <div
              style={{
                color: '#6F5B50',
                fontSize: 12,
                lineHeight: 1.6,
                fontFamily: 'sans-serif',
              }}
            >
              {analysis.analysis}
            </div>
          </Section>

          {analysis.recommendation && (
            <Section
              title={`Fokus für Woche ${nextWeekNumber}`}
              icon="🎯"
              accent="#C66B43"
              background="linear-gradient(135deg,#FFF1E6,#FFF8EF)"
            >
              <div
                style={{
                  color: '#6F5B50',
                  fontSize: 12,
                  lineHeight: 1.6,
                  fontFamily: 'sans-serif',
                }}
              >
                {analysis.recommendation}
              </div>
            </Section>
          )}

          <div
            style={{
              marginTop: 16,
              textAlign: 'center',
              color: '#8B6B5A',
              fontSize: 11,
              fontWeight: 'bold',
              fontFamily: 'sans-serif',
            }}
          >
            Viel Erfolg in Woche {nextWeekNumber}! 💪
          </div>

          <button
            onClick={onClose}
            style={{
              width: '100%',
              marginTop: 12,
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

  const status =
    STATUS_META[data.weekVerdict?.status] ||
    STATUS_META.solid

  const phaseLabel =
    analysisData?.phase?.label ||
    analysisData?.phase?.id ||
    null

  const confidenceLabel =
    data.confidence?.level === 'high'
      ? 'Sehr gute Datenbasis'
      : data.confidence?.level === 'medium'
        ? 'Gute Datenbasis'
        : 'Eingeschränkte Datenbasis'

  const planChanged =
    data.planDecision?.action &&
    data.planDecision.action !== 'keep'

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
          maxHeight: '93vh',
          overflowY: 'auto',
          borderRadius: '28px 28px 0 0',
          background: 'linear-gradient(180deg,#FFFDFC 0%,#FFF8F3 100%)',
          padding: '17px 17px 44px',
          boxShadow: '0 -12px 42px rgba(84,51,35,0.18)',
        }}
      >
        <div
          style={{
            width: 38,
            height: 4,
            borderRadius: 99,
            background: '#EADFD7',
            margin: '0 auto 16px',
          }}
        />

        {/* Kopf: bewusst Rückblick UND Ausblick */}
        <div style={{ padding: '0 2px 4px' }}>
          <div
            style={{
              fontSize: 21,
              fontWeight: 'bold',
              color: '#3D2B1F',
              lineHeight: 1.2,
            }}
          >
            🏃 Woche {weekNumber} im Rückblick
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 11,
              color: '#927D70',
              lineHeight: 1.5,
              fontFamily: 'sans-serif',
            }}
          >
            Was dein Training zeigt und worauf wir jetzt aufbauen.
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 10,
            }}
          >
            {phaseLabel && (
              <span
                style={{
                  padding: '5px 8px',
                  borderRadius: 999,
                  background: '#F6F0EC',
                  color: '#8D776A',
                  fontSize: 9,
                  fontWeight: 'bold',
                  fontFamily: 'sans-serif',
                }}
              >
                {phaseLabel}
              </span>
            )}

            <span
              style={{
                padding: '5px 8px',
                borderRadius: 999,
                background: status.soft,
                color: status.accent,
                fontSize: 9,
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
              }}
            >
              {status.icon} {status.label}
            </span>
          </div>
        </div>

        {/* Wichtigste Karte */}
        <div
          style={{
            marginTop: 11,
            padding: 17,
            borderRadius: 20,
            background: status.bg,
            border: `1px solid ${status.accent}22`,
            boxShadow: '0 6px 22px rgba(94,68,53,0.055)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: status.accent,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: 0.7,
              fontFamily: 'sans-serif',
            }}
          >
            🔥 Coach-Fazit
          </div>

          <div
            style={{
              marginTop: 7,
              color: '#3D2B1F',
              fontSize: 16,
              fontWeight: 'bold',
              lineHeight: 1.35,
            }}
          >
            {data.weekVerdict?.headline}
          </div>

          <div
            style={{
              marginTop: 7,
              color: '#745F52',
              fontSize: 12,
              lineHeight: 1.6,
              fontFamily: 'sans-serif',
            }}
          >
            {data.weekVerdict?.summary}
          </div>
        </div>

        <Section
          title="Das lief richtig gut"
          icon="🟢"
          accent="#4E8D69"
        >
          {(data.positive || []).length ? (
            data.positive.map((text, index) => (
              <InsightItem
                key={index}
                text={text}
                positive
              />
            ))
          ) : (
            <div
              style={{
                fontSize: 11.5,
                color: '#8E7A6E',
                lineHeight: 1.5,
              }}
            >
              Diese Woche gibt es keinen einzelnen Punkt, der besonders heraussticht – die Gesamtentwicklung bleibt trotzdem wertvoll.
            </div>
          )}
        </Section>

        <Section
          title="Deine Entwicklung"
          icon="📈"
          accent="#657BAA"
          background="linear-gradient(135deg,#FBFCFF,#F7F9FD)"
        >
          {data.development?.summary && (
            <div
              style={{
                fontSize: 11.5,
                lineHeight: 1.5,
                color: '#6F5B50',
                marginBottom: 10,
                fontFamily: 'sans-serif',
              }}
            >
              {data.development.summary}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
              gap: 8,
            }}
          >
            {(data.development?.signals || []).map((signal, index) => {
              const trend =
                TREND_META[signal.trend] ||
                TREND_META.unclear

              return (
                <div
                  key={`${signal.metric}-${index}`}
                  style={{
                    minHeight: 92,
                    padding: 10,
                    borderRadius: 13,
                    background: '#FFFFFF',
                    border: '1px solid #E9EDF4',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div
                    style={{
                      color: '#5F5960',
                      fontSize: 10,
                      fontWeight: 'bold',
                      lineHeight: 1.3,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {friendlyMetricLabel(signal.metric)}
                  </div>

                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      alignSelf: 'flex-start',
                      marginTop: 7,
                      padding: '4px 6px',
                      borderRadius: 999,
                      background: trend.bg,
                      color: trend.color,
                      fontSize: 8.5,
                      fontWeight: 'bold',
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {trend.icon} {trend.label}
                  </div>

                  <div
                    style={{
                      marginTop: 7,
                      color: '#8B786D',
                      fontSize: 8.8,
                      lineHeight: 1.35,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    {signal.text}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <Section
          title="Darauf solltest du achten"
          icon="⚠️"
          accent="#B47B32"
          background="linear-gradient(135deg,#FFFDF9,#FFF8EF)"
        >
          {(data.attention || []).length ? (
            data.attention.map((text, index) => (
              <InsightItem
                key={index}
                text={text}
              />
            ))
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#6F5B50',
                fontSize: 11.5,
                lineHeight: 1.5,
                fontFamily: 'sans-serif',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: '#EAF6EF',
                  color: '#4E8D69',
                  fontWeight: 'bold',
                }}
              >
                ✓
              </span>
              Aktuell gibt es keinen besonderen Warnpunkt.
            </div>
          )}
        </Section>

        <Section
          title={`Deshalb sieht Woche ${nextWeekNumber} so aus`}
          icon="🧠"
          accent="#80679B"
          background="linear-gradient(135deg,#FCF9FF,#F8F3FC)"
        >
          <div
            style={{
              fontSize: 11.5,
              lineHeight: 1.55,
              color: '#6F5B50',
              fontFamily: 'sans-serif',
            }}
          >
            {data.planDecision?.reason}
          </div>

          <div
            style={{
              marginTop: 10,
              padding: '9px 10px',
              borderRadius: 11,
              background: '#F2EBF7',
              color: '#7B5F92',
              fontSize: 10.2,
              fontWeight: 'bold',
              lineHeight: 1.4,
              fontFamily: 'sans-serif',
            }}
          >
            {planChanged ? '↗ Plan angepasst: ' : '✓ Planentscheidung: '}
            {data.adjustmentSummary}
          </div>
        </Section>

        {/* Das soll der eine Gedanke sein, den der Nutzer mitnimmt */}
        <div
          style={{
            marginTop: 14,
            padding: 17,
            borderRadius: 19,
            background: 'linear-gradient(135deg,#FFF0E4,#FFF8ED)',
            border: '1px solid #FFD9BF',
            boxShadow: '0 6px 20px rgba(198,107,67,0.07)',
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
            🎯 Fokus für Woche {nextWeekNumber}
          </div>

          <div
            style={{
              marginTop: 6,
              color: '#3D2B1F',
              fontSize: 15,
              fontWeight: 'bold',
              lineHeight: 1.3,
            }}
          >
            {data.nextWeekFocus?.title}
          </div>

          <div
            style={{
              marginTop: 6,
              color: '#755F52',
              fontSize: 11.5,
              lineHeight: 1.55,
              fontFamily: 'sans-serif',
            }}
          >
            {data.nextWeekFocus?.text}
          </div>
        </div>

        {/* Confidence bewusst dezent ganz unten */}
        <div
          style={{
            marginTop: 12,
            padding: '9px 11px',
            borderRadius: 12,
            background: '#F7F3F0',
            color: '#9A877A',
            fontSize: 9.2,
            lineHeight: 1.45,
            fontFamily: 'sans-serif',
          }}
        >
          <strong>Analysequalität: {confidenceLabel}</strong>
          {data.confidence?.reason
            ? ` · ${data.confidence.reason}`
            : ''}
        </div>

        <div
          style={{
            marginTop: 16,
            textAlign: 'center',
            color: '#7B675C',
            fontSize: 11,
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
          }}
        >
          Viel Erfolg in Woche {nextWeekNumber}! 💪
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 11,
            padding: 13,
            borderRadius: 14,
            border: 'none',
            background: '#F0E7E1',
            color: '#806D62',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'sans-serif',
          }}
        >
          Schließen
        </button>
      </div>
    </div>
  )
}
