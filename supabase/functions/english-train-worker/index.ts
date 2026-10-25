// english-train-worker：電車モードの番組をサーバーで作る（アプリを閉じても作りつづける）。
// 1回の実行は短く（約150秒・CPU 2秒まで）、進み具合を english_train_jobs.state に保存して、次の実行が続きをする。
// 実行のきっかけ：アプリから頼んだとき・自分のあとに続けて・1分ごとの pg_cron。
// 声は1行ずつ Live で読ませ、文字にして台本と照らしあわせ、行ごとに MP3 にして保存。章がそろったら1本の MP3 にまとめる。
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { Mp3Encoder } from 'npm:@breezystack/lamejs@1.2.7'
import { LiveConn, askFunction, pickModel } from './live.ts'
import {
  CHAPTER_SPEAKERS, MAKE_OUTLINE, PROGRAM_WRITER_PROMPT, chapterCount, chapterRequest, makeChapter, outlineRequest
} from './shared/programs.js'
import {
  EPISODE_WRITER_PROMPT, LISTENING_WRITER_PROMPT, MAKE_EPISODE, MAKE_LISTENING, SPEAKERS, listeningRequest, mineEpisodeRequest, narratorPrompt
} from './shared/train.js'

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

const RATE = 24000
const KBPS = 40
const ENCODER_DELAY = 1105 // MP3 の頭に入る無音（サンプル数）。字幕の時間を合わせるため
const RUN_MS = 128000 // 1回の実行で使う時間（150秒の上限より少し短く）
const VOICE_MS = 95000 // 新しい行を読みはじめるのはここまで
const ENCODE_SAMPLES = RATE * 30 // 圧縮の1回ぶん（30秒。CPU 2秒の上限を超えないように）

// ---------- 声のデータ ----------

// Live の声（24kHz・16bit）をそのままの形で受けとる（変換で CPU を使わない）
function decodePcm(base64: string): Int16Array {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length & ~1)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Int16Array(bytes.buffer)
}

function join(parts: Int16Array[]): Int16Array {
  const out = new Int16Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}

function trimSilence(samples: Int16Array, threshold = 328, margin = Math.round(RATE * 0.04)) {
  let start = 0
  let end = samples.length - 1
  while (start < end && Math.abs(samples[start]) < threshold) start += 1
  while (end > start && Math.abs(samples[end]) < threshold) end -= 1
  if (end <= start) return new Int16Array(0)
  return samples.subarray(Math.max(0, start - margin), Math.min(samples.length, end + margin + 1))
}

// 間（無音）＋声 を1つの MP3 にする。frames：MP3 のフレーム数（1フレーム＝576サンプル）
function encodeSegment(gap: number, clip: Int16Array) {
  const encoder = new Mp3Encoder(1, RATE, KBPS)
  const total = gap + clip.length
  const block = 576 * 8
  const out: Uint8Array[] = []
  const pcm = new Int16Array(block)
  for (let i = 0; i < total; i += block) {
    const size = Math.min(block, total - i)
    for (let j = 0; j < size; j += 1) {
      const k = i + j - gap
      pcm[j] = k < 0 ? 0 : clip[k]
    }
    out.push(encoder.encodeBuffer(size === block ? pcm : pcm.subarray(0, size)))
  }
  out.push(encoder.flush())
  const bytes = new Uint8Array(out.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of out) { bytes.set(part, offset); offset += part.length }
  return { bytes, frames: countFrames(bytes) }
}

const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
const RATES_V2 = [22050, 24000, 16000]
export function countFrames(bytes: Uint8Array) {
  let frames = 0
  let i = 0
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) { i += 1; continue }
    const bitrate = BITRATES_V2[(bytes[i + 2] >> 4) & 0x0f] * 1000
    const sampleRate = RATES_V2[(bytes[i + 2] >> 2) & 0x03]
    const padding = (bytes[i + 2] >> 1) & 0x01
    if (!bitrate || !sampleRate) { i += 1; continue }
    i += Math.floor((72 * bitrate) / sampleRate) + padding
    frames += 1
  }
  return frames
}

// ---------- 台本どおりに読めたか ----------

function normalizeWords(text: string) {
  return String(text || '').toLowerCase().replace(/’/g, "'")
    .replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'ll\b/g, ' will').replace(/'ve\b/g, ' have').replace(/'d\b/g, ' would').replace(/'s\b/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean)
}

