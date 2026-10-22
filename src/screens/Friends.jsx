import React, { useState } from 'react'
import { PERSONAS, personaOf } from '../data/personas.js'
import { unlockSpeech } from '../lib/tts.js'
import { previewVoice } from '../lib/live.js'
import { isSignedIn } from '../lib/auth.js'
import { Hearts, TabBar } from '../components/ui.jsx'

export default function Friends({ state, update, navigate, showToast }) {
  const current = state.profile?.partner
  const [previewing, setPreviewing] = useState('')

  // 声をえらぶ：タップするとその声で自己紹介して、そのまま決まる
  const chooseVoice = async (persona, voiceName) => {
    if (previewing) return
    update((prev) => ({ ...prev, voices: { ...(prev.voices || {}), [persona.id]: voiceName } }))
    if (!isSignedIn()) return showToast('こえを きくには おうちのひとの ログインが いるよ')
    setPreviewing(`${persona.id}:${voiceName}`)
    try {
      await previewVoice({ voiceName, style: persona.voiceStyle, line: `Hi, ${state.profile?.nickname || 'friend'}! I'm ${persona.nameEn}! Let's talk together!` })
    } catch {
      showToast('いまは こえを きけなかったよ')
    } finally {
      setPreviewing('')
    }
  }

  return (
    <div className="screen">
      <div className="top"><div className="title-lg" style={{ padding: '6px 2px' }}>🐾 なかま</div></div>
      <div className="scroll">
        <p className="muted" style={{ fontSize: 13, fontWeight: 700, padding: '8px 20px 0' }}>タップすると あいぼうを かえられるよ</p>
        {[...Object.values(PERSONAS), ...(state.manaRoster || []).map(item => personaOf(item.id,state.manaRoster))].map((persona) => {
          const memory = state.memory.filter((item) => item.partner === persona.id).slice(-3)
          const chosenVoice = state.voices?.[persona.id] || persona.liveVoice
          return (
            <div key={persona.id} className={`friend-card ${current === persona.id ? 'on' : ''}`} style={{ '--c': persona.theme.main, flexDirection: 'column', alignItems: 'stretch' }}>
              <button
                style={{ display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left' }}
                onClick={() => {
                  unlockSpeech()
                  update((prev) => ({ ...prev, profile: { ...prev.profile, partner: persona.id } }))
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
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink2)', marginBottom: 6 }}>🎙️ こえを えらぶ（タップで きける）</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {persona.liveVoices.map(([voiceName, label]) => {
                    const on = chosenVoice === voiceName
                    const playing = previewing === `${persona.id}:${voiceName}`
                    return (
                      <button
                        key={voiceName}
                        className="chip"
                        style={on ? { background: persona.theme.main, color: '#fff' } : { background: '#F6F3FC' }}
                        onClick={() => { unlockSpeech(); chooseVoice(persona, voiceName) }}
                      >
                        {playing ? '🔊 ' : on ? '✓ ' : ''}{label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
        <p className="muted center" style={{ fontSize: 12, fontWeight: 700, margin: '18px 20px 24px' }}>マナエボで つかまえた なかまとも そのうち おはなし できるよ</p>
      </div>
      <TabBar current="friends" onNavigate={navigate} />
    </div>
  )
}
