import React, { useEffect } from 'react'
import { personaOf } from '../data/personas.js'
import { levelOf } from '../data/levels.js'
import { speak } from '../lib/tts.js'
import { Hearts } from '../components/ui.jsx'

export default function Result({ state, navigate, result }) {
  const { record, completed, memoryAdded } = result
  const persona = personaOf(record.partner)
  const voice = { ...persona.voice, rate: persona.voice.rate * levelOf(state.level).speechRate }
  const newSet = new Set(record.newPhrases)
  const said = [...new Set(record.said)].slice(-6)
  // 相棒の声でほめる（文字が読めなくても伝わるように）
  // 英語でほめたあと、シールのことを日本語でも言う（字が読めなくてもわかるように）
  useEffect(() => {
    const ja = record.sticker ? 'あたらしい シール！ やったね！' : record.stickerToday ? 'シールは 1にち 1まい。また あした もらおうね' : !completed ? 'あと すこし はなすと シールが もらえるよ' : ''
    const timer = setTimeout(async () => {
      await speak(said.length ? `Great talk, ${state.profile?.nickname || 'friend'}!` : 'Thank you! See you!', voice)
      if (ja) speak(ja, { lang: 'ja-JP', rate: 1, pitch: 1.1 })
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="screen result">
      <div className="burst" />
      <div className="scroll" style={{ position: 'relative' }}>
        <div className="center" style={{ marginTop: 18 }}>
          <div className="en" style={{ fontSize: 40, fontWeight: 800, color: 'var(--coral)', lineHeight: 1 }}>{said.length ? 'Great talk!' : 'Nice try!'}</div>
          <div style={{ fontWeight: 900, fontSize: 15, marginTop: 4 }}>{said.length ? 'たくさん おはなし できたね！' : 'おはなし してくれて ありがとう！'}</div>
        </div>
        <div style={{ position: 'relative', height: 180 }}>
          <img src={persona.image} alt="" className="monster-float" style={{ position: 'absolute', left: '50%', top: 6, width: 170, height: 170, marginLeft: -85, objectFit: 'contain' }} />
          <div style={{ position: 'absolute', right: 56, top: 24, fontSize: 28 }}>💕</div>
          <div style={{ position: 'absolute', left: 60, top: 70, fontSize: 20 }}>✨</div>
        </div>
        <div className="center">
          <span className="tag" style={{ background: '#fff', color: 'var(--pink-d)', fontSize: 14, padding: '6px 14px', boxShadow: '0 3px 0 var(--line)' }}>
            {completed ? 'なかよし ♥ +1　' : ''}{persona.name} <Hearts points={state.friendship[persona.id] || 0} />
          </span>
        </div>

        {said.length > 0 && (
          <div className="bubble" style={{ margin: '16px 20px 0', padding: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>🗣️ きょう いえた えいご</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {said.map((text) => (
                <button key={text} className={`said-row ${newSet.has(text) ? 'new' : ''}`} onClick={() => speak(text, voice)}>
                  <span className="en">{text} {newSet.has(text) && <span className="tag" style={{ background: 'var(--sun)', color: '#fff' }}>はじめて！</span>}</span>
                  <span>🔊</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {memoryAdded.length > 0 && (
          <div className="bubble" style={{ margin: '12px 20px 0', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 26 }}>🧠</div>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>
              {persona.name}が きみの ことを {memoryAdded.length}つ おぼえたよ！<br />つぎ はなすときに きいてくるかも！
            </div>
          </div>
        )}

        {!completed && (
          <div className="center" style={{ marginTop: 16, fontWeight: 900, fontSize: 14 }}>🌟 あと すこし はなすと シールが もらえるよ</div>
        )}
        {record.stickerToday && !record.sticker && (
          <div className="center" style={{ marginTop: 16, fontWeight: 900, fontSize: 14 }}>🌟 シールは 1にち 1まい。また あした もらおうね！</div>
        )}
        {record.sticker && (
          <div className="center" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>あたらしい シール！</div>
            <span className="sticker-pop">{record.sticker.emoji}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, padding: '18px 20px 30px' }}>
          <button className="press btn ghost" style={{ flex: 1, height: 58, fontSize: 16 }} onClick={() => navigate('home')}>おわり</button>
          <button className="press btn" style={{ flex: 1.4, height: 58, fontSize: 16, background: 'var(--mint)', color: '#fff', '--d': 'var(--mint-d)' }} onClick={() => navigate('stickers')}>🌟 シールちょう</button>
        </div>
      </div>
    </div>
  )
}
