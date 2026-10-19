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
    // 古くなった接続（約150秒で向こうから切られる）は、頼む前に新しくする（答えを待つ時間も見こむ）
    if (this.session?.ws?.readyState === WebSocket.OPEN && this.session.age > 130000 - this.timeoutMs) {
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
          if (this.closed) { session.close(); throw new Error('closed') }
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
          let result = null
          let turns = 0 // この頼みごとで始まった相手の返事の数（終わりを待ってから次へ進む）
          let settleTimer = null
          const timer = setTimeout(() => (result ? done() : reject(new Error(`${this.step} timeout`))), this.timeoutMs)
          const done = () => { clearTimeout(timer); clearTimeout(settleTimer); resolve(result) }
          this.pending = {
            resolve: (value) => {
              if (result) return
              if (accept && !accept(value)) {
                stale += 1
                if (stale === 1 && retryText) { turns += 1; session.sendText(retryText) }
                return
              }
              result = value
              // 関数のあとに続く相手の返事の「終わり」を待ってから次へ（次の頼みごとに混ざらないように）。来なくても2.5秒で進む
              settleTimer = setTimeout(done, 2500)
            },
            reject: (error) => { clearTimeout(timer); clearTimeout(settleTimer); result ? resolve(result) : reject(error) },
            noCard: () => {
              turns -= 1
              if (turns > 0) return // 前に送った分の「終わり」
              if (result) { done(); return }
              // 関数を呼ばずに返事を終えたら、もう一度だけ頼む
              misses += 1
              if (misses > 1) { clearTimeout(timer); reject(new Error('no call')); return }
              turns += 1
              session.sendText(`Call ${this.name} now for the previous message. Do not speak.`)
            }
          }
          turns += 1
          if (used[1] === 'client') session.sendUserTurn(message)
          else session.sendText(message)
        })
      } catch (error) {
        reportLiveProblem({ step: this.step, way: used?.join('/'), message: `${String(error?.message || error)} ${this.lastClose}` })
        // 古くなって向こうから切られただけなら、モデルのせいにしない（次のモデルへ移らない）
        const aged = (this.session?.age || 0) > 120000 || /closed/.test(String(error?.message))
        if (used && !aged && this.ways[this.index % this.ways.length] === used) this.index += 1
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
    this.pending?.reject(new Error('closed'))
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
