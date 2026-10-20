// 電車モードの番組づくり：台本 → 声で読ませて録音 → 1本の音声（WAV）にまとめる。
// どれも上限のない Live の中だけで行う（台本は音を鳴らさない Live に関数で返してもらう）。
import {
  EPISODE_WRITER_PROMPT, LISTENING_WRITER_PROMPT, MAKE_EPISODE, MAKE_LISTENING, SAMPLE_EPISODE, SAMPLE_LISTENING, SPEAKERS,
  chatEpisodeRequest, listeningRequest, mineEpisodeRequest, narratorPrompt
} from '../data/train.js'
import { dueCards, memoryForTalk, weakSkills } from './adult.js'
import { SilentTool } from './annotator.js'
import { LiveSession, reportLiveProblem, requestLiveToken } from './live.js'
import { isMockMode } from './config.js'
import { encodeWav, pcm16Base64ToFloat } from './wav.js'

export const RATE = 24000

// ---------- 台本 ----------

function cleanLines(lines, speakers) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => ({ speaker: String(line?.speaker || ''), en: String(line?.en || '').trim(), ja: String(line?.ja || '').trim() }))
    .filter((line) => line.en && speakers.includes(line.speaker))
}

// 最近の Alex との会話（子どもの発話が3つ以上あるもの）
export function recentTranscript(adult) {
  const session = [...adult.sessions].reverse().find((item) => (item.turns || []).filter((turn) => turn.who === 'child').length >= 3)
  if (!session) return ''
  return session.turns.map((turn) => `${turn.who === 'partner' ? 'Alex' : 'Me'}: ${turn.text}`).join('\n').slice(-2500)
}

async function askWriter(system, declaration, message) {
  const tool = new SilentTool({ system, declaration, step: 'episode-script', timeoutMs: 70000, ways: [['3.8', 'realtime'], ['3-flash', 'realtime']] })
  try {
    return await tool.ask(message)
  } finally {
    tool.close()
  }
}

// kind ごとに、読む行（speaker / say / en / ja）を作る
export async function buildScript(kind, adult, { topic = '' } = {}) {
  if (kind === 'cards') return cardsScript(adult)
  if (kind === 'toeic') {
    const reply = isMockMode() ? SAMPLE_LISTENING : await askWriter(LISTENING_WRITER_PROMPT, MAKE_LISTENING, listeningRequest({ weakSkills: weakSkills(adult).map((row) => row.ja) }))
    return listeningScript(reply)
  }
  let reply
  if (isMockMode()) reply = SAMPLE_EPISODE
  else if (kind === 'mine') {
    const transcript = recentTranscript(adult)
    if (!transcript) throw Object.assign(new Error('no chat'), { code: 'no-chat' })
    reply = await askWriter(EPISODE_WRITER_PROMPT, MAKE_EPISODE, mineEpisodeRequest({ transcript }))
  } else {
    reply = await askWriter(EPISODE_WRITER_PROMPT, MAKE_EPISODE, chatEpisodeRequest({
      topic,
      memory: memoryForTalk(adult).map((item) => item.fact),
      phrases: dueCards(adult, Date.now() + 3 * 86400000, 6).map((card) => card.en),
      weakSkills: weakSkills(adult).map((row) => row.ja)
    }))
  }
  const lines = cleanLines(reply?.lines, ['Alex', 'Sam']).map((line) => ({ ...line, say: line.en }))
  if (lines.length < 4) throw Object.assign(new Error('script too short'), { code: 'script' })
  return { title: String(reply?.title_ja || topic || '雑談'), lines, tips: Array.isArray(reply?.tips) ? reply.tips.filter((tip) => tip?.en) : [] }
}

export function listeningScript(reply) {
  const lines = []
  const sets = []
  for (const set of Array.isArray(reply?.sets) ? reply.sets : []) {
    const setLines = cleanLines(set.lines, ['M', 'W', 'N'])
    const choices = (set.choices || []).map((choice) => String(choice || '').trim())
    if (setLines.length < 2 || choices.length !== 4 || choices.some((choice) => !choice) || !Number.isInteger(set.answer) || set.answer < 0 || set.answer > 3) continue
    const index = sets.length
    for (const line of setLines) lines.push({ ...line, say: line.en, set: index })
    // 本番と同じく、問題文も読む（ここで止めて答えてもらう）
    lines.push({ speaker: 'N', en: String(set.question_en), ja: '', say: String(set.question_en), set: index, question: true })
    sets.push({ part: set.part === 'p4' ? 'p4' : 'p3', question_en: String(set.question_en), choices, answer: set.answer, explain_ja: String(set.explain_ja || '') })
  }
  if (!sets.length) throw Object.assign(new Error('no sets'), { code: 'script' })
  return { title: `TOEIC リスニング ${sets.length}問`, lines, sets, tips: [] }
}

