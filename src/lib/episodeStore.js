// 電車モードの番組を端末に保存する（音声が大きいので localStorage ではなく IndexedDB）
const DB_NAME = 'mee-train'
const STORE = 'episodes'
const KEEP = 8 // 1人あたり、新しいものから何本残すか

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(request instanceof IDBRequest ? request.result : request) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    // 容量オーバーや、アプリが裏に回って中断されたときは abort だけが来る（待ちっぱなしにしない）
    tx.onabort = () => { db.close(); reject(tx.error || new Error('aborted')) }
  })
}

// どこまで聞いたか・聞きおわったか・TOEIC の答え。番組（音声つきで大きい）を書きなおさないよう、別に小さく保存する
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

export async function saveEpisode(episode) {
  await run('readwrite', (store) => store.put(episode))
  await prune(episode.adultId)
}

export async function getEpisode(id) {
  return withProgress(await run('readonly', (store) => store.get(id)))
}

export async function listEpisodes(adultId) {
  const all = await run('readonly', (store) => store.getAll())
  const progress = readProgress()
  return (all || []).filter((episode) => episode.adultId === adultId).map((episode) => withProgress(episode, progress)).sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteEpisode(id) {
  await run('readwrite', (store) => store.delete(id))
  const all = readProgress()
  if (all[id]) { delete all[id]; writeProgress(all) }
}

async function prune(adultId) {
  const list = await listEpisodes(adultId)
  for (const old of list.slice(KEEP)) await deleteEpisode(old.id)
}
