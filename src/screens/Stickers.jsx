import React from 'react'
import { STICKERS } from '../lib/state.js'
import { TabBar } from '../components/ui.jsx'

export default function Stickers({ state, navigate }) {
  const owned = new Set(state.stickers.map((item) => item.emoji))
  return (
    <div className="screen">
      <div className="top"><div className="title-lg" style={{ padding: '6px 2px' }}>🌟 シールちょう</div><div className="pill">{owned.size} / {STICKERS.length}</div></div>
      <div className="scroll">
        <p className="muted" style={{ fontSize: 13, fontWeight: 700, padding: '8px 20px 0' }}>おはなしを 1かい すると 1まい もらえるよ</p>
        <div className="sticker-grid">
          {STICKERS.map((emoji, index) => owned.has(emoji)
            ? <div key={emoji} className="sticker-slot">{emoji}</div>
            : <div key={emoji} className="sticker-slot empty">{index + 1}</div>)}
        </div>
      </div>
      <TabBar current="stickers" onNavigate={navigate} />
    </div>
  )
}
