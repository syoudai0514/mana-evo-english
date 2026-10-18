// english-talk: マナエボ英語の Gemini Live 接続を用意する。
// - ログイン中のユーザー（app-save-hub の Supabase Auth）だけが使える
// - Gemini の API キーは secret（GEMINI_API_KEY）に置き、アプリには渡さない
// - 使うのは無料枠で上限のない Live モデル2つだけ（Gemini 3 Flash Live / Gemini 3.8 Live）。
//   それ以外のモデル（Flash-Lite など上限のあるもの）は呼ばない

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''

// 許可するモデル（この2つ以外は選ばない）
const LIVE_ALLOWED: Record<string, RegExp> = {
  '3-flash': /^gemini-3(\.1)?-flash-live(-preview)?$/,
  '3.8': /^gemini-3\.8-live$/
}
// おまかせの順番（速い 3 Flash Live を優先）
const AUTO_ORDER = ['3-flash', '3.8']
let liveModelsCache: { names: string[]; at: number } | null = null

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

// このキーで使える Live モデルのうち、許可した2つだけを返す
async function listAllowedLiveModels(): Promise<string[]> {
  if (liveModelsCache && Date.now() - liveModelsCache.at < 6 * 3600_000) return liveModelsCache.names
  const names: string[] = []
  let pageToken = ''
  for (let page = 0; page < 5; page += 1) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`
    const response = await fetch(url, { headers: { 'x-goog-api-key': GEMINI_API_KEY } })
    if (!response.ok) break
    const data = await response.json()
    for (const model of data.models ?? []) {
      const name = String(model.name).replace(/^models\//, '')
      const live = (model.supportedGenerationMethods ?? []).includes('bidiGenerateContent')
      if (live && Object.values(LIVE_ALLOWED).some((pattern) => pattern.test(name))) names.push(name)
    }
    pageToken = data.nextPageToken ?? ''
    if (!pageToken) break
  }
  if (names.length) liveModelsCache = { names, at: Date.now() }
  return names
}

async function pickLiveModel(choice?: string): Promise<string | null> {
  const names = await listAllowedLiveModels()
  const order = choice && LIVE_ALLOWED[choice] ? [choice, ...AUTO_ORDER.filter((id) => id !== choice)] : AUTO_ORDER
  for (const id of order) {
    const hit = names.find((name) => LIVE_ALLOWED[id].test(name))
    if (hit) return hit
  }
  return null
}

// ブラウザが Live API に直接つなぐための使い捨てキー（1回だけ・新しい接続は2分以内）
async function createLiveToken() {
  const now = Date.now()
  const response = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + 30 * 60_000).toISOString(),
      newSessionExpireTime: new Date(now + 2 * 60_000).toISOString()
    })
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.name) {
    console.error('live token failed', response.status, JSON.stringify(data).slice(0, 300))
    return null
  }
  return data.name as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ message: 'method not allowed' }, 405)
  if (!GEMINI_API_KEY) return json({ code: 'config', message: 'GEMINI_API_KEY が設定されていません' }, 500)
  if (!(await verifyUser(req))) return json({ code: 'auth', message: 'ログインが必要です' }, 401)

  let body: { action?: string; liveModel?: string; info?: unknown }
  try { body = await req.json() } catch { return json({ code: 'bad_request', message: 'invalid json' }, 400) }

  if (body?.action === 'live-log') {
    console.warn('live problem', JSON.stringify(body.info ?? {}).slice(0, 800))
    return json({ ok: true })
  }

  if (body?.action === 'live-token') {
    const model = await pickLiveModel(body.liveModel)
    console.log('live token', body.liveModel ?? 'auto', '->', model)
    if (!model) return json({ code: 'no_live_model', message: 'Gemini 3 Flash Live / 3.8 Live が見つかりません' }, 503)
    const token = await createLiveToken()
    if (!token) return json({ code: 'live_token', message: 'Live に接続できませんでした' }, 502)
    return json({ token, model })
  }

  // Live 以外の呼び出し（上限のあるモデル）は受け付けない
  return json({ code: 'not_supported', message: 'Live only' }, 400)
})
