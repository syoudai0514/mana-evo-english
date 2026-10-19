// 英文の読み上げ（大人モードの TOEIC・シャドーイング・復習カード）。
// iPhone の読み上げ（speechSynthesis）はマイクを開いている間は鳴らないことがあるので、
// 会話と同じ Live の声で「渡した文をそのまま読む」だけをしてもらう。だめなときだけ端末の読み上げにもどす。
import { LiveSession, reportLiveProblem, requestLiveToken } from './live.js'
import { isMockMode } from './config.js'
import { speak, stopSpeech } from './tts.js'
import { primePlayback } from './audio.js'

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
    this.seq = 0 // say() を呼ぶたび・止めるたびに増やす（古い呼び出しは何もしない）
    this.sent = 0 // 読むように送った回数
    this.done = 0 // 読み終わったと知らせが来た回数
    this.current = null // { seq, resolve }
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
            // いま読んでいる回の「終わり」だけで次へ（止めた回の遅れた知らせは数えるだけ）
            onTurnComplete: () => { if (this.session === session) { this.done += 1; this.check() } },
            onSpeaking: (speaking) => { if (!speaking) this.check() },
            onClose: () => { if (this.session === session) { this.session = null; this.finish() } }
          }
        })
        await session.connect()
        session.probing = false
        if (this.closed) { session.close(); return null }
        this.session = session
        this.sent = 0
        this.done = 0
        return session
      })().finally(() => { this.connecting = null })
    }
    return this.connecting
  }

  check() {
    if (this.current && this.done >= this.sent && !this.session?.speaking) this.finish()
  }

  finish() {
    const current = this.current
    this.current = null
    current?.resolve()
  }

  // 読みおわったら resolve する。あとから別の say() や stop() が来たら、それまでの分は打ち切る
  async say(text, { slow = false } = {}) {
    this.stop()
    const seq = this.seq
    let session = null
    try {
      session = await Promise.race([this.ensure(), new Promise((_, reject) => setTimeout(() => reject(new Error('reader timeout')), 7000))])
    } catch (error) {
      reportLiveProblem({ step: 'reader', message: String(error?.message || error) })
    }
    if (seq !== this.seq) return // つないでいる間に止められた・次の読み上げが来た
    if (!session) return speak(text.replace(/\b[MW]\s*:\s*/g, ''), { rate: slow ? 0.7 : 0.95, gender: 'male' })
    return new Promise((resolve) => {
      const timer = setTimeout(() => { if (this.current?.seq === seq) this.finish() }, 25000)
      this.current = { seq, resolve: () => { clearTimeout(timer); resolve() } }
      this.sent += 1
      session.sendText(slow ? `[SLOW] ${text}` : text)
    })
  }

  stop() {
    this.seq += 1
    stopSpeech()
    // 読んでいる途中の残りは鳴らさない
    this.session?.silenceCurrentTurn()
    this.finish()
  }

  close() {
    this.closed = true
    this.stop()
    this.session?.close()
    this.session = null
  }
}

let shared = null
let idleTimer = null

export function readAloud(text, options) {
  if (navigator.userActivation?.isActive) primePlayback() // タップの中なら、鳴らせる状態に
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
