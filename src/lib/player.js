import { pcm16Base64ToFloat } from './wav.js'
import { playbackContext, primePlayback } from './audio.js'

// Live API の声（24kHz PCM）を途切れずに鳴らす。
// 細切れの音を1つずつ鳴らすとつなぎ目でプツッと鳴るので、AudioWorklet の中に「ためる場所」を作り、
// そこから1本の音として流す（24kHz → 端末の周波数への変換もつなぎ目なしで行う）。
// 足りなくなったら一度小さくして止め、少したまってから再開する。

// AudioWorklet は別ファイルにして配信する（iPhone の Safari は Blob から読みこめないことがある）
const workletUrl = new URL('./pcm-out.worklet.js', import.meta.url).href

let moduleFor = null // AudioWorklet を読みこんだ AudioContext
let moduleLoading = null

export const audioInfo = { mode: 'none', error: '' } // ログ用：どの方式で鳴らしているか

function loadWorklet(context) {
  if (moduleFor === context) return Promise.resolve(true)
  if (!context.audioWorklet) { audioInfo.error = 'no audioWorklet'; return Promise.resolve(false) }
  if (moduleLoading?.context === context) return moduleLoading.promise
  const promise = context.audioWorklet.addModule(workletUrl)
    .then(() => { moduleFor = context; return true })
    .catch((error) => { audioInfo.error = String(error?.message || error); return false })
  moduleLoading = { context, promise }
  return promise
}

export class PcmPlayer {
  constructor() {
    this.context = null
    this.node = null
    this.pending = [] // AudioWorklet の準備ができるまでの声
    this.active = false
    this.idleTimer = null
    this.onIdle = null
    this.onStart = null
    this.onUnderrun = null
    this.underruns = 0
    // AudioWorklet が使えない端末用（細切れを順番に鳴らす）
    this.fallback = false
    this.sources = new Set()
    this.nextTime = 0
  }

  // タップの中で呼ぶ（iOS は操作の中でないと音を鳴らせない）
  ensure() {
    // タップの中なら、鳴らせる状態にしておく（一度も鳴っていない止まったものは作りなおす）
    const inTap = navigator.userActivation ? navigator.userActivation.isActive : false
    if (inTap) primePlayback()
    const context = playbackContext()
    if (this.node && this.context !== context) this.reattach()
    if (context.state !== 'running') context.resume().catch(() => {})
    return context
  }

  // AudioContext を作りなおしたあと、つなぎなおす（ためていた声は捨てる）
  reattach() {
    this.node?.port.postMessage({ type: 'dispose' })
    this.node?.disconnect()
    this.node = null
    this.connect()
  }

  get playing() {
    return this.active
  }

  // 準備中に何度呼ばれても、つなぐのは1回だけ（2つ作ると声が重なる）
  connect() {
    const context = playbackContext()
    if (this.node && this.context === context) return Promise.resolve()
    if (this.connecting?.context === context) return this.connecting.promise
    const promise = this.attach(context).finally(() => { if (this.connecting?.promise === promise) this.connecting = null })
    this.connecting = { context, promise }
    return promise
  }

  async attach(context) {
    this.node?.port.postMessage({ type: 'dispose' })
    this.node?.disconnect()
    this.node = null
    this.context = context
    const ok = await loadWorklet(context)
    if (this.context !== context) return
    // 話している途中で iPhone が音を止めた（電話・ほかのアプリ）ときも、「話している」のままにしない
    context.addEventListener('statechange', () => { if (this.context === context && !this.closed && this.active && context.state !== 'running') this.watchSilent() })
    if (!ok) { this.fallback = true; audioInfo.mode = 'fallback'; return }
    audioInfo.mode = 'worklet'
    this.closed = false
    this.node = new AudioWorkletNode(context, 'pcm-out', { numberOfInputs: 0, outputChannelCount: [1] })
    this.node.connect(context.destination)
    this.node.port.onmessage = (event) => {
      const data = event.data
      if (data.type === 'start') clearTimeout(this.idleTimer)
      if (data.type === 'gap') { this.underruns = data.underruns; this.onUnderrun?.(this.underruns) }
      if (data.type === 'drained') {
        globalThis.__meeAudio = { underruns: data.underruns, jumps: data.jumps }
        // とぎれただけかもしれないので、少し待っても次が来なければ「話し終わり」
        clearTimeout(this.idleTimer)
        this.idleTimer = setTimeout(() => this.markIdle(), 500)
      }
    }
    for (const [samples, rate] of this.pending) this.node.port.postMessage({ type: 'push', samples, rate }, [samples.buffer])
    this.pending = []
  }

