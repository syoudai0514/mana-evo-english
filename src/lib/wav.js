// 録音した Float32 の音声を 16kHz モノラルの WAV にする（Gemini にそのまま渡せる形式）

export function downsample(samples, inRate, outRate = 16000) {
  if (outRate >= inRate) return samples
  const ratio = inRate / outRate
  const length = Math.floor(samples.length / ratio)
  const out = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio)
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j += 1) sum += samples[j]
    out[i] = sum / Math.max(1, end - start)
  }
  return out
}

export function encodeWav(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const write = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)) }
  write(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Uint8Array(buffer)
}

export function bytesToBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

// 無音判定（RMS）
export function rms(samples) {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

// Live API 用：Float32 → 16bit PCM（little endian）の base64
export function floatToPcm16Base64(samples) {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return bytesToBase64(bytes)
}

// Live API の返事（24kHz 16bit PCM の base64）→ Float32
export function pcm16Base64ToFloat(base64) {
  const binary = atob(base64)
  const length = Math.floor(binary.length / 2)
  const out = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    let value = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8)
    if (value >= 0x8000) value -= 0x10000
    out[i] = value / 0x8000
  }
  return out
}
