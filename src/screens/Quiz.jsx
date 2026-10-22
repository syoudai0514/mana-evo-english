// TOEIC の問題（診断10問・苦手つぶし・会話のあとのお勉強）。問題は音を鳴らさない Live に作ってもらう
// kind: 'diagnosis' | 'toeic' | 'study'
import React, { useEffect, useRef, useState } from 'react'
import { DIAGNOSIS_PLAN, MAKE_QUESTIONS, QUESTION_MAKER_PROMPT, TOEIC_PARTS, questionRequest } from '../data/adult.js'
import { practiceSkills, withAnswers } from '../lib/adult.js'
import { fillQuestions, parseChoice } from '../lib/quiz.js'
import { SilentTool } from '../lib/annotator.js'
import { isMockMode } from '../lib/config.js'
import { useHoldToSpeak } from '../lib/useHoldToSpeak.js'
import { prepareReader, stopReading as stopSpeech } from '../lib/reader.js'
import { AdultTop, HoldMic, speakEnglish } from '../components/adultUi.jsx'

const LETTERS = ['A', 'B', 'C', 'D']

export default function Quiz({ adult, updateAdult, kind, recasts = [], context = '', onDone }) {
  const [items, setItems] = useState(null)
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [showText, setShowText] = useState(false)
  const answers = useRef([])
  const makerRef = useRef(null)
  const indexRef = useRef(0)
  indexRef.current = index
  const pressedAt = useRef(-1)
  const item = items?.[index]

  useEffect(() => {
    prepareReader()
    let alive = true
    const skills = kind === 'diagnosis' ? DIAGNOSIS_PLAN : practiceSkills(adult, 4)
    const lead = kind === 'study'
      ? [...new Map(recasts.filter((row) => row.better || row.tip).map((row) => [(row.better || row.tip).toLowerCase(), row])).values()].slice(-3).map((row) => ({ type: 'recast', ...row }))
      : []
    const load = async () => {
      let made = []
      if (!isMockMode()) {
        const maker = new SilentTool({ system: QUESTION_MAKER_PROMPT, declaration: MAKE_QUESTIONS, step: 'questions', timeoutMs: 30000, ways: [['3.8', 'realtime'], ['3-flash', 'realtime']] })
        makerRef.current = maker
        // 35秒で作れなければ、予備の問題で始める（待たせすぎない）
        const reply = await Promise.race([maker.ask(questionRequest({ skills, context: kind === 'study' ? context : '' })), new Promise((resolve) => setTimeout(() => resolve(null), 35000))])
        maker.close()
        made = Array.isArray(reply?.questions) ? reply.questions.map((row) => ({ ...row, choices: (row.choices || []).map(String) })) : []
      }
      if (alive) setItems([...lead, ...fillQuestions(skills, made).map((row) => ({ type: 'question', ...row }))])
    }
    load()
    return () => { alive = false; stopSpeech(); makerRef.current?.close() }
  }, [])

  // 問題が出たら音声を流す（Part 2 は選択肢も読む）
  useEffect(() => {
    if (item?.type !== 'question') return
    setShowText(false)
    play(item)
  }, [index, items])

  const play = async (question) => {
    if (question.part === 'p2') {
      await speakEnglish(`${question.audio_en}\n${question.choices.map((choice, i) => `${LETTERS[i]}. ${choice}`).join('\n')}`)
    } else if (question.part === 'p3') {
      await speakEnglish(`${question.audio_en}\n${question.question_en}`)
    }
  }

  const choose = (i) => {
    if (chosen !== null || item?.type !== 'question') return
    stopSpeech()
    setChosen(i)
    setShowText(true)
    answers.current.push({ part: item.part, skill: item.skill, correct: i === item.answer })
  }

  const hold = useHoldToSpeak({
    vocabulary: ['A', 'B', 'C', 'D'],
    // 押した時の問題と同じときだけ答えにする（遅れて届いた声の答えを次の問題に使わない）
    onText: (text) => { if (item?.type === 'question' && indexRef.current === pressedAt.current) { const i = parseChoice(text, item.choices); if (i >= 0) choose(i) } }
  })

  const finish = (stop = false) => {
    stopSpeech()
    const rows = answers.current
    // 診断は、ほぼ全部（8問以上）といたときだけ「診断ずみ」にする
    if (rows.length) updateAdult((current) => ({ ...withAnswers(current, rows), diagnosed: current.diagnosed || (kind === 'diagnosis' && rows.length >= 8) }))
    onDone(rows.length ? { answers: rows } : {}, { stop })
  }

  const next = () => {
    setChosen(null)
    if (index + 1 >= items.length) finish()
    else setIndex(index + 1)
  }

  const title = kind === 'diagnosis' ? '🩺 基礎チェック' : kind === 'study' ? '📘 お勉強' : '📘 苦手つぶし'
  const progress = items ? <span className="muted" style={{ marginLeft: 4, fontSize: 12 }}>{index + 1}/{items.length}</span> : null

  if (!items) {
    return (
      <div className="screen adult-dark">
        <AdultTop onBack={() => finish(true)} backLabel="✕" title={title} />
        <div className="center" style={{ marginTop: 120 }}>
          <div className="spinner" />
          <p style={{ fontWeight: 900, marginTop: 14 }}>{kind === 'study' ? 'きょうの会話から問題を作っています…' : '問題を作っています…'}</p>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>10〜30秒ほどかかります</p>
        </div>
      </div>
    )
  }

  if (!item) return <div className="screen adult-dark"><AdultTop onBack={() => finish(true)} backLabel="✕" title={title} /><div className="center" style={{ marginTop: 80 }}><button className="press cta" style={{ height: 52, width: 'auto', padding: '0 24px', margin: '0 auto' }} onClick={() => finish()}>つぎへ ▶</button></div></div>

  if (item.type === 'recast') {
    return (
      <div className="screen adult-dark">
        <AdultTop onBack={() => finish(true)} backLabel="✕" title={<>{title}{progress}</>} />
        <PhaseBar index={index} total={items.length} />
        <div className="scroll">
          <div className="a-card" style={{ margin: '16px 16px 0' }}>
            <span className="chip">きょうの言い直し</span>
            <div className="muted" style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>あなた：{item.said}</div>
            {item.better && <button className="better" onClick={() => speakEnglish(item.better)}>✨ {item.better} 🔊</button>}
            {item.tip && <div className="muted" style={{ marginTop: 8, fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>💡 {item.tip}</div>}
          </div>
          <div className="muted center" style={{ fontSize: 12, marginTop: 12 }}>声に出して2回言ってみましょう。この言い方は復習カードにも入っています</div>
          <div style={{ padding: '16px' }}><button className="press cta" style={{ height: 52, fontSize: 17 }} onClick={next}>つぎへ ▶</button></div>
        </div>
      </div>
    )
  }

  const listening = item.part === 'p2' || item.part === 'p3'
  const hideChoices = item.part === 'p2' && !showText && chosen === null
  return (
    <div className="screen adult-dark">
      <AdultTop onBack={() => finish(true)} backLabel="✕" title={<>{title}{progress}</>} />
      <PhaseBar index={index} total={items.length} />
      <div className="scroll">
        <div className="a-card" style={{ margin: '14px 16px 0' }}>
          <span className="chip">TOEIC {TOEIC_PARTS[item.part].label}</span>
          {listening && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="chip" onClick={() => play(item)}>🔊 もう一度聞く</button>
              {chosen === null && <button className="chip" onClick={() => setShowText((value) => !value)}>{showText ? '文字をかくす' : '文字を見る'}</button>}
            </div>
          )}
          {listening && (showText || chosen !== null) && <div className="script">{item.audio_en.split(/(?=\b[MW]\s*:)/).map((line, i) => <div key={i}>{line.trim()}</div>)}</div>}
          {item.question_en && <div className="qtext">{item.question_en}</div>}
          <div className="choices">
            {item.choices.map((choice, i) => {
              const state = chosen === null ? '' : i === item.answer ? 'right' : i === chosen ? 'wrong' : ''
              return (
                <button key={i} type="button" className={`qopt ${state}`} onClick={() => choose(i)}>
                  <b>{LETTERS[i]}</b><span>{hideChoices ? '（音声を聞いて選ぶ）' : choice}</span>
                </button>
              )
            })}
          </div>
          {chosen !== null && <div className="explain">{chosen === item.answer ? '⭕ 正解！ ' : '❌ '}{item.explain_ja}</div>}
        </div>
        {chosen === null
          ? <div onPointerDown={() => { pressedAt.current = index }}><HoldMic hold={hold} size={80} label="声で「B」と答えてもOK" /></div>
          : <div style={{ padding: '16px' }}><button className="press cta" style={{ height: 52, fontSize: 17 }} onClick={next}>{index + 1 >= items.length ? 'おわり ▶' : 'つぎへ ▶'}</button></div>}
      </div>
    </div>
  )
}

function PhaseBar({ index, total }) {
  return (
    <div className="phase">
      {Array.from({ length: total }, (_, i) => <div key={i} className={i < index ? 'on' : i === index ? 'now' : ''} />)}
    </div>
  )
}
