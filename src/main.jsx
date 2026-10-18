import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
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
