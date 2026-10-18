import React, { useCallback, useEffect, useRef, useState } from 'react'
import { personaOf } from '../data/personas.js'
import { levelOf } from '../data/levels.js'
import { MODES } from '../data/modes.js'
import { annotatorMessage, buildHistory, buildLiveAnnotatorPrompt, buildLiveSystemPrompt, buildSystemPrompt, selectMemory } from '../data/prompt.js'
import { modelToday, todayKey, withMemory, withModelResult, withUtterance } from '../lib/state.js'
import { nextReading } from '../lib/kana.js'
import { Recorder, micSupported } from '../lib/recorder.js'
import { speak, stopSpeech, unlockSpeech } from '../lib/tts.js'
import { sendTurn, TalkError } from '../lib/talk.js'
import { LiveSession, reportLiveProblem, requestLiveToken } from '../lib/live.js'
import { Annotator } from '../lib/annotator.js'
import { Transcriber } from '../lib/transcriber.js'
import { isMockMode } from '../lib/config.js'
import { Reading } from '../components/ui.jsx'

// Live の文字起こしが英語か日本語として読めるか（スペイン語などに化けたものは出さない）
const READABLE = /^[\x20-\x7E\u3000-\u30FF\u4E00-\u9FFF\uFF01-\uFF5E\s]*$/

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
    return { who: 'partner', text: en, kana, ja, jaKids: ja, hints: [], opener: true }
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
    jaKids: reply.reply_ja_kids,
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
  // 日本語の意味：子どもは段階4まで最初から出す（段階5は全部英語）。大人の練習も出す
  const [showJa, setShowJa] = useState(adult || levelOf(state.level).japanese !== 'english-only')
  const [typing, setTyping] = useState(adult || !micSupported())
  const [text, setText] = useState('')
  const [pickedHint, setPickedHint] = useState(null)
  const [talkingIndex, setTalkingIndex] = useState(-1)
  const [stopped, setStopped] = useState(null) // 'exhausted' | 'auth' | 'offline'
  const [caption, setCaption] = useState('')
  const [engine, setEngine] = useState('connecting') // connecting | live | turn

  const recorder = useRef(null)
  const pressing = useRef(false)
  const stopping = useRef(false) // 離したあとの録り足し中
  const logRef = useRef(null)
  const startedAt = useRef(new Date().toISOString())
  const turnsRef = useRef(turns)
  turnsRef.current = turns
  const memoryAdded = useRef([])
  const finished = useRef(false)
  const live = useRef(null)
  const annotator = useRef(null) // 読み・意味・ヒントづくり（Live の文字だけの接続）
  const transcriber = useRef(null) // 子どもの声の文字起こし（3.5 Transcribe Live）
  const usingAsr = useRef(false) // この発話を文字起こし経由で相棒に渡すか
  const heldChunks = useRef([]) // 文字起こしが空だったとき、相棒に声をそのまま送りなおす用
  const workingTranscription = useRef(null) // つながったときの聞き取り設定（つなぎなおしでも同じものを使う）
  const liveTurn = useRef({ child: '', partner: '', start: false, id: 0 })
  const pendingEnd = useRef(false)
  const waitTimer = useRef(null)
  const liveAudio = useRef(new Map()) // turnId → 相棒の声
  const stateRef = useRef(state)
  stateRef.current = state

  const childTurnCount = turns.filter((turn) => turn.who === 'child').length
  const latestPartnerIndex = turns.map((turn) => turn.who).lastIndexOf('partner')
  const latest = turns[latestPartnerIndex]

  const makeContext = (turn) => ({
    mode: config.mode,
    persona: persona.id,
    level: stateRef.current.level,
    nickname: stateRef.current.profile?.nickname,
    topic: config.topic,
    play: config.play,
    secret: config.secret,
    adultScene: config.adultScene,
    parentReads: config.parentReads,
    memory: adult ? [] : selectMemory(stateRef.current.memory),
    turn,
    maxTurns: mode.maxTurns
  })

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
    live.current?.close()
    annotator.current?.close()
    transcriber.current?.close()
    clearTimeout(waitTimer.current)
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
    const context = makeContext(turnNumber)
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
      } else if (code === 'offline') {
        setStopped('offline')
      } else {
        setCaption(code === 'network' ? 'つうしんが うまく いかなかったよ。もういちど！' : 'もういちど はなしてみてね')
      }
    }
  }, [busy, childTurnCount, config, persona.id, state, adult, mode.maxTurns, update, say, finish])

  // ---------- Live（リアルタイム会話） ----------
  const childCount = () => turnsRef.current.filter((turn) => turn.who === 'child' && !turn.pending).length

  // Live の文字起こしは少しずつ届くので、その往復（turnId）の吹き出しを書きかえていく
  const setLiveBubble = (who, text) => {
    const turnId = liveTurn.current.id
    setTurns((prev) => {
      const next = [...prev]
      const index = next.findLastIndex((turn) => turn.turnId === turnId && turn.who === who)
      if (index >= 0) {
        next[index] = { ...next[index], text, english: who === 'child' ? /[a-z]/i.test(text) : next[index].english }
        return next
      }
      const bubble = who === 'child'
        ? { who, text, pending: true, live: true, turnId, english: /[a-z]/i.test(text) }
        : { who, text, live: true, turnId, kana: '', ja: '', hints: [] }
      const partnerIndex = next.findLastIndex((turn) => turn.turnId === turnId && turn.who === 'partner')
      if (who === 'child' && partnerIndex >= 0) next.splice(partnerIndex, 0, bubble)
      else next.push(bubble)
      return next
    })
  }

  const newLiveTurn = (start = false) => {
    liveTurn.current = { child: '', partner: '', start, id: Date.now() }
  }

  const waitForReply = () => {
    setBusy(true)
    clearTimeout(waitTimer.current)
    waitTimer.current = setTimeout(() => { setBusy(false); setCaption('もういちど はなしてみてね') }, 15000)
  }

  const annotateLive = async (liveChildText, partnerText, turnId) => {
    const turn = childCount()
    const byeBye = /bye[- ]?bye|see you/i.test(partnerText)
    const previousPartner = [...turnsRef.current].reverse().find((item) => item.who === 'partner' && item.turnId !== turnId)?.text || ''
    const reply = annotator.current
      ? await annotator.current.ask(annotatorMessage({ previousPartner, childText: liveChildText, partnerText, turn, maxTurns: mode.maxTurns }))
      : null // 読みや訳が出せなくても、会話はそのまま続ける
    // 子どもの言葉は、Live の文字起こしを相棒の返事から推測しなおしたものを優先
    const childText = (liveChildText || reply?.child_said) ? String(reply?.child_said || liveChildText) : ''
    if (reply) {
      setTurns((prev) => prev.map((item) => {
        if (item.turnId !== turnId) return item
        if (item.who === 'partner') {
          return { ...item, kana: String(reply.reply_kana || ''), ipa: String(reply.reply_ipa || ''), ja: String(reply.reply_ja || ''), jaKids: String(reply.reply_ja_kids || ''), hints: Array.isArray(reply.hints) ? reply.hints.slice(0, 3) : [], tip: String(reply.tip_ja || '') }
        }
        return { ...item, text: childText || item.text, english: Boolean(reply.spoke_english), lang: reply.child_lang, recast: String(reply.recast || '') }
      }))
    }
    if (childText && !adult) {
      const english = reply ? Boolean(reply.spoke_english) : /[a-z]/i.test(childText)
      const memory = Array.isArray(reply?.memory) ? reply.memory : []
      update((prev) => withMemory(withUtterance(prev, { english, text: childText }), memory, persona.id))
      if (reply?.memory?.length) memoryAdded.current.push(...reply.memory)
    }
    if (reply?.end || (byeBye && turn >= 3)) {
      pendingEnd.current = true
      if (!live.current?.speaking) setTimeout(finish, 900)
    }
  }

  const startTurnEngine = () => {
    setEngine('turn')
    const first = turnsRef.current[0]
    if (first) say(first.text, 0)
    else send({ text: '[START]' })
  }

  // 選んだ Live モデルでだめなら、もう1つの Live モデルで試してから予備の方式へ
  const startLive = async () => {
    const choice = stateRef.current.liveModel || 'auto'
    const order = ['3-flash', '3.8', '2.5-audio']
    const attempts = choice === 'auto' ? order : [choice, ...order.filter((id) => id !== choice)]
    const tried = new Set()
    let lastError = null
    for (const attempt of attempts) {
      // 聞き取りを英語・日本語に限定する設定を受けつけないモデルなら、設定なしでもう一度
      for (const withHints of [true, false]) {
        if (finished.current) return
        let model = ''
        try {
          const granted = await requestLiveToken(attempt, 'voice')
          model = granted.model
          if (tried.has(`${model}:${withHints}`)) break
          tried.add(`${model}:${withHints}`)
          const transcription = withHints ? transcriptionHints() : {}
          const session = createLiveSession({ ...granted, transcription })
          await session.connect()
          onLiveConnected(session, model)
          try {
            await Promise.race([session.firstTurn, new Promise((_, reject) => setTimeout(() => reject(new Error('live first reply timeout')), 12000))])
          } catch (error) {
            if (live.current === session) live.current = null
            session.close()
            clearTimeout(waitTimer.current)
            setBusy(false)
            throw error
          }
          session.probing = false
          workingTranscription.current = transcription
          update((prev) => ({ ...prev, liveDate: todayKey(), liveModelName: model, liveError: null }))
          return
        } catch (error) {
          lastError = error
          const info = { step: model ? 'connect' : 'token', choice: attempt, model, hints: withHints, message: String(error?.message || error) }
          update((prev) => ({ ...prev, liveError: { ...info, at: new Date().toISOString() } }))
          reportLiveProblem(info)
          if (!model) break
        }
      }
    }
    throw lastError || new Error('live unavailable')
  }

  // 子どもの声の聞き取り：英語と日本語だけにしぼり、この会話で出そうな単語を優先させる
  const transcriptionHints = () => {
    const words = new Set(['yes', 'no', 'hello', 'hi', 'cat', 'dog', 'I like', 'I want', 'red', 'blue', 'yellow', 'green', 'big', 'small', 'thank you', 'bye-bye', persona.nameEn])
    for (const phrase of config.play?.scene?.phrases || []) words.add(phrase.replace(/_+/g, '').trim())
    if (config.secret?.en) words.add(config.secret.en.replace(/^(a|an) /, ''))
    for (const word of (config.topic?.about || '').split(/[,\s]+/)) if (word.length > 2) words.add(word)
    return { languageCodes: ['en-US', 'ja-JP'], customVocabulary: [...words].filter(Boolean).slice(0, 40) }
  }

  const createLiveSession = ({ token, model, transcription = {} }) => {
    return new LiveSession({
      transcription,
      muted: Boolean(config.parentReads),
      token,
      model,
      system: buildLiveSystemPrompt(makeContext(0)),
      voiceName: stateRef.current.voices?.[persona.id] || persona.liveVoice,
      handlers: {
        onPartnerText: (text) => {
          liveTurn.current.partner += text
          if (liveTurn.current.start && turnsRef.current[0]?.opener) return
          setLiveBubble('partner', liveTurn.current.partner.trim())
        },
        onChildText: (text) => {
          if (liveTurn.current.typed) return
          liveTurn.current.child += text
          // 英語か日本語として読めれば、すぐ吹き出しに出す（化けていたら聞きなおすまで「…」）
          const heard = liveTurn.current.child.trim()
          if (heard && READABLE.test(heard)) setLiveBubble('child', heard)
        },
        onSpeaking: (speaking) => {
          setTalkingIndex(speaking ? 'latest' : -1)
          if (!speaking && pendingEnd.current) setTimeout(finish, 700)
        },
        onTurnComplete: (audio) => {
          clearTimeout(waitTimer.current)
          setBusy(false)
          const { child, partner, start, id } = liveTurn.current
          if (audio.length) liveAudio.current.set(start && turnsRef.current[0]?.opener ? 'opener' : id, audio)
          newLiveTurn()
          setTurns((prev) => prev.map((item) => (item.turnId === id ? { ...item, live: false, pending: false } : item)))
          if (start && turnsRef.current[0]?.opener) return
          // 声の聞きなおしは、文字起こしが空・化けている・日本語（"ちゃ" など）のときだけ
          annotateLive(child.trim(), partner.trim(), id)
        },
        onClose: (event) => {
          if (finished.current) return
          reportLiveProblem({ step: 'closed', model, message: `${event?.code} ${event?.reason || ''}` })
          live.current = null
          setBusy(false)
          reconnectLive()
        }
      }
    })
  }

  // 会話の途中で Live が切れたら、Live のままつなぎなおして続きから話す。2回だめなら予備の方式へ
  const reconnects = useRef(0)
  const reconnectLive = async () => {
    reconnects.current += 1
    setEngine('connecting')
    setCaption('つなぎなおしてるよ…')
    try {
      if (reconnects.current > 2) throw new Error('too many reconnects')
      const granted = await requestLiveToken(stateRef.current.liveModel || 'auto', 'voice')
      if (finished.current) return
      const session = createLiveSession({ ...granted, transcription: workingTranscription.current ?? transcriptionHints() })
      await session.connect()
      session.probing = false
      live.current = session
      setEngine('live')
      const history = buildHistory(turnsRef.current.filter((turn) => !turn.pending && turn.text && turn.text !== '…'), 12)
        .map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }))
      session.sendHistory(history)
      setCaption('')
    } catch (error) {
      reportLiveProblem({ step: 'reconnect', message: String(error?.message || error) })
      if (finished.current) return
      setEngine('connecting')
      setStopped('offline')
    }
  }

  const retryLive = () => {
    setStopped(null)
    reconnects.current = 0
    if (turnsRef.current.some((turn) => turn.who === 'child')) reconnectLive()
    else startLive().catch(() => { if (!finished.current) setStopped('offline') })
  }

  const onLiveConnected = (session, model) => {
    live.current = session
    setEngine('live')
    if (!annotator.current) {
      annotator.current = new Annotator({ system: buildLiveAnnotatorPrompt(makeContext(0)) })
      annotator.current.ensure().catch(() => {})
    }
    if (!transcriber.current) {
      transcriber.current = new Transcriber({ transcription: transcriptionHints() })
      transcriber.current.ensure()
    }
    const first = turnsRef.current[0]
    newLiveTurn(true)
    waitForReply()
    session.sendStart(first ? `[START] Begin by saying exactly this line, then wait for the child: "${first.text}"` : '[START]')
  }

  // はじめのひとこと。Live につながればリアルタイム、だめなら1回ずつ送る方式
  useEffect(() => {
    if (micSupported()) {
      recorder.current = new Recorder()
      recorder.current.onLevel = setMicLevel
      recorder.current.warmUp()
    }
    // 会話も読みづくりも、上限のない Live の中だけで行う（確認用の mock だけ1回ずつの方式）
    if (isMockMode()) startTurnEngine()
    else startLive().catch(() => { if (!finished.current) setStopped('offline') })
    return () => { stopSpeech(); recorder.current?.close(); live.current?.close(); annotator.current?.close(); transcriber.current?.close(); clearTimeout(waitTimer.current) }
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns.length, busy])

  const startRecording = async (event) => {
    event.preventDefault()
    if (busy || recording || stopped || stopping.current) return
    pressing.current = true
    unlockSpeech()
    stopSpeech()
    try {
      if (!recorder.current) {
        recorder.current = new Recorder()
        recorder.current.onLevel = setMicLevel
      }
      if (live.current) {
        newLiveTurn()
        heldChunks.current = []
        const asr = transcriber.current?.ready ? transcriber.current : null
        usingAsr.current = Boolean(asr)
        if (asr) {
          // 声は文字起こし専用モデルへ。相棒には確定した文字を渡す（聞きまちがいが少ない）
          live.current.silenceCurrentTurn()
          asr.begin()
          recorder.current.onChunk = (chunk) => { heldChunks.current.push(chunk); asr.sendAudio(chunk) }
        } else {
          live.current.beginSpeech()
          recorder.current.onChunk = (chunk) => live.current?.sendAudio(chunk)
        }
      } else {
        recorder.current.onChunk = null
      }
      await recorder.current.start()
      // はじめてのマイク許可ダイアログの間に指を離していたら、録音しない
      if (!pressing.current) { recorder.current.stop(); return }
      setRecording(true)
      setCaption('はなしてね… はなしたら ゆびを はなす')
      // 0.8秒たっても音が届かなければ、マイクが止まっている。作りなおして、もういちど押してもらう
      const rec = recorder.current
      setTimeout(() => {
        if (rec !== recorder.current || !rec.silentSinceStart) return
        rec.recording = false
        rec.close()
        if (live.current && !usingAsr.current) live.current.endSpeech()
        if (usingAsr.current) transcriber.current?.end()
        pressing.current = false
        setRecording(false)
        setCaption('マイクを じゅんびしたよ。もういちど おしてね')
      }, 800)
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
    // 指を離したあとも少しだけ録りつづける（言い終わりが切れないように）
    const rec = recorder.current
    stopping.current = true
    setTimeout(async () => {
      stopping.current = false
      if (!rec.isRecording) return
      const audio = rec.stop()
      if (live.current && usingAsr.current) {
        if (audio.seconds < 0.5) { transcriber.current?.end(); return setCaption('ながめに おしながら はなしてね') }
        setLiveBubble('child', '…')
        setCaption('')
        waitForReply()
        const text = await transcriber.current.end()
        if (!live.current || finished.current) return
        if (text) {
          liveTurn.current.child = text
          liveTurn.current.typed = true
          setLiveBubble('child', text)
          live.current.sendText(text)
        } else {
          // 文字にならなかったときは、相棒に声をそのまま送る
          live.current.beginSpeech()
          for (const chunk of heldChunks.current) live.current.sendAudio(chunk)
          live.current.endSpeech()
        }
        return
      }
      if (live.current) {
        live.current.endSpeech()
        if (audio.seconds < 0.5) return setCaption('ながめに おしながら はなしてね')
        setLiveBubble('child', '…')
        setCaption('')
        return waitForReply()
      }
      if (audio.seconds < 0.5) return setCaption('ながめに おしながら はなしてね')
      if (audio.loudness < 0.004) return setCaption('こえが きこえなかったよ。もういちど！')
      send({ audio: { mime: audio.mime, data: audio.base64 } })
    }, 300)
  }

  const tapHint = (hint) => {
    unlockSpeech()
    if (pickedHint?.en === hint.en) {
      sendTyped(hint.en, `[HINT] ${hint.en}`)
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
    sendTyped(value, value)
  }

  // 文字やヒントで答えたとき
  function sendTyped(display, message) {
    setPickedHint(null)
    if (!live.current) return send({ text: message }, display)
    if (busy) return
    newLiveTurn()
    liveTurn.current.child = display
    liveTurn.current.typed = true
    setLiveBubble('child', display)
    live.current.sendText(message)
    waitForReply()
  }

  const dontKnow = () => {
    unlockSpeech()
    if (!live.current) return send({ text: '[DONT_KNOW]' })
    if (busy) return
    newLiveTurn()
    live.current.sendText('[DONT_KNOW]')
    waitForReply()
  }

  // 🔊：Live の声が残っていればそれを、なければ端末の読み上げで
  const replay = (turn, index) => {
    unlockSpeech()
    const audio = liveAudio.current.get(turn.opener ? 'opener' : turn.turnId)
    if (live.current && audio) return live.current.replay(audio)
    setTalkingIndex(index)
    speak(turn.text, voice).then(() => setTalkingIndex(-1))
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
                {showJa && (adult ? turn.ja : (turn.jaKids || turn.ja)) && (
                  <div className={adult ? 'ja' : 'ja kids'}>{adult ? turn.ja : (turn.jaKids || turn.ja)}</div>
                )}
                {!turn.live && <button className="speak" aria-label="もういちど きく" onClick={() => replay(turn, index)}>🔊</button>}
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
                {!adult && showJa && hint.ja && <div className="m">{hint.ja}</div>}
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
          <button className="side-btn" disabled={busy} onClick={dontKnow}>
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
        <div className="cap">{caption || (engine === 'connecting' ? `${persona.name}に つないでるよ…` : busy ? `${persona.name}が かんがえてるよ…` : recording ? 'きいてるよ…' : 'おしながら はなしてね')}</div>
      </div>

      {stopped && (
        <div className="overlay">
          <div className="card">
            <img src={persona.image} alt="" className="monster-sleep" style={{ width: 140, height: 140, objectFit: 'contain' }} />
            {stopped === 'offline' ? (
              <>
                <p style={{ fontWeight: 900, marginTop: 6 }}>{persona.name}に つながらなかったよ</p>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>でんぱの いい ところで もういちど ためしてね</p>
                <button className="press cta" style={{ marginTop: 16, height: 56, fontSize: 18 }} onClick={retryLive}>もういちど</button>
              </>
            ) : stopped === 'exhausted' ? (
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
            <button className={stopped === 'offline' ? 'press btn ghost' : 'press cta'} style={{ marginTop: stopped === 'offline' ? 10 : 16, height: 56, fontSize: 18, width: '100%' }} onClick={finish}>{stopped === 'offline' ? 'おわる' : 'わかった'}</button>
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