// 耳で復習カード：日本語 → 3秒あけて英語 → もう一度英語
export function cardsScript(adult, count = 12) {
  const due = dueCards(adult, Date.now(), count)
  const picks = due.length >= count ? due : [...due, ...[...adult.cards].reverse().filter((card) => !due.includes(card))].slice(0, count)
  if (!picks.length) throw Object.assign(new Error('no cards'), { code: 'no-cards' })
  const lines = []
  for (const card of picks) {
    lines.push({ speaker: 'JA', en: '', ja: card.ja, say: card.ja, cardId: card.id, prompt: true })
    lines.push({ speaker: 'Alex', en: card.en, ja: card.ja, say: card.en, cardId: card.id, pauseBefore: 3 })
    lines.push({ speaker: 'Alex', en: card.en, ja: card.ja, say: card.en, cardId: card.id, pauseBefore: 0.8, repeat: true })
  }
  return { title: `耳で復習 ${picks.length}枚`, lines, tips: [] }
}

// ---------- 声で読ませて録音 ----------

// 話す人ひとりぶんの読み手。1行ずつ読ませて、その声（24kHz）を受けとる
class Voice {
  constructor(speaker) {
    this.speaker = speaker
    this.session = null
    this.chunks = []
    this.heard = '' // 読んだ声を文字にしたもの（台本どおりに読めたか確かめる）
    this.reads = 0
    this.done = null
  }

  async ensure() {
    // 同じ接続で読みつづけると、だんだん台本を「読む」より「返事」をしはじめるので、数行ごとに新しくする
    if (this.session?.ws?.readyState === WebSocket.OPEN && this.session.age < 100000 && this.reads < 6) return this.session
    this.session?.close()
    this.reads = 0
    const granted = await requestLiveToken('auto', 'voice')
    const session = new LiveSession({
      ...granted,
      system: narratorPrompt(this.speaker),
      voiceName: (SPEAKERS[this.speaker] || SPEAKERS.N).voice,
      muted: true,
      handlers: {
        onAudio: (data) => { if (this.session === session) this.chunks.push(pcm16Base64ToFloat(data)) },
        onPartnerText: (text) => { if (this.session === session) this.heard += text },
        onTurnComplete: () => { if (this.session === session) this.done?.() },
        onClose: () => { if (this.session === session) { this.session = null; this.done?.(new Error('closed')) } }
      }
    })
    await session.connect()
    session.probing = false
    this.session = session
    return session
  }

  // 1行読ませる。台本とちがうことを言ったら、新しい接続で読みなおす（3回まで）。だめなら null
  async read(text) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const session = await this.ensure()
        this.chunks = []
        this.heard = ''
        this.reads += 1
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('read timeout')), 25000)
          this.done = (error) => { clearTimeout(timer); this.done = null; error ? reject(error) : resolve() }
          session.sendText(`LINE: ${text}`)
        })
        const audio = joinFloat(this.chunks)
        if (audio.length <= RATE * 0.2) continue
        if (this.speaker === 'JA' || sameLine(text, this.heard)) return audio
        reportLiveProblem({ step: 'episode-mismatch', message: `${this.speaker}: "${text.slice(0, 60)}" heard "${this.heard.slice(0, 60)}"` })
        this.session?.close()
        this.session = null
      } catch (error) {
        reportLiveProblem({ step: 'episode-voice', message: `${this.speaker}: ${String(error?.message || error)}` })
        this.session?.close()
        this.session = null
      }
    }
    return null
  }

  close() {
    this.session?.close()
    this.session = null
  }
}

// 読んだ声（文字にしたもの）が台本の行とほぼ同じか：台本のことばの3/4以上を言っていて、余計な話をしていない
export function sameLine(script, heard) {
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
  return hit / target.length >= 0.75 && said.length <= target.length * 1.3 + 3
}

// I'm / I am、don't / do not などの書き方のちがいは同じとみなす
function normalizeWords(text) {
  return String(text || '').toLowerCase().replace(/’/g, "'")
    .replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'ll\b/g, ' will').replace(/'ve\b/g, ' have').replace(/'d\b/g, ' would').replace(/'s\b/g, '')
    .replace(/\bwon not\b/g, 'will not').replace(/\bcan not\b/g, 'cannot').replace(/\bca not\b/g, 'cannot')
    .replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(Boolean)
}

export function joinFloat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.length }
  return out
}

