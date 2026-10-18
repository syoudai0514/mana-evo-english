// 子どもの声の文字起こし（Gemini 3.5 Transcribe Live、上限なし）。
// 押している間の声を流し、離したら確定した文字を返す。会話の相棒にはこの文字を渡す。
import { LiveSession, reportLiveProblem, requestLiveToken } from './live.js'

const SETTLE_MS = 450 // 文字がこの時間ふえなければ確定とみなす
const MAX_WAIT_MS = 1600
const REFRESH_AFTER_MS = 100000 // 100秒たったら入れかえる

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

  // Live は2〜3分で向こうから切られる（切れた瞬間に話すと聞きとれない）。
  // 話していないときに、古くなった接続を新しいものに入れかえておく
  startRefresh() {
    if (this.refreshTimer) return
    this.refreshTimer = setInterval(() => {
      if (!this.active && this.ready && this.session.age > REFRESH_AFTER_MS) this.refresh()
    }, 10000)
  }

  async refresh() {
    if (this.refreshing) return
    this.refreshing = true
    const old = this.session
    try {
      const fresh = await this.open()
      if (this.active || this.closed) { fresh.close(); return } // 話しはじめていたら、次の機会に
      this.session = fresh
      old?.close()
    } catch {
      // だめなら今の接続のまま（切れたら次に押したときにつなぐ）
    } finally {
      this.refreshing = false
    }
  }

  async open() {
    const granted = await requestLiveToken('auto', 'asr')
    const session = new LiveSession({
      ...granted,
      system: 'Transcribe the speaker exactly.',
      asr: true,
      transcription: this.transcription,
      handlers: {
        onChildText: (text) => { if (this.session === session) { this.text += text; this.changedAt = Date.now() } },
        onTurnComplete: (_audio, text) => {
          if (this.session !== session) return
          if (text && !this.text) { this.text = text; this.changedAt = Date.now() }
          this.completed = true
        },
        onClose: (event) => {
          if (this.session === session) this.session = null
          reportLiveProblem({ step: 'asr-closed', model: granted.model, message: `${event?.code} ${event?.reason || ''} age=${Math.round(session.age / 1000)}s` })
        }
      }
    })
    await session.connect()
    session.probing = false
    return session
  }

  async ensure() {
    this.startRefresh()
    if (this.ready || (this.failed && Date.now() - this.failedAt < 30000)) return this.session
    if (!this.connecting) {
      this.connecting = (async () => {
        try {
          const session = await this.open()
          this.session = session
          this.failed = false
          return session
        } catch (error) {
          // 使えなければ、しばらくは相棒に声をそのまま送るやり方にもどす（30秒たったら、またつないでみる）
          this.failed = true
          this.failedAt = Date.now()
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
    this.active = true
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
    if (!this.ready || !this.session.endSpeech()) { this.active = false; return '' } // つながっていない・音が届いていない
    const started = Date.now()
    await new Promise((resolve) => {
      const check = () => {
        const settled = this.text && Date.now() - this.changedAt > SETTLE_MS
        if (this.completed || settled || Date.now() - started > MAX_WAIT_MS) return resolve()
        setTimeout(check, 60)
      }
      check()
    })
    this.active = false
    return this.text.trim()
  }

  close() {
    this.closed = true
    clearInterval(this.refreshTimer)
    this.session?.close()
    this.session = null
  }
}
