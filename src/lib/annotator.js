// 音を鳴らさない Live に、関数を1回呼んでもらって結果を受け取る裏方。
// Live は文字だけの返事ができないので、声の接続（音は鳴らさない）で関数だけを呼んでもらう。
// 画面カード（読み・ひらがなの意味・ヒント）づくりのほか、大人の問題づくりなどにも使う。
import { LiveSession, reportLiveProblem, requestLiveToken } from './live.js'

function words(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)
}

// カードの reply_en が、この回のセリフとほぼ同じか（語の6割以上が重なる）
export function sameLine(a, b) {
  const left = words(a)
  const right = new Set(words(b))
  if (!left.length || !right.size) return false
  const hit = left.filter((word) => right.has(word)).length
  return hit / Math.max(left.length, right.size) >= 0.6
}

const DEFAULT_WAYS = [['3.8', 'realtime'], ['3.8', 'client'], ['3-flash', 'realtime'], ['3-flash', 'client']]

export class SilentTool {
  // declaration：呼んでもらう関数（null なら画面カード show_card）
  // ways：使うモデルと送り方の順番（賢い 3.8 Live → 3 Flash Live）。だめなら次を試す
  constructor({ system, declaration = null, timeoutMs = 9000, step = 'annotate', ways = DEFAULT_WAYS }) {
    this.system = system
    this.declaration = declaration
    this.timeoutMs = timeoutMs
    this.step = step
    this.ways = ways
    this.index = 0
    this.session = null
    this.connecting = null
    this.queue = Promise.resolve()
    this.pending = null
    this.closed = false
    this.lastClose = ''
  }

  get name() {
    return this.declaration?.name || 'show_card'
  }

  async ensure() {
    // 古くなった接続（2〜3分で向こうから切られる）は、頼む前に新しくする
    if (this.session?.ws?.readyState === WebSocket.OPEN && this.session.age > 100000) {
      this.session.close()
      this.session = null
    }
    if (this.session?.ws?.readyState === WebSocket.OPEN) return this.session
    if (!this.connecting) {
      this.connecting = (async () => {
        const way = this.ways[this.index % this.ways.length]
        const granted = await requestLiveToken(way[0], 'voice')
        const session = new LiveSession({
          ...granted,
          system: this.system,
          voiceName: 'Kore',
          muted: true,
          card: this.declaration ? null : 'blocking',
          functions: this.declaration ? [this.declaration] : null,
          handlers: {
            onCard: (card) => this.pending?.resolve(card),
            onTool: (name, args) => { if (name === this.name) this.pending?.resolve(args) },
            onTurnComplete: () => this.pending?.noCard(),
            onClose: (event) => {
              this.lastClose = `${event?.code} ${event?.reason || ''}`
              if (this.session === session) this.session = null
              this.pending?.reject(new Error(`${this.step} closed`))
            }
          }
        })
        try {
          await session.connect()
        } catch (error) {
          this.index += 1
          reportLiveProblem({ step: `${this.step}-connect`, way: way.join('/'), message: String(error?.message || error) })
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

  // 1回ぶんの結果をもらう。だめなら同じ回のうちに次のモデル・送り方で。全部だめなら null（画面は止めない）
  // accept：結果が今回のものか確かめる（前の回の結果が遅れて届いたら捨てて待ちなおす）
  ask(message, { accept = null, retryText = '' } = {}) {
    const once = async () => {
      let used = null
      try {
        const session = await this.ensure()
        used = session.way
        return await new Promise((resolve, reject) => {
          let misses = 0
          let stale = 0
          const timer = setTimeout(() => reject(new Error(`${this.step} timeout`)), this.timeoutMs)
          this.pending = {
            resolve: (result) => {
              if (accept && !accept(result)) {
                stale += 1
                if (stale === 1 && retryText) session.sendText(retryText)
                return
              }
              clearTimeout(timer)
              resolve(result)
            },
            reject: (error) => { clearTimeout(timer); reject(error) },
            // 関数を呼ばずに返事を終えたら、もう一度だけ頼む
            noCard: () => {
              misses += 1
              if (misses > 1) { clearTimeout(timer); reject(new Error('no call')); return }
              session.sendText(`Call ${this.name} now for the previous message. Do not speak.`)
            }
          }
          if (used[1] === 'client') session.sendUserTurn(message)
          else session.sendText(message)
        })
      } catch (error) {
        reportLiveProblem({ step: this.step, way: used?.join('/'), message: `${String(error?.message || error)} ${this.lastClose}` })
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
          // 次のモデル・送り方で
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

// 画面カードづくり。expect：この回の相棒のセリフ（前の回のカードが遅れて届いたら捨てる）
export class Annotator extends SilentTool {
  ask(message, expect = '') {
    return super.ask(message, expect
      ? { accept: (card) => sameLine(card?.reply_en, expect), retryText: `That card was for an older line. Call show_card for this line: "${expect}"` }
      : {})
  }
}
