// english-train：電車モードの番組をサーバーに頼む・進み具合を見る・できた番組を受け取る（アプリから呼ぶ）。
// 作るのは english-train-worker（アプリを閉じても作りつづける）。ログイン中のユーザーだけが使える。
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const BUCKET = 'english-train'

// worker を呼ぶための合い言葉（データベースの vault にだけ置いてある）
let workerKey = ''
async function getWorkerKey() {
  if (!workerKey) { const { data } = await db.rpc('english_train_worker_key'); workerKey = String(data || '') }
  return workerKey
}

const PROGRAMS: Record<string, number[]> = { talk: [10, 20, 30], drama: [15, 30], radio: [10, 20], story: [15, 30], toeic: [10, 20], mine: [5], cards: [5, 10] }
const MAX_ACTIVE = 8 // 1人が同時に頼める本数

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function kick() {
  const key = await getWorkerKey()
  return fetch(`${SUPABASE_URL}/functions/v1/english-train-worker`, { method: 'POST', headers: { 'x-worker-key': key } }).then((r) => r.body?.cancel()).catch(() => null)
}

// 受けとる番組の中身（字幕など）と、章ごとの音声のダウンロード先（1時間だけ使える）
async function deliver(row: any) {
  const chapters = row.episode?.chapters || []
  const urls: string[] = []
  for (const chapter of chapters) {
    const { data } = await db.storage.from(BUCKET).createSignedUrl(chapter.path, 3600)
    urls.push(data?.signedUrl || '')
  }
  return { id: row.id, programId: row.program_id, length: row.length, shared: row.shared, createdAt: row.created_at, episode: row.episode, urls }
}

async function removeJob(id: string) {
  for (const prefix of [`out/${id}`, `work/${id}`]) {
    const { data } = await db.storage.from(BUCKET).list(prefix, { limit: 1000 })
    const files = (data || []).filter((file) => file.id).map((file) => `${prefix}/${file.name}`)
    if (files.length) await db.storage.from(BUCKET).remove(files)
  }
  await db.from('english_train_jobs').delete().eq('id', id)
}

async function handle(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ message: 'method not allowed' }, 405)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const { data: auth } = await db.auth.getUser(token)
  const userId = auth?.user?.id
  if (!userId) return json({ code: 'auth', message: 'ログインが必要です' }, 401)
  let body: any
  try { body = await req.json() } catch { return json({ code: 'bad_request' }, 400) }

  if (body.action === 'enqueue') {
    const lengths = PROGRAMS[body.programId]
    if (!lengths || !lengths.includes(Number(body.length))) return json({ code: 'bad_request', message: 'unknown program' }, 400)
    const { count } = await db.from('english_train_jobs').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['queued', 'working'])
    if ((count || 0) >= MAX_ACTIVE) return json({ code: 'too_many', message: `同時に頼めるのは${MAX_ACTIVE}本までです` }, 429)
    // 番組の材料（記憶・覚えたい言い方・会話など）は大きすぎないように
    const context = body.context && typeof body.context === 'object' ? body.context : {}
    if (JSON.stringify(context).length > 40000) return json({ code: 'too_large' }, 413)
    const { data, error } = await db.from('english_train_jobs').insert({
      user_id: userId, adult_key: String(body.adultKey || ''), program_id: body.programId, length: Number(body.length), topic: String(body.topic || '').slice(0, 80), context
    }).select('id').single()
    if (error) return json({ code: 'server', message: error.message }, 500)
    await kick()
    return json({ id: data.id })
  }

  if (body.action === 'status') {
    const { data: mine } = await db.from('english_train_jobs').select('id, program_id, length, status, progress, error, created_at, adult_key')
      .eq('user_id', userId).eq('adult_key', String(body.adultKey || '')).order('created_at', { ascending: true }).limit(40)
    const { data: shared } = await db.from('english_train_jobs').select('id, program_id, length, created_at, episode->title, episode->duration')
      .eq('shared', true).eq('status', 'ready').order('created_at', { ascending: false }).limit(40)
    if ((mine || []).some((job) => job.status === 'queued')) kick()
    return json({ jobs: mine || [], catalog: shared || [] })
  }

  if (body.action === 'fetch') {
    const { data: row } = await db.from('english_train_jobs').select('*').eq('id', String(body.id)).eq('status', 'ready').maybeSingle()
    if (!row || (!row.shared && row.user_id !== userId)) return json({ code: 'not_found' }, 404)
    return json(await deliver(row))
  }

  if (body.action === 'ack' || body.action === 'cancel') {
    const { data: row } = await db.from('english_train_jobs').select('id, user_id, shared').eq('id', String(body.id)).maybeSingle()
    if (!row || row.shared || row.user_id !== userId) return json({ ok: true })
    await removeJob(row.id)
    return json({ ok: true })
  }

  if (body.action === 'retry') {
    await db.from('english_train_jobs').update({ status: 'queued', error: null, failures: 0, lease_until: null }).eq('id', String(body.id)).eq('user_id', userId)
    await kick()
    return json({ ok: true })
  }

  return json({ code: 'not_supported' }, 400)
}

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch (error) {
    console.error('english-train', String((error as Error)?.message ?? error))
    return json({ code: 'server', message: 'サーバーでエラーが起きました' }, 500)
  }
})