function sameLine(script: string, heard: string, seconds: number) {
  const target = normalizeWords(script)
  const said = normalizeWords(heard)
  if (!target.length) return true
  if (!said.length) return false
  const pool = [...said]
  let hit = 0
  for (const word of target) {
    const at = pool.indexOf(word)
    if (at >= 0) { hit += 1; pool.splice(at, 1) }
  }
  if (hit / target.length >= 0.75 && said.length <= target.length * 1.3 + 3) return true
  return pool.length <= Math.max(1, said.length * 0.15) && hit >= Math.min(2, target.length) && seconds >= target.length * 0.2
}

// ---------- 台本 ----------

type Line = { speaker: string; en: string; ja: string; say: string; set?: number; question?: boolean; answer?: boolean; pauseBefore?: number; cardId?: string; repeat?: boolean; prompt?: boolean }

function cleanLines(lines: unknown, speakers: string[]): Line[] {
  return (Array.isArray(lines) ? lines : [])
    .map((line: any) => ({ speaker: String(line?.speaker || ''), en: String(line?.en || '').trim(), ja: String(line?.ja || '').trim() }))
    .filter((line) => speakers.includes(line.speaker) && (line.speaker === 'JA' ? line.ja : line.en))
    .map((line) => ({ ...line, say: line.speaker === 'JA' ? line.ja : line.en }))
}

function scriptError(message: string) {
  return Object.assign(new Error(message), { code: 'script' })
}

async function planProgram(job: any) {
  const count = chapterCount(job.program_id, job.length)
  const ctx = job.context || {}
  if (job.program_id === 'toeic') return { title: `TOEIC 模試 ${job.length}問`, chapters: Array.from({ length: count }, (_, i) => ({ title: `第${i + 1}回（5問）`, brief: '' })) }
  if (job.program_id === 'mine') return { title: 'あなたの会話のネイティブ版', chapters: [{ title: 'ネイティブ版', brief: '' }] }
  if (job.program_id === 'cards') return { title: ctx.title || '耳で復習カード', chapters: [{ title: '耳で復習', brief: '' }] }
  let previous = ctx.previous || ''
  // みんなの連続ドラマは、前の回のあらすじから続ける
  if (job.shared && job.program_id === 'drama' && !previous) {
    const { data } = await db.from('english_train_jobs').select('episode').eq('shared', true).eq('program_id', 'drama').eq('status', 'ready').order('created_at', { ascending: false }).limit(1)
    previous = data?.[0]?.episode?.summary || ''
  }
  const reply: any = await askFunction(PROGRAM_WRITER_PROMPT, MAKE_OUTLINE, outlineRequest({ programId: job.program_id, chapters: count, topic: job.topic, memory: ctx.memory || [], previous }))
  const raw = (Array.isArray(reply?.chapters) ? reply.chapters : []).filter((item: any) => item?.title_ja)
  if (!raw.length) throw scriptError('no outline')
  const chapters = Array.from({ length: count }, (_, i) => {
    const item = raw[i] || { title_ja: `${raw[raw.length - 1].title_ja}（つづき）`, brief_en: 'Continue the previous chapter.' }
    return { title: String(item.title_ja), brief: String(item.brief_en || '') }
  })
  return { title: String(reply.title_ja || job.topic || '番組'), chapters }
}

function listeningScript(reply: any) {
  const lines: Line[] = []
  const sets: any[] = []
  for (const set of Array.isArray(reply?.sets) ? reply.sets : []) {
    const setLines = cleanLines(set.lines, ['M', 'W', 'N'])
    const choices = (set.choices || []).map((choice: unknown) => String(choice || '').trim())
    if (setLines.length < 2 || choices.length !== 4 || choices.some((choice: string) => !choice) || !Number.isInteger(set.answer) || set.answer < 0 || set.answer > 3) continue
    const index = sets.length
    for (const line of setLines) lines.push({ ...line, set: index })
    lines.push({ speaker: 'N', en: String(set.question_en), ja: '', say: String(set.question_en), set: index, question: true })
    const letter = 'ABCD'[set.answer]
    lines.push({ speaker: 'N', en: `The answer is ${letter}. ${choices[set.answer]}`, ja: `正解は ${letter}`, say: `The answer is ${letter}. ${choices[set.answer]}`, set: index, answer: true, pauseBefore: 5 })
    if (set.explain_ja) lines.push({ speaker: 'JA', en: '', ja: String(set.explain_ja), say: String(set.explain_ja), set: index, answer: true })
    sets.push({ part: set.part === 'p4' ? 'p4' : 'p3', question_en: String(set.question_en), choices, answer: set.answer, explain_ja: String(set.explain_ja || '') })
  }
  if (!sets.length) throw scriptError('no sets')
  return { lines, sets, tips: [], summary: '' }
}

