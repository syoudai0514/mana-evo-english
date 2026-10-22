import test from 'node:test'
import assert from 'node:assert/strict'
import { speak } from '../src/lib/tts.js'
test('speech completion is distinct from unavailable or failed playback', async () => {
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text
    }
  }
  globalThis.window = { speechSynthesis: null }
  assert.deepEqual(await speak('cat'), {
    completed: false,
    reason: 'unavailable'
  })
  window.speechSynthesis = {
    getVoices: () => [],
    cancel: () => {},
    speak: (u) => queueMicrotask(() => u.onend())
  }
  assert.deepEqual(await speak('cat'), { completed: true })
  window.speechSynthesis.speak = (u) => queueMicrotask(() => u.onerror())
  assert.deepEqual(await speak('cat'), { completed: false, reason: 'error' })
  delete globalThis.window
  delete globalThis.SpeechSynthesisUtterance
})
