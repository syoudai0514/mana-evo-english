// 電車モードの番組表。長い番組は「章」（1章＝約2〜3分）に分けて作る。
// 章ごとに保存するので、作っている途中で止まっても、できた章までは聞ける・続きから作れる。
// 指示文は英語で書く（Gemini にそのまま渡す）。

// 1章の長さ（分）。実際に作った番組の長さから決めた（台本の指示より短くなりがち）
export const CHAPTER_MINUTES = { radio: 2.2, default: 2.6 }

export const PROGRAMS = {
  talk: {
    id: 'talk', emoji: '🎙️', bg: '#2E5B52', title: 'ロング雑談（ポッドキャスト風）', about: 'Alex と Sam が本物の速さで',
    lengths: [10, 20, 30], unit: '分', flow: true, topic: true
  },
  drama: {
    id: 'drama', emoji: '💼', bg: '#4A3550', title: '連続ビジネスドラマ', about: '会議・出張・トラブル。毎話つづく',
    lengths: [15, 30], unit: '分', flow: true
  },
  radio: {
    id: 'radio', emoji: '🧠', bg: '#25433D', title: '英語ラジオ講座（日本語解説つき）', about: 'ひとつの表現を、解説 → 例文 → 会話で',
    lengths: [10, 20], unit: '分', flow: true, topic: true
  },
  story: {
    id: 'story', emoji: '📖', bg: '#3B2F55', title: '朗読ストーリー（章ごと）', about: 'やさしい英語の物語を、ナレーターが',
    lengths: [15, 30], unit: '分', flow: true
  },
  toeic: {
    id: 'toeic', emoji: '📘', bg: '#3D3A25', title: 'TOEIC Part 3・4 模試', about: '答える／聞き流す を再生前にえらべる',
    lengths: [10, 20], unit: '問', flow: true
  },
  mine: {
    id: 'mine', emoji: '🔁', bg: '#3A3560', title: 'あなたの会話をネイティブ版で', about: '最近 Alex と話した内容を、自然な会話に',
    lengths: [5], unit: '分', flow: true, needs: 'chat'
  },
  cards: {
    id: 'cards', emoji: '🎧', bg: '#4A3550', title: '耳で復習カード', about: '日本語 → 3秒待つ → 英語。手ぶらでOK',
    lengths: [5, 10], unit: '分', flow: true, needs: 'cards'
  }
}

// 何章に分けるか（TOEIC は5問で1章）
export function chapterCount(programId, length) {
  if (programId === 'toeic') return Math.max(1, Math.round(length / 5))
  if (programId === 'mine' || programId === 'cards') return 1
  return Math.max(1, Math.round(length / (CHAPTER_MINUTES[programId] || CHAPTER_MINUTES.default)))
}

// 番組を作るのにかかる時間・大きさの目安（1行ずつ AI の声で読ませるため、聞く時間とおなじくらいかかる）
export function estimate(programId, length) {
  const minutes = programId === 'toeic' ? length * 1.2 : length
  return { minutes, makeMinutes: Math.round(minutes * 1.1), megabytes: Math.round(minutes * 0.36) }
}

// ---------- 台本づくりの関数（音を鳴らさない Live に関数で返してもらう） ----------

export const MAKE_OUTLINE = {
  name: 'make_outline',
  description: 'Return the plan of a long listening programme.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title_ja: { type: 'STRING', description: 'short Japanese title of the whole programme' },
      chapters: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title_ja: { type: 'STRING', description: 'short Japanese chapter title' },
            brief_en: { type: 'STRING', description: 'one or two English sentences: what happens / what is talked about in this chapter' }
          },
          required: ['title_ja', 'brief_en']
        }
      }
    },
    required: ['title_ja', 'chapters']
  }
}

function lineSchema(speakers) {
  return {
    type: 'OBJECT',
    properties: {
      speaker: { type: 'STRING', enum: speakers },
      en: { type: 'STRING', description: 'the English line ("" for a Japanese narrator line)' },
      ja: { type: 'STRING', description: 'natural Japanese translation (for JA lines: the Japanese explanation itself)' }
    },
    required: ['speaker', 'en', 'ja']
  }
}

const TIPS = {
  type: 'ARRAY',
  description: '3-5 natural phrases used in this chapter that a Japanese learner should notice',
  items: { type: 'OBJECT', properties: { en: { type: 'STRING' }, ja: { type: 'STRING', description: 'meaning and nuance in Japanese' } }, required: ['en', 'ja'] }
}

export function makeChapter(speakers) {
  return {
    name: 'make_chapter',
    description: 'Return the script of one chapter.',
    parameters: {
      type: 'OBJECT',
      properties: {
        lines: { type: 'ARRAY', items: lineSchema(speakers) },
        tips: TIPS,
        summary_en: { type: 'STRING', description: 'two sentences: what happened in this chapter (for the next chapter / next episode)' }
      },
      required: ['lines', 'tips', 'summary_en']
    }
  }
}

export const CHAPTER_SPEAKERS = {
  talk: ['Alex', 'Sam'],
  drama: ['Alex', 'Sam'],
  radio: ['JA', 'Alex', 'Sam'],
  story: ['N', 'Alex', 'Sam']
}

