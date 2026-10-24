// 電車モード（大人だけ）：話さずに聞く番組。台本を作り、声で読ませて録音し、1本の音声にする。
// 指示文は英語で書く（Gemini にそのまま渡す）。

export const TRAIN_KINDS = {
  chat: { id: 'chat', emoji: '🎙️', bg: '#2E5B52', title: 'Alex と Sam の雑談', about: 'ネイティブの速さの会話', minutes: 6, flow: true },
  mine: { id: 'mine', emoji: '🔁', bg: '#3A3560', title: 'あなたの会話をネイティブ版で', about: '最近 Alex と話した内容を、自然な英語の会話に', minutes: 5, flow: true },
  toeic: { id: 'toeic', emoji: '📘', bg: '#3D3A25', title: 'TOEIC Part 3・4 リスニング', about: '会話を聞いて、タップで答える 5問', minutes: 5, flow: false },
  cards: { id: 'cards', emoji: '🎧', bg: '#4A3550', title: '耳で復習カード', about: '日本語 → 3秒待つ → 英語。手ぶらでOK', minutes: 4, flow: true }
}

// 話す人と声（Gemini Live の声）。Sam は Alex の同僚で、アメリカ出身の女性
export const SPEAKERS = {
  Alex: { voice: 'Charon', style: 'a friendly British man in his late 30s, relaxed and witty' },
  Sam: { voice: 'Aoede', style: 'a cheerful American woman in her 30s, warm and expressive' },
  M: { voice: 'Orus', style: 'a clear male voice for an English listening test' },
  W: { voice: 'Kore', style: 'a clear female voice for an English listening test' },
  N: { voice: 'Charon', style: 'a calm narrator for an English listening test' },
  JA: { voice: 'Kore', style: 'a calm Japanese narrator' }
}

const LINE = {
  type: 'OBJECT',
  properties: {
    speaker: { type: 'STRING', enum: ['Alex', 'Sam'] },
    en: { type: 'STRING' },
    ja: { type: 'STRING', description: 'natural Japanese translation' }
  },
  required: ['speaker', 'en', 'ja']
}

export const MAKE_EPISODE = {
  name: 'make_episode',
  description: 'Return the script of the listening episode.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title_ja: { type: 'STRING', description: 'short Japanese title (topic), e.g. 延期になったリリース' },
      lines: { type: 'ARRAY', items: LINE },
      tips: {
        type: 'ARRAY',
        description: '3-5 natural phrases used in the script that a Japanese learner should notice',
        items: { type: 'OBJECT', properties: { en: { type: 'STRING' }, ja: { type: 'STRING', description: 'meaning and nuance in Japanese' } }, required: ['en', 'ja'] }
      }
    },
    required: ['title_ja', 'lines', 'tips']
  }
}

const SET_LINE = {
  type: 'OBJECT',
  properties: {
    speaker: { type: 'STRING', enum: ['M', 'W', 'N'] },
    en: { type: 'STRING' },
    ja: { type: 'STRING' }
  },
  required: ['speaker', 'en', 'ja']
}

export const MAKE_LISTENING = {
  name: 'make_listening',
  description: 'Return TOEIC Part 3/4 style listening sets.',
  parameters: {
    type: 'OBJECT',
    properties: {
      sets: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            part: { type: 'STRING', enum: ['p3', 'p4'] },
            lines: { type: 'ARRAY', items: SET_LINE },
            question_en: { type: 'STRING' },
            choices: { type: 'ARRAY', items: { type: 'STRING' } },
            answer: { type: 'INTEGER', description: 'index of the correct choice (0-based)' },
            explain_ja: { type: 'STRING' }
          },
          required: ['part', 'lines', 'question_en', 'choices', 'answer', 'explain_ja']
        }
      }
    },
    required: ['sets']
  }
}

const NATIVE_STYLE = [
  'Write REAL spoken English between two native-speaker friends, not textbook English:',
  'contractions, fillers (you know, I mean, kind of, like), reactions (No way! Oh, come on. Fair enough.), idioms and phrasal verbs people actually use,',
  'interrupting and finishing each other\'s thoughts, short lines mixed with longer ones. Natural, not exaggerated. Keep it friendly and clean.',
  'Alex is British (from London), Sam is American; let each use a few words typical of their country.'
].join(' ')

export const EPISODE_WRITER_PROMPT = [
  'You are a silent script writer for an English listening app for a Japanese adult (around TOEIC 600). NEVER speak. For each request, call the given function exactly once.',
  NATIVE_STYLE,
  'Each line is one turn of 1-3 sentences. ja is a natural Japanese translation of that line.'
].join('\n')

