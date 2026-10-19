// 相棒の声を鳴らす AudioContext（すべての Live の声でひとつだけ使う）。
// マイクは別の AudioContext にする：iPhone は読み上げなどで AudioContext を止めることがあり、
// 共用にすると声とマイクが一緒に止まってしまうため。
let context = null

export function playbackContext() {
  if (!context || context.state === 'closed') {
    const Context = window.AudioContext || window.webkitAudioContext
    const created = new Context()
    context = created
    // 一度でも鳴った AudioContext は、iPhone に止められても（interrupted）タップなしで再開できる
    created.onstatechange = () => {
      if (created.state === 'running') created.wasRunning = true
      if (created === context && (created.state === 'interrupted' || created.state === 'suspended') && created.wasRunning) {
        setTimeout(() => { if (created === context && created.state !== 'running') created.resume().catch(() => {}) }, 150)
      }
    }
  }
  return context
}

// タップの中で呼ぶ：AudioContext を作って鳴らせる状態にしておく（iPhone はタップの外で作ると鳴らない）
export function primePlayback() {
  try {
    let ctx = playbackContext()
    // 一度も鳴っていないまま止まっているものは、タップの中で作りなおす
    if (ctx.state === 'interrupted' && !ctx.wasRunning) { resetPlaybackContext(); ctx = playbackContext() }
    ctx.resume().catch(() => {})
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start()
  } catch {}
}

// 止まったまま（"interrupted" など）戻らないときに作りなおす
export function resetPlaybackContext() {
  try { context?.close() } catch {}
  context = null
}
