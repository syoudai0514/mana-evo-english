import { bytesToBase64, downsample, encodeWav, rms } from './wav.js'

const MAX_SECONDS = 15

// おしながら はなす 録音。マイクは会話画面にいる間だけ開いておく。
export class Recorder {
  constructor() {
    this.stream = null
    this.context = null
    this.source = null
    this.processor = null
    this.chunks = []
    this.recording = false
    this.onLevel = null
  }

  async open() {
    if (this.stream) return
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
    const Context = window.AudioContext || window.webkitAudioContext
    this.context = new Context()
    this.source = this.context.createMediaStreamSource(this.stream)
    this.processor = this.context.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (event) => {
      if (!this.recording) return
      const data = event.inputBuffer.getChannelData(0)
      this.chunks.push(new Float32Array(data))
      this.onLevel?.(Math.min(1, rms(data) * 6))
      if (this.duration() > MAX_SECONDS) this.recording = false
    }
    this.source.connect(this.processor)
    this.processor.connect(this.context.destination)
  }

  duration() {
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    return this.context ? total / this.context.sampleRate : 0
  }

  async start() {
    await this.open()
    if (this.context.state === 'suspended') await this.context.resume()
    this.chunks = []
    this.recording = true
  }

  stop() {
    this.recording = false
    const length = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Float32Array(length)
    let offset = 0
    for (const chunk of this.chunks) { merged.set(chunk, offset); offset += chunk.length }
    this.chunks = []
    const seconds = this.context ? length / this.context.sampleRate : 0
    const loudness = rms(merged)
    const pcm = downsample(merged, this.context?.sampleRate || 16000, 16000)
    return { seconds, loudness, base64: bytesToBase64(encodeWav(pcm, 16000)), mime: 'audio/wav' }
  }

  close() {
    this.recording = false
    try { this.processor?.disconnect(); this.source?.disconnect() } catch {}
    this.stream?.getTracks().forEach((track) => track.stop())
    this.context?.close().catch(() => {})
    this.stream = null
    this.context = null
  }
}

export function micSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}