  markIdle() {
    if (!this.active) return
    this.active = false
    this.onIdle?.()
  }

  push(base64, sampleRate = 24000) {
    const samples = pcm16Base64ToFloat(base64)
    if (!samples.length) return
    this.ensure()
    if (!this.active) { this.active = true; this.onStart?.() }
    clearTimeout(this.idleTimer)
    // AudioContext が止まったまま鳴らないときは、「話している」のままにしない（次のタップで鳴るようになる）
    if (playbackContext().state !== 'running') this.watchSilent()
    if (this.fallback) return this.pushFallback(samples, sampleRate)
    if (this.node && this.context === playbackContext()) {
      this.node.port.postMessage({ type: 'push', samples, rate: sampleRate }, [samples.buffer])
    } else {
      this.pending.push([samples, sampleRate])
      this.connect().then(() => { if (this.fallback) this.flushFallback() })
    }
  }

  // 1.5秒たっても鳴らせないままなら止める（次のタップで鳴るようになる）
  watchSilent() {
    if (this.silentTimer) return
    this.silentTimer = setTimeout(() => {
      this.silentTimer = null
      const state = playbackContext().state
      if (state !== 'running') { this.onSilent?.(state); this.stop() }
    }, 1500)
  }

  stop() {
    clearTimeout(this.idleTimer)
    this.pending = []
    this.node?.port.postMessage({ type: 'clear' })
    for (const source of this.sources) { try { source.stop() } catch {} }
    this.sources.clear()
    this.nextTime = 0
    this.resampler = null
    const was = this.active
    this.active = false
    if (was) this.onIdle?.()
  }

  close() {
    this.stop()
    clearTimeout(this.silentTimer)
    this.silentTimer = null
    // AudioWorklet の処理も止めて片づける（disconnect だけだと残りつづけ、会話のたびにメモリがふえる）
    this.node?.port.postMessage({ type: 'dispose' })
    this.node?.disconnect()
    this.node = null
    this.closed = true
  }

  // ---- AudioWorklet が使えない端末用 ----
  flushFallback() {
    const pending = this.pending
    this.pending = []
    for (const [samples, rate] of pending) this.pushFallback(samples, rate)
  }

  pushFallback(samples, sampleRate) {
    const context = playbackContext()
    if (this.fallbackContext !== context) { this.fallbackContext = context; this.nextTime = 0; this.resampler = null }
    // 端末の周波数に自分で変換する（つなぎ目で位置を引きつぐので、細切れでも音が飛ばない）
    const step = sampleRate / context.sampleRate
    // p：この細切れの中での位置（samples[i] が p=i、前の細切れの最後の音が p=-1）
    const state = this.resampler || { p: 0, prev: samples[0] }
    const at = (i) => (i < 0 ? state.prev : samples[i])
    const values = []
    let p = state.p
    while (p < samples.length - 1) {
      const base = Math.floor(p)
      const frac = p - base
      const a = at(base)
      values.push(a + (at(base + 1) - a) * frac)
      p += step
    }
    this.resampler = { p: p - samples.length, prev: samples[samples.length - 1] }
    const frames = values.length
    const out = Float32Array.from(values)
    if (!frames) return
    const underrun = this.nextTime < context.currentTime + 0.02
    const lead = !this.sources.size ? 0.25 : underrun ? 0.15 : 0
    const startAt = underrun ? context.currentTime + lead : this.nextTime
    const buffer = context.createBuffer(1, frames, context.sampleRate)
    buffer.copyToChannel(out, 0)
    const node = context.createBufferSource()
    node.buffer = buffer
    node.connect(context.destination)
    node.start(startAt)
    this.nextTime = startAt + frames / context.sampleRate
    this.sources.add(node)
    node.onended = () => {
      this.sources.delete(node)
      if (!this.sources.size) this.markIdle()
    }
  }
}

export function sampleRateOf(mimeType) {
  const match = /rate=(\d+)/.exec(mimeType || '')
  return match ? Number(match[1]) : 24000
}
