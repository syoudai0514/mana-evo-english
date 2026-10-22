import React, { useCallback, useEffect, useRef, useState } from 'react'
import { personaOf } from '../data/personas.js'
import { levelOf } from '../data/levels.js'
import { MODES } from '../data/modes.js'
import {
  annotatorMessage,
  buildAnnotatorPrompt,
  buildHistory,
  buildLiveSystemPrompt,
  buildSystemPrompt,
  selectMemory
} from '../data/prompt.js'
import {
  letterToday,
  modelToday,
  todayKey,
  withMemory,
  withModelResult,
  withUtterance
} from '../lib/state.js'
import { nextReading, cleanHint, tidyKidsJa } from '../lib/kana.js'
import { micSupported } from '../lib/recorder.js'
import { speak, stopSpeech, unlockSpeech } from '../lib/tts.js'
import { sendTurn, TalkError } from '../lib/talk.js'
import {
  LiveSession,
  reportLiveProblem,
  requestLiveToken,
  releaseLiveLease
} from '../lib/live.js'
import { Transcriber } from '../lib/transcriber.js'
import { Annotator } from '../lib/annotator.js'
import {
  buildAdultAnnotatorPrompt,
  buildAdultLiveSystemPrompt
} from '../data/adult.js'
import { withAdultMemory, withCards } from '../lib/adult.js'
import { isMockMode } from '../lib/config.js'
import {
  Avatar,
  TalkTranscript,
  TalkHints
} from '../components/talk/TalkParts.jsx'
import TalkDock from '../components/talk/TalkDock.jsx'
import { useTalkRecording } from '../hooks/talk/useTalkRecording.js'
import { useTalkConnection } from '../hooks/talk/useTalkConnection.js'
import { useTalkConversation } from '../hooks/talk/useTalkConversation.js'

// Live の文字起こしが英語か日本語として読めるか（スペイン語などに化けたものは出さない）
const READABLE = /^[\x20-\x7E\u3000-\u30FF\u4E00-\u9FFF\uFF01-\uFF5E\s]*$/

function titleOf(config) {
  if (config.mode === 'free')
    return {
      emoji: config.topic?.emoji || '🎤',
      text: config.topic?.title || 'おしゃべり'
    }
  if (config.mode === 'play')
    return { emoji: config.play.scene.emoji, text: config.play.scene.title }
  if (config.mode === 'guess') return { emoji: '🔍', text: 'あてっこゲーム' }
  if (config.mode === 'adult')
    return { emoji: config.adultScene.emoji, text: config.adultScene.title }
  return { emoji: '🎤', text: 'おしゃべり' }
}

// Gemini のモデル名 → english-talk に頼むときの名前（続きからつなぎなおすときは同じモデルが必要）
function liveModelId(name) {
  if (/3\.8-live/.test(name)) return '3.8'
  if (/flash-live/.test(name)) return '3-flash'
  if (/2\.5-flash-native-audio/.test(name)) return '2.5-audio'
  return ''
}

// はじめのひとことにも、こたえ方のボタンを出す（英語ゼロの子が最初につまずかないように）
const OPENER_HINTS = [
  { en: 'Yes!', kana: 'イエス！', ja: 'うん！', emoji: '👍' },
  { en: 'No!', kana: 'ノー！', ja: 'ううん', emoji: '🙅' },
  { en: 'Wow!', kana: 'ワオ！', ja: 'すごい！', emoji: '🤩' }
]
// 画面カードが作れなかったときの、こたえ方のボタン
const FALLBACK_HINTS = [
  { en: 'Yes!', kana: 'イエス！', ja: 'うん！', emoji: '👍' },
  { en: 'No!', kana: 'ノー！', ja: 'ううん', emoji: '🙅' }
]

function openerTurn(config) {
  if (config.mode === 'free' && config.topic) {
    const { en, kana, ja } = config.topic.opener
    return {
      who: 'partner',
      text: en,
      kana,
      ja,
      jaKids: ja,
      hints: config.topic.hints || OPENER_HINTS,
      opener: true
    }
  }
  if (config.mode === 'adult')
    return {
      who: 'partner',
      text: config.adultScene.opener,
      kana: '',
      ja: config.adultScene.openerJa || '',
      hints: [],
      opener: true
    }
  return null
}

