// Gemini Live API でリアルタイムに会話する。
// API キーはブラウザに置かず、english-talk から使い捨ての接続キー（ephemeral token）をもらって直接つなぐ。
import { SUPABASE_ANON_KEY, TALK_ENDPOINT } from './config.js'
import { getAccessToken } from './auth.js'
import { PcmPlayer, sampleRateOf } from './player.js'

const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained'

export async function requestLiveToken() {
  const token = await getAccessToken().catch(() => null)
  if (!token) throw Object.assign(new Error('auth'), { code: 'auth' })
  const response = await fetch(TALK_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'live-token' })
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
  constructor({ token, model, system, voiceName, handlers }) {
    this.token = token
    this.model = model
    this.system = system
    this.voiceName = voiceName
    this.handlers = handlers // { onReady, onPartnerText, onChildText, onTurnComplete, onInterrupted, onSpeaking, onClose }
    this.player = new PcmPlayer()
    this.player.onStart = () => this.handlers.onSpeaking?.(true)
    this.player.onIdle = () => this.handlers.onSpeaking?.(false)
    this.ws = null
    this.ready = false
    this.closedByUs = false
    this.turnAudio = [] // 🔊で聞きなおせるよう、1往復ぶんの声をとっておく
  }

  connect(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}?access_token=${encodeURIComponent(this.token)}`)
      this.ws = ws
      const timer = setTimeout(() => { reject(new Error('live timeout')); this.close() }, timeoutMs)
      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: this.model.startsWith('models/') ? this.model : `models/${this.model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: 0.9,
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voiceName } } }
            },
            systemInstruction: { parts: [{ text: this.system }] },
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
      ws.onerror = () => { clearTimeout(timer); if (!this.ready) reject(new Error('live error')) }
      ws.onclose = (event) => {
        clearTimeout(timer)
        if (!this.ready) reject(new Error(`live closed ${event.code} ${event.reason}`))
        if (!this.closedByUs) this.handlers.onClose?.(event)
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
      if (part.inlineData?.data && /^audio\//.test(part.inlineData.mimeType || '')) {
        const rate = sampleRateOf(part.inlineData.mimeType)
        this.turnAudio.push([part.inlineData.data, rate])
        this.player.push(part.inlineData.data, rate)
      }
    }
    if (content.inputTranscription?.text) this.handlers.onChildText?.(content.inputTranscription.text)
    if (content.outputTranscription?.text) this.handlers.onPartnerText?.(content.outputTranscription.text)
    if (content.turnComplete) {
      const audio = this.turnAudio
      this.turnAudio = []
      this.handlers.onTurnComplete?.(audio)
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

  sendText(text) {
    this.player.ensure()
    this.player.stop()
    this.send({ realtimeInput: { activityStart: {} } })
    this.send({ realtimeInput: { text } })
    this.send({ realtimeInput: { activityEnd: {} } })
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
