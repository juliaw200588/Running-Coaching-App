import { useState } from 'react'
import AchievementList from './AchievementList.jsx'
import AchievementCollections from './AchievementCollections.jsx'
import SportJourney from './SportJourney.jsx'

const TABS = [
  {
    id: 'achievements',
    label: 'Erfolge',
    icon: '🏆',
  },
  {
    id: 'collections',
    label: 'Sammlungen',
    icon: '📚',
  },
  {
    id: 'journey',
    label: 'Mein Weg',
    icon: '🛤️',
  },
]

export default function Achievements({ user }) {
  const [section, setSection] = useState('achievements')

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
          gap: 7,
          padding: 4,
          marginBottom: 14,
          borderRadius: 15,
          background: 'rgba(239,230,224,0.74)',
          fontFamily: 'sans-serif',
        }}
      >
        {TABS.map(tab => {
          const active = section === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              style={{
                minWidth: 0,
                padding: '9px 5px',
                border: 'none',
                borderRadius: 12,
                background: active ? '#FFFFFF' : 'transparent',
                color: active ? '#3D2B1F' : '#9A8274',
                boxShadow: active
                  ? '0 3px 12px rgba(80,53,39,0.08)'
                  : 'none',
                fontSize: 9.5,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: 14,
                  marginBottom: 3,
                }}
              >
                {tab.icon}
              </span>
              {tab.label}
            </button>
          )
        })}
      </div>

      {section === 'achievements' && (
        <AchievementList user={user} />
      )}

      {section === 'collections' && (
        <AchievementCollections user={user} />
      )}

      {section === 'journey' && (
        <SportJourney user={user} />
      )}
    </div>
  )
}
