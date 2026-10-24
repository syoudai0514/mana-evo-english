// 電車モードの番組づくりの順番待ちと進み具合。画面を移っても作りつづけられるように、画面の外に置く。
// 1本ずつ順番に作り（同時にいくつも作ると Live の使いすぎで止められる）、章ができるたびに保存する。
// 途中で止まっても（アプリを閉じた・電波が切れた）、できた章までは聞けて、あとで続きから作れる。
import { PROGRAMS } from '../data/programs.js'
import { chapterScript, encodeAudio, planProgram, tailOf, voiceChapter, withChapter } from './programMaker.js'
import { askPersistentStorage, getEpisode, latestEpisodeOf, saveEpisode, savePart } from './episodeStore.js'

export const PROGRAM_VERSION = 3

const jobs = new Map() // id → { id, adultId, programId, length, title, stage, chapter, chapters, done, total, error, episodeId }
const listeners = new Set()
let queue = Promise.resolve()
let wakeLock = null

function notify() {
  const list = [...jobs.values()]
  for (const fn of listeners) fn(list)
}

export function subscribeJobs(fn) {
  listeners.add(fn)
  fn([...jobs.values()])
  return () => listeners.delete(fn)
}

function update(id, patch) {
  const job = jobs.get(id)
  if (!job) return
  jobs.set(id, { ...job, ...patch })
  notify()
}

export function dismissJob(id) {
  jobs.delete(id)
  notify()
}

// 作っている間は画面を消さない（iPhone は画面が消えると止まる）
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen')
      wakeLock.addEventListener?.('release', () => { wakeLock = null })
    } else if (!on && wakeLock) {
      await wakeLock.release()
      wakeLock = null
    }
  } catch {}
}
if (typeof document !== 'undefined') {
  // 画面を消して戻ってきたら、もう一度たのむ（いったん消すと解除されるため）
  document.addEventListener('visibilitychange', () => { if (!document.hidden && [...jobs.values()].some((job) => !job.error && job.stage !== 'done')) keepAwake(true) })
}

// 新しい番組を順番待ちに入れる
export function enqueueProgram(adult, programId, length, { topic = '' } = {}) {
  const id = `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  jobs.set(id, { id, adultId: adult.id, programId, length, title: PROGRAMS[programId]?.title || '番組', stage: 'queued', chapter: 0, chapters: 0, done: 0, total: 0 })
  notify()
  schedule(id, () => makeProgram(id, adult, programId, length, topic))
  return id
}

// 途中で止まった番組の続きを作る
export function resumeProgram(adult, episode) {
  if ([...jobs.values()].some((job) => job.episodeId === episode.id && !job.error)) return null
  const id = `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  jobs.set(id, { id, adultId: adult.id, programId: episode.programId, length: episode.length, title: episode.title, stage: 'queued', chapter: episode.chapters.length, chapters: episode.plan.chapters.length, done: 0, total: 0, episodeId: episode.id })
  notify()
  schedule(id, async () => {
    const saved = await getEpisode(episode.id)
    if (!saved) throw Object.assign(new Error('gone'), { code: 'gone' })
    await makeChapters(id, adult, saved)
  })
  return id
}

function schedule(id, work) {
  askPersistentStorage()
  const run = queue.then(async () => {
    keepAwake(true)
    try {
      await work()
      update(id, { stage: 'done' })
      setTimeout(() => dismissJob(id), 4000)
    } catch (error) {
      update(id, { error: error?.code || 'failed' })
    } finally {
      if (![...jobs.values()].some((job) => job.stage === 'queued')) keepAwake(false)
    }
  })
  queue = run.catch(() => null)
}

async function makeProgram(id, adult, programId, length, topic) {
  update(id, { stage: 'plan' })
  // 連続ドラマは、前の話のあらすじから続ける
  const previous = programId === 'drama' ? (await latestEpisodeOf(adult.id, 'drama').catch(() => null))?.summary || '' : ''
  const plan = await planProgram(programId, length, adult, { topic, previous })
  const episode = {
    id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    adultId: adult.id,
    kind: programId,
    programId,
    length,
    topic,
    title: plan.title,
    plan: { ...plan, programId },
    createdAt: Date.now(),
    status: 'making',
    chapters: [],
    lines: [],
    tips: [],
    sets: programId === 'toeic' ? [] : undefined,
    summary: '',
    duration: 0,
    position: 0,
    listened: false,
    v: PROGRAM_VERSION
  }
  await saveEpisode(episode)
  update(id, { episodeId: episode.id, title: plan.title, chapters: plan.chapters.length })
  await makeChapters(id, adult, episode)
}

async function makeChapters(id, adult, start) {
  let episode = start
  const plan = episode.plan
  for (let index = episode.chapters.length; index < plan.chapters.length; index += 1) {
    update(id, { stage: 'script', chapter: index, chapters: plan.chapters.length, done: 0, total: 0 })
    const script = await chapterScript(plan, index, adult, tailOf(episode))
    update(id, { stage: 'voice', total: script.lines.length })
    const voiced = await voiceChapter(script, (done, total) => update(id, { done, total }))
    update(id, { stage: 'encode' })
    const audio = await encodeAudio(voiced.samples)
    await savePart(episode.id, index, audio)
    episode = withChapter(episode, { title: plan.chapters[index].title, lines: voiced.lines, duration: voiced.duration, tips: script.tips, sets: script.sets, summary: script.summary })
    if (index === plan.chapters.length - 1) episode = { ...episode, status: 'ready' }
    // 章ができるたびに保存（ここまでは聞ける）
    await saveEpisode(episode)
  }
  if (episode.status !== 'ready') await saveEpisode({ ...episode, status: 'ready' })
}
