// Gemini Live API でリアルタイムに会話する。
// API キーはブラウザに置かず、english-talk から使い捨ての接続キー（ephemeral token）をもらって直接つなぐ。
import { SUPABASE_ANON_KEY, TALK_ENDPOINT } from './config.js'
import { getAccessToken } from './auth.js'
import { PcmPlayer, audioInfo, sampleRateOf } from './player.js'

let audioInfoSent = false // 鳴らし方の情報は、起動ごとに1回だけログへ

// 画面カード（読み・ひらがなの意味・ヒントなど）を相棒から受け取る関数
const HINT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    en: { type: 'STRING' }, kana: { type: 'STRING' }, ja: { type: 'STRING' }, emoji: { type: 'STRING' },
    // 絵文字が途中で壊れて届くことがあるので、Unicode の番号（例 1F6DD）でも受け取る
    emoji_code: { type: 'STRING', description: 'Unicode code point of the emoji in hex, e.g. "1F6DD" for 🛝' }
  },
  required: ['en', 'kana', 'ja', 'emoji_code']
}
export function showCardDeclaration(behavior) {
  const declaration = {
    name: 'show_card',
    description: 'Show the screen card for the reply you just spoke: readings, simple Japanese meaning, hints and notes about the child.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reply_en: { type: 'STRING' },
        kana: { type: 'STRING' },
        ja_kids: { type: 'STRING' },
        ja: { type: 'STRING' },
        child_said: { type: 'STRING' },
        spoke_english: { type: 'BOOLEAN' },
        recast: { type: 'STRING' },
        hints: { type: 'ARRAY', items: HINT_SCHEMA },
        memory: { type: 'ARRAY', items: { type: 'STRING' } },
        tip_ja: { type: 'STRING' },
        // 大人だけ：この往復から覚えておきたい言い方（復習カードになる）
        learn: { type: 'ARRAY', items: { type: 'OBJECT', properties: { en: { type: 'STRING' }, ja: { type: 'STRING' } }, required: ['en', 'ja'] } },
        end: { type: 'BOOLEAN' }
      },
      required: ['reply_en', 'kana', 'ja_kids', 'hints']
    }
  }
  if (behavior === 'nonblocking') declaration.behavior = 'NON_BLOCKING'
  return declaration
}

const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained'

// Live に失敗した理由を english-talk のログに残す（原因調べ用。会話の中身は送らない）
export async function reportLiveProblem(info) {
  try {
    const token = await getAccessToken()
    if (!token) return
    await fetch(TALK_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'live-log', info: { ...info, ua: navigator.userAgent } })
    })
  } catch {}
}

// purpose: 'voice'（会話・速さ優先）/ 'text'（読みづくり・賢さ優先）
export async function requestLiveToken(liveModel = 'auto', purpose = 'voice') {
  const token = await getAccessToken().catch(() => null)
  if (!token) throw Object.assign(new Error('auth'), { code: 'auth' })
  const response = await fetch(TALK_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'live-token', liveModel, purpose })
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.token || !data?.model) {
    throw Object.assign(new Error(data?.message || 'live unavailable'), { code: data?.code || 'live' })
  }
  return data
}

async function messageText(data) {
  if (typeof data === 'string') return data
  if (data instanceof Blob) return data.text()
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data)
  return ''
}

// 1回の会話（セッション）。押している間だけ話す（自動の音声検出は使わない）ので、
// 子どもの声と相棒の声が混ざって勝手に割り込まれることがない。
export class LiveSession {
  // text: true なら文字だけで返す接続（読み・意味・ヒントづくり用）。muted: true なら声を鳴らさない（親子モード）
  // transcription: 子どもの声の聞き取り設定（languageCodes で英語・日本語に限定、customVocabulary でよく出る単語を優先）
  // asr: true なら文字起こし専用（3.5 Transcribe Live）
  // card: 'nonblocking'（声を止めずにカードを渡す）/ 'blocking' / null
  // resume: 切れても続きからつなぎなおせるようにする（resumeHandle があればその続きから）
  // functions：show_card 以外の関数を渡すとき（大人の問題づくりなど）。届いたら handlers.onTool(name, args)
  constructor({ token, model, system, voiceName, handlers, text = false, asr = false, muted = false, transcription = {}, card = null, functions = null, resume = false, resumeHandle = '' }) {
    this.card = card
    this.functions = functions
    this.resume = resume
    this.resumeHandle = resumeHandle
    this.transcription = transcription
    this.asr = asr
    this.dropAudio = false
    this.token = token
    this.model = model
    this.system = system
    this.voiceName = voiceName
    this.textMode = text
    this.muted = muted
    this.textBuffer = ''
    this.handlers = handlers // { onReady, onPartnerText, onChildText, onTurnComplete, onInterrupted, onSpeaking, onClose }
    this.player = new PcmPlayer()
    this.player.onStart = () => this.handlers.onSpeaking?.(true)
    this.player.onIdle = () => this.handlers.onSpeaking?.(false)
    // 声がとぎれた回数（届くのが間に合わなかった）。原因調べのために、1往復ごとにログへ
    this.gaps = 0
    this.chunks = 0
    this.player.onUnderrun = () => { this.gaps += 1 }
    this.ws = null
    this.ready = false
    this.closedByUs = false
    this.turnAudio = [] // 🔊で聞きなおせるよう、1往復ぶんの声をとっておく
    // 最初の返事が最後まで届いたら「つながった」とみなす（つながってすぐ切られるモデルがあるため）
    this.probing = true
    this.firstTurn = new Promise((resolve, reject) => { this.firstTurnDone = resolve; this.firstTurnFailed = reject })
    this.firstTurn.catch(() => {})
  }

