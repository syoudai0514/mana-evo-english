// 電車モードの番組づくりの進み具合。画面を移っても作りつづけられるように、画面の外に置く
import { createEpisode } from './episodes.js'
import { saveEpisode } from './episodeStore.js'

const jobs = {} // `${adultId}:${kind}` → { stage, done, total } | { error }
const listeners = new Set()

function notify() {
  for (const fn of listeners) fn({ ...jobs })
}

export function subscribeJobs(fn) {
  listeners.add(fn)
  fn({ ...jobs })
  return () => listeners.delete(fn)
}

export function jobKey(adultId, kind) {
  return `${adultId}:${kind}`
}

export function isRunning(adultId, kind) {
  const job = jobs[jobKey(adultId, kind)]
  return Boolean(job && !job.error)
}

// 1本つくって保存する。できたら番組を返す（失敗したら null。理由は jobs に残る）
export async function prepareEpisode(kind, adult, { topic = '' } = {}) {
  const key = jobKey(adult.id, kind)
  if (isRunning(adult.id, kind)) return null
  jobs[key] = { stage: 'queued', done: 0, total: 0, topic }
  notify()
  // 1本ずつ順番に作る（いくつも同時に作ると Live の接続が多すぎて止められる）
  const run = queue.then(async () => {
    jobs[key] = { stage: 'script', done: 0, total: 0, topic }
    notify()
    try {
      const episode = await createEpisode(kind, adult, { topic, onStage: (stage) => { jobs[key] = { ...stage, topic }; notify() } })
      await saveEpisode(episode)
      delete jobs[key]
      notify()
      return episode
    } catch (error) {
      jobs[key] = { error: error?.code || 'failed' }
      notify()
      return null
    }
  })
  queue = run.catch(() => null)
  return run
}

let queue = Promise.resolve()

export function clearJobError(adultId, kind) {
  const key = jobKey(adultId, kind)
  if (jobs[key]?.error) { delete jobs[key]; notify() }
}
