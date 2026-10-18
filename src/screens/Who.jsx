// 起動したら「だれが はなす？」。子どもと大人の入り口を最初に分ける
import React, { useState } from 'react'
import { personaOf } from '../data/personas.js'
import { streakCount } from '../lib/state.js'
import { adultStreak, newAdult, withAdult } from '../lib/adult.js'
import { unlockSpeech } from '../lib/tts.js'

const EMOJIS = ['🧔', '👨', '👩', '🧑', '👱‍♀️', '👨‍🦱']

export default function Who({ state, adultStore, updateAdultStore, onKid, onAdult }) {
  const [adding, setAdding] = useState(!adultStore.order.length)
  const [name, setName] = useState(adultStore.order.length ? 'ママ' : 'パパ')
  const [emoji, setEmoji] = useState(adultStore.order.length ? '👩' : '🧔')
  const [target, setTarget] = useState(730)
  const persona = personaOf(state.profile?.partner)
  const kidStreak = streakCount(state)

  const add = () => {
    const adult = newAdult({ name: name.trim() || 'パパ', emoji, target: Number(target) || 730 })
    updateAdultStore((prev) => withAdult(prev, adult))
    setAdding(false)
    onAdult(adult.id)
  }

  return (
    <div className="screen who">
      <div className="scroll">
        <div className="center" style={{ marginTop: 46 }}>
          <div className="en" style={{ font: '800 32px var(--en)', color: 'var(--coral)' }}>Who's talking?</div>
          <div style={{ fontWeight: 900, marginTop: 4 }}>だれが はなす？</div>
        </div>
        <div className="who-grid">
          {state.profile && (
            <button className="press who-card kid" onClick={() => { unlockSpeech(); onKid() }}>
              <img src={persona.image} alt="" />
              <div className="n">{state.profile.nickname}</div>
              {kidStreak > 0 && <span className="tag" style={{ background: '#FFF1C9', color: '#B07A00' }}>🔥 {kidStreak}にち れんぞく</span>}
            </button>
          )}
          {adultStore.order.map((id) => {
            const adult = adultStore.adults[id]
            const streak = adultStreak(adult)
            return (
              <button key={id} className="press who-card grown" onClick={() => { unlockSpeech(); onAdult(id) }}>
                <div style={{ fontSize: 58 }}>{adult.emoji}</div>
                <div className="n">{adult.name}</div>
                <span className="tag" style={{ background: '#3D4677', color: '#C9CDF5' }}>{streak ? `🔥 ${streak}日 ・ ` : ''}TOEIC 目標 {adult.target}</span>
              </button>
            )
          })}
        </div>

        {adding ? (
          <div className="card who-add">
            <h3>大人の入り口をつくる</h3>
            <div className="field"><label>よび名</label><input value={name} maxLength={10} onChange={(event) => setName(event.target.value)} /></div>
            <div className="field"><label>アイコン</label>
              <div style={{ display: 'flex', gap: 8 }}>{EMOJIS.map((item) => <button key={item} className={`emoji-pick ${emoji === item ? 'on' : ''}`} onClick={() => setEmoji(item)}>{item}</button>)}</div>
            </div>
            <div className="field"><label>TOEIC の目標スコア</label><input inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value.replace(/\D/g, '').slice(0, 3))} /></div>
            <p className="muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 8, lineHeight: 1.6 }}>大人の会話の記憶（仕事・家族の話）は子ども側には出しません。入るときは保護者PINで守ります。</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {adultStore.order.length > 0 && <button className="press btn ghost" style={{ flex: 1 }} onClick={() => setAdding(false)}>やめる</button>}
              <button className="press btn primary" style={{ flex: 2 }} onClick={add}>つくって はじめる</button>
            </div>
            {!adultStore.order.length && <button className="link-btn" onClick={onKid}>子どもの画面へ ›</button>}
          </div>
        ) : (
          <button className="link-btn center" style={{ display: 'block', margin: '22px auto 0' }} onClick={() => setAdding(true)}>＋ ママ・ほかの大人をふやす</button>
        )}
        <div style={{ height: 30 }} />
      </div>
    </div>
  )
}
