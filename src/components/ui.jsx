import React, { useState } from 'react'
import { readingText } from '../lib/kana.js'
import { friendshipView } from '../lib/state.js'

export function Hearts({ points }) {
  const { rank, hearts } = friendshipView(points)
  return (
    <span className="hearts">
      {'♥'.repeat(hearts)}<span className="off">{'♥'.repeat(5 - hearts)}</span>
      {rank > 1 && <span style={{ color: 'var(--grape)', fontSize: 11, marginLeft: 4 }}>Lv{rank}</span>}
    </span>
  )
}

// 英文の下の読み。タップで ひらがな → カタカナ → なし。
// 段階3〜4は最初は隠しておき「よみ」で出す。段階5は発音記号。
export function Reading({ kana, ipa, policy, mode, onCycle }) {
  const [revealed, setRevealed] = useState(false)
  if (policy === 'ipa') {
    if (!ipa) return null
    if (!revealed) return <button className="reveal" onClick={() => setRevealed(true)}>はつおん</button>
    return <span className="reading ipa">/{ipa.replace(/^\/|\/$/g, '')}/</span>
  }
  if (!kana) return null
  if (policy === 'hidden' && !revealed) {
    return <button className="reveal" onClick={() => { setRevealed(true); if (mode === 'none') onCycle() }}>よみ</button>
  }
  const text = readingText(kana, mode)
  if (!text) return <button className="reveal" onClick={onCycle}>よみ</button>
  return (
    <button className="reading" onClick={onCycle}>
      <span className="mode">{mode === 'hira' ? 'あ' : 'ア'}</span>{text}
    </button>
  )
}

export function Toast({ message }) {
  if (!message) return null
  return <div className="toast">{message}</div>
}

export function TabBar({ current, onNavigate }) {
  const tabs = [
    ['home', '🏠', 'ホーム'],
    ['stickers', '🌟', 'シール'],
    ['friends', '🐾', 'なかま'],
    ['parent', '👪', 'おうちのひと']
  ]
  return (
    <nav className="tabbar">
      {tabs.map(([id, icon, label]) => (
        <button key={id} className={current === id ? 'on' : ''} onClick={() => onNavigate(id)}>
          <span>{icon}</span>{label}
        </button>
      ))}
    </nav>
  )
}
