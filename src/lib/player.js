import { pcm16Base64ToFloat } from './wav.js'
import { sharedContext } from './audio.js'

// Live API の声（24kHz PCM）を途切れずに鳴らす。
// 細切れの音を1つずつ鳴らすとつなぎ目でプツッと鳴るので、AudioWorklet の中に「ためる場所」を作り、
// そこから1本の音として流す（24kHz → 端末の周波数への変換もつなぎ目なしで行う）。
// 足りなくなったら一度小さくして止め、少したまってから再開する。

const WORKLET = `
class PcmOut extends AudioWorkletProcessor {
  constructor() {
    super()
    this.size = 24000 * 60
    this.ring = new Float32Array(this.size)
    this.write = 0
    this.read = 0
    this.rate = 24000 / sampleRate
    this.playing = false
    this.gain = 0
    this.idleFrames = 0
    this.sinceInput = 0
    this.need = 0.25 * 24000
    this.underruns = 0
    this.maybeGap = false
    this.last = 0
    this.prev = 0
    this.jumps = 0 // 隣どうしの音が大きく飛んだ回数（プツッという音の目安）
    this.port.onmessage = (event) => {
      const data = event.data
      if (data.type === 'push') {
        const samples = data.samples
        this.rate = (data.rate || 24000) / sampleRate
        for (let i = 0; i < samples.length; i += 1) this.ring[(this.write + i) % this.size] = samples[i]
        this.write += samples.length
        if (this.write - this.read > this.size - 1) this.read = this.write - this.size + 1
        // 空になったあと、すぐ続きが届いた＝とぎれた（話し終わりで空になったのは数えない）
        if (this.maybeGap && this.sinceInput < sampleRate) {
          this.underruns += 1
          this.port.postMessage({ type: 'gap', underruns: this.underruns })
        }
        this.maybeGap = false
        this.sinceInput = 0
      } else if (data.type === 'clear') {
        this.read = this.write
        this.fading = false
        this.maybeGap = false
        this.playing = false
        this.gain = 0
        this.need = 0.25 * 24000
      }
    }
  }

  process(inputs, outputs) {
    const out = outputs[0][0]
    if (!out) return true
    const available = this.write - this.read
    this.sinceInput += out.length
    if (!this.playing) {
      // 話しはじめは 0.25 秒、とぎれたあとは 0.15 秒ためてから。届くのが止まっていたら残りを鳴らす
      if (available > 1 && (available >= this.need || this.sinceInput > 0.3 * sampleRate)) {
        this.playing = true
        this.port.postMessage({ type: 'start' })
      } else {
        out.fill(0)
        return true
      }
    }
    const fade = 1 / (0.004 * sampleRate)
    for (let i = 0; i < out.length; i += 1) {
      const left = this.write - this.read
      // 足りなくなったら、続きが届いても途中でもどさず最後まで小さくする（もどすと音が飛ぶ）
      if (left < 2 && !this.fading) { this.fading = true; this.maybeGap = true }
      if (this.fading) {
        // 足りない：直前の音から小さくしていく（プツッと切れないように）
        this.gain = Math.max(0, this.gain - fade)
        out[i] = this.last * this.gain
        if (this.gain === 0) {
          for (let j = i + 1; j < out.length; j += 1) out[j] = 0
          this.fading = false
          this.playing = false
          this.need = 0.15 * 24000
          this.port.postMessage({ type: 'drained', underruns: this.underruns, jumps: this.jumps })
          return true
        }
        continue
      }
      const base = Math.floor(this.read)
      const frac = this.read - base
      const a = this.ring[base % this.size]
      const b = this.ring[(base + 1) % this.size]
      this.gain = Math.min(1, this.gain + fade)
      this.last = a + (b - a) * frac
      out[i] = this.last * this.gain
      if (Math.abs(out[i] - this.prev) > 0.25) this.jumps += 1
      this.prev = out[i]
      this.read += this.rate
    }
    return true
  }
}
registerProcessor('pcm-out', PcmOut)
`

let moduleFor = null // AudioWorklet を読みこんだ AudioContext
let moduleLoading = null

function loadWorklet(context) {
  if (moduleFor === context) return Promise.resolve(true)
  if (!context.audioWorklet) return Promise.resolve(false)
  if (moduleLoading?.context === context) return moduleLoading.promise
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
  const promise = context.audioWorklet.addModule(url).then(() => { moduleFor = context; return true }).catch(() => false)
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
    const context = sharedContext()
    if (context.state !== 'running') context.resume().catch(() => {})
    return context
  }

  get playing() {
    return this.active
  }

  // 準備中に何度呼ばれても、つなぐのは1回だけ（2つ作ると声が重なる）
  connect() {
    const context = sharedContext()
    if (this.node && this.context === context) return Promise.resolve()
    if (this.connecting?.context === context) return this.connecting.promise
    const promise = this.attach(context).finally(() => { if (this.connecting?.promise === promise) this.connecting = null })
    this.connecting = { context, promise }
    return promise
  }

  async attach(context) {
    this.node?.disconnect()
    this.node = null
    this.context = context
    const ok = await loadWorklet(context)
    if (this.context !== context) return
    if (!ok) { this.fallback = true; return }
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
    if (this.fallback) return this.pushFallback(samples, sampleRate)
    if (this.node && this.context === sharedContext()) {
      this.node.port.postMessage({ type: 'push', samples, rate: sampleRate }, [samples.buffer])
    } else {
      this.pending.push([samples, sampleRate])
      this.connect().then(() => { if (this.fallback) this.flushFallback() })
    }
  }

  stop() {
    clearTimeout(this.idleTimer)
    this.pending = []
    this.node?.port.postMessage({ type: 'clear' })
    for (const source of this.sources) { try { source.stop() } catch {} }
    this.sources.clear()
    this.nextTime = 0
    const was = this.active
    this.active = false
    if (was) this.onIdle?.()
  }

  close() {
    this.stop()
    this.node?.disconnect()
    this.node = null
  }

  // ---- AudioWorklet が使えない端末用 ----
  flushFallback() {
    const pending = this.pending
    this.pending = []
    for (const [samples, rate] of pending) this.pushFallback(samples, rate)
  }

  pushFallback(samples, sampleRate) {
    const context = sharedContext()
    const underrun = this.nextTime < context.currentTime + 0.02
    const lead = !this.sources.size ? 0.25 : underrun ? 0.15 : 0
    const startAt = underrun ? context.currentTime + lead : this.nextTime
    const buffer = context.createBuffer(1, samples.length, sampleRate)
    buffer.copyToChannel(samples, 0)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start(startAt)
    this.nextTime = startAt + buffer.duration
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      if (!this.sources.size) this.markIdle()
    }
  }
}

export function sampleRateOf(mimeType) {
  const match = /rate=(\d+)/.exec(mimeType || '')
  return match ? Number(match[1]) : 24000
}
