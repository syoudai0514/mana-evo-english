import React, { useState } from 'react'
import { PERSONAS } from '../data/personas.js'
import { speak, unlockSpeech } from '../lib/tts.js'

export function PartnerPicker({ value, onChange }) {
  return (
    <div className="partner-grid">
      {Object.values(PERSONAS).map((persona) => (
        <button
          key={persona.id}
          className={`partner-card ${value === persona.id ? 'on' : ''}`}
          style={{ '--c': persona.theme.main, '--cd': persona.theme.deep, background: `linear-gradient(180deg, ${persona.theme.soft}, #fff)` }}
          onClick={() => {
            unlockSpeech()
            onChange(persona.id)
            speak(`Hi! I'm ${persona.nameEn}!`, persona.voice)
          }}
        >
          {value === persona.id && <span className="tag chosen">✓ えらんだ</span>}
          <img src={persona.image} alt={persona.name} className={value === persona.id ? 'monster-float' : ''} />
          <div className="name">{persona.name}</div>
          <div className="desc">{persona.tagline[0]}<br />{persona.tagline[1]}</div>
        </button>
      ))}
    </div>
  )
}

export default function Setup({ onDone }) {
  const [nickname, setNickname] = useState('')
  const [partner, setPartner] = useState('howamy')
  const name = nickname.trim()

  return (
    <div className="screen">
      <div className="scroll">
        <div className="setup-hero">
          <h1>Nice to meet you!</h1>
          <p>はじめまして！ なんて よんだら いい？</p>
        </div>
        <div className="name-card">
          <label htmlFor="nickname">あだな</label>
          <input
            id="nickname"
            value={nickname}
            maxLength={12}
            placeholder="そうちゃん"
            autoComplete="off"
            onChange={(event) => setNickname(event.target.value)}
          />
          <div className="en" style={{ fontSize: 14, color: 'var(--grape)', fontWeight: 700, minHeight: 22 }}>
            {name ? `“Hi, ${name}! Let's be friends!”` : 'おうちのひとと いっしょに いれてね'}
          </div>
        </div>
        <div className="center" style={{ fontWeight: 900, fontSize: 16, marginTop: 24 }}>いっしょに はなす あいぼうを えらぼう</div>
        <PartnerPicker value={partner} onChange={setPartner} />
        <div className="center muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 14 }}>あいぼうは あとから いつでも かえられるよ</div>
        <div style={{ padding: '20px 22px 32px' }}>
          <button className="press cta" disabled={!name} onClick={() => { unlockSpeech(); onDone({ nickname: name, partner }) }}>
            はじめる！
          </button>
        </div>
      </div>
    </div>
  )
}
