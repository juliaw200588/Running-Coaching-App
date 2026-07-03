import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import FriendProfile from './FriendProfile.jsx'

export default function Friends({ user }) {
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [suche, setSuche] = useState('')
  const [suchergebnisse, setSuchergebnisse] = useState([])
  const [freunde, setFreunde] = useState([])
  const [anfragen, setAnfragen] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    loadFreunde()
  }, [user])

  const loadFreunde = async () => {
    setLoading(true)

    // Angenommene Freundschaften laden
    const { data: fs } = await supabase
      .from('friendships')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq('status', 'accepted')

    // Offene Anfragen an mich
    const { data: anf } = await supabase
      .from('friendships')
      .select('*')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')

    if (fs) {
      const freundIds = fs.map(f => f.sender_id === user.id ? f.receiver_id : f.sender_id)
      if (freundIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', freundIds)
        setFreunde(profiles || [])
      } else {
        setFreunde([])
      }
    }

    if (anf) {
      const senderIds = anf.map(a => a.sender_id)
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', senderIds)
        setAnfragen(profiles?.map(p => ({ ...p, friendship_id: anf.find(a => a.sender_id === p.id)?.id })) || [])
      } else {
        setAnfragen([])
      }
    }

    setLoading(false)
  }

  const handleSuche = async (text) => {
    setSuche(text)
    if (text.length < 2) { setSuchergebnisse([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .ilike('name', `%${text}%`)
      .neq('id', user.id)
      .limit(10)
    setSuchergebnisse(data || [])
    setSearching(false)
  }

  const sendAnfrage = async (empfaengerId) => {
    await supabase.from('friendships').insert({ sender_id: user.id, receiver_id: empfaengerId })
    // Benachrichtigung senden
    const { data: senderProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    await supabase.from('notifications').insert({
      user_id: empfaengerId,
      type: 'friend_request',
      message: `${senderProfile?.name || 'Jemand'} möchte dein Freund sein! 👥`,
      from_user_id: user.id,
    })
    setSuchergebnisse(prev => prev.filter(p => p.id !== empfaengerId))
  }

  const anfrageAnnehmen = async (friendshipId, profil) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    // Benachrichtigung an Absender
    const { data: myProfile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    await supabase.from('notifications').insert({
      user_id: profil.id,
      type: 'friend_accepted',
      message: `${myProfile?.name || 'Jemand'} hat deine Freundschaftsanfrage angenommen! 🎉`,
      from_user_id: user.id,
    })
    setAnfragen(prev => prev.filter(a => a.friendship_id !== friendshipId))
    setFreunde(prev => [...prev, profil])
  }

  const anfrageAblehnen = async (friendshipId) => {
    await supabase.from('friendships').update({ status: 'declined' }).eq('id', friendshipId)
    setAnfragen(prev => prev.filter(a => a.friendship_id !== friendshipId))
  }

  const freundEntfernen = async (freundId) => {
    await supabase.from('friendships')
      .delete()
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${freundId}),and(sender_id.eq.${freundId},receiver_id.eq.${user.id})`)
    setFreunde(prev => prev.filter(f => f.id !== freundId))
  }

  const shareLink = () => {
    const link = `${window.location.origin}?friend=${user.id}`
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 3000)
    })
  }

  const Avatar = ({ profil, size = 40 }) => (
    profil?.avatar_url ? (
      <img src={profil.avatar_url} alt={profil.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid #FFE0CC', flexShrink: 0 }} />
    ) : (
      <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, color: 'white', flexShrink: 0, border: '2px solid #FFE0CC' }}>
        {profil?.name?.[0]?.toUpperCase() || '👤'}
      </div>
    )
  )

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#B8A090', fontFamily: 'sans-serif' }}>⏳ Lade…</div>

  return (
    <div>
      {selectedFriend && <FriendProfile friendId={selectedFriend.id} currentUser={user} onClose={() => setSelectedFriend(null)} />}
      {/* Suche */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6, fontFamily: 'sans-serif' }}>
          Freunde suchen
        </label>
        <input
          value={suche}
          onChange={e => handleSuche(e.target.value)}
          placeholder="Name eingeben…"
          style={{ width: '100%', padding: '13px 16px', borderRadius: 14, border: '1.5px solid #F0E0D0', fontSize: 15, color: '#3D2B1F', outline: 'none', boxSizing: 'border-box', background: '#FFF8F5', fontFamily: 'sans-serif' }}
        />

        {searching && <div style={{ fontSize: 12, color: '#B8A090', fontFamily: 'sans-serif', marginTop: 8 }}>⏳ Suche…</div>}

        {suchergebnisse.length > 0 && (
          <div style={{ marginTop: 8, background: 'white', borderRadius: 14, border: '1.5px solid #F0E8E0', overflow: 'hidden' }}>
            {suchergebnisse.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid #F0E8E0' }}>
                <Avatar profil={p} size={36} />
                <div style={{ flex: 1, fontFamily: 'sans-serif', fontSize: 14, color: '#3D2B1F', fontWeight: 'bold' }}>{p.name || 'Kein Name'}</div>
                <button onClick={() => sendAnfrage(p.id)}
                  style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#FF8C69,#FF6B9D)', color: 'white', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                  + Anfragen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link teilen */}
      <div style={{ marginBottom: 20, padding: '14px 16px', background: '#F0FAF4', borderRadius: 14, border: '1px solid #B8E4CC' }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: '#3D8B6E', fontFamily: 'sans-serif', marginBottom: 8 }}>🔗 Per Link einladen</div>
        <div style={{ fontSize: 12, color: '#5BA88A', fontFamily: 'sans-serif', marginBottom: 10 }}>Teile deinen persönlichen Link z.B. per WhatsApp</div>
        <button onClick={shareLink}
          style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: linkCopied ? '#5BA88A' : 'linear-gradient(135deg,#7EC8A4,#5BA88A)', color: 'white', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all 0.2s' }}>
          {linkCopied ? '✓ Link kopiert!' : '📋 Link kopieren'}
        </button>
      </div>

      {/* Offene Anfragen */}
      {anfragen.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'sans-serif', marginBottom: 10 }}>
            Anfragen ({anfragen.length})
          </div>
          {anfragen.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#FFF5EE', borderRadius: 14, border: '1.5px solid #FFE0CC', marginBottom: 8 }}>
              <Avatar profil={a} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>{a.name || 'Kein Name'}</div>
                <div style={{ fontSize: 11, color: '#C4A882', fontFamily: 'sans-serif' }}>möchte dein Freund sein</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => anfrageAnnehmen(a.friendship_id, a)}
                  style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: '#5BA88A', color: 'white', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>✓</button>
                <button onClick={() => anfrageAblehnen(a.friendship_id)}
                  style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: '#FDECEA', color: '#B85464', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Freundesliste */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 'bold', color: '#B8A090', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'sans-serif', marginBottom: 10 }}>
          Meine Freunde ({freunde.length})
        </div>

        {freunde.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: '#B8A090', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👟</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>Noch keine Freunde</div>
            <div style={{ fontSize: 12, color: '#D4C4B8' }}>Suche nach Namen oder teile deinen Link</div>
          </div>
        ) : (
          freunde.map(f => (
            <div key={f.id} onClick={() => setSelectedFriend(f)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'white', borderRadius: 14, border: '1.5px solid #F0E8E0', marginBottom: 8, cursor: 'pointer' }}>
              <Avatar profil={f} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: '#3D2B1F', fontFamily: 'sans-serif' }}>{f.name || 'Kein Name'}</div>
              </div>
              <button onClick={() => freundEntfernen(f.id)}
                style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #F0E0D0', background: 'white', color: '#C4A882', fontSize: 12, cursor: 'pointer', fontFamily: 'sans-serif' }}>
                Entfernen
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
