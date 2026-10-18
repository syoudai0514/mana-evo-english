import { bytesToBase64, downsample, encodeWav, floatToPcm16Base64, rms } from './wav.js'

const MAX_SECONDS = 15
const PREROLL_SECONDS = 0.5

// おしながら はなす 録音。マイクは会話画面にいる間だけ開いておく。
export class Recorder {
  constructor() {
    this.stream = null
    this.context = null
    this.source = null
    this.processor = null
    this.chunks = []
    this.preroll = [] // 押す直前の音（押すと同時に話しはじめても頭が切れないように）
    this.frames = 0
    this.recording = false
    this.onLevel = null
    this.onChunk = null // Live API：録音中の音声を 16kHz PCM の base64 で順に渡す
  }

  // iOS は読み上げや相棒の声のあと、マイクが止まったり AudioContext が "interrupted" のままになる。
  // そうなっていたら、マイクごと作りなおす。
  healthy() {
    const track = this.stream?.getAudioTracks()[0]
    return Boolean(track && track.readyState === 'live' && this.context && this.context.state !== 'closed')
  }

  async open() {
    if (this.healthy()) return
    this.close()
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
    const Context = window.AudioContext || window.webkitAudioContext
    this.context = new Context()
    this.source = this.context.createMediaStreamSource(this.stream)
    this.processor = this.context.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (event) => {
      this.frames += 1
      const data = event.inputBuffer.getChannelData(0)
      if (!this.recording) {
        this.preroll.push(new Float32Array(data))
        const keep = Math.ceil((PREROLL_SECONDS * this.context.sampleRate) / data.length)
        if (this.preroll.length > keep) this.preroll.splice(0, this.preroll.length - keep)
        return
      }
      this.chunks.push(new Float32Array(data))
      this.onLevel?.(Math.min(1, rms(data) * 6))
      if (this.onChunk) this.onChunk(floatToPcm16Base64(downsample(data, this.context.sampleRate, 16000)))
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
    // iOS：録音中も相棒の声がスピーカーから出るようにする（対応ブラウザのみ）
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record' } catch {}
    await this.open()
    if (!(await this.resume())) {
      this.close()
      await this.open()
      await this.resume()
    }
    this.framesAtStart = this.frames
    this.chunks = this.preroll
    this.preroll = []
    if (this.onChunk) {
      for (const chunk of this.chunks) this.onChunk(floatToPcm16Base64(downsample(chunk, this.context.sampleRate, 16000)))
    }
    this.recording = true
  }

  // 会話画面に入ったら先にマイクを開いておく（押す直前の音をためられるように）
  async warmUp() {
    try {
      await this.open()
      await this.resume()
    } catch {}
  }

  // suspended だけでなく iOS の interrupted からも戻す。戻らなければ false
  async resume() {
    if (this.context.state === 'running') return true
    await Promise.race([this.context.resume().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 500))])
    return this.context.state === 'running'
  }

  // 押しはじめてしばらくしても音が1つも届かないときに使う（マイクが止まっている）
  get silentSinceStart() {
    return this.recording && this.frames === this.framesAtStart
  }

  get isRecording() {
    return this.recording
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
