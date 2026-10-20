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
    const result = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(result?.result ?? result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function saveEpisode(episode) {
  await run('readwrite', (store) => store.put(episode))
  await prune(episode.adultId)
}

export async function updateEpisode(id, patch) {
  const episode = await getEpisode(id)
  if (episode) await run('readwrite', (store) => store.put({ ...episode, ...patch }))
}

export function getEpisode(id) {
  return run('readonly', (store) => store.get(id))
}

export async function listEpisodes(adultId) {
  const all = await run('readonly', (store) => store.getAll())
  return (all || []).filter((episode) => episode.adultId === adultId).sort((a, b) => b.createdAt - a.createdAt)
}

export function deleteEpisode(id) {
  return run('readwrite', (store) => store.delete(id))
}

async function prune(adultId) {
  const list = await listEpisodes(adultId)
  for (const old of list.slice(KEEP)) await deleteEpisode(old.id)
}
