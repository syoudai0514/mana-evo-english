import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateLiveBody,
  safeDiagnostic,
  ephemeralRequest
} from '../supabase/functions/english-talk-v2/policy.js'
test('Live API validates the purpose, model and release id', () => {
  assert.equal(
    validateLiveBody({
      action: 'live-token',
      purpose: 'asr',
      liveModel: 'auto'
    }),
    true
  )
  for (const body of [
    { action: 'generate' },
    { action: 'live-token', purpose: 'anything' },
    { action: 'live-token', liveModel: 'constructor' },
    { action: 'live-release', leaseId: 'wrong' }
  ])
    assert.equal(validateLiveBody(body), false)
})
test('diagnostics cannot include conversation text, tokens or arbitrary errors', () => {
  const d = safeDiagnostic({
    step: 'reader',
    message: 'PRIVATE',
    token: 'SECRET',
    transcript: 'PRIVATE',
    ua: 'iPhone',
    code: 429
  })
  assert.deepEqual(d, { step: 'reader', code: 429, platform: 'ios' })
  assert.ok(!JSON.stringify(d).includes('PRIVATE'))
  assert.equal(
    safeDiagnostic({ step: 'PRIVATEsecret', code: Infinity }).step,
    'unknown'
  )
  assert.equal(
    safeDiagnostic({ step: 'reader', platform: 'ios' }).platform,
    'ios'
  )
})
test('ephemeral tokens constrain the exact model and have bounded lifetime and one use', () => {
  const b = ephemeralRequest('gemini-test', 1000)
  assert.equal(b.uses, 1)
  assert.equal(b.fieldMask, 'model')
  assert.equal(b.bidiGenerateContentSetup.model, 'models/gemini-test')
  assert.equal(Date.parse(b.expireTime) - 1000, 600000)
  assert.equal(Date.parse(b.newSessionExpireTime) - 1000, 120000)
})
