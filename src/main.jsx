import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './experience.css'
import './learning.css'
import { reportLiveProblem } from './lib/live.js'

// iPhone で起きたエラーを english-talk のログに残す（原因調べ用。会話の中身は送らない）
let errorCount = 0
const reportError = (message) => { if (errorCount++ < 5) reportLiveProblem({ step: 'js-error', message: String(message).slice(0, 300) }) }
window.addEventListener('error', (event) => reportError(`${event.message} @${event.filename?.split('/').pop()}:${event.lineno}`))
window.addEventListener('unhandledrejection', (event) => reportError(`unhandled: ${event.reason?.message || event.reason}`))

createRoot(document.getElementById('root')).render(<App />)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

// 裏に回していた PWA は、長いあいだ古い版のまま動きつづける。30分以上たってもどったら、新しい版があれば読みなおす
// （会話や番組の途中ではやらない：音が鳴っていない・マイクを使っていないときだけ）
let hiddenAt = 0
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return }
  if (!import.meta.env.PROD || !hiddenAt || Date.now() - hiddenAt < 30 * 60000) return
  const playing = [...document.querySelectorAll('audio')].some((element) => !element.paused)
  if (playing || document.querySelector('.screen.talk, .train-player')) return
  const current = document.querySelector('script[type="module"][src*="/assets/"]')?.getAttribute('src')
  fetch('/', { cache: 'no-store' })
    .then((response) => (response.ok ? response.text() : ''))
    .then((html) => {
      const latest = /src="(\/assets\/index-[^"]+\.js)"/.exec(html)?.[1]
      if (current && latest && latest !== current) location.reload()
    })
    .catch(() => {})
})
