import React from 'react'
import { STICKERS } from '../lib/state.js'
import { LETTERS } from '../data/letters.js'
import { speak, unlockSpeech } from '../lib/tts.js'
import { TabBar } from '../components/ui.jsx'

export default function Stickers({ state, navigate }) {
  const owned = new Set(state.stickers.map((item) => item.emoji))
  return (
    <div className="screen">
      <div className="top"><div className="title-lg" style={{ padding: '6px 2px' }}>🌟 シールちょう</div><div className="pill">{owned.size} / {STICKERS.length}</div></div>
      <div className="scroll">
        <p className="muted" style={{ fontSize: 13, fontWeight: 700, padding: '8px 20px 0' }}>3かい いじょう こたえると、1にち 1まい もらえるよ</p>
        <div className="sticker-grid">
          {STICKERS.map((emoji, index) => owned.has(emoji)
            ? <div key={emoji} className="sticker-slot">{emoji}</div>
            : <div key={emoji} className="sticker-slot empty">{index + 1}</div>)}
        </div>
        <div className="title-lg" style={{ fontSize: 17, padding: '18px 20px 0' }}>🔤 ABC アルバム <span className="muted" style={{ fontSize: 13 }}>{LETTERS.filter((item) => state.lettersSeen?.[item.letter]).length} / 26</span></div>
        <p className="muted" style={{ fontSize: 12, fontWeight: 700, padding: '4px 20px 0' }}>「きょうの もじ」を きくと ふえるよ。タップで もういちど きける</p>
        <div className="abc-grid">
          {LETTERS.map((item) => state.lettersSeen?.[item.letter]
            ? <button key={item.letter} className="abc-slot" onClick={() => { unlockSpeech(); speak(`${item.letter}! ${item.word}!`, { rate: 0.8 }) }}><span className="en">{item.letter}{item.letter.toLowerCase()}</span><span>{item.emoji}</span></button>
            : <div key={item.letter} className="abc-slot empty en">{item.letter}</div>)}
        </div>
        <div style={{ height: 20 }} />
      </div>
      <TabBar current="stickers" onNavigate={navigate} />
    </div>
  )
}
