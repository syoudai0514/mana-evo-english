// アプリ全体でひとつだけ使う AudioContext。
// iPhone は AudioContext が複数あると（相棒の声・裏方・マイクで別々に作ると）音がブツブツ切れるので、ひとつにまとめる。
let context = null

export function sharedContext() {
  if (!context || context.state === 'closed') {
    const Context = window.AudioContext || window.webkitAudioContext
    context = new Context()
  }
  return context
}

// "interrupted" から戻らないときだけ作りなおす（声の再生側は次に鳴らすときに作りなおす）
export function resetSharedContext() {
  try { context?.close() } catch {}
  context = null
}

export async function resumeShared(timeoutMs = 500) {
  const ctx = sharedContext()
  if (ctx.state === 'running') return true
  await Promise.race([ctx.resume().catch(() => {}), new Promise((resolve) => setTimeout(resolve, timeoutMs))])
  return ctx.state === 'running'
}