  connect(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      // 公式 SDK と同じく、トークン（auth_tokens/...）はそのまま付ける
      const ws = new WebSocket(`${WS_BASE}?access_token=${this.token}`)
      this.ws = ws
      const timer = setTimeout(() => { reject(new Error('live timeout')); this.close() }, timeoutMs)
      ws.onopen = () => {
        const model = this.model.startsWith('models/') ? this.model : `models/${this.model}`
        const systemInstruction = { parts: [{ text: this.system }] }
        ws.send(JSON.stringify(this.asr
          ? {
              setup: {
                model,
                generationConfig: { responseModalities: ['TEXT'] },
                inputAudioTranscription: this.transcription,
                realtimeInputConfig: { automaticActivityDetection: { disabled: true } }
              }
            }
          : this.textMode
          ? {
              setup: {
                model,
                generationConfig: { responseModalities: ['TEXT'], temperature: 0.4 },
                systemInstruction
              }
            }
          : {
              setup: {
                model,
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  temperature: 0.9,
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } } }
                },
                systemInstruction,
                ...(this.functions
                  ? { tools: [{ functionDeclarations: this.functions }] }
                  : this.card ? { tools: [{ functionDeclarations: [showCardDeclaration(this.card)] }] } : {}),
                inputAudioTranscription: this.transcription,
                outputAudioTranscription: {},
                ...(this.resume
                  ? { sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {}, contextWindowCompression: { slidingWindow: {} } }
                  : {}),
                realtimeInputConfig: { automaticActivityDetection: { disabled: true } }
              }
            }))
      }
      ws.onmessage = async (event) => {
        let message
        try { message = JSON.parse(await messageText(event.data)) } catch { return }
        if (message.setupComplete && !this.ready) {
          this.ready = true
          this.connectedAt = Date.now()
          clearTimeout(timer)
          resolve()
          this.handlers.onReady?.()
          return
        }
        this.handle(message)
      }
      // error のあとには必ず close が来るので、理由（code / reason）は onclose で受け取る
      ws.onerror = () => {}
      ws.onclose = (event) => {
        clearTimeout(timer)
        if (!this.ready) reject(new Error(`live closed ${event.code} ${event.reason}`))
        if (this.ready) this.firstTurnFailed(new Error(`live closed ${event.code} ${event.reason}`))
        if (this.ready && !this.closedByUs && !this.probing) this.handlers.onClose?.(event)
      }
    })
  }

  handle(message) {
    const update = message.sessionResumptionUpdate
    if (update?.resumable && update.newHandle) this.resumeHandle = update.newHandle
    for (const call of message.toolCall?.functionCalls || []) {
      if (call.name === 'show_card') this.handlers.onCard?.(call.args || {})
      else this.handlers.onTool?.(call.name, call.args || {})
      // すぐ返事をして、相棒がカードのことで話しださないようにする
      this.send({
        toolResponse: {
          functionResponses: [{ id: call.id, name: call.name, response: { ok: true }, ...(this.card === 'nonblocking' ? { scheduling: 'SILENT' } : {}) }]
        }
      })
    }
    const content = message.serverContent
    if (!content) return
    // 返事の途中で何も届かなくなったら（接続が止まった）、その往復を終わったことにして画面を止めない
    clearTimeout(this.stallTimer)
    if (!content.turnComplete && !content.interrupted && !this.asr) {
      this.stallTimer = setTimeout(() => {
        if (this.closedByUs) return
        reportLiveProblem({ step: 'stall', model: this.model, message: `no turnComplete for 8s (age ${Math.round(this.age / 1000)}s)` })
        this.handle({ serverContent: { turnComplete: true } })
      }, 8000)
    }
    if (content.interrupted) {
      this.player.stop()
      this.handlers.onInterrupted?.()
    }
    for (const part of content.modelTurn?.parts || []) {
      if (typeof part.text === 'string' && !part.thought) this.textBuffer += part.text
      if (part.inlineData?.data && /^audio\//.test(part.inlineData.mimeType || '') && !this.muted && !this.dropAudio) {
        const rate = sampleRateOf(part.inlineData.mimeType)
        this.turnAudio.push([part.inlineData.data, rate])
        this.chunks += 1
        this.chunkMs = Math.round((part.inlineData.data.length * 0.75 / 2 / rate) * 1000) // 1つの細切れの長さ（ログ用）
        this.player.push(part.inlineData.data, rate)
      }
    }
    if (content.inputTranscription?.text) this.handlers.onChildText?.(content.inputTranscription.text)
    if (content.outputTranscription?.text) this.handlers.onPartnerText?.(content.outputTranscription.text)
    if (content.turnComplete) {
      if (!audioInfoSent && this.chunks && !this.muted) {
        audioInfoSent = true
        const ctx = this.player.context
        reportLiveProblem({ step: 'audio-info', model: this.model, message: `mode=${audioInfo.mode} err=${audioInfo.error} rate=${ctx?.sampleRate} base=${ctx?.baseLatency} out=${ctx?.outputLatency} chunks=${this.chunks} chunkMs=${this.chunkMs}` })
      }
      if (this.gaps) {
        reportLiveProblem({ step: 'audio-gaps', model: this.model, message: `gaps=${this.gaps} chunks=${this.chunks} worklet=${!this.player.fallback} rate=${this.player.context?.sampleRate}` })
      }
      this.gaps = 0
      this.chunks = 0
      this.dropAudio = false
      this.firstTurnDone()
      const audio = this.turnAudio
      const text = this.textBuffer
      this.turnAudio = []
      this.textBuffer = ''
      this.handlers.onTurnComplete?.(audio, text)
    }
  }

  // 音を鳴らす接続だけ、タップの中で AudioContext を起こす（裏方や文字起こしは音にさわらない）
  wake() {
    if (!this.muted && !this.asr && !this.textMode) this.player.ensure()
  }

  send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload))
  }

  // 押しはじめ：相棒が話していたら止める
  // 「話しはじめ」は最初の音を送るときに送る。音が1つもなければ「話し終わり」も送らない
  // （中身のない発話を送ると、Live が 1007 Precondition check failed で接続を切る）
  beginSpeech() {
    this.wake()
    this.player.stop()
    this.turnAudio = []
    this.speechOpen = 'pending'
  }

  sendAudio(base64) {
    if (this.speechOpen === 'pending') { this.send({ realtimeInput: { activityStart: {} } }); this.speechOpen = 'open' }
    this.send({ realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } } })
  }

  // 話し終わり。音を送っていれば true
  endSpeech() {
    const sent = this.speechOpen === 'open'
    if (sent) this.send({ realtimeInput: { activityEnd: {} } })
    this.speechOpen = null
    return sent
  }

  // 会話のはじまり：最初の文脈として送る（clientContent はセッション開始時だけ使える）
  sendStart(text) {
    this.wake()
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } })
  }

  // つなぎなおしたとき：これまでの会話を渡す（相棒は話しださず、子どもを待つ）
  sendHistory(turns) {
    if (!turns.length) return
    this.send({ clientContent: { turns, turnComplete: false } })
  }

  // 子どもが話しはじめたら、いま流れている相棒の声を止めて、この返事の残りは鳴らさない
  silenceCurrentTurn() {
    if (this.player.playing) this.dropAudio = true
    this.player.stop()
  }

  // 文字だけの接続で、1つの質問として送る
  sendUserTurn(text) {
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } })
  }

  // 会話の途中の文字（ヒントや文字入力）
  sendText(text) {
    if (!this.textMode) {
      this.wake()
      this.player.stop()
    }
    this.send({ realtimeInput: { text } })
  }

  replay(audio) {
    this.wake()
    this.player.stop()
    for (const [data, rate] of audio) this.player.push(data, rate)
  }

  // つないでからの時間（ms）。Live は2〜3分で向こうから切られるので、その前につなぎなおす目安
  get age() {
    return this.connectedAt ? Date.now() - this.connectedAt : 0
  }

  get speaking() {
    return this.player.playing
  }

  close() {
    this.closedByUs = true
    clearTimeout(this.stallTimer)
    this.player.close()
    try { this.ws?.close() } catch {}
  }
}

// 声の試し聞き：その声で相棒にひとこと言ってもらう
export async function previewVoice({ voiceName, line, style }) {
  const granted = await requestLiveToken('auto')
  const session = new LiveSession({
    ...granted,
    system: `${style}\nWhen you get a line in quotes, say exactly that line out loud and nothing else.`,
    voiceName,
    handlers: {}
  })
  await session.connect()
  session.sendStart(`"${line}"`)
  await Promise.race([session.firstTurn, new Promise((resolve) => setTimeout(resolve, 10000))])
  // 声が鳴り終わるまで待ってから閉じる
  await new Promise((resolve) => {
    const check = () => (session.speaking ? setTimeout(check, 200) : resolve())
    setTimeout(check, 300)
  })
  session.close()
}