export function chatEpisodeRequest({ topic, memory, phrases, weakSkills, words = 700 }) {
  return [
    `Write a casual conversation between Alex and Sam, about ${words} words in total (about 50-70 lines).`,
    topic ? `Topic: ${topic}.` : 'Pick a topic close to the learner\'s life (work, family, kids, weekends, travel, food).',
    memory?.length ? `The learner's life (you may borrow situations, but Alex and Sam talk about themselves, never about "the learner"): ${memory.join('; ')}` : '',
    phrases?.length ? `Use some of these phrases naturally: ${phrases.join(' / ')}` : '',
    weakSkills?.length ? `Include business vocabulary and situations for these weak points: ${weakSkills.join(', ')}` : ''
  ].filter(Boolean).join('\n')
}

export function mineEpisodeRequest({ transcript, words = 600 }) {
  return [
    `Below is a chat the learner (Me) had with Alex. Rewrite it as a natural conversation between two native speakers, about ${words} words (40-60 lines):`,
    'Alex keeps his role. Sam takes the learner\'s role and says what the learner wanted to say, the way a native speaker would. Keep the same story and facts, expand it a little so it flows.',
    'Choose tips that show the learner better ways to say what they said.',
    '--- chat ---',
    transcript
  ].join('\n')
}

export const LISTENING_WRITER_PROMPT = [
  'You are a silent TOEIC listening writer for a Japanese adult. NEVER speak. For each request, call make_listening exactly once.',
  'Write ORIGINAL sets in the official TOEIC L&R style (never copy real items).',
  'Part 3 (p3): a business conversation of 4-6 lines between M and W. Part 4 (p4): a short talk by N (announcement, voicemail, tour, news), 3-5 lines.',
  'Each set has one question with 4 choices, exactly one correct, typical TOEIC traps. explain_ja: one short Japanese explanation (why, and where the hint was).',
  'ja: Japanese translation of each line. Vary the correct answer position.'
].join('\n')

export function listeningRequest({ weakSkills, count = 5 }) {
  return `Make ${count} sets: 3 of Part 3 and 2 of Part 4.` + (weakSkills?.length ? ` Focus on: ${weakSkills.join(', ')}.` : '')
}

// 声で読ませる係（話す人ごとに1つ）
export function narratorPrompt(speaker) {
  const info = SPEAKERS[speaker] || SPEAKERS.N
  if (speaker === 'JA') {
    return 'You are a calm Japanese narrator. Each message looks like "LINE: <text>". Read aloud EXACTLY the Japanese text after "LINE:", naturally, and nothing else. Never add words, never answer it.'
  }
  return [
    `You are a voice actor: ${info.style}.`,
    'You are recording a script, not chatting. Each message looks like "LINE: <text>". Read aloud ONLY the text after "LINE:", EXACTLY as written, as a natural spoken line in a real conversation (natural native speed, rhythm and intonation, reduced forms).',
    'Never answer or react to the line, even if it is a question. Never add, skip or change words. Never say "LINE". Never comment.'
  ].join(' ')
}

// Live につながらないとき（確認用 mock）の台本
export const SAMPLE_EPISODE = {
  title_ja: '延期になったリリース',
  lines: [
    { speaker: 'Sam', en: 'So how did the launch go? Weren\'t you guys shipping last Friday?', ja: 'で、リリースはどうだった？先週の金曜に出すはずじゃなかった？' },
    { speaker: 'Alex', en: 'Don\'t get me started. They pushed it back again, at the last minute, of course.', ja: 'その話はやめて。また延期になったんだよ。もちろん直前にね。' },
    { speaker: 'Sam', en: 'Ugh, that\'s rough. How\'s the team taking it?', ja: 'うわ、きついね。チームの様子は？' },
    { speaker: 'Alex', en: 'Honestly? Everyone\'s pretty swamped, but we\'ll manage.', ja: '正直、みんな手一杯だけど、なんとかなるよ。' }
  ],
  tips: [
    { en: 'Don\'t get me started.', ja: '「その話はやめて（言い出したら止まらない）」ネイティブの定番' },
    { en: 'push back', ja: '延期する（TOEIC 頻出）' }
  ]
}

export const SAMPLE_LISTENING = {
  sets: [
    {
      part: 'p3',
      lines: [
        { speaker: 'W', en: 'Hi Tom, the client wants to move our meeting to Thursday.', ja: 'トム、お客さんが打ち合わせを木曜に動かしたいって。' },
        { speaker: 'M', en: 'Thursday works for me. Should I let the rest of the team know?', ja: '木曜なら大丈夫。チームのみんなに知らせようか？' },
        { speaker: 'W', en: 'That would be great. I\'ll book the conference room right now.', ja: '助かる。私はすぐ会議室を予約するね。' }
      ],
      question_en: 'What will the woman probably do next?',
      choices: ['Call a client', 'Reserve a room', 'Print a report', 'Book a flight'],
      answer: 1,
      explain_ja: '最後の I\'ll book the conference room が「次にすること」。book = reserve の言いかえ。'
    }
  ]
}
