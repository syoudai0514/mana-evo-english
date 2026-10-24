// 電車モードの番組を、サーバー（english-train）で作ってもらう。
// アプリを閉じても・画面を消してもサーバーが作りつづけ、できたら次にアプリを開いたときに数秒でダウンロードする。
// みんなの番組（連続ドラマ・朗読・ラジオ講座・TOEIC）は毎晩サーバーが作り置きする。
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js'
import { getAccessToken } from './auth.js'
import { dueCards, memoryForTalk, weakSkills } from './adult.js'
import { cardsScript, recentTranscript } from './episodes.js'
import { latestEpisodeOf, listEpisodes, saveEpisode, savePart } from './episodeStore.js'

const ENDPOINT = `${SUPABASE_URL}/functions/v1/english-train`

async function api(action, body = {}) {
  const token = await getAccessToken().catch(() => null)
  if (!token) throw Object.assign(new Error('auth'), { code: 'auth' })
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body })
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.message || action), { code: data.code || 'server' })
  return data
}

// 番組の材料（あなたの記憶・覚えたい言い方・苦手・最近の会話・復習カード）
export async function contextFor(adult, programId) {
  const context = {
    memory: memoryForTalk(adult).map((item) => item.fact),
    phrases: dueCards(adult, Date.now() + 3 * 86400000, 5).map((card) => card.en),
    weakSkills: weakSkills(adult).map((row) => row.ja)
  }
  if (programId === 'mine') context.transcript = recentTranscript(adult)
  if (programId === 'cards') {
    const script = cardsScript(adult, 12)
    context.lines = script.lines
    context.title = script.title
  }
  if (programId === 'drama') context.previous = (await latestEpisodeOf(adult.id, 'drama').catch(() => null))?.summary || ''
  return context
}

export async function requestProgram(adult, programId, length, { topic = '' } = {}) {
  return api('enqueue', { adultKey: adult.id, programId, length, topic, context: await contextFor(adult, programId) })
}

// 頼んだ番組の進み具合と、毎晩の作り置き
export function serverStatus(adult) {
  return api('status', { adultKey: adult.id })
}

export function retryProgram(id) {
  return api('retry', { id })
}

export function cancelProgram(id) {
  return api('cancel', { id })
}

// できた番組をこの iPhone に保存する（章ごとの音声 → 番組の情報）。頼んだ番組はサーバーから消す
export async function downloadProgram(adult, id, onProgress = () => {}) {
  const data = await api('fetch', { id })
  const episode = data.episode || {}
  const localId = `s${id.replace(/-/g, '').slice(0, 16)}`
  const chapters = episode.chapters || []
  for (let i = 0; i < chapters.length; i += 1) {
    onProgress(i, chapters.length)
    const response = await fetch(data.urls[i])
    if (!response.ok) throw Object.assign(new Error('download'), { code: 'download' })
    await savePart(localId, i, await response.blob())
  }
  await saveEpisode({
    id: localId,
    serverId: id,
    shared: data.shared,
    adultId: adult.id,
    kind: data.programId,
    programId: data.programId,
    length: data.length,
    title: episode.title || '番組',
    plan: episode.plan,
    createdAt: Date.parse(data.createdAt) || Date.now(),
    status: 'ready',
    chapters: chapters.map(({ title, start, duration }) => ({ title, start, duration })),
    lines: episode.lines || [],
    tips: episode.tips || [],
    sets: episode.sets,
    summary: episode.summary || '',
    duration: episode.duration || 0,
    position: 0,
    listened: false,
    v: 3
  })
  if (!data.shared) await api('ack', { id }).catch(() => null)
  return localId
}

// もうこの iPhone にある作り置きの番組（サーバーの番号）
export async function downloadedServerIds(adult) {
  return new Set((await listEpisodes(adult.id)).map((episode) => episode.serverId).filter(Boolean))
}