async function chapterScript(job: any, state: any, index: number) {
  const ctx = job.context || {}
  const programId = job.program_id
  if (programId === 'toeic') return listeningScript(await askFunction(LISTENING_WRITER_PROMPT, MAKE_LISTENING, listeningRequest({ weakSkills: ctx.weakSkills || [] })))
  if (programId === 'cards') {
    const lines = (ctx.lines || []).map((line: any) => ({ ...line, say: line.say || line.en || line.ja }))
    if (!lines.length) throw Object.assign(new Error('no cards'), { code: 'no-cards' })
    return { lines, tips: [], summary: '' }
  }
  if (programId === 'mine') {
    if (!ctx.transcript) throw Object.assign(new Error('no chat'), { code: 'no-chat' })
    const reply: any = await askFunction(EPISODE_WRITER_PROMPT, MAKE_EPISODE, mineEpisodeRequest({ transcript: ctx.transcript }))
    const lines = cleanLines(reply?.lines, ['Alex', 'Sam'])
    if (lines.length < 4) throw scriptError('short')
    return { lines, tips: Array.isArray(reply?.tips) ? reply.tips.filter((tip: any) => tip?.en) : [], summary: '' }
  }
  const speakers = CHAPTER_SPEAKERS[programId] || ['Alex', 'Sam']
  const tail = (state.episode?.lines || []).slice(-4).map((line: any) => `${line.speaker}: ${line.en || line.ja}`).join('\n')
  const reply: any = await askFunction(PROGRAM_WRITER_PROMPT, makeChapter(speakers), chapterRequest({ programId, outline: state.plan, index, previousTail: tail, phrases: index === 0 ? ctx.phrases || [] : [] }))
  const lines = cleanLines(reply?.lines, speakers)
  if (lines.length < 4) throw scriptError('short')
  return { lines, tips: Array.isArray(reply?.tips) ? reply.tips.filter((tip: any) => tip?.en) : [], summary: String(reply?.summary_en || '') }
}

// ---------- 声 ----------

function gapBefore(lines: Line[], index: number) {
  if (index === 0) return 0.3
  return lines[index].pauseBefore ?? (lines[index - 1].speaker === lines[index].speaker ? 0.3 : 0.45)
}

class Reader {
  conn: LiveConn | null = null
  reads = 0
  constructor(public speaker: string) {}

  async ensure() {
    if (this.conn?.usable && this.reads < 6) return this.conn
    this.conn?.close()
    this.reads = 0
    const model = await pickModel(['3-flash', '3.8', '2.5-audio'])
    if (!model) throw new Error('no live model')
    const conn = new LiveConn()
    await conn.open({ model, system: narratorPrompt(this.speaker), voice: (SPEAKERS[this.speaker] || SPEAKERS.N).voice })
    this.conn = conn
    return conn
  }

  // 1行読ませて、声（24kHz）と、それを文字にしたものを返す
  async read(text: string) {
    const conn = await this.ensure()
    this.reads += 1
    const chunks: Int16Array[] = []
    let heard = ''
    let lastText = Date.now()
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('read timeout')), 25000)
      conn.handlers = {
        onAudio: (data) => chunks.push(decodePcm(data)),
        onTranscript: (part) => { heard += part; lastText = Date.now() },
        onTurnComplete: () => { clearTimeout(timer); resolve() },
        onClose: (reason) => { clearTimeout(timer); reject(new Error(`closed ${reason}`)) }
      }
      conn.sendText(`LINE: ${text}`)
    })
    // 文字は声より少しおくれて届く。0.6 秒とどかなくなるまで待つ（長くても 2.5 秒）
    const settleStart = Date.now()
    while (Date.now() - settleStart < 2500 && Date.now() - lastText < 600) await new Promise((r) => setTimeout(r, 150))
    return { audio: join(chunks), heard }
  }

  close() {
    this.conn?.close()
    this.conn = null
  }
}

// この章で、もう録音した行（行の番号）
async function recordedLines(job: any, chapter: number) {
  const { data } = await db.from('english_train_segments').select('line, status').eq('job_id', job.id).eq('chapter', chapter)
  return data || []
}

