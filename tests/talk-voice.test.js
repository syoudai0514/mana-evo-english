import test from 'node:test'
import assert from 'node:assert/strict'
import { LiveSession } from '../src/lib/live.js'

test('parent reading suppresses automatic playback but preserves the voice for an explicit replay', () => {
  let audio,
    played = 0,
    wakes = 0
  const session = new LiveSession({
    muted: true,
    handlers: {
      onTurnComplete: (chunks) => {
        audio = chunks
      }
    }
  })
  session.player = {
    ensure: () => {
      wakes++
    },
    stop: () => {},
    push: () => {
      played++
    }
  }
  session.handle({
    serverContent: {
      modelTurn: {
        parts: [
          { inlineData: { data: 'AAAA', mimeType: 'audio/pcm;rate=24000' } }
        ]
      },
      turnComplete: true
    }
  })
  assert.equal(played, 0)
  assert.deepEqual(audio, [['AAAA', 24000]])
  session.replay(audio)
  assert.equal(wakes, 1)
  assert.equal(played, 1)
  assert.equal(session.muted, true)
  session.handle({
    serverContent: {
      modelTurn: {
        parts: [
          { inlineData: { data: 'BBBB', mimeType: 'audio/pcm;rate=24000' } }
        ]
      },
      turnComplete: true
    }
  })
  assert.equal(played, 1)
})
