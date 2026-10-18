import React, { useCallback, useEffect, useRef, useState } from 'react'
import { personaOf } from '../data/personas.js'
import { levelOf } from '../data/levels.js'
import { MODES } from '../data/modes.js'
import { annotatorMessage, buildAnnotatorPrompt, buildHistory, buildLiveSystemPrompt, buildSystemPrompt, selectMemory } from '../data/prompt.js'
import { modelToday, todayKey, withMemory, withModelResult, withUtterance } from '../lib/state.js'
import { nextReading, cleanHint, tidyKidsJa } from '../lib/kana.js'
import { Recorder, micSupported, setPlaybackSession } from '../lib/recorder.js'
import { speak, stopSpeech, unlockSpeech } from '../lib/tts.js'
import { sendTurn, TalkError } from '../lib/talk.js'
import { LiveSession, reportLiveProblem, requestLiveToken } from '../lib/live.js'
import { Transcriber } from '../lib/transcriber.js'
import { Annotator } from '../lib/annotator.js'
import { buildAdultAnnotatorPrompt, buildAdultLiveSystemPrompt } from '../data/adult.js'
import { withAdultMemory, withCards } from '../lib/adult.js'
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

// Gemini のモデル名 → english-talk に頼むときの名前（続きからつなぎなおすときは同じモデルが必要）
function liveModelId(name) {
  if (/3\.8-live/.test(name)) return '3.8'
  if (/flash-live/.test(name)) return '3-flash'
  if (/2\.5-flash-native-audio/.test(name)) return '2.5-audio'
  return ''
}

function openerTurn(config) {
  if (config.mode === 'free' && config.topic) {
    const { en, kana, ja } = config.topic.opener
    return { who: 'partner', text: en, kana, ja, jaKids: ja, hints: [], opener: true }
  }
  if (config.mode === 'adult') return { who: 'partner', text: config.adultScene.opener, kana: '', ja: config.adultScene.openerJa || '', hints: [], opener: true }
  return null
}

// 大人の相棒（Alex）は画像のかわりに絵文字。会話画面で使う形にそろえる
function adultPersona(partner) {
  return { ...partner, nameEn: partner.name, image: null, theme: { glow: 'rgba(47,199,159,.35)' } }
}

