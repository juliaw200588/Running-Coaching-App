export default function BottomNav({ activeTab, onChange }) {
  const tabs = [
    { id: 'training', label: 'Training', icon: '🏋️' },
    { id: 'activities', label: 'Aktivitäten', icon: '📋' },
    { id: 'profile', label: 'Profil', icon: '👤' },
  ]

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', background: 'white', borderTop: '1.5px solid #F0E8E0',
      padding: '8px 0 calc(10px + env(safe-area-inset-bottom, 0px))',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
    }}>
      {tabs.map(tab => {
        const active = activeTab === tab.id
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '4px 0',
            }}>
            <div style={{
              width: active ? 44 : 26, height: 26, borderRadius: active ? 13 : 8, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 15,
              background: active ? 'linear-gradient(135deg,#FF8C69,#FF6B9D)' : 'transparent',
              opacity: active ? 1 : 0.45, transition: 'all 0.2s',
            }}>
              {tab.icon}
            </div>
            <div style={{ fontSize: 10, fontWeight: 'bold', color: active ? '#FF8C69' : '#C4A882', fontFamily: 'sans-serif' }}>
              {tab.label}
            </div>
          </button>
        )
      })}
    </div>
  )
}