const NATIVE_STYLE = [
  'Write REAL spoken English between native speakers, not textbook English:',
  'contractions, fillers (you know, I mean, kind of), reactions (No way! Fair enough.), idioms and phrasal verbs people actually use,',
  'short lines mixed with longer ones. Natural, friendly and clean.',
  'Alex is British (from London), Sam is American; let each use a few words typical of their country.'
].join(' ')

export const PROGRAM_WRITER_PROMPT = [
  'You are a silent script writer for an English listening app for a Japanese adult (around TOEIC 600). NEVER speak. For each request, call the given function exactly once.',
  NATIVE_STYLE,
  'Each English line is one turn of 1-3 sentences. ja is a natural Japanese translation of that line.'
].join('\n')

const PROGRAM_STYLE = {
  talk: 'A long, relaxed podcast-style chat between two friends, Alex and Sam. Each chapter is one sub-topic; move between sub-topics naturally.',
  drama: 'A serialised office drama. Alex and Sam work at "Brightline", a mid-size tech company in London, with recurring colleagues (their boss Priya, the client Mr. Tanaka from Osaka). Each chapter is a scene: meetings, emails read aloud, business trips, problems and solutions, with useful business English (TOEIC vocabulary). Keep the story continuous.',
  radio: 'A Japanese-English radio lesson. The Japanese narrator (speaker JA, en "" and the Japanese words in ja) explains, in friendly Japanese, ONE useful natural expression at a time: meaning, nuance, when to use it. Then Alex and Sam say 2-3 short example exchanges using it (English lines with Japanese translation). About 3 expressions per chapter, then a short natural dialogue using all of them, then JA sums up in one line.',
  story: 'An original graded story (around CEFR B1, easy to follow) read by a narrator (speaker N) with short character lines by Alex and Sam. Vivid, warm, a little suspense at the end of each chapter. Narrator lines are 1-3 sentences.'
}

export function outlineRequest({ programId, chapters, topic, memory, previous }) {
  return [
    `Plan a programme of ${chapters} chapters (about 3 minutes each).`,
    PROGRAM_STYLE[programId],
    topic ? `Theme requested by the learner: ${topic}.` : 'Choose a theme close to a Japanese working parent\'s life (work, family, kids, travel, food, hobbies).',
    memory?.length ? `The learner's life, for ideas (never talk about "the learner"): ${memory.join('; ')}` : '',
    previous ? `Story so far (continue from here; this is the next episode): ${previous}` : ''
  ].filter(Boolean).join('\n')
}

export function chapterRequest({ programId, outline, index, previousTail, phrases }) {
  const chapter = outline.chapters[index]
  return [
    `Programme: "${outline.title}". ${PROGRAM_STYLE[programId]}`,
    `Write chapter ${index + 1} of ${outline.chapters.length}: "${chapter.title}". ${chapter.brief}`,
    programId === 'radio' ? 'About 700 words of English and Japanese together (35-55 lines).' : 'About 650 words in total (45-60 lines).',
    index === 0 ? 'Start the programme naturally.' : `Continue naturally from the previous chapter. It ended with:\n${previousTail}`,
    index === outline.chapters.length - 1 ? 'This is the last chapter: wrap up warmly.' : 'Do not end the programme; lead into the next chapter.',
    phrases?.length ? `Use a few of these phrases naturally: ${phrases.join(' / ')}` : ''
  ].filter(Boolean).join('\n')
}

// 確認用 mock：Live につながらないときの台本
export const SAMPLE_OUTLINE = {
  title_ja: '週末と子育て',
  chapters: [
    { title_ja: '月曜の朝', brief_en: 'Alex and Sam catch up on Monday morning.' },
    { title_ja: '子どもの習いごと', brief_en: 'They talk about their kids\' lessons.' },
    { title_ja: '週末の公園', brief_en: 'A crowded park on Saturday.' },
    { title_ja: '行きたい旅行', brief_en: 'Dream holidays.' },
    { title_ja: '仕事の話', brief_en: 'A tricky project.' },
    { title_ja: 'またね', brief_en: 'They wrap up.' }
  ]
}

export function sampleChapter(programId, index) {
  const who = CHAPTER_SPEAKERS[programId] || ['Alex', 'Sam']
  const speakers = who.filter((name) => name !== 'JA' && name !== 'N')
  const lines = []
  if (who.includes('JA')) lines.push({ speaker: 'JA', en: '', ja: `第${index + 1}章では「packed」を覚えましょう。` })
  if (who.includes('N')) lines.push({ speaker: 'N', en: `Chapter ${index + 1}. It was a quiet morning in the city.`, ja: `第${index + 1}章。街は静かな朝だった。` })
  for (let i = 0; i < 4; i += 1) {
    lines.push({ speaker: speakers[i % speakers.length], en: `Chapter ${index + 1}, line ${i + 1}. The park was absolutely packed, you know.`, ja: `第${index + 1}章 ${i + 1}行目。公園はぎゅうぎゅうだったよ。` })
  }
  return { lines, tips: [{ en: 'packed', ja: 'ぎゅうぎゅうに混んでいる' }], summary_en: `Chapter ${index + 1} happened.` }
}
