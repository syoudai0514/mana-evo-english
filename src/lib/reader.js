// 英文の読み上げ（大人モードの TOEIC・シャドーイング・復習カード）。
// iPhone の読み上げ（speechSynthesis）はマイクを開いている間は鳴らないことがあるので、
// 会話と同じ Live の声で「渡した文をそのまま読む」だけをしてもらう。だめなときだけ端末の読み上げにもどす。
import { LiveSession, reportLiveProblem, requestLiveToken } from './live.js'
import { isMockMode } from './config.js'
import { speak, stopSpeech } from './tts.js'

const SYSTEM = [
  'You are a narrator for English listening practice. You never chat, greet, answer questions or comment.',
  'When you receive text, read it aloud EXACTLY as written, clearly, at natural speed, and then stop.',
  'If the text starts with [SLOW], read the rest slowly and clearly, word by word, without saying "[SLOW]".',
  'For conversation lines that start with "M:" or "W:", do not read the labels; use a slightly lower tone for M and a slightly higher tone for W.',
  'Choice labels like "A." should be read as "A".'
].join('\n')

class Reader {
  constructor() {
    this.session = null
    this.connecting = null
    this.pending = null
    this.turnDone = false
  }

  async ensure() {
    if (this.session?.ws?.readyState === WebSocket.OPEN && this.session.age < 100000) return this.session
    if (this.session) { this.session.close(); this.session = null }
    if (!this.connecting) {
      this.connecting = (async () => {
        const granted = await requestLiveToken('auto', 'voice')
        const session = new LiveSession({
          ...granted,
          system: SYSTEM,
          voiceName: 'Charon',
          handlers: {
            onTurnComplete: () => { this.turnDone = true; if (!session.speaking) this.finish() },
            onSpeaking: (speaking) => { if (!speaking && this.turnDone) this.finish() },
            onClose: () => { if (this.session === session) this.session = null; this.finish() }
          }
        })
        await session.connect()
        session.probing = false
        this.session = session
        return session
      })().finally(() => { this.connecting = null })
    }
    return this.connecting
  }

  finish() {
    const pending = this.pending
    this.pending = null
    pending?.()
  }

  // 読みおわったら resolve する
  async say(text, { slow = false } = {}) {
    this.stop()
    let session = null
    try {
      session = await Promise.race([this.ensure(), new Promise((_, reject) => setTimeout(() => reject(new Error('reader timeout')), 7000))])
    } catch (error) {
      reportLiveProblem({ step: 'reader', message: String(error?.message || error) })
    }
    if (!session) return speak(text.replace(/\b[MW]\s*:\s*/g, ''), { rate: slow ? 0.7 : 0.95, gender: 'male' })
    return new Promise((resolve) => {
      this.turnDone = false
      const timer = setTimeout(() => this.finish(), 25000)
      this.pending = () => { clearTimeout(timer); resolve() }
      session.sendText(slow ? `[SLOW] ${text}` : text)
    })
  }

  stop() {
    stopSpeech()
    this.session?.player.stop()
    this.finish()
  }

  close() {
    this.stop()
    this.session?.close()
    this.session = null
  }
}

let shared = null
let idleTimer = null

export function readAloud(text, options) {
  if (isMockMode()) return speak(text, { rate: options?.slow ? 0.7 : 0.95, gender: 'male' })
  shared = shared || new Reader()
  clearTimeout(idleTimer)
  // 1分つかわなければ接続を閉じる
  const done = shared.say(text, options)
  done.finally(() => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { shared?.close(); shared = null }, 60000) })
  return done
}

export function stopReading() {
  shared?.stop()
  stopSpeech()
}

// 画面に入ったときに先につないでおく（最初の読み上げを待たせない）
export function prepareReader() {
  if (isMockMode()) return
  shared = shared || new Reader()
  shared.ensure().catch(() => {})
}
