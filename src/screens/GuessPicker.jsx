import React from 'react'
import { GUESS_CATEGORIES, pickSecret } from '../data/guess.js'
import { personaOf } from '../data/personas.js'
import { speak, unlockSpeech } from '../lib/tts.js'
import { TabBar } from '../components/ui.jsx'

const COLORS = [['#E9FBE9', '#C9E8C9'], ['#FFF1C9', '#F0DCA0'], ['#DDF0FF', '#BFD9F5'], ['#FFE3EF', '#F5C2D6']]

export default function GuessPicker({ state, navigate, onStart }) {
  const persona = personaOf(state.profile?.partner, state.manaRoster)
  const childAsks = state.level >= 4
  return (
    <div className="screen">
      <div className="top">
        <button className="icon-btn" onClick={() => navigate('home')}>‹</button>
        <div className="title-lg">🔍 あてっこゲーム</div>
        <div style={{ width: 42 }} />
      </div>
      <div className="scroll">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 20px 0' }}>
          <img src={persona.image} onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src='/monsters/m049.webp'}} alt="" className="monster-float" style={{ width: 84, height: 84, objectFit: 'contain' }} />
          <div className="bubble" style={{ flex: 1, padding: '10px 14px' }}>
            <button className="en" style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.2, textAlign: 'left' }} onClick={() => { unlockSpeech(); speak("I'm thinking of something. Can you guess?", persona.voice) }}>I'm thinking of something… Can you guess? 🔊</button>
            <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
              {childAsks ? 'えいごで しつもんして あててね（Is it big? など）' : 'ヒントを きいて、なにか あててね！'}
            </div>
          </div>
        </div>
        <div className="scene-grid">
          {GUESS_CATEGORIES.map((category, index) => (
            <button
              key={category.id}
              className="press scene-card"
              style={{ background: `linear-gradient(160deg, ${COLORS[index % 4][0]}, #fff)`, '--d': COLORS[index % 4][1], minHeight: 150 }}
              onClick={() => { unlockSpeech(); onStart({ mode: 'guess', partner: persona.id, secret: pickSecret(category.id) }) }}
            >
              <div className="big">{category.emoji}</div>
              <div className="t">{category.title}</div>
              <div className="s">{category.items.slice(0, 4).map((item) => item.emoji).join(' ')} …</div>
            </button>
          ))}
        </div>
      </div>
      <TabBar current="home" onNavigate={navigate} />
    </div>
  )
}
