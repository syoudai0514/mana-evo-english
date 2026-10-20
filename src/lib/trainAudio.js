// 電車モードの <audio> は1つだけにして、使いまわす。
// iPhone は「タップの中で一度鳴らした <audio>」でないと、あとから再生できない（番組の読みこみはタップのあとに終わるので）。
// 番組を選ぶタップの中で unlockTrainAudio() を呼び、その同じ <audio> で番組を鳴らす。

let element = null
// 0.05秒の無音（タップの中で鳴らして、この <audio> を使えるようにする）
const SILENT = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQQAAAAAAAAA'

export function trainAudio() {
  if (!element) {
    element = document.createElement('audio')
    element.playsInline = true
    element.setAttribute('playsinline', '')
    element.preload = 'auto'
    globalThis.__meeTrainAudio = element // 確認用
  }
  return element
}

export function unlockTrainAudio() {
  const audio = trainAudio()
  if (audio.src && !audio.src.startsWith('data:') && !audio.paused) return
  audio.src = SILENT
  audio.play().then(() => { if (audio.src === SILENT) audio.pause() }).catch(() => {})
}
