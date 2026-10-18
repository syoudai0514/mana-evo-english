// 画面カード（読み・ひらがなの意味・ヒント・子どもの言葉の補正）を作る裏方。
// Live は文字だけの返事ができないので、声の接続（音は鳴らさない）で、関数 show_card だけを呼んでもらう。
// 会話の相棒とは別の接続にして、相棒は会話だけに集中させる。
import { LiveSession, reportLiveProblem, requestLiveToken } from './live.js'

const TIMEOUT_MS = 9000

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

export class Annotator {
  // ways：使うモデルと送り方の順番（賢い 3.8 Live → 3 Flash Live）。だめなら次を試す
  constructor({ system, ways = [['3.8', 'realtime'], ['3.8', 'client'], ['3-flash', 'realtime'], ['3-flash', 'client']] }) {
    this.system = system
    this.ways = ways
    this.index = 0
    this.session = null
    this.connecting = null
    this.queue = Promise.resolve()
    this.pending = null
    this.closed = false
    this.lastClose = ''
  }

  async ensure() {
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
          card: 'blocking',
          handlers: {
            onCard: (card) => this.pending?.resolve(card),
            onTurnComplete: () => this.pending?.noCard(),
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
          this.index += 1
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

  // 1往復ぶんのカードをもらう。だめなら同じ回のうちに次のモデル・送り方で。全部だめなら null（会話は止めない）
  // expect：この回の相棒のセリフ。前の回のカードが遅れて届いたら、それは捨てて待ちなおす
  ask(message, expect = '') {
    const once = async () => {
      let used = null
      try {
        const session = await this.ensure()
        used = session.way
        return await new Promise((resolve, reject) => {
          let misses = 0
          let stale = 0
          const timer = setTimeout(() => reject(new Error('annotator timeout')), TIMEOUT_MS)
          this.pending = {
            resolve: (card) => {
              if (expect && !sameLine(card?.reply_en, expect)) {
                stale += 1
                if (stale === 1) session.sendText(`That card was for an older line. Call show_card for this line: "${expect}"`)
                return
              }
              clearTimeout(timer)
              resolve(card)
            },
            reject: (error) => { clearTimeout(timer); reject(error) },
            // 関数を呼ばずに返事を終えたら、もう一度だけ頼む
            noCard: () => {
              misses += 1
              if (misses > 1) { clearTimeout(timer); reject(new Error('no card')); return }
              session.sendText('Call show_card now for the previous message. Do not speak.')
            }
          }
          if (used[1] === 'client') session.sendUserTurn(message)
          else session.sendText(message)
        })
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
