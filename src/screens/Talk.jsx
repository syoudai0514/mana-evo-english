import React, { useCallback, useEffect, useRef, useState } from 'react'
import { personaOf } from '../data/personas.js'
import { levelOf } from '../data/levels.js'
import { MODES } from '../data/modes.js'
import { buildHistory, buildSystemPrompt, selectMemory } from '../data/prompt.js'
import { modelToday, withMemory, withModelResult, withUtterance } from '../lib/state.js'
import { nextReading } from '../lib/kana.js'
import { Recorder, micSupported } from '../lib/recorder.js'
import { speak, stopSpeech, unlockSpeech } from '../lib/tts.js'
import { sendTurn, TalkError } from '../lib/talk.js'
import { Reading } from '../components/ui.jsx'

function titleOf(config) {
  if (config.mode === 'free') return { emoji: config.topic?.emoji || '🎤', text: config.topic?.title || 'おしゃべり' }
  if (config.mode === 'play') return { emoji: config.play.scene.emoji, text: config.play.scene.title }
  if (config.mode === 'guess') return { emoji: '🔍', text: 'あてっこゲーム' }
  if (config.mode === 'adult') return { emoji: config.adultScene.emoji, text: config.adultScene.title }
  return { emoji: '🎤', text: 'おしゃべり' }
}

function openerTurn(config) {
  if (config.mode === 'free' && config.topic) {
    const { en, kana, ja } = config.topic.opener
    return { who: 'partner', text: en, kana, ja, hints: [] }
  }
  if (config.mode === 'adult') return { who: 'partner', text: config.adultScene.opener, kana: '', ja: '', hints: [] }
  return null
}

function partnerTurnFrom(reply) {
  return {
    who: 'partner',
    text: reply.reply_en,
    kana: reply.reply_kana,
    ipa: reply.reply_ipa,
    ja: reply.reply_ja,
    hints: (reply.hints || []).slice(0, 3),
    tip: reply.tip_ja || '',
    recastOf: reply.recast || ''
  }
}

