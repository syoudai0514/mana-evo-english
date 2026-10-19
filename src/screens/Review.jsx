// 言い方の復習カード：日本語を見て英語で言ってみる → 答えを見て「わからない／あやしい／言えた」
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { compareShadow, dueCards, nextLabel, withGrade } from '../lib/adult.js'
import { useHoldToSpeak } from '../lib/useHoldToSpeak.js'
import { prepareReader, readAloud } from '../lib/reader.js'
import { AdultTop, HoldMic } from '../components/adultUi.jsx'

const GRADES = [
  { id: 'again', label: '😵 わからない', cls: 'again' },
  { id: 'hard', label: '🤔 あやしい', cls: 'hard' },
  { id: 'good', label: '😎 言えた', cls: 'good' }
]

export default function Review({ adult, updateAdult, onDone }) {
  // 期限の来たカード。なければ新しいものから10枚（いつでも練習できるように）
  const cards = useMemo(() => {
    const due = dueCards(adult)
    return due.length ? due : [...adult.cards].reverse().slice(0, 10)
  }, [])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [said, setSaid] = useState(null) // { text, score }
  const [done, setDone] = useState(0)
  const card = cards[index]
  const indexRef = useRef(0)
  indexRef.current = index
  const pressedAt = useRef(-1) // 押した時のカード（遅れて届いた声の答えを次のカードに使わない）
  useEffect(() => { prepareReader() }, [])
  const hold = useHoldToSpeak({
    vocabulary: cards.map((item) => item.en),
    onText: (text) => {
      if (!card || revealed || pressedAt.current !== indexRef.current) return
      setSaid({ text, score: text ? compareShadow(card.en, text).score : 0 })
      setRevealed(true)
      readAloud(card.en)
    }
  })

  if (!card) {
    return (
      <div className="screen adult-dark">
        <AdultTop onBack={() => onDone({}, { stop: true })} backLabel="✕" title="🔁 復習" />
        <div className="center" style={{ marginTop: 80, padding: 24 }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <p style={{ fontWeight: 900, marginTop: 8 }}>復習するカードはありません</p>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>雑談すると、使えそうな言い方が自動でカードになります</p>
          <button className="press cta" style={{ height: 54, marginTop: 20 }} onClick={() => onDone({})}>つぎへ ▶</button>
        </div>
      </div>
    )
  }

  const grade = (id) => {
    updateAdult((current) => withGrade(current, card.id, id))
    setDone((value) => value + 1)
    setRevealed(false)
    setSaid(null)
    if (index + 1 >= cards.length) onDone({ reviewed: done + 1 })
    else setIndex(index + 1)
  }

  return (
    <div className="screen adult-dark">
      <AdultTop onBack={() => onDone(done ? { reviewed: done } : {}, { stop: true })} backLabel="✕" title={<>🔁 復習 <span className="muted" style={{ marginLeft: 4, fontSize: 12 }}>{index + 1}/{cards.length}</span></>} />
      <div className="scroll">
        <div className="flash">
          {card.from && <span className="chip">{card.from} から</span>}
          <div className="q">{card.ja}</div>
          {!revealed && <div className="muted" style={{ marginTop: 18, fontSize: 13 }}>英語で言ってみて（声でも、頭の中でもOK）</div>}
          {revealed && (
            <>
              <button className="a" onClick={() => readAloud(card.en)}>{card.en} 🔊</button>
              {said && (
                <div className={`said ${said.score >= 70 ? 'ok' : ''}`}>
                  {said.text ? <>あなた：{said.text}<br />{said.score >= 70 ? '👍 ほぼ言えています' : 'もう少し！'}</> : '聞き取れませんでした'}
                </div>
              )}
            </>
          )}
        </div>
        {!revealed ? (
          <div style={{ padding: '0 16px' }}>
            <button className="press btn ghost dark-ghost" style={{ width: '100%', height: 54 }} onClick={() => { setRevealed(true); readAloud(card.en) }}>答えを見る</button>
            <div onPointerDown={() => { pressedAt.current = index }}><HoldMic hold={hold} label="押しながら英語で言う" /></div>
          </div>
        ) : (
          <>
            <div className="grades">
              {GRADES.map((item) => (
                <button key={item.id} className={`press grade ${item.cls} ${said && ((said.score >= 70 && item.id === 'good') || (said.score < 70 && item.id === 'hard')) ? 'suggest' : ''}`} onClick={() => grade(item.id)}>
                  {item.label}<span>{nextLabel(card, item.id)}</span>
                </button>
              ))}
            </div>
            <div className="muted center" style={{ fontSize: 12, marginTop: 10 }}>選んだボタンで、次にこのカードが出る日が決まります</div>
          </>
        )}
      </div>
    </div>
  )
}
