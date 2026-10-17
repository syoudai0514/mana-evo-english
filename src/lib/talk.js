// english-talk（Supabase Edge Function）を呼ぶ。?mock=1 のときは端末内のダミー相手。
import { SUPABASE_ANON_KEY, TALK_ENDPOINT, isMockMode } from './config.js'
import { getAccessToken } from './auth.js'
import { mockReply } from './mockTalk.js'

export class TalkError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

async function post(body, token) {
  return fetch(TALK_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

// input: { text } または { audio: { mime, data } }
export async function sendTurn({ system, history, input, startModel = 0, context }) {
  if (isMockMode()) return mockReply({ input, context })

  let token = await getAccessToken().catch(() => null)
  if (!token) throw new TalkError('auth', 'ログインが必要です')
  const body = { system, history, input, startModel }

  let response
  try {
    response = await post(body, token)
    if (response.status === 401) {
      token = await getAccessToken({ force: true })
      response = await post(body, token)
    }
  } catch (error) {
    if (error instanceof TalkError) throw error
    throw new TalkError('network', 'つうしんできませんでした')
  }

  const data = await response.json().catch(() => null)
  if (response.status === 401) throw new TalkError('auth', 'ログインしなおしてください')
  if (data?.code === 'exhausted') throw new TalkError('exhausted', 'きょうは おしまい')
  if (!response.ok || !data?.reply) throw new TalkError('server', data?.message || 'うまく おへんじ できなかったよ')
  return { reply: data.reply, model: data.model, modelIndex: data.modelIndex || 0 }
}