export default function Talk({ state, update, config, onFinish, showToast }) {
  const persona = personaOf(config.partner)
  const adult = config.mode === 'adult'
  const level = levelOf(adult ? 5 : state.level)
  const mode = MODES[config.mode] || MODES.free
  const voice = { ...persona.voice, rate: adult ? 0.95 : persona.voice.rate * level.speechRate }
  const title = titleOf(config)

  const [turns, setTurns] = useState(() => { const first = openerTurn(config); return first ? [first] : [] })
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [showJa, setShowJa] = useState(adult)
  const [typing, setTyping] = useState(adult || !micSupported())
  const [text, setText] = useState('')
  const [pickedHint, setPickedHint] = useState(null)
  const [talkingIndex, setTalkingIndex] = useState(-1)
  const [stopped, setStopped] = useState(null) // 'exhausted' | 'auth'
  const [caption, setCaption] = useState('')

  const recorder = useRef(null)
  const pressing = useRef(false)
  const logRef = useRef(null)
  const startedAt = useRef(new Date().toISOString())
  const turnsRef = useRef(turns)
  turnsRef.current = turns
  const memoryAdded = useRef([])
  const finished = useRef(false)

  const childTurnCount = turns.filter((turn) => turn.who === 'child').length
  const latestPartnerIndex = turns.map((turn) => turn.who).lastIndexOf('partner')
  const latest = turns[latestPartnerIndex]

  const say = useCallback(async (line, index) => {
    if (config.parentReads || !line) return
    setTalkingIndex(index)
    await speak(line, voice)
    setTalkingIndex(-1)
  }, [config.parentReads, voice.pitch, voice.rate])

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    stopSpeech()
    recorder.current?.close()
    onFinish({
      id: `s${Date.now()}`,
      mode: config.mode,
      partner: persona.id,
      title: title.text,
      emoji: title.emoji,
      topicId: config.topic?.id || null,
      startedAt: startedAt.current,
      turns: turnsRef.current.map(({ who, text, ja, english, lang, recast }) => ({ who, text, ja, english, lang, recast }))
    }, { memoryAdded: memoryAdded.current })
  }, [config, persona.id, onFinish, title.text, title.emoji])

  const send = useCallback(async (input, preview) => {
    if (busy || finished.current) return
    setBusy(true)
    setPickedHint(null)
    setCaption('')
    stopSpeech()
    if (preview) setTurns((prev) => [...prev, { who: 'child', text: preview, pending: true, english: /[a-z]/i.test(preview) }])

    const isStart = input.text === '[START]'
    const special = isStart || input.text === '[DONT_KNOW]'
    const turnNumber = isStart ? 0 : childTurnCount + 1
    const context = {
      mode: config.mode,
      persona: persona.id,
      level: state.level,
      nickname: state.profile?.nickname,
      topic: config.topic,
      play: config.play,
      secret: config.secret,
      adultScene: config.adultScene,
      parentReads: config.parentReads,
      memory: adult ? [] : selectMemory(state.memory),
      turn: turnNumber,
      maxTurns: mode.maxTurns
    }
    const history = buildHistory(turnsRef.current.filter((turn) => !turn.pending))

    try {
      const { reply, modelIndex } = await sendTurn({
        system: buildSystemPrompt(context),
        history,
        input,
        startModel: modelToday(state).startIndex,
        context
      })
      update((prev) => withModelResult(prev, { modelIndex }))

      const heard = special || (reply.heard !== false && Boolean(reply.child_said || preview))
      setTurns((prev) => {
        const base = prev.filter((turn) => !turn.pending)
        const next = [...base]
        if (!special && heard) {
          next.push({
            who: 'child',
            text: reply.child_said || preview || '',
            english: Boolean(reply.spoke_english),
            lang: reply.child_lang,
            recast: reply.recast || ''
          })
        }
        next.push(partnerTurnFrom(reply))
        return next
      })

      if (!special && heard && !adult) {
        update((prev) => withMemory(withUtterance(prev, { english: reply.spoke_english, text: reply.child_said || preview }), reply.memory, persona.id))
        if (reply.memory?.length) memoryAdded.current.push(...reply.memory)
      }
      if (!heard) setCaption('もういちど おしながら はなしてね')

      setBusy(false)
      await say(reply.reply_en, 'latest')
      if (reply.end) setTimeout(finish, 900)
    } catch (error) {
      setTurns((prev) => prev.filter((turn) => !turn.pending))
      setBusy(false)
      const code = error instanceof TalkError ? error.code : 'server'
      if (code === 'exhausted') {
        update((prev) => withModelResult(prev, { exhausted: true }))
        setStopped('exhausted')
      } else if (code === 'auth') {
        setStopped('auth')
      } else {
        setCaption(code === 'network' ? 'つうしんが うまく いかなかったよ。もういちど！' : 'もういちど はなしてみてね')
      }
    }
  }, [busy, childTurnCount, config, persona.id, state, adult, mode.maxTurns, update, say, finish])

  // はじめのひとこと
  useEffect(() => {
    const first = turnsRef.current[0]
    if (first) say(first.text, 0)
    else send({ text: '[START]' })
    return () => { stopSpeech(); recorder.current?.close() }
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns.length, busy])

  const startRecording = async (event) => {
    event.preventDefault()
    if (busy || recording || stopped) return
    pressing.current = true
    unlockSpeech()
    stopSpeech()
    try {
      if (!recorder.current) {
        recorder.current = new Recorder()
        recorder.current.onLevel = setMicLevel
      }
      await recorder.current.start()
      // はじめてのマイク許可ダイアログの間に指を離していたら、録音しない
      if (!pressing.current) { recorder.current.stop(); return }
      setRecording(true)
      setCaption('はなしてね… はなしたら ゆびを はなす')
    } catch {
      setTyping(true)
      setCaption('マイクが つかえないよ。おうちのひとに きいてね')
    }
  }

  const stopRecording = (event) => {
    event?.preventDefault()
    pressing.current = false
    if (!recording) return
    setRecording(false)
    setMicLevel(0)
    const audio = recorder.current.stop()
    if (audio.seconds < 0.4) return setCaption('ながめに おしながら はなしてね')
    if (audio.loudness < 0.004) return setCaption('こえが きこえなかったよ。もういちど！')
    send({ audio: { mime: audio.mime, data: audio.base64 } })
  }

  const tapHint = (hint) => {
    unlockSpeech()
    if (pickedHint?.en === hint.en) {
      send({ text: `[HINT] ${hint.en}` }, hint.en)
      return
    }
    setPickedHint(hint)
    speak(hint.en, voice)
  }

  const submitText = (event) => {
    event.preventDefault()
    const value = text.trim()
    if (!value) return
    setText('')
    send({ text: value }, value)
  }

  const cycleReading = () => update((prev) => ({ ...prev, reading: nextReading(prev.reading) }))
  const readingPolicy = config.parentReads ? 'show' : level.reading

  return (
    <div className={`screen talk ${adult ? 'adult' : ''}`} style={{ '--glow': persona.theme.glow }}>
      <div className="top">
        <button className="icon-btn" aria-label="おわる" onClick={finish}>✕</button>
        <div className="pill" style={{ fontSize: 13, maxWidth: '62%', overflow: 'hidden' }}>
          <span className="ic">{title.emoji}</span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title.text}</span>
        </div>
        {level.japanese !== 'english-only' || adult ? (
          <button className="icon-btn" style={{ fontSize: 12, color: showJa ? '#fff' : 'var(--grape)', background: showJa ? 'var(--grape)' : '#fff' }} onClick={() => setShowJa((v) => !v)}>あ⇄A</button>
        ) : <div style={{ width: 42 }} />}
      </div>

      <div className="talk-log" ref={logRef}>
        {config.parentReads && (
          <div className="center"><span className="tag" style={{ background: '#fff', color: 'var(--grape)', fontSize: 12, padding: '5px 12px' }}>👨‍👦 おうちのひとが {persona.name}の セリフを よんでね</span></div>
        )}
        {turns.map((turn, index) => turn.who === 'partner' ? (
          <div key={index}>
            <div className="row-partner">
              <img src={persona.image} alt="" className={talkingIndex === index || (talkingIndex === 'latest' && index === latestPartnerIndex) ? 'monster-talk' : ''} />
              <div className={`bubble ${index === latestPartnerIndex ? 'latest' : ''}`}>
                <div className="say" style={config.parentReads ? { fontSize: 21 } : undefined}>
                  <Highlight text={turn.text} mark={turns[index - 1]?.recast} />
                </div>
                <Reading kana={turn.kana} ipa={turn.ipa} policy={readingPolicy} mode={state.reading} onCycle={cycleReading} />
                {showJa && turn.ja && <div className="ja">{turn.ja}</div>}
                <button className="speak" aria-label="もういちど きく" onClick={() => { unlockSpeech(); setTalkingIndex(index); speak(turn.text, voice).then(() => setTalkingIndex(-1)) }}>🔊</button>
              </div>
            </div>
            {turn.tip && <div className="tip" style={{ marginTop: 8 }}>💡 {turn.tip}</div>}
          </div>
        ) : (
          <div key={index} className="row-child">
            <div className={`child-bubble ${turn.english ? 'en' : 'ja'}`} style={{ opacity: turn.pending ? 0.6 : 1 }}>{turn.text || '…'}</div>
            {!turn.pending && !adult && turn.english && <span className="tag praise">✨ えいごで いえたね！</span>}
            {!turn.pending && turn.recast && !turn.english && <span className="tag recast en" style={{ fontSize: 12 }}>💬 {turn.recast}</span>}
          </div>
        ))}
        {busy && (
          <div className="row-partner">
            <img src={persona.image} alt="" className="monster-float" />
            <div className="bubble" style={{ flex: 'none' }}><span className="typing"><i /><i /><i /></span></div>
          </div>
        )}
      </div>

      {!busy && latest?.hints?.length > 0 && !stopped && (
        <div className="hints">
          <div className="label">💡 {adult ? 'こんな返し方も' : 'こまったら タップ → まねして いってみよう'}</div>
          <div className="hint-row">
            {latest.hints.map((hint) => (
              <button key={hint.en} className={`press hint ${pickedHint?.en === hint.en ? 'on' : ''}`} onClick={() => tapHint(hint)}>
                {pickedHint?.en === hint.en && <span className="tag send">これで こたえる</span>}
                <div className="e">{hint.emoji}</div>
                <div className="w">{hint.en}</div>
                <div className="k">{hint.kana}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="dock">
        {typing && (
          <form className="text-input" onSubmit={submitText} style={{ marginBottom: 12 }}>
            <input value={text} onChange={(event) => setText(event.target.value)} placeholder={adult ? 'Type in English (日本語でもOK)' : 'えいごで かいてね'} enterKeyHint="send" />
            <button type="submit" className="press" disabled={busy}>おくる</button>
          </form>
        )}
        <div className="dock-row">
          <button className="side-btn" disabled={busy} onClick={() => { unlockSpeech(); send({ text: '[DONT_KNOW]' }) }}>
            🤔<br />わから<br />ない
          </button>
          <div
            className={`mic ${recording ? 'rec' : ''} ${busy ? 'busy' : ''}`}
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerCancel={stopRecording}
            onPointerLeave={stopRecording}
            onContextMenu={(event) => event.preventDefault()}
            role="button"
            aria-label="おしながら はなす"
          >
            <div className="ring" style={{ inset: -14, transform: `scale(${1 + micLevel * 0.35})` }} />
            <div className="ring" style={{ inset: -6, background: 'rgba(255,107,91,.22)' }} />
            <div className="core">{busy ? '💭' : '🎤'}</div>
          </div>
          <button className="side-btn" onClick={() => setTyping((v) => !v)}>⌨️<br />もじ</button>
        </div>
        <div className="cap">{caption || (busy ? `${persona.name}が かんがえてるよ…` : recording ? 'きいてるよ…' : 'おしながら はなしてね')}</div>
      </div>

      {stopped && (
        <div className="overlay">
          <div className="card">
            <img src={persona.image} alt="" className="monster-sleep" style={{ width: 140, height: 140, objectFit: 'contain' }} />
            {stopped === 'exhausted' ? (
              <>
                <div className="en" style={{ fontSize: 22, fontWeight: 800 }}>I'm sleepy… See you tomorrow!</div>
                <p style={{ fontWeight: 900, marginTop: 6 }}>きょうは おしまい。また あした！</p>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 900, marginTop: 6 }}>おうちのひとに ログインしてもらってね</p>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>「おうちのひと」→「AIのせつぞく」から mana-evo と同じアカウントでログインできます</p>
              </>
            )}
            <button className="press cta" style={{ marginTop: 16, height: 56, fontSize: 18 }} onClick={finish}>わかった</button>
          </div>
        </div>
      )}
    </div>
  )
}

// 子どもの言葉を言い直した部分に、うすくマーカーを引く
function Highlight({ text, mark }) {
  if (!mark) return text
  const core = mark.replace(/^I\s+/i, '').replace(/[.!?]$/, '').trim()
  if (core.length < 3) return text
  const index = text.toLowerCase().indexOf(core.toLowerCase())
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}<span className="mark">{text.slice(index, index + core.length)}</span>{text.slice(index + core.length)}
    </>
  )
}