// まだ読んでいない行を、話す人ごとに同時に読む（ここでは圧縮しない。録音を保存して、圧縮は別の実行で）
async function voiceSome(job: any, state: any, startedAt: number) {
  const script = state.script
  const k = state.chapter
  state.tries = state.tries || {}
  const recorded = new Set((await recordedLines(job, k)).map((row: any) => row.line))
  const bySpeaker = new Map<string, number[]>()
  script.lines.forEach((line: Line, index: number) => {
    if (recorded.has(index) || (state.tries[index] || 0) >= 4) return
    if (!bySpeaker.has(line.speaker)) bySpeaker.set(line.speaker, [])
    bySpeaker.get(line.speaker)!.push(index)
  })
  const readers: Reader[] = []
  const result = { ok: 0, failed: 0 } // この実行で録れた行・失敗した行（全部だめなら、しばらく休む）
  await Promise.all([...bySpeaker.entries()].map(async ([speaker, indexes]) => {
    const reader = new Reader(speaker)
    readers.push(reader)
    for (const index of indexes) {
      if (Date.now() - startedAt > VOICE_MS) return
      const line: Line = script.lines[index]
      state.tries[index] = (state.tries[index] || 0) + 1
      try {
        const { audio, heard } = await reader.read(line.say)
        const clip = trimSilence(audio)
        if (clip.length < RATE * 0.2 || (line.speaker !== 'JA' && !sameLine(line.say, heard, audio.length / RATE))) {
          console.warn('mismatch', speaker, line.say.slice(0, 50), '|', heard.slice(0, 50))
          reader.close() // 同じ接続だと「返事」をしはじめるので、新しくする
          continue
        }
        const gap = Math.round(gapBefore(script.lines, index) * RATE)
        const path = `work/${job.id}/${k}/${index}.pcm`
        const bytes = new Uint8Array(clip.buffer, clip.byteOffset, clip.byteLength).slice()
        const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/octet-stream', upsert: true })
        if (error) throw new Error(`upload ${error.message}`)
        await db.from('english_train_segments').upsert({ job_id: job.id, chapter: k, line: index, pcm_path: path, gap, clip: clip.length, status: 'raw' }, { onConflict: 'job_id,chapter,line' })
        result.ok += 1
      } catch (error) {
        const message = String((error as Error)?.message ?? error)
        console.warn('read failed', speaker, message)
        reader.close()
        result.failed += 1
        // 返事が来ない・使いすぎで切られた：その行の失敗には数えず、この実行ではこの人の行をやめる（あとで）
        state.tries[index] -= 1
        if (/quota|1011|exhausted|timeout/i.test(message)) return
      }
    }
  }))
  for (const reader of readers) reader.close()
  return result
}

// 録音した行を MP3 にする（いくつもの実行が同時に、30秒ぶんずつ）
async function encodeBatch() {
  const { data } = await db.rpc('english_train_claim_segments', { max_samples: ENCODE_SAMPLES })
  const rows = Array.isArray(data) ? data : []
  for (const row of rows) {
    try {
      const { data: blob, error } = await db.storage.from(BUCKET).download(row.pcm_path)
      if (error || !blob) throw new Error(`download ${error?.message}`)
      const clip = new Int16Array(await blob.arrayBuffer())
      const { bytes, frames } = encodeSegment(row.gap, clip)
      const path = row.pcm_path.replace(/\.pcm$/, '.mp3')
      const { error: upError } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'audio/mpeg', upsert: true })
      if (upError) throw new Error(`upload ${upError.message}`)
      await db.from('english_train_segments').update({ status: 'done', mp3_path: path, frames, lease_until: null }).eq('id', row.id)
      await db.storage.from(BUCKET).remove([row.pcm_path]).catch(() => null)
    } catch (error) {
      console.warn('encode failed', row.id, String((error as Error)?.message ?? error))
      await db.from('english_train_segments').update({ status: 'raw', lease_until: null }).eq('id', row.id)
    }
  }
  return rows.length
}

