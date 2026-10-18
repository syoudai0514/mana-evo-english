// 子どもの声の文字起こし（Gemini 3.5 Transcribe Live、上限なし）。
// 押している間の声を流し、離したら確定した文字を返す。会話の相棒にはこの文字を渡す。
import { LiveSession, reportLiveProblem, requestLiveToken } from './live.js'

const SETTLE_MS = 450 // 文字がこの時間ふえなければ確定とみなす
const MAX_WAIT_MS = 1600

export class Transcriber {
  constructor({ transcription }) {
    this.transcription = transcription
    this.session = null
    this.connecting = null
    this.text = ''
    this.changedAt = 0
    this.completed = false
    this.failed = false
  }

  get ready() {
    return this.session?.ws?.readyState === WebSocket.OPEN
  }

  async ensure() {
    if (this.ready || this.failed) return this.session
    if (!this.connecting) {
      this.connecting = (async () => {
        try {
          const granted = await requestLiveToken('auto', 'asr')
          const session = new LiveSession({
            ...granted,
            system: 'Transcribe the speaker exactly.',
            asr: true,
            transcription: this.transcription,
            handlers: {
              onChildText: (text) => { this.text += text; this.changedAt = Date.now() },
              onTurnComplete: (_audio, text) => {
                if (text && !this.text) { this.text = text; this.changedAt = Date.now() }
                this.completed = true
              },
              onClose: (event) => {
                if (this.session === session) this.session = null
                reportLiveProblem({ step: 'asr-closed', model: granted.model, message: `${event?.code} ${event?.reason || ''}` })
              }
            }
          })
          await session.connect()
          session.probing = false
          this.session = session
          return session
        } catch (error) {
          this.failed = true // 使えなければ、相棒に声をそのまま送るやり方にもどす
          reportLiveProblem({ step: 'asr', message: String(error?.message || error) })
          return null
        } finally {
          this.connecting = null
        }
      })()
    }
    return this.connecting
  }

  begin() {
    this.text = ''
    this.completed = false
    this.changedAt = Date.now()
    this.session?.beginSpeech()
  }

  sendAudio(base64) {
    this.session?.sendAudio(base64)
  }

  // 離したあと、確定した文字を待つ（空なら ''）
  async end() {
    if (!this.ready) return ''
    if (!this.session.endSpeech()) return '' // 音が届いていない
    const started = Date.now()
    await new Promise((resolve) => {
      const check = () => {
        const settled = this.text && Date.now() - this.changedAt > SETTLE_MS
        if (this.completed || settled || Date.now() - started > MAX_WAIT_MS) return resolve()
        setTimeout(check, 60)
      }
      check()
    })
    return this.text.trim()
  }

  close() {
    this.session?.close()
    this.session = null
  }
}