// 大人の相棒（Alex）は画像のかわりに絵文字。会話画面で使う形にそろえる
function adultPersona(partner) {
  return {
    ...partner,
    nameEn: partner.name,
    image: null,
    theme: { glow: 'rgba(47,199,159,.35)' }
  }
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

export default function Talk({
  state,
  update,
  config,
  onFinish,
  showToast,
  onAdultCard,
  onExitReady
}) {
  const persona = config.adultPartner
    ? adultPersona(config.adultPartner)
    : personaOf(config.partner, state.manaRoster)
  const adult = config.mode === 'adult'
  const level = levelOf(adult ? 5 : state.level)
  const mode = MODES[config.mode] || MODES.free
  const voice = {
    ...persona.voice,
    rate: adult ? 0.95 : persona.voice.rate * level.speechRate
  }
  const title = titleOf(config)
  const say2 = (kid, grown) => (adult ? grown : kid) // 子ども向け／大人向けの言い方

  const [turns, setTurns] = useState(() => {
    const first = openerTurn(config)
    return first ? [first] : []
  })
  const [busy, setBusy] = useState(false)
  const [recording, setRecordingState] = useState(false)
  const recordingRef = useRef(false)
  const setRecording = (value) => {
    recordingRef.current = value
    setRecordingState(value)
  }
  const [pressed, setPressed] = useState(false) // 押したらすぐ、押した見た目にする（マイクが開くまで少しかかるため）
  const [micLevel, setMicLevel] = useState(0)
  // 日本語の意味：子どもは段階4まで最初から出す（段階5は全部英語）。大人の練習も出す
  const [showJa, setShowJa] = useState(
    adult || levelOf(state.level).japanese !== 'english-only'
  )
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
  const speakJaFor = useRef(0) // 「わからない」のあとの返事：ひらがなの意味を声でも読む
  const speakJapanese = (text) => {
    if (text) {
      unlockSpeech()
      speak(text, { lang: 'ja-JP', rate: 1, pitch: 1.1 })
    }
  }
  // 相棒の英語の声が鳴り終わってから日本語を読む（声が重ならないように）
  const speakJapaneseAfterVoice = (text, tries = 0) => {
    if (live.current?.speaking && tries < 50) {
      setTimeout(() => speakJapaneseAfterVoice(text, tries + 1), 300)
      return
    }
    speakJapanese(text)
  }
  // 字が読めない子のために、だいじな お知らせは声でも言う（同じことを続けて何度も言わない）
  const lastGuide = useRef({ text: '', at: 0 })
  const guide = (kid, grown) => {
    if (
      !adult &&
      (lastGuide.current.text !== kid ||
        Date.now() - lastGuide.current.at > 8000)
    ) {
      lastGuide.current = { text: kid, at: Date.now() }
      speakJapanese(kid.replace(/[…]/g, ''))
    }
    return say2(kid, grown)
  }
  // 子ども：決めた回数めの答えといっしょに「おわり」を送る（答えに反応してから さよなら。質問だけ残して終わらない）
  const childSends = useRef(0)
  const withWrap = (message) => {
    childSends.current += 1
    if (adult || !kidLimit || wrapped.current || childSends.current < kidLimit)
      return message
    wrapped.current = true
    return `${message}\n[WRAP_UP]`
  }
  const cardsAdded = useRef([]) // 大人：この会話で復習カードになった言い方
  // 大人：記憶とカードを保存し、本当に増えた分だけを「きょう増えたもの」に入れる（前からあるものは出さない）
  const saveAdultCard = (memory, learn) => {
    if (config.guidedLessonId) memory = [] // Role-play facts never become personal memory.
    if (!memory.length && !learn.length) return
    onAdultCard?.((current) => {
      const next = withCards(
        withAdultMemory(current, memory),
        learn,
        config.adultScene?.title || ''
      )
      const oldMemory = new Set(current.memory.map((item) => item.id))
      for (const item of next.memory) {
        const raw = `${item.cat}: ${item.fact}`
        if (!oldMemory.has(item.id) && !memoryAdded.current.includes(raw))
          memoryAdded.current.push(raw)
      }
      const oldCards = new Set(current.cards.map((card) => card.id))
      for (const card of next.cards) {
        if (
          !oldCards.has(card.id) &&
          !cardsAdded.current.some((item) => item.en === card.en)
        )
          cardsAdded.current.push({ en: card.en, ja: card.ja })
      }
      return next
    })
  }
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
  const latestPartnerIndex = turns
    .map((turn) => turn.who)
    .lastIndexOf('partner')
  const latest = turns[latestPartnerIndex]

  const makeContext = (turn) => ({
    mode: config.mode,
    persona: persona.id,
    personaDetails: persona,
    level: stateRef.current.level,
    nickname: stateRef.current.profile?.nickname,
    topic: config.topic,
    play: config.play,
    secret: config.secret,
    adultScene: config.adultScene,
    parentReads: config.parentReads,
    memory: adult ? [] : selectMemory(stateRef.current.memory),
    letter: adult ? null : letterToday(stateRef.current).item,
    turn,
    maxTurns: mode.maxTurns
  })

  const say = useCallback(
    async (line, index) => {
      if (config.parentReads || !line) return
      setTalkingIndex(index)
      await speak(line, voice)
      setTalkingIndex(-1)
    },
    [config.parentReads, voice.pitch, voice.rate]
  )

  const finish = useCallback(
    (stopped = false) => {
      if (finished.current) return
      finished.current = true
      stopSpeech()
      recorder.current?.close()
      live.current?.close()
      transcriber.current?.close()
      annotator.current?.close()
      clearTimeout(waitTimer.current)
      onFinish(
        {
          id: `s${Date.now()}`,
          mode: config.mode,
          partner: persona.id,
          title: title.text,
          emoji: title.emoji,
          topicId: config.topic?.id || null,
          startedAt: startedAt.current,
          turns: turnsRef.current
            .filter((turn) => turn.text && turn.text !== '…')
            .map(({ who, text, ja, english, lang, recast, tip, hint }) => ({
              who,
              text,
              ja,
              english,
              lang,
              recast,
              tip,
              ...(hint ? { hint: true } : {})
            }))
        },
        {
          memoryAdded: memoryAdded.current,
          cardsAdded: cardsAdded.current,
          stopped: stopped === true
        }
      )
    },
    [config, persona.id, onFinish, title.text, title.emoji]
  )

  const send = useCallback(
    async (input, preview) => {
      if (busy || finished.current) return
      setBusy(true)
      setPickedHint(null)
      setCaption('')
      stopSpeech()
      if (preview)
        setTurns((prev) => [
          ...prev,
          {
            who: 'child',
            text: preview,
            pending: true,
            english: /[a-z]/i.test(preview)
          }
        ])

      const isStart = input.text === '[START]'
      const special = isStart || input.text === '[DONT_KNOW]'
      const turnNumber = isStart ? 0 : childTurnCount + 1
      const context = makeContext(turnNumber)
      const history = buildHistory(
        turnsRef.current.filter((turn) => !turn.pending)
      )

      try {
        const { reply, modelIndex } = await sendTurn({
          system: buildSystemPrompt(context),
          history,
          input,
          startModel: modelToday(state).startIndex,
          context
        })
        update((prev) => withModelResult(prev, { modelIndex }))

        const heard =
          special ||
          (reply.heard !== false && Boolean(reply.child_said || preview))
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
          const learn = Array.isArray(reply.learn)
            ? reply.learn.filter((item) => item?.en && item?.ja)
            : []
          if (reply.tip_ja)
            setTurns((prev) => {
              const next = [...prev]
              const i = next.findLastIndex((turn) => turn.who === 'child')
              if (i >= 0) next[i] = { ...next[i], tip: reply.tip_ja }
              return next
            })
          saveAdultCard(reply.memory || [], learn)
        }
        if (!special && heard && !adult) {
          update((prev) =>
            withMemory(
              withUtterance(prev, {
                english: reply.spoke_english,
                text: reply.child_said || preview
              }),
              reply.memory,
              persona.id
            )
          )
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
          setCaption(
            code === 'network'
              ? 'つうしんが うまく いかなかったよ。もういちど！'
              : 'もういちど はなしてみてね'
          )
        }
      }
    },
    [
      busy,
      childTurnCount,
      config,
      persona.id,
      state,
      adult,
      mode.maxTurns,
      update,
      say,
      finish
    ]
  )

  // ---------- Live（リアルタイム会話） ----------
  const childCount = () =>
    turnsRef.current.filter((turn) => turn.who === 'child' && !turn.pending)
      .length

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
    for (const key of ['child', 'partner'])
      if (queued[key])
        writeLiveBubble(key, queued[key].text, queued[key].turnId)
  }

  const writeLiveBubble = (who, text, turnId) => {
    setTurns((prev) => {
      const next = [...prev]
      const index = next.findLastIndex(
        (turn) => turn.turnId === turnId && turn.who === who
      )
      if (index >= 0) {
        next[index] = {
          ...next[index],
          text,
          english: who === 'child' ? /[a-z]/i.test(text) : next[index].english
        }
        return next
      }
      const bubble =
        who === 'child'
          ? {
              who,
              text,
              pending: true,
              live: true,
              turnId,
              english: /[a-z]/i.test(text)
            }
          : { who, text, live: true, turnId, kana: '', ja: '', hints: [] }
      const partnerIndex = next.findLastIndex(
        (turn) => turn.turnId === turnId && turn.who === 'partner'
      )
      if (who === 'child' && partnerIndex >= 0)
        next.splice(partnerIndex, 0, bubble)
      else next.push(bubble)
      return next
    })
  }

  const turnSeq = useRef(0)
  const newLiveTurn = (start = false) => {
    turnSeq.current += 1
    liveTurn.current = { child: '', partner: '', start, id: turnSeq.current }
  }

  const waitForReply = () => {
    setBusy(true)
    clearTimeout(waitTimer.current)
    waitTimer.current = setTimeout(() => {
      setBusy(false)
      setCaption(
        say2('もういちど はなしてみてね', 'もう一度話してみてください')
      )
    }, 15000)
  }

  // 1往復が終わったとき：さよならなら閉じる（子どもの発話の記録は、画面カードで言葉を直してから）
  const recordTurn = (childText, partnerText) => {
    // さよならで終わったら閉じる（"Can I see your …" などの途中の see you では閉じない）
    if (
      /\b(bye[- ]?bye|see you( (later|soon|tomorrow))?)\b[.!]*\s*$/i.test(
        partnerText.trim()
      ) &&
      childCount() >= 3
    ) {
      pendingEnd.current = true
      if (!live.current?.speaking) setTimeout(finish, 900)
    }
  }

  // 裏方に、この往復の画面カードを頼む
  const annotateTurn = async (
    childText,
    partnerText,
    turnId,
    { hint = false, dk = false } = {}
  ) => {
    // 段階の判定用に記録する。文字起こしは「チーズ」のように英語がカタカナになることがあるので、カードで直した言葉と判定を使う
    const record = (card) => {
      if (adult || !(childText || dk)) return
      const said = String(card?.child_said || '').trim() || childText
      const english =
        !dk &&
        (typeof card?.spoke_english === 'boolean'
          ? card.spoke_english
          : /[a-z]/i.test(said))
      update((prev) => withUtterance(prev, { english, text: said, hint, dk }))
    }
    if (!annotator.current || !partnerText) {
      record(null)
      return
    }
    const previousPartner =
      [...turnsRef.current]
        .reverse()
        .find((item) => item.who === 'partner' && item.turnId !== turnId)
        ?.text || ''
    // カードがおそいときも、こまらないよう少ししたら「Yes! / No!」のボタンを出しておく（カードが来たら入れかえる）
    const fallback = adult
      ? 0
      : setTimeout(() => showFallbackHints(turnId), 3500)
    const card = await annotator.current.ask(
      annotatorMessage({ previousPartner, childText, partnerText }),
      partnerText
    )
    clearTimeout(fallback)
    record(card)
    if (card && !finished.current) applyCard(card, turnId)
    if (!card && !finished.current && !adult) showFallbackHints(turnId)
  }

  const showFallbackHints = (turnId) => {
    if (finished.current || pendingEnd.current) return
    setTurns((prev) =>
      prev.map((item) =>
        item.turnId === turnId && item.who === 'partner' && !item.hints?.length
          ? { ...item, hints: FALLBACK_HINTS }
          : item
      )
    )
  }

  // 相棒から届いた画面カード（読み・ひらがなの意味・ヒント・子どもの言葉の補正）を、その往復の吹き出しに付ける
  const applyCard = (card, explicitTurnId) => {
    const current = liveTurn.current
    if (!explicitTurnId && current.start && turnsRef.current[0]?.opener) return
    const turnId =
      explicitTurnId ||
      (current.partner || current.child ? current.id : lastTurnId.current)
    const childSaid = String(card.child_said || '').trim()
    setTurns((prev) =>
      prev.map((item) => {
        if (item.turnId !== turnId) return item
        if (item.who === 'partner') {
          // 「わからない」のあとの返事は、ひらがなの意味を声でも読む
          if (!adult && speakJaFor.current === turnId && card.ja_kids) {
            speakJaFor.current = 0
            speakJapaneseAfterVoice(tidyKidsJa(card.ja_kids))
          }
          const hints = Array.isArray(card.hints)
            ? card.hints
                .slice(0, 3)
                .map(cleanHint)
                .filter((hint) => hint.en)
            : []
          // ヒントが空でも、子どもにはこたえ方のボタンを出す（さよならのときは出さない）
          return {
            ...item,
            kana: String(card.kana || ''),
            ja: String(card.ja || card.ja_kids || ''),
            jaKids: tidyKidsJa(card.ja_kids),
            hints: hints.length || adult || card.end ? hints : FALLBACK_HINTS,
            tip: String(card.tip_ja || '')
          }
        }
        return {
          ...item,
          text: childSaid || item.text,
          english: card.spoke_english ?? item.english,
          recast: String(card.recast || '')
        }
      })
    )
    const memory = Array.isArray(card.memory)
      ? card.memory.map(String).filter(Boolean)
      : []
    if (adult) {
      const learn = Array.isArray(card.learn)
        ? card.learn.filter((item) => item?.en && item?.ja)
        : []
      if (card.tip_ja)
        setTurns((prev) =>
          prev.map((item) =>
            item.turnId === turnId && item.who === 'child'
              ? { ...item, tip: String(card.tip_ja) }
              : item
          )
        )
      saveAdultCard(memory, learn)
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
    const giveUpAt = Date.now() + 25000 // 子どもを長く待たせない（25秒でだめなら「もういちど」）
    const choice = stateRef.current.liveModel || 'auto'
    const order = ['3-flash', '3.8', '2.5-audio']
    const attempts =
      choice === 'auto'
        ? order
        : [choice, ...order.filter((id) => id !== choice)]
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
        if (Date.now() > giveUpAt) throw lastError || new Error('live timeout')
        let model = ''
        try {
          const granted = await requestLiveToken(attempt, 'voice')
          model = granted.model
          const key = `${model}:${setup.hints}:${setup.resume}`
          if (tried.has(key)) {
            releaseLiveLease(granted.leaseId)
            continue
          }
          tried.add(key)
          const transcription = setup.hints ? transcriptionHints() : {}
          const session = createLiveSession({
            ...granted,
            transcription,
            card: setup.card,
            resume: setup.resume
          })
          await session.connect()
          if (finished.current) {
            session.close()
            return
          } // つないでいる間に画面を閉じていた
          onLiveConnected(session, model)
          try {
            await Promise.race([
              session.firstTurn,
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error('live first reply timeout')),
                  12000
                )
              )
            ])
          } catch (error) {
            if (live.current === session) live.current = null
            session.close()
            clearTimeout(waitTimer.current)
            setBusy(false)
            // 失敗した回の書きかけの吹き出しを消す（次の回のはじめのひとことと重ならないように）
            const failedId = liveTurn.current.id
            bubbleQueue.current = {}
            setTurns((prev) => prev.filter((turn) => turn.turnId !== failedId))
            throw error
          }
          session.probing = false
          workingSetup.current = {
            transcription,
            card: setup.card,
            resume: setup.resume
          }
          update((prev) => ({
            ...prev,
            liveDate: todayKey(),
            liveModelName: model,
            liveError: null
          }))
          return
        } catch (error) {
          lastError = error
          const info = {
            step: model ? 'connect' : 'token',
            choice: attempt,
            model,
            setup: `${setup.hints}/${setup.resume}`,
            message: String(error?.message || error)
          }
          update((prev) => ({
            ...prev,
            liveError: { ...info, at: new Date().toISOString() }
          }))
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
      const words = new Set([
        persona.nameEn,
        'meeting',
        'deadline',
        'project',
        'boss',
        'client',
        'weekend',
        'my son',
        'my wife',
        ...(config.adultCtx?.phrases || [])
      ])
      return {
        languageCodes: ['en-US', 'ja-JP'],
        customVocabulary: [...words].filter(Boolean).slice(0, 40)
      }
    }
    const words = new Set([
      'yes',
      'no',
      'hello',
      'hi',
      'cat',
      'dog',
      'I like',
      'I want',
      'red',
      'blue',
      'yellow',
      'green',
      'big',
      'small',
      'thank you',
      'bye-bye',
      persona.nameEn
    ])
    for (const phrase of config.play?.scene?.phrases || [])
      words.add(phrase.replace(/_+/g, '').trim())
    if (config.secret?.en) words.add(config.secret.en.replace(/^(a|an) /, ''))
    for (const word of (config.topic?.about || '').split(/[,\s]+/))
      if (word.length > 2) words.add(word)
    return {
      languageCodes: ['en-US', 'ja-JP'],
      customVocabulary: [...words].filter(Boolean).slice(0, 40)
    }
  }

  const createLiveSession = ({
    token,
    model,
    leaseId,
    transcription = {},
    card = null,
    resume = false,
    resumeHandle = ''
  }) => {
    return new LiveSession({
      transcription,
      leaseId,
      card,
      resume,
      resumeHandle,
      muted: Boolean(config.parentReads),
      token,
      model,
      system: config.adultCtx
        ? buildAdultLiveSystemPrompt({
            partner: persona,
            course: config.adultScene,
            opener: config.adultScene.opener,
            ...config.adultCtx
          })
        : buildLiveSystemPrompt({ ...makeContext(0), withCard: Boolean(card) }),
      voiceName: adult
        ? persona.liveVoice
        : stateRef.current.voices?.[persona.id] || persona.liveVoice,
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
          const { child, partner, start, id, hint, dk } = liveTurn.current
          if (audio.length) {
            liveAudio.current.set(
              start && turnsRef.current[0]?.opener ? 'opener' : id,
              audio
            )
            // 🔊 で聞きなおせる声は、はじめのひとこと と 新しい12回分だけ（長い会話でメモリがふくらまないように）
            const keys = [...liveAudio.current.keys()].filter(
              (key) => key !== 'opener'
            )
            for (const key of keys.slice(0, -12)) liveAudio.current.delete(key)
          }
          flushBubbles()
          newLiveTurn()
          setTurns((prev) =>
            prev.map((item) =>
              item.turnId === id
                ? {
                    ...item,
                    live: false,
                    pending: false,
                    ...(item.who === 'child' && hint ? { hint: true } : {})
                  }
                : item
            )
          )
          if (start && turnsRef.current[0]?.opener) return
          // 声の聞きなおしは、文字起こしが空・化けている・日本語（"ちゃ" など）のときだけ
          lastTurnId.current = id
          reconnects.current = 0 // 1往復できたら、つなぎなおしの回数をもどす
          recordTurn(child.trim(), partner.trim())
          if (dk) speakJaFor.current = id
          annotateTurn(child.trim(), partner.trim(), id, { hint, dk })
        },
        onClose: (event) => {
          if (finished.current) return
          const closing = live.current
          // 入れかえ済みの古い接続が閉じたのなら、何もしない
          if (closing && closing.ws && closing.ws.readyState === WebSocket.OPEN)
            return
          reportLiveProblem({
            step: 'closed',
            model,
            message: `${event?.code} ${event?.reason || ''} age=${Math.round((closing?.age || 0) / 1000)}s`
          })
          resumeRef.current = closing?.resumeHandle || ''
          resumeModel.current = closing?.model || ''
          live.current = null
          // 途中だった往復を片づける（書きかけの吹き出しを確定し、待つのをやめる）
          clearTimeout(waitTimer.current)
          flushBubbles()
          const brokenId = liveTurn.current.id
          setTurns((prev) =>
            prev
              .filter(
                (turn) =>
                  !(
                    turn.turnId === brokenId &&
                    turn.who === 'child' &&
                    (!turn.text || turn.text === '…')
                  )
              )
              .map((turn) =>
                turn.turnId === brokenId
                  ? { ...turn, live: false, pending: false }
                  : turn
              )
          )
          newLiveTurn()
          setBusy(false)
          reconnectLive()
        },
        // サーバーが「もうすぐ切る」と知らせてきたら、話していないすきに入れかえる
        onGoAway: () => {
          goAwaySoon.current = true
        }
      }
    })
  }

  // 会話の途中で Live が切れたら、Live のままつなぎなおして続きから話す。2回だめなら予備の方式へ
  const reconnects = useRef(0)
  const resumeRef = useRef('')
  const resumeModel = useRef('')
  const reconnecting = useRef(false) // つなぎなおしは同時に1つだけ
  const reconnectLive = async () => {
    if (reconnecting.current) return
    reconnecting.current = true
    try {
      await reconnectOnce()
    } finally {
      reconnecting.current = false
    }
  }
  const reconnectOnce = async () => {
    reconnects.current += 1
    setEngine('connecting')
    setCaption(say2('つなぎなおしてるよ…', 'つなぎ直しています…'))
    try {
      if (reconnects.current > 2) throw new Error('too many reconnects')
      const setup = workingSetup.current ?? {
        transcription: transcriptionHints(),
        card: null,
        resume: false
      }
      // 続きの目印があれば、同じモデルでその続きから（会話の流れがそのまま残る）。だめなら会話を渡して新しく
      const handle = setup.resume ? resumeRef.current : ''
      let session = null
      if (handle && liveModelId(resumeModel.current)) {
        try {
          const granted = await requestLiveToken(
            liveModelId(resumeModel.current),
            'voice'
          )
          if (finished.current) return
          session = createLiveSession({
            ...granted,
            ...setup,
            resumeHandle: handle
          })
          await session.connect()
          if (finished.current) {
            session.close()
            return
          }
        } catch (error) {
          reportLiveProblem({
            step: 'resume',
            message: String(error?.message || error)
          })
          session = null
        }
      }
      const resumed = Boolean(session)
      if (!session) {
        const granted = await requestLiveToken(
          stateRef.current.liveModel || 'auto',
          'voice'
        )
        if (finished.current) return
        session = createLiveSession({ ...granted, ...setup })
        await session.connect()
        if (finished.current) {
          session.close()
          return
        }
      }
      session.probing = false
      live.current = session
      setEngine('live')
      if (!resumed) {
        const history = buildHistory(
          turnsRef.current.filter(
            (turn) => !turn.pending && turn.text && turn.text !== '…'
          ),
          12
        ).map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }))
        session.sendHistory(history)
      }
      setCaption('')
    } catch (error) {
      reportLiveProblem({
        step: 'reconnect',
        message: String(error?.message || error)
      })
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
    const setup = workingSetup.current ?? {
      transcription: transcriptionHints(),
      card: null,
      resume: false
    }
    const handle = setup.resume ? old.resumeHandle : ''
    const turnAtStart = lastTurnId.current
    try {
      const granted = await requestLiveToken(
        liveModelId(old.model) || stateRef.current.liveModel || 'auto',
        'voice'
      )
      const fresh = createLiveSession({
        ...granted,
        ...setup,
        resumeHandle: handle
      })
      await fresh.connect()
      fresh.probing = false
      // つないでいる間に話しはじめていたら、今回はやめる（次のすきに）
      if (
        finished.current ||
        live.current !== old ||
        pressing.current ||
        stopping.current ||
        busyRef.current ||
        old.speaking ||
        lastTurnId.current !== turnAtStart
      ) {
        fresh.close()
        return
      }
      goAwaySoon.current = false
      if (!handle) {
        const history = buildHistory(
          turnsRef.current.filter(
            (turn) => !turn.pending && turn.text && turn.text !== '…'
          ),
          12
        ).map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }))
        fresh.sendHistory(history)
      }
      live.current = fresh
      old.close()
    } catch (error) {
      reportLiveProblem({
        step: 'refresh',
        message: String(error?.message || error)
      })
    } finally {
      refreshing.current = false
    }
  }
  const goAwaySoon = useRef(false)
  const busyRef = useRef(false)
  busyRef.current = busy
  const retryLive = () => {
    setStopped(null)
    reconnects.current = 0
    if (turnsRef.current.some((turn) => turn.who === 'child')) reconnectLive()
    else
      startLive().catch((error) => {
        if (!finished.current)
          setStopped(error?.code === 'auth' ? 'auth' : 'offline')
      })
  }

  const onLiveConnected = (session, model) => {
    if (finished.current) {
      session.close()
      return
    }
    // 前の接続がまだ残っていたら閉じる（2つの接続から声が重ならないように）
    if (live.current && live.current !== session) live.current.close()
    live.current = session
    setEngine('live')
    if (!transcriber.current) {
      transcriber.current = new Transcriber({
        transcription: transcriptionHints()
      })
      transcriber.current.ensure()
    }
    if (!annotator.current) {
      annotator.current = new Annotator({
        system: adult
          ? buildAdultAnnotatorPrompt(config.adultCtx?.memory)
          : buildAnnotatorPrompt(makeContext(0))
      })
      annotator.current.ensure().catch(() => {})
    }
    const first = turnsRef.current[0]
    newLiveTurn(true)
    waitForReply()
    session.sendStart(
      first
        ? `[START] Begin by saying exactly this line, then wait for the child: "${first.text}"`
        : '[START]'
    )
  }

  useTalkConnection({
    live,
    goAwaySoon,
    pressing,
    stopping,
    busyRef,
    refreshLive,
    recorder,
    setMicLevel,
    finished,
    startTurnEngine,
    startLive,
    setStopped,
    transcriber,
    annotator,
    waitTimer,
    bubbleTimer
  })

  // つながらない・おしまいのお知らせも、子どもには声で（字が読めなくても わかるように）
  useEffect(() => {
    if (adult || !stopped) return
    const lines = {
      offline: `${persona.name}に つながらなかったよ。もういちど を おしてね`,
      exhausted: 'きょうは おしまい。また あした！'
    }
    speakJapanese(lines[stopped] || 'おうちのひとを よんでね')
  }, [stopped])
  // おきるまで（つながるまで）時間がかかるときも、声で「まってね」
  useEffect(() => {
    if (adult || engine !== 'connecting') return undefined
    const timer = setTimeout(
      () => speakJapanese(`${persona.name}が おきるまで ちょっと まってね`),
      5000
    )
    return () => clearTimeout(timer)
  }, [engine])
  const { elapsed, timeUp, kidLimit } = useTalkConversation({
    config,
    adult,
    level,
    childTurnCount,
    startedAt,
    live,
    wrapped,
    busyRef,
    pressing,
    stopping,
    childCount,
    newLiveTurn,
    waitForReply,
    turns,
    busy,
    logRef
  })

  const { startRecording, stopRecording } = useTalkRecording({
    busy,
    recording,
    stopped,
    stopping,
    live,
    setCaption,
    say2,
    persona,
    pressing,
    setPressed,
    recorder,
    setMicLevel,
    transcriber,
    usingAsr,
    heldChunks,
    newLiveTurn,
    setRecording,
    guide,
    recordingRef,
    setTyping,
    setLiveBubble,
    waitForReply,
    liveTurn,
    finished,
    withWrap,
    childSends,
    notHeard,
    send
  })

  // 声が届かなかった：待つのをやめて、もう一度押してもらう
  function notHeard() {
    clearTimeout(waitTimer.current)
    setBusy(false)
    const id = liveTurn.current.id
    setTurns((prev) =>
      prev.filter(
        (turn) =>
          !(
            turn.turnId === id &&
            turn.who === 'child' &&
            (!turn.text || turn.text === '…')
          )
      )
    )
    bubbleQueue.current = {}
    setCaption(
      guide(
        'こえが きこえなかったよ。もういちど おしてね',
        '声が聞き取れませんでした。もう一度押して話してください'
      )
    )
  }

  const hintTeach = useRef(0)
  const tapHint = (hint) => {
    unlockSpeech()
    if (pickedHint?.en === hint.en) {
      sendTyped(hint.en, `[HINT] ${hint.en}`)
      return
    }
    setPickedHint(hint)
    // はじめの数回は「もういちど タップで こたえよう」も声で教える（字が読めなくてもわかるように）
    const teach = !adult && hintTeach.current < 3
    if (teach) hintTeach.current += 1
    Promise.resolve(speak(hint.en, voice)).then(() => {
      if (teach) speakJapanese('もういちど タップすると こたえられるよ')
    })
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
    if (!live.current)
      return isMockMode()
        ? send({ text: message }, display)
        : setCaption(
            say2(
              'つないでるよ… ちょっと まってね',
              '接続中です。少し待ってください'
            )
          )
    if (busy) return
    newLiveTurn()
    liveTurn.current.child = display
    liveTurn.current.typed = true
    liveTurn.current.hint = message.startsWith('[HINT]') // ヒントをタップしただけ（自分で言えた数には入れない）
    setLiveBubble('child', display)
    live.current.sendText(withWrap(message))
    waitForReply()
  }

  const dontKnow = () => {
    unlockSpeech()
    if (!live.current)
      return isMockMode()
        ? send({ text: '[DONT_KNOW]' })
        : setCaption(
            say2(
              'つないでるよ… ちょっと まってね',
              '接続中です。少し待ってください'
            )
          )
    if (busy) return
    newLiveTurn()
    liveTurn.current.dk = true
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

  const cycleReading = () =>
    update((prev) => ({ ...prev, reading: nextReading(prev.reading) }))
  const readingPolicy = config.parentReads ? 'show' : level.reading

  useEffect(() => {
    onExitReady?.(() => finish(true))
    return () => onExitReady?.(null)
  }, [finish])

  return (
    <div
      className={`screen talk ${adult ? 'adult' : ''} ${config.adultCtx ? 'dark' : ''}`}
      style={{ '--glow': persona.theme.glow }}
    >
      <div className="top">
        <button
          className="icon-btn"
          aria-label="おわる"
          onClick={() => finish(true)}
        >
          ✕
        </button>
        <div
          className="pill"
          style={{ fontSize: 13, maxWidth: '62%', overflow: 'hidden' }}
        >
          <span className="ic">{title.emoji}</span>
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {title.text}
          </span>
          {config.minutes > 0 && (
            <span className="muted" style={{ marginLeft: 4, fontSize: 11 }}>
              {Math.floor(elapsed)}/{config.minutes}分
            </span>
          )}
        </div>
        {level.japanese !== 'english-only' || adult ? (
          <button
            className="icon-btn"
            style={{
              fontSize: 12,
              color: showJa ? '#fff' : 'var(--grape)',
              background: showJa ? 'var(--grape)' : '#fff'
            }}
            onClick={() => setShowJa((v) => !v)}
          >
            {adult ? 'あ⇄A' : showJa ? 'にほんご ON' : 'にほんご OFF'}
          </button>
        ) : (
          <div style={{ width: 42 }} />
        )}
      </div>

      <TalkTranscript
        {...{
          config,
          persona,
          turns,
          talkingIndex,
          latestPartnerIndex,
          readingPolicy,
          state,
          cycleReading,
          showJa,
          adult,
          live,
          speakJapanese,
          replay,
          busy,
          logRef
        }}
      />

      <TalkHints
        {...{ busy, latest, stopped, adult, pickedHint, tapHint, showJa }}
      />

      {timeUp && adult && !stopped && (
        <div style={{ padding: '6px 14px 0' }}>
          <button className="press cta study-go" onClick={() => finish()}>
            📘 お勉強へ すすむ ▶
          </button>
        </div>
      )}

      <TalkDock
        {...{
          typing,
          submitText,
          text,
          setText,
          adult,
          busy,
          dontKnow,
          recording,
          pressed,
          engine,
          startRecording,
          stopRecording,
          micLevel,
          setTyping,
          caption,
          persona
        }}
      />

      {stopped && (
        <div className="overlay">
          <div className="card">
            <Avatar persona={persona} className="monster-sleep" size={140} />
            {stopped === 'offline' ? (
              <>
                <p style={{ fontWeight: 900, marginTop: 6 }}>
                  {persona.name}に つながらなかったよ
                </p>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  でんぱの いい ところで もういちど ためしてね
                </p>
                <button
                  className="press cta"
                  style={{ marginTop: 16, height: 56, fontSize: 18 }}
                  onClick={retryLive}
                >
                  もういちど
                </button>
              </>
            ) : stopped === 'exhausted' ? (
              <>
                <div className="en" style={{ fontSize: 22, fontWeight: 800 }}>
                  I'm sleepy… See you tomorrow!
                </div>
                <p style={{ fontWeight: 900, marginTop: 6 }}>
                  きょうは おしまい。また あした！
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 44, marginTop: 4 }}>👪</div>
                <p style={{ fontWeight: 900, marginTop: 6, fontSize: 18 }}>
                  おうちのひとを よんでね
                </p>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  「おうちのひと」→「AIのせつぞく」からログインし、音声の送信・保存について確認してください
                </p>
              </>
            )}
            <button
              className={
                stopped === 'offline' ? 'press btn ghost' : 'press cta'
              }
              style={{
                marginTop: stopped === 'offline' ? 10 : 16,
                height: 56,
                fontSize: 18,
                width: '100%'
              }}
              onClick={finish}
            >
              {stopped === 'offline' ? 'おわる' : 'わかった'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
