import React, { useState } from 'react'
import { personaOf } from '../data/personas.js'
import { HOME_MODE_IDS, MODES } from '../data/modes.js'
import { levelOf, WORLD_UNLOCK_LEVEL } from '../data/levels.js'
import { modelToday, streakCount, todayKey } from '../lib/state.js'
import { speak, unlockSpeech } from '../lib/tts.js'
import { Hearts, Reading, TabBar } from '../components/ui.jsx'
import { nextReading } from '../lib/kana.js'

const POKE_LINES = ['Hee-hee! That tickles!', 'Hi hi!', 'Let\'s talk!', 'Yay!', 'Boing!']

export default function Home({ state, update, navigate, showToast, topic, onStart }) {
  const persona = personaOf(state.profile?.partner)
  const level = levelOf(state.level)
  const [wiggle, setWiggle] = useState(false)
  // Live が今日つながっていれば、1回ずつ送る方式の上限に関係なく話せる
  const done = modelToday(state).done && state.liveDate !== todayKey()
  const streak = streakCount(state)
  const voice = { ...persona.voice, rate: persona.voice.rate * level.speechRate }

  const poke = () => {
    unlockSpeech()
    setWiggle(true)
    setTimeout(() => setWiggle(false), 650)
    speak(done ? 'Zzz...' : POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)], voice)
  }

  const openMode = (id) => {
    unlockSpeech()
    if (done) return showToast('きょうは おしまい。また あした！')
    if (id === 'play') return navigate('play')
    if (id === 'guess') return navigate('guess')
    if (id === 'story') return showToast('もうすぐ あそべるよ！')
    if (id === 'world') {
      if (state.level < WORLD_UNLOCK_LEVEL) return showToast(`だんかい${WORLD_UNLOCK_LEVEL}に なったら でんわが くるよ！`)
      return showToast('じゅんびちゅう！ もうすぐ でんわが くるよ')
    }
  }

  return (
    <div className="screen">
      <div className="scroll">
        <div className="top">
          <div className="pill"><span className="ic">🔥</span>{streak}にち</div>
          <div style={{ font: '800 21px var(--en)', color: 'var(--coral)' }}>
            マナエボ<span style={{ color: 'var(--sun)' }}> </span>English
          </div>
          <button className="pill" onClick={() => navigate('stickers')}><span className="ic">⭐</span>{state.stickers.length}</button>
        </div>

        <div className="home-stage">
          <div className="shadow" />
          <img
            src={persona.image}
            alt={persona.name}
            className={`monster ${wiggle ? 'monster-wiggle' : done ? 'monster-sleep' : 'monster-float'}`}
            onClick={poke}
          />
          {done && <div style={{ position: 'absolute', right: 70, top: 90, fontSize: 30 }}>💤</div>}
          <div className="bubble home-bubble">
            {done ? (
              <>
                <div className="line en">I'm sleepy... See you tomorrow, {state.profile?.nickname}!</div>
                <div className="ja" style={{ borderTop: 0, paddingTop: 0 }}>きょうは おしまい。また あした おはなし しようね</div>
              </>
            ) : (
              <>
                <button className="line en" style={{ textAlign: 'left' }} onClick={() => { unlockSpeech(); speak(topic.opener.en, voice) }}>
                  {topic.opener.en} {topic.emoji}
                </button>
                <Reading
                  kana={topic.opener.kana}
                  policy={level.reading}
                  mode={state.reading}
                  onCycle={() => update((prev) => ({ ...prev, reading: nextReading(prev.reading) }))}
                />
              </>
            )}
          </div>
          <div className="home-name">
            <span className="tag" style={{ background: '#fff', color: 'var(--grape)', fontSize: 13, padding: '5px 12px', boxShadow: '0 3px 0 var(--line)' }}>
              {persona.name}　<Hearts points={state.friendship[persona.id] || 0} />
            </span>
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>
          <button
            className="press cta"
            style={{ height: 76, fontSize: 22 }}
            disabled={done}
            onClick={() => { unlockSpeech(); onStart({ mode: 'free', partner: persona.id, topic }) }}
          >
            <span style={{ fontSize: 32 }}>{done ? '😴' : '🎤'}</span> {done ? 'また あした！' : 'おはなし する！'}
          </button>
        </div>

        <div className="mode-grid">
          {HOME_MODE_IDS.map((id) => {
            const mode = MODES[id]
            const locked = id === 'world' && state.level < WORLD_UNLOCK_LEVEL
            return (
              <button key={id} className={`press mode-card ${locked ? 'locked' : ''}`} onClick={() => openMode(id)}>
                <div className="ic" style={{ background: mode.iconBg }}>{mode.emoji}</div>
                <div>
                  <div className="t">{mode.title}</div>
                  <div className="s">{mode.titleEn}</div>
                </div>
                {locked && <span className="tag badge" style={{ background: '#fff', color: 'var(--grape)', boxShadow: '0 2px 0 var(--line)' }}>🔒 だんかい{WORLD_UNLOCK_LEVEL}で ひらく</span>}
                {mode.status === 'soon' && <span className="tag badge" style={{ background: '#fff', color: 'var(--pink-d)', boxShadow: '0 2px 0 var(--line)' }}>もうすぐ</span>}
              </button>
            )
          })}
        </div>
      </div>
      <TabBar current="home" onNavigate={navigate} />
    </div>
  )
}
