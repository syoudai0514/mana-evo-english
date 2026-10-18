import { pcm16Base64ToFloat } from './wav.js'

// Live API の声（24kHz PCM）を途切れずに順番に鳴らす
export class PcmPlayer {
  constructor() {
    this.context = null
    this.nextTime = 0
    this.sources = new Set()
    this.onIdle = null
    this.onStart = null
  }

  ensure() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext
      // 声と同じ 24kHz で鳴らす。iPhone は細切れの音を1つずつ変換するので、つなぎ目でプツッと鳴る
      try { this.context = new Context({ sampleRate: 24000 }) } catch { this.context = new Context() }
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {})
    return this.context
  }

  get playing() {
    return this.sources.size > 0
  }

  push(base64, sampleRate = 24000) {
    const context = this.ensure()
    const samples = pcm16Base64ToFloat(base64)
    if (!samples.length) return
    // 話しはじめと、音が足りなくなったとき（通信のゆれ）は、少しためてから鳴らす（プツプツ防止）
    const underrun = this.nextTime < context.currentTime + 0.02
    const lead = !this.sources.size ? 0.25 : underrun ? 0.15 : 0
    const startAt = underrun ? context.currentTime + lead : this.nextTime
    // 無音のあとから鳴りはじめるときは、少しずつ大きくしてプツッという音を消す
    if (underrun) fadeIn(samples, Math.round(sampleRate * 0.004))
    const buffer = context.createBuffer(1, samples.length, sampleRate)
    buffer.copyToChannel(samples, 0)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start(startAt)
    this.nextTime = startAt + buffer.duration
    if (!this.sources.size) this.onStart?.()
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      if (!this.sources.size) this.onIdle?.()
    }
  }

  stop() {
    for (const source of this.sources) {
      try { source.stop() } catch {}
    }
    this.sources.clear()
    this.nextTime = 0
    this.onIdle?.()
  }

  close() {
    this.stop()
    this.context?.close().catch(() => {})
    this.context = null
  }
}

function fadeIn(samples, length) {
  const n = Math.min(length, samples.length)
  for (let i = 0; i < n; i += 1) samples[i] *= i / n
}

export function sampleRateOf(mimeType) {
  const match = /rate=(\d+)/.exec(mimeType || '')
  return match ? Number(match[1]) : 24000
}
