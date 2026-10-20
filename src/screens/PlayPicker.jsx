import React, { useMemo, useState } from 'react'
import { SCENE_CATEGORIES, SCENES, rollScene } from '../data/scenes.js'
import { personaOf } from '../data/personas.js'
import { unlockSpeech } from '../lib/tts.js'
import { TabBar } from '../components/ui.jsx'

export default function PlayPicker({ state, navigate, onStart }) {
  const [category, setCategory] = useState('all')
  const persona = personaOf(state.profile?.partner)
  // 役割とハプニングは画面を開くたびに振りなおす
  const rolls = useMemo(() => Object.fromEntries(SCENES.map((scene) => [scene.id, rollScene(scene)])), [])
  const playedIds = new Set(state.sessions.filter((session) => session.mode === 'play').map((session) => session.title))
  const scenes = SCENES.filter((scene) => category === 'all' || scene.category === category)

  return (
    <div className="screen">
      <div className="top">
        <button className="icon-btn" onClick={() => navigate('home')}>‹</button>
        <div className="title-lg">🎭 ごっこあそび</div>
        <div style={{ width: 42 }} />
      </div>
      <div className="chips">
        {SCENE_CATEGORIES.map((item) => (
          <button key={item.id} className={`chip ${category === item.id ? 'on' : ''}`} onClick={() => setCategory(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="scroll">
        <div className="scene-grid">
          {scenes.map((scene) => {
            const roll = rolls[scene.id]
            const [from, to, shadow, accent] = scene.colors
            return (
              <button
                key={scene.id}
                className="press scene-card"
                style={{ background: `linear-gradient(160deg, ${from}, ${to})`, '--d': shadow }}
                onClick={() => { unlockSpeech(); onStart({ mode: 'play', partner: persona.id, play: { scene, role: roll.role, twist: roll.twist } }) }}
              >
                {!playedIds.has(scene.title) && <span className="tag" style={{ position: 'absolute', top: 10, right: 10, background: 'var(--coral)', color: '#fff' }}>あたらしい</span>}
                <div className="big">{scene.emoji}</div>
                <div className="t">{scene.title}</div>
                <div className="s">{scene.titleEn}</div>
                <div className="r" style={{ color: accent }}>きみは：{roll.role.childJa}</div>
              </button>
            )
          })}
        </div>
      </div>
      <TabBar current="home" onNavigate={navigate} />
    </div>
  )
}
