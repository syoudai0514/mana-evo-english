// Gemini Live API でリアルタイムに会話する。
// API キーはブラウザに置かず、english-talk から使い捨ての接続キー（ephemeral token）をもらって直接つなぐ。
import { SUPABASE_ANON_KEY, TALK_ENDPOINT } from './config.js'
import { getAccessToken } from './auth.js'
import { PcmPlayer, sampleRateOf } from './player.js'

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

export async function requestLiveToken(liveModel = 'auto') {
  const token = await getAccessToken().catch(() => null)
  if (!token) throw Object.assign(new Error('auth'), { code: 'auth' })
  const response = await fetch(TALK_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'live-token', liveModel })
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
  constructor({ token, model, system, voiceName, handlers, text = false, muted = false }) {
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
        ws.send(JSON.stringify(this.textMode
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
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                realtimeInputConfig: { automaticActivityDetection: { disabled: true } }
              }
            }))
      }
      ws.onmessage = async (event) => {
        let message
        try { message = JSON.parse(await messageText(event.data)) } catch { return }
        if (message.setupComplete && !this.ready) {
          this.ready = true
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
    const content = message.serverContent
    if (!content) return
    if (content.interrupted) {
      this.player.stop()
      this.handlers.onInterrupted?.()
    }
    for (const part of content.modelTurn?.parts || []) {
      if (typeof part.text === 'string' && !part.thought) this.textBuffer += part.text
      if (part.inlineData?.data && /^audio\//.test(part.inlineData.mimeType || '') && !this.muted) {
        const rate = sampleRateOf(part.inlineData.mimeType)
        this.turnAudio.push([part.inlineData.data, rate])
        this.player.push(part.inlineData.data, rate)
      }
    }
    if (content.inputTranscription?.text) this.handlers.onChildText?.(content.inputTranscription.text)
    if (content.outputTranscription?.text) this.handlers.onPartnerText?.(content.outputTranscription.text)
    if (content.turnComplete) {
      this.firstTurnDone()
      const audio = this.turnAudio
      const text = this.textBuffer
      this.turnAudio = []
      this.textBuffer = ''
      this.handlers.onTurnComplete?.(audio, text)
    }
  }

  send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload))
  }

  // 押しはじめ：相棒が話していたら止める
  beginSpeech() {
    this.player.ensure()
    this.player.stop()
    this.turnAudio = []
    this.send({ realtimeInput: { activityStart: {} } })
  }

  sendAudio(base64) {
    this.send({ realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } } })
  }

  endSpeech() {
    this.send({ realtimeInput: { activityEnd: {} } })
  }

  // 会話のはじまり：最初の文脈として送る（clientContent はセッション開始時だけ使える）
  sendStart(text) {
    this.player.ensure()
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } })
  }

  // つなぎなおしたとき：これまでの会話を渡す（相棒は話しださず、子どもを待つ）
  sendHistory(turns) {
    if (!turns.length) return
    this.send({ clientContent: { turns, turnComplete: false } })
  }

  // 会話の途中の文字（ヒントや文字入力）
  sendText(text) {
    if (!this.textMode) {
      this.player.ensure()
      this.player.stop()
    }
    this.send({ realtimeInput: { text } })
  }

  replay(audio) {
    this.player.ensure()
    this.player.stop()
    for (const [data, rate] of audio) this.player.push(data, rate)
  }

  get speaking() {
    return this.player.playing
  }

  close() {
    this.closedByUs = true
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