// 章の声がそろったら1本の MP3 にまとめ、字幕の時間を決める
async function assembleChapter(job: any, state: any) {
  const script = state.script
  const k = state.chapter
  const { data: rows } = await db.from('english_train_segments').select('*').eq('job_id', job.id).eq('chapter', k).eq('status', 'done').order('line')
  const kept = (rows || []).map((rec: any) => ({ index: rec.line, rec }))
  const speakers = new Set(script.lines.map((line: Line) => line.speaker))
  const voiced = new Set(kept.map(({ index }) => script.lines[index].speaker))
  if (kept.length < script.lines.length * 0.9 || [...speakers].some((who) => !voiced.has(who))) throw Object.assign(new Error('voice failed'), { code: 'voice' })
  const parts: Uint8Array[] = []
  const placed: any[] = []
  const chapterStart = state.episode.duration || 0
  const setOffset = (state.episode.sets || []).length
  let samples = 0
  for (const { index, rec } of kept) {
    const { data, error } = await db.storage.from(BUCKET).download(rec.mp3_path)
    if (error || !data) throw new Error(`download ${error?.message}`)
    parts.push(new Uint8Array(await data.arrayBuffer()))
    const start = (samples + ENCODER_DELAY + rec.gap) / RATE
    const line = script.lines[index]
    placed.push({ ...line, part: k, start: chapterStart + start, end: chapterStart + start + rec.clip / RATE, ...(line.set !== undefined ? { set: line.set + setOffset } : {}) })
    samples += rec.frames * 576
  }
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.length }
  const path = `out/${job.id}/${k}.mp3`
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'audio/mpeg', upsert: true })
  if (error) throw new Error(`upload ${error.message}`)
  const duration = samples / RATE
  const newSets = (script.sets || []).map((set: any, i: number) => ({ ...set, end: placed.find((line) => line.set === i + setOffset && line.question)?.end ?? null }))
  state.episode = {
    ...state.episode,
    chapters: [...state.episode.chapters, { title: state.plan.chapters[k].title, start: chapterStart, duration, path, bytes: bytes.length }],
    lines: [...state.episode.lines, ...placed],
    tips: [...state.episode.tips, ...(script.tips || [])].slice(0, 30),
    sets: [...(state.episode.sets || []), ...newSets],
    summary: [state.episode.summary, script.summary].filter(Boolean).join(' ').slice(-1200),
    duration: chapterStart + duration
  }
  await db.storage.from(BUCKET).remove(kept.map(({ rec }: any) => rec.mp3_path)).catch(() => null)
  await db.from('english_train_segments').delete().eq('job_id', job.id).eq('chapter', k)
  state.chapter = k + 1
  state.script = null
  state.tries = {}
}

// ---------- 1回の実行 ----------

function progressOf(state: any) {
  const total = state.script?.lines?.length || 0
  const done = state.recorded || 0
  return { stage: !state.plan ? 'plan' : state.script ? 'voice' : 'script', chapter: state.chapter || 0, chapters: state.plan?.chapters?.length || 0, done, total, title: state.plan?.title || '' }
}

async function save(job: any, patch: Record<string, unknown>) {
  await db.from('english_train_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', job.id)
}

async function work(job: any, startedAt: number) {
  const state = job.state && Object.keys(job.state).length ? job.state : { chapter: 0, tries: {}, script: null, plan: null, episode: null }
  if (!state.plan) {
    state.plan = await planProgram(job)
    state.episode = { title: state.plan.title, plan: state.plan, chapters: [], lines: [], tips: [], sets: job.program_id === 'toeic' ? [] : undefined, summary: '', duration: 0 }
    await save(job, { state, progress: progressOf(state) })
  }
  while (state.chapter < state.plan.chapters.length && Date.now() - startedAt < RUN_MS) {
    if (!state.script) {
      if (Date.now() - startedAt > RUN_MS - 75000) break // 台本づくりには時間がかかるので、次の実行で
      state.script = await chapterScript(job, state, state.chapter)
      state.tries = {}
      state.recorded = 0
      await save(job, { state, progress: progressOf(state) })
    }
    const voiced = await voiceSome(job, state, startedAt)
    // 1行も録れずに失敗ばかり（Live が混んでいる・使いすぎ）：10分休んでから続ける
    if (voiced.failed && !voiced.ok) {
      await save(job, { state, status: 'queued', error: 'busy', lease_until: new Date(Date.now() + 10 * 60000).toISOString() })
      return false
    }
    const rows = await recordedLines(job, state.chapter)
    const recorded = new Set(rows.map((row: any) => row.line))
    state.recorded = rows.length
    const remaining = state.script.lines.filter((_: Line, index: number) => !recorded.has(index) && (state.tries?.[index] || 0) < 4).length
    if (!remaining) {
      // 圧縮が終わるのを待つ（圧縮は別の実行で同時に進む）
      if (rows.some((row: any) => row.status !== 'done')) {
        await save(job, { state, progress: { ...progressOf(state), stage: 'encode' } })
        await save(job, { status: 'queued', lease_until: new Date(Date.now() + 8000).toISOString() })
        return false
      }
      try {
        await assembleChapter(job, state)
      } catch (error) {
        // 読めなかった行が多いときは、1回だけ その行を読みなおす
        if ((error as any)?.code !== 'voice' || state.retried === state.chapter) throw error
        state.retried = state.chapter
        state.tries = {}
        await save(job, { state })
        continue
      }
    }
    await save(job, { state, progress: progressOf(state) })
    if (remaining && Date.now() - startedAt > VOICE_MS) break
  }
  if (state.chapter >= state.plan.chapters.length) {
    await save(job, { status: 'ready', state: { plan: state.plan, chapter: state.chapter }, episode: state.episode, progress: { ...progressOf(state), stage: 'ready' }, lease_until: null, error: null, failures: 0 })
    return true
  }
  await save(job, { status: 'queued', lease_until: null, failures: 0, error: null })
  return false
}

