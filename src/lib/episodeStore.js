// 電車モードの番組を端末に保存する（音声が大きいので localStorage ではなく IndexedDB）。
// 番組の情報（題・字幕・章）と、章ごとの音声を別々にしまう。音声は一度書いたら書きなおさない
// （再生中に音声の入った記録を書きなおすと、iPhone では音が止まるため）。
const DB_NAME = 'mee-train'
const STORE = 'episodes'
const PARTS = 'parts' // `${番組id}:${章}` → 音声 Blob
const KEEP = 30 // 1人あたり、何本まで残すか

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PARTS)) db.createObjectStore(PARTS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run(storeName, mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const request = fn(tx.objectStore(storeName))
    tx.oncomplete = () => { db.close(); resolve(request instanceof IDBRequest ? request.result : request) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    // 容量オーバーや、アプリが裏に回って中断されたときは abort だけが来る（待ちっぱなしにしない）
    tx.onabort = () => { db.close(); reject(tx.error || new Error('aborted')) }
  })
}

// どこまで聞いたか・聞きおわったか・TOEIC の答え。番組を書きなおさないよう、別に小さく保存する
const PROGRESS_KEY = 'mee-train-progress'
function readProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {} } catch { return {} }
}
function writeProgress(all) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)) } catch {}
}
export function saveProgress(id, patch) {
  const all = readProgress()
  all[id] = { ...all[id], ...patch }
  writeProgress(all)
}
function withProgress(episode, all = readProgress()) {
  return episode ? { ...episode, ...all[episode.id] } : episode
}

// 番組の情報だけを保存（音声は savePart で）。古い形（audio を中に持つ番組）はそのまま
export async function saveEpisode(episode) {
  const { parts, ...meta } = episode
  await run(STORE, 'readwrite', (store) => store.put(meta))
  await prune(episode.adultId)
}

export function savePart(episodeId, index, blob) {
  return run(PARTS, 'readwrite', (store) => store.put(blob, `${episodeId}:${index}`))
}

export async function getPart(episode, index) {
  if (episode.audio && index === 0) return episode.audio // 古い形（1本の音声）
  return run(PARTS, 'readonly', (store) => store.get(`${episode.id}:${index}`))
}

export async function getEpisode(id) {
  return withProgress(await run(STORE, 'readonly', (store) => store.get(id)))
}

// 声と字幕がずれているかもしれない古い番組（照らしあわせる前に作ったもの）は消して、作りなおしてもらう
const MIN_VERSION = 2

export async function listEpisodes(adultId) {
  const all = await run(STORE, 'readonly', (store) => store.getAll())
  for (const old of (all || []).filter((episode) => (episode.v || 1) < MIN_VERSION)) await deleteEpisode(old.id).catch(() => {})
  const progress = readProgress()
  return (all || [])
    .filter((episode) => episode.adultId === adultId && (episode.v || 1) >= MIN_VERSION)
    .map((episode) => withProgress(episode, progress))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function latestEpisodeOf(adultId, programId) {
  return (await listEpisodes(adultId)).find((episode) => (episode.programId || episode.kind) === programId && episode.status !== 'making') || null
}

export async function deleteEpisode(id) {
  await run(STORE, 'readwrite', (store) => store.delete(id))
  await run(PARTS, 'readwrite', (store) => store.delete(IDBKeyRange.bound(`${id}:`, `${id}:￿`))).catch(() => {})
  const all = readProgress()
  if (all[id]) { delete all[id]; writeProgress(all) }
}

// 多すぎたら、聞いたもの → 古いもの の順に消す（作っている途中のものは消さない）
async function prune(adultId) {
  const list = (await listEpisodes(adultId)).filter((episode) => episode.status !== 'making')
  if (list.length <= KEEP) return
  const order = [...list].sort((a, b) => Number(Boolean(b.listened)) - Number(Boolean(a.listened)) || a.createdAt - b.createdAt)
  for (const old of order.slice(0, list.length - KEEP)) await deleteEpisode(old.id)
}

// 端末の保存の使用量（わかる端末だけ）。番組が消されにくいよう、使いつづける保存をたのむ
export async function storageInfo() {
  try {
    const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) || {}
    return { usedMb: Math.round(usage / 1e6), quotaMb: Math.round(quota / 1e6) }
  } catch {
    return null
  }
}

export function askPersistentStorage() {
  try { navigator.storage?.persist?.() } catch {}
}
