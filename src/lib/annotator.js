// 読み・日本語の意味・ヒント・言い直し・記憶を、文字だけで返す Live の接続で作る。
// （上限のない Live の中で全部まかなうため。1往復ずつ順番に聞く）
import { LiveSession, reportLiveProblem, requestLiveToken } from './live.js'

const TIMEOUT_MS = 9000

export function parseJsonReply(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const reply = JSON.parse(text.slice(start, end + 1))
    return typeof reply === 'object' && reply ? reply : null
  } catch {
    return null
  }
}

export class Annotator {
  // candidates：読みづくりに使う Live モデルの順番（賢い 3.8 Live → 3 Flash Live）
  constructor({ system, candidates = ['3.8', '3-flash'] }) {
    this.system = system
    this.candidates = candidates
    this.index = 0
    this.session = null
    this.connecting = null
    this.queue = Promise.resolve()
    this.pending = null
    this.closed = false
  }

  async ensure() {
    if (this.session?.ws?.readyState === WebSocket.OPEN) return this.session
    if (!this.connecting) {
      this.connecting = (async () => {
        const granted = await requestLiveToken(this.candidates[this.index % this.candidates.length], 'text')
        const session = new LiveSession({
          ...granted,
          system: this.system,
          text: true,
          handlers: {
            onTurnComplete: (_audio, text) => this.pending?.resolve(text),
            onClose: () => {
              if (this.session === session) this.session = null
              this.pending?.reject(new Error('annotator closed'))
            }
          }
        })
        try {
          await session.connect()
        } catch (error) {
          this.index += 1 // このモデルが文字だけの接続を受けつけなければ、次のモデルへ
          throw error
        }
        session.probing = false
        this.session = session
        return session
      })().finally(() => { this.connecting = null })
    }
    return this.connecting
  }

  // 1往復ぶんを聞く。失敗したら null（会話は止めない）
  ask(message) {
    const run = async () => {
      if (this.closed) return null
      try {
        const session = await this.ensure()
        const text = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('annotator timeout')), TIMEOUT_MS)
          this.pending = {
            resolve: (value) => { clearTimeout(timer); resolve(value) },
            reject: (error) => { clearTimeout(timer); reject(error) }
          }
          session.sendText(message)
        })
        return parseJsonReply(text)
      } catch (error) {
        reportLiveProblem({ step: 'annotate', model: this.session?.model, message: String(error?.message || error) })
        if (this.session) this.index += 1 // つながったのに返事がだめなら、次は別のモデルで
        this.session?.close()
        this.session = null
        return null
      } finally {
        this.pending = null
      }
    }
    const result = this.queue.then(run)
    this.queue = result.catch(() => null)
    return result
  }

  close() {
    this.closed = true
    this.session?.close()
    this.session = null
  }
}
