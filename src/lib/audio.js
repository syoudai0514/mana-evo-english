// 相棒の声を鳴らす AudioContext（すべての Live の声でひとつだけ使う）。
// マイクは別の AudioContext にする：iPhone は読み上げなどで AudioContext を止めることがあり、
// 共用にすると声とマイクが一緒に止まってしまうため。
let context = null

export function playbackContext() {
  if (!context || context.state === 'closed') {
    const Context = window.AudioContext || window.webkitAudioContext
    context = new Context()
  }
  return context
}

// 止まったまま（"interrupted" など）戻らないときに作りなおす
export function resetPlaybackContext() {
  try { context?.close() } catch {}
  context = null
}
