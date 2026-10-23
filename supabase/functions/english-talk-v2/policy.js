export const MAX_BODY_BYTES = 4096
export function validateLiveBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  if (!['live-token', 'live-log', 'live-release'].includes(body.action))
    return false
  if (
    body.action === 'live-token' &&
    ((body.purpose && !['voice', 'text', 'asr'].includes(body.purpose)) ||
      (body.liveModel &&
        !['auto', '3-flash', '3.8', '2.5-audio', '3.5-transcribe'].includes(
          body.liveModel
        )))
  )
    return false
  if (
    body.action === 'live-release' &&
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.leaseId || '')
  )
    return false
  return true
}
const diagnosticSteps = new Set([
  'render-error',
  'js-error',
  'episode-mismatch',
  'episode-script',
  'episode-script-connect',
  'episode-voice',
  'audio-gaps',
  'audio-info',
  'audio-silent',
  'stall',
  'reader',
  'reader-connect',
  'asr',
  'asr-closed',
  'questions',
  'questions-connect',
  'pron-tips',
  'pron-tips-connect',
  'closed',
  'reconnect',
  'refresh',
  'resume',
  'annotator',
  'annotator-connect'
])
export function safeDiagnostic(info) {
  return {
    step: diagnosticSteps.has(info?.step) ? info.step : 'unknown',
    code:
      Number.isInteger(info?.code) && info.code >= 0 && info.code <= 9999
        ? info.code
        : 0,
    platform:
      info?.platform === 'ios' || /iphone|ipad/i.test(String(info?.ua || ''))
        ? 'ios'
        : 'other'
  }
}

export function ephemeralRequest(model, now = Date.now()) {
  return {
    uses: 1,
    expireTime: new Date(now + 10 * 60_000).toISOString(),
    newSessionExpireTime: new Date(now + 2 * 60_000).toISOString(),
    bidiGenerateContentSetup: { model: `models/${model}` },
    fieldMask: 'model'
  }
}
