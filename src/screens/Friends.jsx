import React from 'react'
import { PERSONAS } from '../data/personas.js'
import { speak, unlockSpeech } from '../lib/tts.js'
import { Hearts, TabBar } from '../components/ui.jsx'

export default function Friends({ state, update, navigate, showToast }) {
  const current = state.profile?.partner
  return (
    <div className="screen">
      <div className="top"><div className="title-lg" style={{ padding: '6px 2px' }}>🐾 なかま</div></div>
      <div className="scroll">
        <p className="muted" style={{ fontSize: 13, fontWeight: 700, padding: '8px 20px 0' }}>タップすると あいぼうを かえられるよ</p>
        {Object.values(PERSONAS).map((persona) => {
          const memory = state.memory.filter((item) => item.partner === persona.id).slice(-3)
          return (
            <button
              key={persona.id}
              className={`friend-card ${current === persona.id ? 'on' : ''}`}
              style={{ '--c': persona.theme.main }}
              onClick={() => {
                unlockSpeech()
                update((prev) => ({ ...prev, profile: { ...prev.profile, partner: persona.id } }))
                speak(`Let's talk, ${state.profile?.nickname || 'friend'}!`, persona.voice)
                showToast(`${persona.name}と おはなし するよ！`)
              }}
            >
              <img src={persona.image} alt="" className={current === persona.id ? 'monster-float' : ''} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 900, fontSize: 18 }}>{persona.name}</span>
                  {current === persona.id && <span className="tag" style={{ background: persona.theme.main, color: '#fff' }}>あいぼう</span>}
                </div>
                <div style={{ fontSize: 13 }}><Hearts points={state.friendship[persona.id] || 0} /></div>
                <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, marginTop: 2 }}>{persona.tagline.join('・')}</div>
                {memory.length > 0 && (
                  <div style={{ fontSize: 11.5, marginTop: 6, background: '#F7F5FD', borderRadius: 10, padding: '5px 8px' }}>
                    🧠 <span className="en" style={{ fontWeight: 600 }}>{memory.map((item) => item.fact).join(' / ')}</span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
        <p className="muted center" style={{ fontSize: 12, fontWeight: 700, margin: '18px 20px 24px' }}>マナエボで つかまえた なかまとも そのうち おはなし できるよ</p>
      </div>
      <TabBar current="friends" onNavigate={navigate} />
    </div>
  )
}