// 古いものの片づけ：みんなの作り置きは14日、頼んだ番組で受け取られていないものは7日
async function cleanup() {
  const now = Date.now()
  const { data } = await db.from('english_train_jobs').select('id, shared, created_at, status')
    .or(`and(shared.eq.true,created_at.lt.${new Date(now - 14 * 86400000).toISOString()}),and(shared.eq.false,created_at.lt.${new Date(now - 7 * 86400000).toISOString()})`).limit(5)
  for (const row of data || []) await removeJob(row.id)
}

export async function removeJob(id: string) {
  for (const prefix of [`out/${id}`, `work/${id}`]) {
    const { data } = await db.storage.from(BUCKET).list(prefix, { limit: 1000 })
    if (data?.length) await db.storage.from(BUCKET).remove(data.map((file) => `${prefix}/${file.name}`))
    for (const folder of (data || []).filter((file) => !file.id)) {
      const { data: inner } = await db.storage.from(BUCKET).list(`${prefix}/${folder.name}`, { limit: 1000 })
      if (inner?.length) await db.storage.from(BUCKET).remove(inner.map((file) => `${prefix}/${folder.name}/${file.name}`))
    }
  }
  await db.from('english_train_jobs').delete().eq('id', id)
}

async function kick() {
  const key = await getWorkerKey()
  // 続きがあれば、次の実行をすぐ始める（返事は待たない）
  return fetch(`${SUPABASE_URL}/functions/v1/english-train-worker`, { method: 'POST', headers: { 'x-worker-key': key } }).then((r) => r.body?.cancel()).catch(() => null)
}

async function runOnce() {
  const startedAt = Date.now()
  // 圧縮待ちの行があれば、まずそれを（声を読む実行とは別に、いくつも同時に）
  if (await encodeBatch()) { await kickIfMore(1); return }
  const { data } = await db.rpc('english_train_claim', { lease_seconds: 150 })
  const job = Array.isArray(data) ? data[0] : null
  if (!job) { await cleanup().catch(() => null); return }
  try {
    await work(job, startedAt)
  } catch (error) {
    const message = String((error as Error)?.message ?? error)
    const code = (error as any)?.code || (/quota|1011/i.test(message) ? 'busy' : 'failed')
    const failures = (job.failures || 0) + 1
    console.error('job failed', job.id, code, message)
    // 台本の材料がない・何度もだめ → あきらめる。ほかは次の実行でもう一度
    const giveUp = code === 'no-chat' || code === 'no-cards' || failures >= 5
    await save(job, { status: giveUp ? 'failed' : 'queued', error: code, failures, lease_until: giveUp ? null : new Date(Date.now() + 30000).toISOString() })
  }
  await kickIfMore(3)
}

// 続きの仕事があれば次の実行を起こす。圧縮待ちが多ければ、圧縮の実行をいくつか同時に
async function kickIfMore(maxEncoders: number) {
  const { count: raw } = await db.from('english_train_segments').select('id', { count: 'exact', head: true }).eq('status', 'raw')
  const { count: jobs } = await db.from('english_train_jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued')
  const encoders = Math.min(maxEncoders, Math.ceil((raw || 0) / 8))
  const kicks = encoders + (jobs ? 1 : 0)
  await Promise.all(Array.from({ length: kicks }, () => kick()))
}

Deno.serve(async (req) => {
  const key = await getWorkerKey()
  if (!key || req.headers.get('x-worker-key') !== key) return new Response('forbidden', { status: 403 })
  // 返事はすぐ返し、作業は裏で（実行の上限まで）
  // @ts-ignore EdgeRuntime はホスト環境にある
  EdgeRuntime.waitUntil(runOnce().catch((error) => console.error('worker', String(error?.message ?? error))))
  return new Response('ok', { status: 202 })
})
