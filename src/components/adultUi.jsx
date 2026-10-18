// 大人モードの共通部品（落ち着いた濃い色の画面）
import React from 'react'
import { speak } from '../lib/tts.js'

export function AdultTop({ onBack, backLabel = '‹', title, right }) {
  return (
    <div className="top">
      {onBack ? <button className="icon-btn" aria-label="もどる" onClick={onBack}>{backLabel}</button> : <div style={{ width: 42 }} />}
      <div className="pill">{title}</div>
      {right || <div style={{ width: 42 }} />}
    </div>
  )
}

// 押しながら話すボタン（useHoldToSpeak の bind を渡す）
export function HoldMic({ hold, size = 96, label }) {
  if (!hold.available) return null
  return (
    <div className="hold-mic-wrap">
      <div className={`mic ${hold.recording ? 'rec' : ''} ${hold.busy ? 'busy' : ''}`} style={{ width: size, height: size }} {...hold.bind} role="button" aria-label="押しながら話す">
        <div className="ring" style={{ inset: -12, transform: `scale(${1 + hold.level * 0.35})` }} />
        <div className="core" style={{ fontSize: size * 0.42 }}>{hold.busy ? '💭' : '🎤'}</div>
      </div>
      <div className="cap">{hold.recording ? '聞いています…（離すと判定）' : hold.busy ? '文字にしています…' : label || '押しながら話す'}</div>
    </div>
  )
}

export function ScoreRing({ score }) {
  const color = score >= 80 ? 'var(--mint)' : score >= 60 ? 'var(--sun)' : 'var(--coral)'
  return <div className="score-ring" style={{ borderColor: color }}>{score}</div>
}

// 英語の読み上げ（端末の声）。slow でゆっくり。Part 3 は M:/W: で声を変える
export async function speakEnglish(text, { slow = false } = {}) {
  const rate = slow ? 0.7 : 0.95
  const lines = String(text || '').split(/(?=\b[MW]\s*:)/)
  for (const line of lines) {
    const match = /^([MW])\s*:\s*(.*)$/s.exec(line.trim())
    if (match) await speak(match[2], { rate, gender: match[1] === 'W' ? 'female' : 'male', pitch: 1 })
    else await speak(line.trim(), { rate, gender: 'male', pitch: 1 })
  }
}
