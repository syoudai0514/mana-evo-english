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
  // ways：読みづくりに使う Live モデルと送り方の順番（賢い 3.8 Live → 3 Flash Live）。
  // モデルによって受けつける送り方がちがうので、だめなら次を試す
  constructor({ system, ways = [['3.8', 'client'], ['3.8', 'realtime'], ['3-flash', 'realtime'], ['3-flash', 'client']] }) {
    this.system = system
    this.ways = ways
    this.index = 0
    this.lastClose = ''
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
        const way = this.ways[this.index % this.ways.length]
        const granted = await requestLiveToken(way[0], 'text')
        const session = new LiveSession({
          ...granted,
          system: this.system,
          text: true,
          handlers: {
            onTurnComplete: (_audio, text) => this.pending?.resolve(text),
            onClose: (event) => {
              this.lastClose = `${event?.code} ${event?.reason || ''}`
              if (this.session === session) this.session = null
              this.pending?.reject(new Error('annotator closed'))
            }
          }
        })
        try {
          await session.connect()
        } catch (error) {
          this.index += 1 // このモデルが文字だけの接続を受けつけなければ、次のモデルへ
          reportLiveProblem({ step: 'annotate-connect', way: way.join('/'), message: String(error?.message || error) })
          throw error
        }
        session.probing = false
        session.way = way
        this.session = session
        return session
      })().finally(() => { this.connecting = null })
    }
    return this.connecting
  }

  // 1往復ぶんを聞く。だめなら同じ回のうちに次の送り方・モデルで聞きなおす。全部だめなら null（会話は止めない）
  ask(message) {
    const once = async () => {
      let used = null
      try {
        const session = await this.ensure()
        used = session.way
        const text = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('annotator timeout')), TIMEOUT_MS)
          this.pending = {
            resolve: (value) => { clearTimeout(timer); resolve(value) },
            reject: (error) => { clearTimeout(timer); reject(error) }
          }
          if (session.way[1] === 'client') session.sendUserTurn(message)
          else session.sendText(message)
        })
        const reply = parseJsonReply(text)
        if (!reply) throw new Error('not json')
        return reply
      } catch (error) {
        reportLiveProblem({ step: 'annotate', way: used?.join('/'), message: `${String(error?.message || error)} ${this.lastClose}` })
        if (used && this.ways[this.index % this.ways.length] === used) this.index += 1
        this.session?.close()
        this.session = null
        throw error
      } finally {
        this.pending = null
      }
    }
    const run = async () => {
      for (let attempt = 0; attempt < this.ways.length && !this.closed; attempt += 1) {
        try {
          return await once()
        } catch {
          // 次の送り方・モデルで
        }
      }
      return null
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
