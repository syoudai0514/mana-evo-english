// 相棒の声を流す AudioWorklet（player.js から読みこむ）。ためる場所から1本の音として流す
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
    this.need = 0.5 * 24000
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
        this.need = 0.5 * 24000
      }
    }
  }

  process(inputs, outputs) {
    const out = outputs[0][0]
    if (!out) return true
    const available = this.write - this.read
    this.sinceInput += out.length
    if (!this.playing) {
      // 話しはじめは 0.5 秒、とぎれたあとは 0.4 秒ためてから（声は 0.3 秒ほどの細切れで届く）。届くのが止まっていたら残りを鳴らす
      if (available > 1 && (available >= this.need || this.sinceInput > 0.45 * sampleRate)) {
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
          this.need = 0.4 * 24000
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