function Avatar({ persona, className = '', size }) {
  if (persona.image) return <img src={persona.image} alt="" className={className} style={size ? { width: size, height: size, objectFit: 'contain' } : undefined} />
  return <div className={`avatar ${className}`} style={size ? { width: size, height: size, fontSize: size * 0.55 } : undefined}>{persona.emoji}</div>
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

export default function Talk({ state, update, config, onFinish, showToast, onAdultCard }) {
  const persona = config.adultPartner ? adultPersona(config.adultPartner) : personaOf(config.partner)
  const adult = config.mode === 'adult'
  const level = levelOf(adult ? 5 : state.level)
  const mode = MODES[config.mode] || MODES.free
  const voice = { ...persona.voice, rate: adult ? 0.95 : persona.voice.rate * level.speechRate }
  const title = titleOf(config)
  const say2 = (kid, grown) => (adult ? grown : kid) // 子ども向け／大人向けの言い方

  const [turns, setTurns] = useState(() => { const first = openerTurn(config); return first ? [first] : [] })
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  // 日本語の意味：子どもは段階4まで最初から出す（段階5は全部英語）。大人の練習も出す
  const [showJa, setShowJa] = useState(adult || levelOf(state.level).japanese !== 'english-only')
  const [typing, setTyping] = useState(!micSupported())
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
  const cardsAdded = useRef([]) // 大人：この会話で復習カードになった言い方
  const [elapsed, setElapsed] = useState(0) // 大人：時間を決めた会話の経過（分）
  const wrapped = useRef(false)
  const finished = useRef(false)
  const live = useRef(null)
  const lastTurnId = useRef(0) // 最後に終わった往復（カードが遅れて届いたとき用）
  const annotator = useRef(null) // 画面カードづくりの裏方（音を鳴らさない Live）
  const transcriber = useRef(null) // 子どもの声の文字起こし（3.5 Transcribe Live）
  const usingAsr = useRef(false) // この発話を文字起こし経由で相棒に渡すか
  const heldChunks = useRef([]) // 文字起こしが空だったとき、相棒に声をそのまま送りなおす用
  const workingSetup = useRef(null) // つながったときの設定（聞き取り・カード）。つなぎなおしでも同じものを使う
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

  const finish = useCallback((stopped = false) => {
    if (finished.current) return
    finished.current = true
    stopSpeech()
    recorder.current?.close()
    live.current?.close()
    transcriber.current?.close()
    annotator.current?.close()
    clearTimeout(waitTimer.current)
    onFinish({
      id: `s${Date.now()}`,
      mode: config.mode,
      partner: persona.id,
      title: title.text,
      emoji: title.emoji,
      topicId: config.topic?.id || null,
      startedAt: startedAt.current,
      turns: turnsRef.current.filter((turn) => turn.text && turn.text !== '…').map(({ who, text, ja, english, lang, recast, tip }) => ({ who, text, ja, english, lang, recast, tip }))
    }, { memoryAdded: memoryAdded.current, cardsAdded: cardsAdded.current, stopped: stopped === true })
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

      if (!special && heard && adult) {
        const learn = Array.isArray(reply.learn) ? reply.learn : []
        if (reply.tip_ja) setTurns((prev) => { const next = [...prev]; const i = next.findLastIndex((turn) => turn.who === 'child'); if (i >= 0) next[i] = { ...next[i], tip: reply.tip_ja }; return next })
        if (reply.memory?.length || learn.length) onAdultCard?.((current) => withCards(withAdultMemory(current, reply.memory || []), learn, config.adultScene?.title || ''))
        memoryAdded.current.push(...(reply.memory || []))
        cardsAdded.current.push(...learn)
      }
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
  // 文字が少しずつ届くたびに描きなおすと iPhone が重くなり音がとぎれるので、まとめて描く
  const bubbleQueue = useRef({})
  const bubbleTimer = useRef(null)
  const setLiveBubble = (who, text) => {
    bubbleQueue.current[who] = { text, turnId: liveTurn.current.id }
    if (bubbleTimer.current) return
    bubbleTimer.current = setTimeout(flushBubbles, 150)
  }

  const flushBubbles = () => {
    clearTimeout(bubbleTimer.current)
    bubbleTimer.current = null
    const queued = bubbleQueue.current
    bubbleQueue.current = {}
    for (const key of ['child', 'partner']) if (queued[key]) writeLiveBubble(key, queued[key].text, queued[key].turnId)
  }

  const writeLiveBubble = (who, text, turnId) => {
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
    waitTimer.current = setTimeout(() => { setBusy(false); setCaption(say2('もういちど はなしてみてね', 'もう一度話してみてください')) }, 15000)
  }

  // 1往復が終わったとき：子どもの発話を記録（カードが来たら英語判定などを上書き）
  const recordTurn = (childText, partnerText) => {
    if (childText && !adult) {
      update((prev) => withUtterance(prev, { english: /[a-z]/i.test(childText), text: childText }))
    }
    if (/bye[- ]?bye|see you/i.test(partnerText) && childCount() >= 3) {
      pendingEnd.current = true
      if (!live.current?.speaking) setTimeout(finish, 900)
    }
  }

  // 裏方に、この往復の画面カードを頼む
  const annotateTurn = async (childText, partnerText, turnId) => {
    if (!annotator.current || !partnerText) return
    const previousPartner = [...turnsRef.current].reverse().find((item) => item.who === 'partner' && item.turnId !== turnId)?.text || ''
    const card = await annotator.current.ask(annotatorMessage({ previousPartner, childText, partnerText }), partnerText)
    if (card && !finished.current) applyCard(card, turnId)
  }

  // 相棒から届いた画面カード（読み・ひらがなの意味・ヒント・子どもの言葉の補正）を、その往復の吹き出しに付ける
  const applyCard = (card, explicitTurnId) => {
    const current = liveTurn.current
    if (!explicitTurnId && current.start && turnsRef.current[0]?.opener) return
    const turnId = explicitTurnId || (current.partner || current.child ? current.id : lastTurnId.current)
    const childSaid = String(card.child_said || '').trim()
    setTurns((prev) => prev.map((item) => {
      if (item.turnId !== turnId) return item
      if (item.who === 'partner') {
        return { ...item, kana: String(card.kana || ''), ja: String(card.ja || card.ja_kids || ''), jaKids: tidyKidsJa(card.ja_kids), hints: Array.isArray(card.hints) ? card.hints.slice(0, 3).map(cleanHint) : [], tip: String(card.tip_ja || '') }
      }
      return { ...item, text: childSaid || item.text, english: card.spoke_english ?? item.english, recast: String(card.recast || '') }
    }))
    const memory = Array.isArray(card.memory) ? card.memory.map(String).filter(Boolean) : []
    if (adult) {
      const learn = Array.isArray(card.learn) ? card.learn.filter((item) => item?.en && item?.ja) : []
      if (card.tip_ja) setTurns((prev) => prev.map((item) => (item.turnId === turnId && item.who === 'child' ? { ...item, tip: String(card.tip_ja) } : item)))
      if (memory.length || learn.length) onAdultCard?.((current) => withCards(withAdultMemory(current, memory), learn, config.adultScene?.title || ''))
      memoryAdded.current.push(...memory)
      cardsAdded.current.push(...learn)
    } else if (memory.length) {
      update((prev) => withMemory(prev, memory, persona.id))
      memoryAdded.current.push(...memory)
    }
    if (card.end && !adult) {
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
      // 受けつけない設定があれば外していく：聞き取りの言語指定・画面カード（声を止めない→止める→なし）
      // 相棒は会話だけに集中させる（画面カードは裏方が作る）
      // resume：切れても続きからつなぎなおせる設定。受けつけないモデルでは外す
      const setups = [
        { hints: true, card: null, resume: true },
        { hints: true, card: null, resume: false },
        { hints: false, card: null, resume: false }
      ]
      for (const setup of setups) {
        if (finished.current) return
        let model = ''
        try {
          const granted = await requestLiveToken(attempt, 'voice')
          model = granted.model
          const key = `${model}:${setup.hints}:${setup.resume}`
          if (tried.has(key)) continue
          tried.add(key)
          const transcription = setup.hints ? transcriptionHints() : {}
          const session = createLiveSession({ ...granted, transcription, card: setup.card, resume: setup.resume })
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
          workingSetup.current = { transcription, card: setup.card, resume: setup.resume }
          update((prev) => ({ ...prev, liveDate: todayKey(), liveModelName: model, liveError: null }))
          return
        } catch (error) {
          lastError = error
          const info = { step: model ? 'connect' : 'token', choice: attempt, model, setup: `${setup.hints}/${setup.resume}`, message: String(error?.message || error) }
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
    if (adult) {
      const words = new Set([persona.nameEn, 'meeting', 'deadline', 'project', 'boss', 'client', 'weekend', 'my son', 'my wife', ...(config.adultCtx?.phrases || [])])
      return { languageCodes: ['en-US', 'ja-JP'], customVocabulary: [...words].filter(Boolean).slice(0, 40) }
    }
    const words = new Set(['yes', 'no', 'hello', 'hi', 'cat', 'dog', 'I like', 'I want', 'red', 'blue', 'yellow', 'green', 'big', 'small', 'thank you', 'bye-bye', persona.nameEn])
    for (const phrase of config.play?.scene?.phrases || []) words.add(phrase.replace(/_+/g, '').trim())
    if (config.secret?.en) words.add(config.secret.en.replace(/^(a|an) /, ''))
    for (const word of (config.topic?.about || '').split(/[,\s]+/)) if (word.length > 2) words.add(word)
    return { languageCodes: ['en-US', 'ja-JP'], customVocabulary: [...words].filter(Boolean).slice(0, 40) }
  }

  const createLiveSession = ({ token, model, transcription = {}, card = null, resume = false, resumeHandle = '' }) => {
    return new LiveSession({
      transcription,
      card,
      resume,
      resumeHandle,
      muted: Boolean(config.parentReads),
      token,
      model,
      system: config.adultCtx
        ? buildAdultLiveSystemPrompt({ partner: persona, course: config.adultScene, opener: config.adultScene.opener, ...config.adultCtx })
        : buildLiveSystemPrompt({ ...makeContext(0), withCard: Boolean(card) }),
      voiceName: adult ? persona.liveVoice : stateRef.current.voices?.[persona.id] || persona.liveVoice,
      handlers: {
        onCard: applyCard,
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
          flushBubbles()
          newLiveTurn()
          setTurns((prev) => prev.map((item) => (item.turnId === id ? { ...item, live: false, pending: false } : item)))
          if (start && turnsRef.current[0]?.opener) return
          // 声の聞きなおしは、文字起こしが空・化けている・日本語（"ちゃ" など）のときだけ
          lastTurnId.current = id
          reconnects.current = 0 // 1往復できたら、つなぎなおしの回数をもどす
          recordTurn(child.trim(), partner.trim())
          annotateTurn(child.trim(), partner.trim(), id)
        },
        onClose: (event) => {
          if (finished.current) return
          reportLiveProblem({ step: 'closed', model, message: `${event?.code} ${event?.reason || ''}` })
          resumeRef.current = live.current?.resumeHandle || ''
          resumeModel.current = live.current?.model || ''
          live.current = null
          setBusy(false)
          reconnectLive()
        }
      }
    })
  }

  // 会話の途中で Live が切れたら、Live のままつなぎなおして続きから話す。2回だめなら予備の方式へ
  const reconnects = useRef(0)
  const resumeRef = useRef('')
  const resumeModel = useRef('')
  const reconnectLive = async () => {
    reconnects.current += 1
    setEngine('connecting')
    setCaption(say2('つなぎなおしてるよ…', 'つなぎ直しています…'))
    try {
      if (reconnects.current > 2) throw new Error('too many reconnects')
      const setup = workingSetup.current ?? { transcription: transcriptionHints(), card: null, resume: false }
      // 続きの目印があれば、同じモデルでその続きから（会話の流れがそのまま残る）。だめなら会話を渡して新しく
      const handle = setup.resume ? resumeRef.current : ''
      let session = null
      if (handle && liveModelId(resumeModel.current)) {
        try {
          const granted = await requestLiveToken(liveModelId(resumeModel.current), 'voice')
          if (finished.current) return
          session = createLiveSession({ ...granted, ...setup, resumeHandle: handle })
          await session.connect()
        } catch (error) {
          reportLiveProblem({ step: 'resume', message: String(error?.message || error) })
          session = null
        }
      }
      const resumed = Boolean(session)
      if (!session) {
        const granted = await requestLiveToken(stateRef.current.liveModel || 'auto', 'voice')
        if (finished.current) return
        session = createLiveSession({ ...granted, ...setup })
        await session.connect()
      }
      session.probing = false
      live.current = session
      setEngine('live')
      if (!resumed) {
        const history = buildHistory(turnsRef.current.filter((turn) => !turn.pending && turn.text && turn.text !== '…'), 12)
          .map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }))
        session.sendHistory(history)
      }
      setCaption('')
    } catch (error) {
      reportLiveProblem({ step: 'reconnect', message: String(error?.message || error) })
      if (finished.current) return
      setEngine('connecting')
      setStopped('offline')
    }
  }

  // Live は2〜3分で向こうから切られる（返事の途中で切れると止まる）。
  // 話していないすきに、続きの目印を使って新しい接続に入れかえておく
  const refreshing = useRef(false)
  const refreshLive = async () => {
    const old = live.current
    if (!old || refreshing.current || finished.current) return
    refreshing.current = true
    const setup = workingSetup.current ?? { transcription: transcriptionHints(), card: null, resume: false }
    const handle = setup.resume ? old.resumeHandle : ''
    try {
      const granted = await requestLiveToken(liveModelId(old.model) || stateRef.current.liveModel || 'auto', 'voice')
      const fresh = createLiveSession({ ...granted, ...setup, resumeHandle: handle })
      await fresh.connect()
      fresh.probing = false
      // つないでいる間に話しはじめていたら、今回はやめる（次のすきに）
      if (finished.current || live.current !== old || pressing.current || stopping.current || busyRef.current || old.speaking) { fresh.close(); return }
      if (!handle) {
        const history = buildHistory(turnsRef.current.filter((turn) => !turn.pending && turn.text && turn.text !== '…'), 12)
          .map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }))
        fresh.sendHistory(history)
      }
      live.current = fresh
      old.close()
    } catch (error) {
      reportLiveProblem({ step: 'refresh', message: String(error?.message || error) })
    } finally {
      refreshing.current = false
    }
  }
  const busyRef = useRef(false)
  busyRef.current = busy
  useEffect(() => {
    const timer = setInterval(() => {
      const session = live.current
      if (session && session.age > 100000 && !pressing.current && !stopping.current && !busyRef.current && !session.speaking) refreshLive()
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const retryLive = () => {
    setStopped(null)
    reconnects.current = 0
    if (turnsRef.current.some((turn) => turn.who === 'child')) reconnectLive()
    else startLive().catch(() => { if (!finished.current) setStopped('offline') })
  }

  const onLiveConnected = (session, model) => {
    live.current = session
    setEngine('live')
    if (!transcriber.current) {
      transcriber.current = new Transcriber({ transcription: transcriptionHints() })
      transcriber.current.ensure()
    }
    if (!annotator.current) {
      annotator.current = new Annotator({ system: adult ? buildAdultAnnotatorPrompt() : buildAnnotatorPrompt(makeContext(0)) })
      annotator.current.ensure().catch(() => {})
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
      // マイクは押している間だけ開く（開きっぱなしだと iPhone で相棒の声がブツブツになる）
      setPlaybackSession()
    }
    // 会話も読みづくりも、上限のない Live の中だけで行う（確認用の mock だけ1回ずつの方式）
    if (isMockMode()) startTurnEngine()
    else startLive().catch(() => { if (!finished.current) setStopped('offline') })
    return () => { stopSpeech(); recorder.current?.close(); live.current?.close(); transcriber.current?.close(); annotator.current?.close(); clearTimeout(waitTimer.current) }
  }, [])

  // 大人：時間を決めた会話。時間が来たら相棒にまとめてもらい、「お勉強へ」を出す
  useEffect(() => {
    if (!config.minutes) return undefined
    const timer = setInterval(() => setElapsed((Date.now() - new Date(startedAt.current).getTime()) / 60000), 5000)
    return () => clearInterval(timer)
  }, [])
  const timeUp = Boolean(config.minutes) && elapsed >= config.minutes
  useEffect(() => {
    if (!timeUp || wrapped.current || busy || !live.current || childCount() < 2) return
    wrapped.current = true
    newLiveTurn()
    live.current.sendText('[WRAP_UP]')
    waitForReply()
  }, [timeUp, busy])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns.length, busy])

  const startRecording = async (event) => {
    event.preventDefault()
    if (busy || recording || stopped || stopping.current) return
    pressing.current = true
    unlockSpeech()
    stopSpeech()
    live.current?.wake() // タップの中で、相棒の声の AudioContext を起こしておく
    try {
      if (!recorder.current) {
        recorder.current = new Recorder()
        recorder.current.onLevel = setMicLevel
      }
      if (live.current) {
        newLiveTurn()
        heldChunks.current = []
        const asr = transcriber.current?.ready ? transcriber.current : null
        if (transcriber.current && !asr) transcriber.current.ensure() // 切れていたら、次に押すときのためにつなぎなおす
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
      setCaption(say2('はなしてね… はなしたら ゆびを はなす', '話し終わったら指を離してください'))
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
        setCaption(say2('マイクを じゅんびしたよ。もういちど おしてね', 'マイクを準備しました。もう一度押してください'))
      }, 800)
    } catch {
      setTyping(true)
      setCaption(say2('マイクが つかえないよ。おうちのひとに きいてね', 'マイクが使えません。文字で入力してください'))
    }
  }

  const stopRecording = (event) => {
    event?.preventDefault()
    pressing.current = false
    if (!recording) return
    live.current?.wake()
    setRecording(false)
    setMicLevel(0)
    // 指を離したあとも少しだけ録りつづける（言い終わりが切れないように）
    const rec = recorder.current
    stopping.current = true
    setTimeout(async () => {
      stopping.current = false
      if (!rec.isRecording) return
      const audio = rec.stop()
      rec.release()
      if (live.current && usingAsr.current) {
        if (audio.seconds < 0.5) { transcriber.current?.end(); return setCaption(say2('ながめに おしながら はなしてね', '少し長めに押しながら話してください')) }
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
        } else if (audio.loudness >= 0.004) {
          // 文字にならなかったときは、相棒に声をそのまま送る
          live.current.beginSpeech()
          for (const chunk of heldChunks.current) live.current.sendAudio(chunk)
          if (!live.current.endSpeech()) notHeard()
        } else {
          notHeard()
        }
        return
      }
      if (live.current) {
        const sent = live.current.endSpeech()
        if (audio.seconds < 0.5) return setCaption(say2('ながめに おしながら はなしてね', '少し長めに押しながら話してください'))
        if (!sent) return notHeard()
        setLiveBubble('child', '…')
        setCaption('')
        return waitForReply()
      }
      if (audio.seconds < 0.5) return setCaption(say2('ながめに おしながら はなしてね', '少し長めに押しながら話してください'))
      if (audio.loudness < 0.004) return setCaption('こえが きこえなかったよ。もういちど！')
      send({ audio: { mime: audio.mime, data: audio.base64 } })
    }, 300)
  }

  // 声が届かなかった：待つのをやめて、もう一度押してもらう
  const notHeard = () => {
    clearTimeout(waitTimer.current)
    setBusy(false)
    const id = liveTurn.current.id
    setTurns((prev) => prev.filter((turn) => !(turn.turnId === id && turn.who === 'child' && (!turn.text || turn.text === '…'))))
    bubbleQueue.current = {}
    setCaption(say2('こえが きこえなかったよ。もういちど おしてね', '声が聞き取れませんでした。もう一度押して話してください'))
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
    <div className={`screen talk ${adult ? 'adult' : ''} ${config.adultCtx ? 'dark' : ''}`} style={{ '--glow': persona.theme.glow }}>
      <div className="top">
        <button className="icon-btn" aria-label="おわる" onClick={() => finish(true)}>✕</button>
        <div className="pill" style={{ fontSize: 13, maxWidth: '62%', overflow: 'hidden' }}>
          <span className="ic">{title.emoji}</span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title.text}</span>
          {config.minutes > 0 && <span className="muted" style={{ marginLeft: 4, fontSize: 11 }}>{Math.floor(elapsed)}/{config.minutes}分</span>}
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
              <Avatar persona={persona} className={talkingIndex === index || (talkingIndex === 'latest' && index === latestPartnerIndex) ? 'monster-talk' : ''} />
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
            {!adult && turn.tip && <div className="tip" style={{ marginTop: 8 }}>💡 {turn.tip}</div>}
          </div>
        ) : (
          <div key={index} className="row-child">
            <div className={`child-bubble ${turn.english ? 'en' : 'ja'}`} style={{ opacity: turn.pending ? 0.6 : 1 }}>{turn.text || '…'}</div>
            {!turn.pending && !adult && turn.english && <span className="tag praise">✨ えいごで いえたね！</span>}
            {!turn.pending && turn.recast && (adult || !turn.english) && <span className="tag recast en" style={{ fontSize: 12, whiteSpace: 'normal', textAlign: 'right' }}>💬 {turn.recast}</span>}
            {adult && turn.tip && <div className="tip adult-tip">💡 {turn.tip}</div>}
          </div>
        ))}
        {busy && (
          <div className="row-partner">
            <Avatar persona={persona} className="monster-float" />
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
                {hint.emoji && <div className="e">{hint.emoji}</div>}
                <div className="w">{hint.en}</div>
                <div className="k">{hint.kana}</div>
                {!adult && showJa && hint.ja && <div className="m">{hint.ja}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {timeUp && !stopped && (
        <div style={{ padding: '6px 14px 0' }}>
          <button className="press cta study-go" onClick={() => finish()}>📘 お勉強へ すすむ ▶</button>
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
        <div className="cap">{caption || (adult
          ? (engine === 'connecting' ? `${persona.name}につないでいます…` : busy ? `${persona.name}が考え中…` : recording ? '聞いています…（離すと送信）' : '押しながら話してください')
          : (engine === 'connecting' ? `${persona.name}に つないでるよ…` : busy ? `${persona.name}が かんがえてるよ…` : recording ? 'きいてるよ…' : 'おしながら はなしてね'))}</div>
      </div>

      {stopped && (
        <div className="overlay">
          <div className="card">
            <Avatar persona={persona} className="monster-sleep" size={140} />
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
