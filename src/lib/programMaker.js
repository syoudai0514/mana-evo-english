// 電車モードの番組づくり（長い番組は章ごと）：計画 → 章の台本 → 声で読ませて録音 → 圧縮して保存。
// どれも上限のない Live の中だけで行う（台本は音を鳴らさない Live に関数で返してもらう）。
import {
  CHAPTER_SPEAKERS, MAKE_OUTLINE, PROGRAM_WRITER_PROMPT, SAMPLE_OUTLINE, chapterCount, chapterRequest, makeChapter, outlineRequest, sampleChapter
} from '../data/programs.js'
import { RATE, askWriter, assemble, buildScript, renderLines } from './episodes.js'
import { dueCards, memoryForTalk } from './adult.js'
import { isMockMode } from './config.js'
import { encodeWav } from './wav.js'

const TOEIC_PER_CHAPTER = 5

// 番組全体の計画（章の題と中身）
export async function planProgram(programId, length, adult, { topic = '', previous = '' } = {}) {
  const count = chapterCount(programId, length)
  if (programId === 'toeic') {
    return { title: `TOEIC 模試 ${length}問`, chapters: Array.from({ length: count }, (_, i) => ({ title: `第${i + 1}回（${TOEIC_PER_CHAPTER}問）`, brief: '' })) }
  }
  if (programId === 'mine') return { title: 'あなたの会話のネイティブ版', chapters: [{ title: 'ネイティブ版', brief: '' }] }
  if (programId === 'cards') return { title: '耳で復習カード', chapters: [{ title: '耳で復習', brief: '' }] }
  const reply = isMockMode()
    ? SAMPLE_OUTLINE
    : await askWriter(PROGRAM_WRITER_PROMPT, MAKE_OUTLINE, outlineRequest({ programId, chapters: count, topic, memory: memoryForTalk(adult).map((item) => item.fact), previous }))
  const raw = (Array.isArray(reply?.chapters) ? reply.chapters : []).filter((item) => item?.title_ja)
  if (!raw.length) throw Object.assign(new Error('no outline'), { code: 'script' })
  // 頼んだ章の数にそろえる（足りなければ最後の章の続きにする）
  const chapters = Array.from({ length: count }, (_, i) => {
    const item = raw[i] || { title_ja: `${raw[raw.length - 1].title_ja}（つづき ${i + 1 - raw.length}）`, brief_en: 'Continue the previous chapter.' }
    return { title: String(item.title_ja), brief: String(item.brief_en || '') }
  })
  return { title: String(reply.title_ja || topic || '番組'), chapters }
}

function cleanLines(lines, speakers) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => ({ speaker: String(line?.speaker || ''), en: String(line?.en || '').trim(), ja: String(line?.ja || '').trim() }))
    .filter((line) => speakers.includes(line.speaker) && (line.speaker === 'JA' ? line.ja : line.en))
    // 日本語のナレーターは日本語を読む。それ以外は英語を読む
    .map((line) => ({ ...line, say: line.speaker === 'JA' ? line.ja : line.en }))
}

// 1章の台本（読む行・ことばのコツ・あらすじ。TOEIC は問題も）
export async function chapterScript(plan, index, adult, previousTail = '') {
  const programId = plan.programId
  if (programId === 'toeic' || programId === 'mine' || programId === 'cards') {
    const script = await buildScript(programId === 'toeic' ? 'toeic' : programId, adult)
    return { ...script, summary: '' }
  }
  const speakers = CHAPTER_SPEAKERS[programId] || ['Alex', 'Sam']
  const reply = isMockMode()
    ? sampleChapter(programId, index)
    : await askWriter(PROGRAM_WRITER_PROMPT, makeChapter(speakers), chapterRequest({
        programId,
        outline: plan,
        index,
        previousTail,
        phrases: index === 0 ? dueCards(adult, Date.now() + 3 * 86400000, 5).map((card) => card.en) : []
      }))
  const lines = cleanLines(reply?.lines, speakers)
  if (lines.length < 4) throw Object.assign(new Error('chapter too short'), { code: 'script' })
  return { lines, tips: Array.isArray(reply?.tips) ? reply.tips.filter((tip) => tip?.en) : [], summary: String(reply?.summary_en || '') }
}

// 章の声を作る。声にできなかった行が多い章は失敗にする（あとで続きから作りなおせる）
export async function voiceChapter(script, onProgress) {
  const clips = await renderLines(script.lines, onProgress)
  const { samples, lines, duration } = assemble(script.lines, clips)
  const speakers = new Set(script.lines.map((line) => line.speaker))
  const voiced = new Set(lines.map((line) => line.speaker))
  if (lines.length < Math.min(4, script.lines.length) || lines.length < script.lines.length * 0.9 || [...speakers].some((who) => !voiced.has(who))) {
    throw Object.assign(new Error('voice failed'), { code: 'voice' })
  }
  return { samples, lines, duration }
}

// 声を MP3 に圧縮する（30分で約11MB。WAV のままだと約86MB）。使えなければ WAV
export async function encodeAudio(samples, rate = RATE) {
  try {
    const { Mp3Encoder } = await import('@breezystack/lamejs')
    const encoder = new Mp3Encoder(1, rate, 48)
    const block = 1152
    const out = []
    const pcm = new Int16Array(block)
    for (let i = 0; i < samples.length; i += block) {
      const size = Math.min(block, samples.length - i)
      for (let j = 0; j < size; j += 1) pcm[j] = Math.max(-1, Math.min(1, samples[i + j])) * 0x7fff
      out.push(encoder.encodeBuffer(size === block ? pcm : pcm.subarray(0, size)))
      // ときどき手をはなして、画面が固まらないように
      if (i % (block * 200) === 0) await new Promise((resolve) => setTimeout(resolve, 0))
    }
    out.push(encoder.flush())
    return new Blob(out, { type: 'audio/mpeg' })
  } catch {
    return new Blob([encodeWav(samples, rate)], { type: 'audio/wav' })
  }
}

// できた章を番組に足す（字幕の時間は番組全体での時間にする）
export function withChapter(episode, { title, lines, duration, tips, sets, summary }) {
  const start = episode.duration || 0
  const part = episode.chapters.length
  const setOffset = (episode.sets || []).length
  const placed = lines.map((line) => ({ ...line, part, start: line.start + start, end: line.end + start, ...(line.set !== undefined ? { set: line.set + setOffset } : {}) }))
  const newSets = (sets || []).map((set, i) => {
    const question = placed.find((line) => line.set === i + setOffset && line.question)
    return { ...set, end: question?.end ?? null }
  })
  return {
    ...episode,
    chapters: [...episode.chapters, { title, start, duration }],
    lines: [...episode.lines, ...placed],
    tips: [...episode.tips, ...(tips || [])].slice(0, 30),
    sets: [...(episode.sets || []), ...newSets],
    summary: [episode.summary, summary].filter(Boolean).join(' ').slice(-1200),
    duration: start + duration
  }
}

// 前の章のおわり（次の章を自然につなぐため）
export function tailOf(episode, count = 4) {
  return episode.lines.slice(-count).map((line) => `${line.speaker}: ${line.en || line.ja}`).join('\n')
}
