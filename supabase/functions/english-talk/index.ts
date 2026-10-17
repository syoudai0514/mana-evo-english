// english-talk: マナエボ英語の会話を Gemini に中継する。
// - ログイン中のユーザー（app-save-hub の Supabase Auth）だけが使える
// - Gemini の API キーは secret（GEMINI_API_KEY）に置き、アプリには渡さない
// - メインのモデルが上限（429）なら次のモデルへ。全部だめなら code: "exhausted"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const MODELS = (Deno.env.get('GEMINI_MODELS') ?? 'gemini-3.1-flash-lite,gemini-3.5-flash')
  .split(',').map((model) => model.trim()).filter(Boolean)

const LIMITS = { system: 24000, historyItems: 16, historyText: 2000, inputText: 1000, audioBase64: 3_000_000 }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const HINT = {
  type: 'OBJECT',
  properties: { en: { type: 'STRING' }, kana: { type: 'STRING' }, emoji: { type: 'STRING' } },
  required: ['en', 'kana', 'emoji']
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    child_said: { type: 'STRING' },
    heard: { type: 'BOOLEAN' },
    child_lang: { type: 'STRING', enum: ['en', 'ja', 'mixed', 'none'] },
    spoke_english: { type: 'BOOLEAN' },
    recast: { type: 'STRING' },
    reply_en: { type: 'STRING' },
    reply_kana: { type: 'STRING' },
    reply_ipa: { type: 'STRING' },
    reply_ja: { type: 'STRING' },
    hints: { type: 'ARRAY', items: HINT },
    memory: { type: 'ARRAY', items: { type: 'STRING' } },
    tip_ja: { type: 'STRING' },
    end: { type: 'BOOLEAN' }
  },
  required: ['child_said', 'heard', 'child_lang', 'spoke_english', 'recast', 'reply_en', 'reply_kana', 'reply_ipa', 'reply_ja', 'hints', 'memory', 'tip_ja', 'end']
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function verifyUser(req: Request) {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: SUPABASE_ANON_KEY }
  })
  return response.ok
}

type Turn = { role: 'user' | 'model'; text: string }
type Body = {
  system: string
  history: Turn[]
  input: { text?: string; audio?: { mime: string; data: string } }
  startModel?: number
}

function validate(body: Body): string | null {
  if (typeof body?.system !== 'string' || !body.system || body.system.length > LIMITS.system) return 'system'
  if (!Array.isArray(body.history) || body.history.length > LIMITS.historyItems) return 'history'
  for (const turn of body.history) {
    if (!['user', 'model'].includes(turn?.role) || typeof turn.text !== 'string' || turn.text.length > LIMITS.historyText) return 'history'
  }
  const { text, audio } = body.input ?? {}
  if (audio) {
    if (!['audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg'].includes(audio.mime)) return 'audio'
    if (typeof audio.data !== 'string' || audio.data.length > LIMITS.audioBase64) return 'audio'
  } else if (typeof text !== 'string' || !text || text.length > LIMITS.inputText) {
    return 'input'
  }
  return null
}

function buildContents(body: Body) {
  // Gemini は user/model が交互でないと嫌うので、同じ役が続いたらまとめる
  const contents: { role: string; parts: unknown[] }[] = []
  for (const turn of body.history) {
    const last = contents[contents.length - 1]
    if (last?.role === turn.role) last.parts.push({ text: turn.text })
    else contents.push({ role: turn.role, parts: [{ text: turn.text }] })
  }
  const parts = body.input.audio
    ? [{ text: '(The child is speaking. Listen to the audio.)' }, { inlineData: { mimeType: body.input.audio.mime, data: body.input.audio.data } }]
    : [{ text: body.input.text }]
  const last = contents[contents.length - 1]
  if (last?.role === 'user') last.parts.push(...parts)
  else contents.push({ role: 'user', parts })
  return contents
}

async function callGemini(model: string, body: Body, withThinking: boolean) {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.9,
    maxOutputTokens: 1024
  }
  if (withThinking) generationConfig.thinkingConfig = { thinkingLevel: 'minimal' }
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: body.system }] },
      contents: buildContents(body),
      generationConfig,
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' }
      ]
    })
  })
}

function parseReply(data: any) {
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? '')
    .join('')
  if (!text) return null
  const reply = JSON.parse(text)
  if (typeof reply?.reply_en !== 'string' || !reply.reply_en) return null
  return {
    child_said: String(reply.child_said ?? ''),
    heard: reply.heard !== false,
    child_lang: reply.child_lang ?? 'none',
    spoke_english: Boolean(reply.spoke_english),
    recast: String(reply.recast ?? ''),
    reply_en: reply.reply_en,
    reply_kana: String(reply.reply_kana ?? ''),
    reply_ipa: String(reply.reply_ipa ?? ''),
    reply_ja: String(reply.reply_ja ?? ''),
    hints: Array.isArray(reply.hints) ? reply.hints.slice(0, 3) : [],
    memory: Array.isArray(reply.memory) ? reply.memory.slice(0, 3).map(String) : [],
    tip_ja: String(reply.tip_ja ?? ''),
    end: Boolean(reply.end)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ message: 'method not allowed' }, 405)
  if (!GEMINI_API_KEY) return json({ code: 'config', message: 'GEMINI_API_KEY が設定されていません' }, 500)
  if (!(await verifyUser(req))) return json({ code: 'auth', message: 'ログインが必要です' }, 401)

  let body: Body
  try { body = await req.json() } catch { return json({ code: 'bad_request', message: 'invalid json' }, 400) }
  const invalid = validate(body)
  if (invalid) return json({ code: 'bad_request', message: `invalid ${invalid}` }, 400)

  const start = Math.min(Math.max(0, Number(body.startModel) || 0), MODELS.length - 1)
  let lastError = ''
  let quotaHit = false
  let otherFailure = false
  for (let index = start; index < MODELS.length; index += 1) {
    const model = MODELS[index]
    let response = await callGemini(model, body, true)
    if (response.status === 400) {
      // thinkingLevel に対応していないモデルなら、指定なしでもう一度
      const detail = await response.text()
      if (/thinking/i.test(detail)) response = await callGemini(model, body, false)
      else { lastError = detail.slice(0, 300); otherFailure = true; break }
    }
    if (response.status === 429) {
      quotaHit = true
      lastError = `${model}: 429`
      continue
    }
    if (response.status === 404) {
      lastError = `${model}: 404 (model not found)`
      continue
    }
    if (!response.ok) {
      lastError = `${model}: ${response.status} ${(await response.text()).slice(0, 300)}`
      // 混雑（503）は次のモデルで試す
      otherFailure = true
      if (response.status >= 500) continue
      break
    }
    try {
      const reply = parseReply(await response.json())
      if (reply) return json({ reply, model, modelIndex: index })
      lastError = `${model}: empty reply`
    } catch (error) {
      lastError = `${model}: parse ${error}`
    }
    otherFailure = true
  }

  if (quotaHit && !otherFailure) {
    return json({ code: 'exhausted', message: 'きょうは おしまい' }, 429)
  }
  console.error('english-talk failed', lastError)
  return json({ code: 'upstream', message: 'うまく おへんじ できなかったよ' }, 502)
})