// 声の前後の無音を切る（行と行の間は、こちらで決めた長さにそろえる）
export function trimSilence(samples, threshold = 0.01, margin = Math.round(RATE * 0.04)) {
  let start = 0
  let end = samples.length - 1
  while (start < end && Math.abs(samples[start]) < threshold) start += 1
  while (end > start && Math.abs(samples[end]) < threshold) end -= 1
  if (end <= start) return new Float32Array(0)
  return samples.subarray(Math.max(0, start - margin), Math.min(samples.length, end + margin + 1))
}

// 確認用 mock：文の長さぶんの小さな音
function mockAudio(text) {
  const seconds = Math.max(0.6, String(text).split(/\s+/).length * 0.32)
  const out = new Float32Array(Math.round(seconds * RATE))
  for (let i = 0; i < out.length; i += 1) out[i] = Math.sin(i / 12) * 0.05
  return out
}

// 全部の行を読ませる。話す人ごとに並べて同時に進める
export async function renderLines(lines, onProgress = () => {}) {
  const clips = new Array(lines.length).fill(null)
  let finished = 0
  if (isMockMode()) {
    lines.forEach((line, index) => { clips[index] = mockAudio(line.say); onProgress(++finished, lines.length) })
    return clips
  }
  const bySpeaker = new Map()
  lines.forEach((line, index) => {
    if (!bySpeaker.has(line.speaker)) bySpeaker.set(line.speaker, [])
    bySpeaker.get(line.speaker).push(index)
  })
  const voices = []
  try {
    await Promise.all([...bySpeaker.entries()].map(async ([speaker, indexes]) => {
      const voice = new Voice(speaker)
      voices.push(voice)
      for (const index of indexes) {
        const audio = await voice.read(lines[index].say)
        clips[index] = audio ? trimSilence(audio) : null
        onProgress(++finished, lines.length)
      }
    }))
  } finally {
    for (const voice of voices) voice.close()
  }
  return clips
}

// ---------- 1本の音声にまとめる ----------

// 行と行の間：同じ人なら 0.3 秒、話す人が変わったら 0.45 秒、決めた間（pauseBefore）があればその長さ
export function assemble(lines, clips, rate = RATE) {
  const kept = []
  const parts = []
  let cursor = 0
  lines.forEach((line, index) => {
    const clip = clips[index]
    if (!clip || !clip.length) return
    const previous = kept[kept.length - 1]
    const gapSeconds = !previous ? 0.3 : line.pauseBefore ?? (previous.speaker === line.speaker ? 0.3 : 0.45)
    const gap = Math.round(gapSeconds * rate)
    parts.push(new Float32Array(gap))
    cursor += gap
    const start = cursor / rate
    parts.push(clip)
    cursor += clip.length
    kept.push({ ...line, start, end: cursor / rate })
  })
  const tail = Math.round(0.6 * rate)
  parts.push(new Float32Array(tail))
  cursor += tail
  return { samples: joinFloat(parts), lines: kept, duration: cursor / rate }
}

// ---------- まとめて作る ----------

// 2：読んだ声を文字にして台本と照らしあわせるようにした版（それより前の番組は、声と字幕がずれていることがある）
export const EPISODE_VERSION = 2

export async function createEpisode(kind, adult, { topic = '', onStage = () => {} } = {}) {
  onStage({ stage: 'script' })
  const script = await buildScript(kind, adult, { topic })
  onStage({ stage: 'voice', done: 0, total: script.lines.length })
  const clips = await renderLines(script.lines, (done, total) => onStage({ stage: 'voice', done, total }))
  const { samples, lines, duration } = assemble(script.lines, clips)
  // 声にできなかった行が多い・片方の話し手が丸ごと抜けた番組は「準備OK」にしない（もう一度作ってもらう）
  const speakers = new Set(script.lines.map((line) => line.speaker))
  const voiced = new Set(lines.map((line) => line.speaker))
  if (lines.length < Math.min(4, script.lines.length) || lines.length < script.lines.length * 0.9 || [...speakers].some((who) => !voiced.has(who))) {
    throw Object.assign(new Error('voice failed'), { code: 'voice' })
  }
  // TOEIC：問題文まで読めた問題だけ残す
  // （番号は行と対応しているので消さずに、読めなかった問題には end を付けない。再生ではとばす）
  const sets = script.sets ? script.sets.map((set, index) => ({ ...set, end: lines.find((line) => line.set === index && line.question)?.end ?? null })) : undefined
  if (sets && !sets.some((set) => set.end)) throw Object.assign(new Error('no questions voiced'), { code: 'voice' })
  const audio = new Blob([encodeWav(samples, RATE)], { type: 'audio/wav' })
  return {
    id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    adultId: adult.id,
    kind,
    title: script.title,
    topic,
    createdAt: Date.now(),
    duration,
    lines,
    tips: script.tips,
    sets,
    audio,
    position: 0,
    listened: false,
    v: EPISODE_VERSION
  }
}
