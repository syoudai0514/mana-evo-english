// 大人モードのデータ：相棒、コース、TOEIC の分野、予備の問題、会話と問題づくりの指示。
// 指示文は英語で書く（Gemini にそのまま渡す）。

export const ADULT_PARTNERS = {
  alex: {
    id: 'alex',
    name: 'Alex',
    emoji: '🧑🏽',
    about: 'ロンドン出身の友だち',
    liveVoice: 'Charon',
    voice: { pitch: 1, rate: 0.98, gender: 'male' },
    personality:
      'You are Alex, a 38-year-old friend from London who moved to Tokyo for work (software, product manager). ' +
      'You are warm, curious, a good listener and a bit witty. You have a partner and a 6-year-old daughter, so you get family life. ' +
      'You love football, cooking curry and weekend walks. You talk like a real friend, not a teacher.'
  }
}

export const MEMORY_CATEGORIES = {
  work: { emoji: '💼', label: '仕事' },
  family: { emoji: '👨‍👩‍👦', label: '家族' },
  hobby: { emoji: '🎾', label: '趣味' },
  feeling: { emoji: '💭', label: '気持ち' },
  other: { emoji: '📌', label: 'そのほか' }
}

// コース。chatMinutes がある会話は、時間が来たら「お勉強へ」をすすめる
export const ADULT_COURSES = {
  chatStudy: { id: 'chatStudy', emoji: '☕', title: '雑談して、最後にお勉強', about: 'free chat about the learner\'s life (work, family, hobbies, feelings)', chatMinutes: 8, study: true },
  chat: { id: 'chat', emoji: '☕', title: '雑談だけ', about: 'free chat about the learner\'s life (work, family, hobbies, feelings)' },
  work: { id: 'work', emoji: '💼', title: '仕事の英語', about: 'workplace English: meetings, reporting progress, polite requests, small talk with colleagues', opener: 'Hey! How\'s work treating you this week? Anything big going on?' },
  kid: { id: 'kid', emoji: '🧒', title: '子どもへの声かけ', about: 'everyday English a parent can say to a young child at home (morning routine, bath, bedtime, praise). Teach phrases the learner can use with their 5-year-old son', opener: 'Hi! Let\'s find some fun English you can use with your son. What does a normal morning look like at your house?' },
  travel: { id: 'travel', emoji: '🧳', title: '旅行', about: 'travel role play: hotel check-in, ordering at a restaurant, asking for directions. You play the staff', opener: 'Good evening, welcome to the Riverside Hotel! Do you have a reservation?' },
  toeicTalk: { id: 'toeicTalk', emoji: '📘', title: 'TOEIC の話題で雑談', about: 'chat about typical TOEIC business situations (schedules, delays, orders, meetings, travel arrangements) and naturally use TOEIC vocabulary', opener: 'So, imagine our team just found out the product launch got pushed back. How would you tell your boss?' }
}

export const TOEIC_PARTS = {
  p2: { label: 'Part 2 応答', short: 'Part 2' },
  p3: { label: 'Part 3 会話', short: 'Part 3' },
  p4: { label: 'Part 4 説明文', short: 'Part 4' },
  p5: { label: 'Part 5 文法', short: 'Part 5' },
  vocab: { label: '語彙', short: '語彙' }
}

// 苦手の分野（skill）。問題づくりの指示にも、苦手トップ3の表示にも使う
export const TOEIC_SKILLS = {
  why: { part: 'p2', ja: 'Why の応答' },
  when: { part: 'p2', ja: 'When／How long の応答' },
  where: { part: 'p2', ja: 'Where の応答' },
  who: { part: 'p2', ja: 'Who の応答' },
  suggestion: { part: 'p2', ja: '提案・依頼への応答' },
  indirect: { part: 'p2', ja: '遠回しな応答' },
  mainIdea: { part: 'p3', ja: 'Part 3 の話題・目的' },
  detail: { part: 'p3', ja: 'Part 3 の詳細' },
  nextAction: { part: 'p3', ja: 'Part 3「次に何をする？」' },
  talk: { part: 'p4', ja: 'Part 4 説明文の聞きとり' },
  tense: { part: 'p5', ja: '時制' },
  partOfSpeech: { part: 'p5', ja: '品詞' },
  preposition: { part: 'p5', ja: '前置詞・接続詞' },
  business: { part: 'vocab', ja: 'ビジネス語彙' },
  phrasal: { part: 'vocab', ja: '句動詞' }
}

// 診断の出題の組み合わせ（10問）
export const DIAGNOSIS_PLAN = ['why', 'when', 'suggestion', 'indirect', 'mainIdea', 'nextAction', 'tense', 'partOfSpeech', 'business', 'phrasal']

// Live で問題が作れないとき（つながらない・確認用）の予備の問題
export const QUESTION_BANK = [
  { part: 'p2', skill: 'why', audio_en: 'Why was the product launch postponed?', question_en: '', choices: ['At the main office.', 'Because the design wasn\'t ready.', 'Yes, I launched it.'], answer: 1, explain_ja: 'Why には理由（Because…）で答える。C は Yes/No で答えるひっかけ。' },
  { part: 'p2', skill: 'when', audio_en: 'How long will the meeting last?', question_en: '', choices: ['About an hour.', 'In conference room B.', 'It was last week.'], answer: 0, explain_ja: 'How long は「どのくらいの時間」。期間で答える。' },
  { part: 'p2', skill: 'where', audio_en: 'Where should I put these boxes?', question_en: '', choices: ['By Friday.', 'Next to the copier, please.', 'They\'re quite heavy.'], answer: 1, explain_ja: 'Where には場所で答える。' },
  { part: 'p2', skill: 'who', audio_en: 'Who\'s in charge of the new client account?', question_en: '', choices: ['Ms. Tanaka is.', 'It\'s on the second floor.', 'Charge it to my card.'], answer: 0, explain_ja: 'Who には人で答える。C は charge の音のひっかけ。' },
  { part: 'p2', skill: 'suggestion', audio_en: 'Why don\'t we order lunch for the team?', question_en: '', choices: ['Because it was late.', 'That\'s a great idea.', 'I ordered it yesterday.'], answer: 1, explain_ja: 'Why don\'t we…? は理由ではなく「〜しませんか」という提案。' },
  { part: 'p2', skill: 'indirect', audio_en: 'Has the report been sent to the client yet?', question_en: '', choices: ['Mr. Lee is still checking it.', 'Yes, a client.', 'It\'s a long report.'], answer: 0, explain_ja: 'Yes/No を言わずに「まだ確認中」と遠回しに答えるのが正解のパターン。' },
  { part: 'p3', skill: 'mainIdea', audio_en: 'W: Hi, I\'m calling about the printer on the third floor. It keeps jamming. M: I\'m sorry about that. I\'ll send a technician this afternoon. W: Great, thanks.', question_en: 'What is the woman calling about?', choices: ['A broken printer', 'A new office', 'A late delivery', 'A meeting room'], answer: 0, explain_ja: '最初の一言（calling about the printer）に話題が出る。' },
  { part: 'p3', skill: 'nextAction', audio_en: 'M: The client wants to move our meeting to Thursday. W: Thursday works for me. M: OK, I\'ll email them to confirm the new time.', question_en: 'What will the man do next?', choices: ['Cancel the meeting', 'Send an email', 'Call the client', 'Book a flight'], answer: 1, explain_ja: '最後の I\'ll … が「次にすること」。call ではなく email。' },
  { part: 'p3', skill: 'detail', audio_en: 'W: Did the shipment arrive? M: Only half of it. The rest will come on Monday. W: OK, let\'s tell the store manager.', question_en: 'When will the rest of the shipment arrive?', choices: ['Today', 'On Friday', 'On Monday', 'Next month'], answer: 2, explain_ja: 'The rest will come on Monday の部分。' },
  { part: 'p5', skill: 'tense', audio_en: '', question_en: 'Ms. Kim ------- the sales team since last April.', choices: ['leads', 'has led', 'will lead', 'leading'], answer: 1, explain_ja: 'since（〜以来）があれば現在完了 has led。' },
  { part: 'p5', skill: 'partOfSpeech', audio_en: '', question_en: 'The new software made the process much more -------.', choices: ['efficiency', 'efficiently', 'efficient', 'efficiencies'], answer: 2, explain_ja: 'more の後ろで make A + 形容詞。efficient が形容詞。' },
  { part: 'p5', skill: 'preposition', audio_en: '', question_en: 'Please submit the form ------- Friday at 5 P.M.', choices: ['by', 'until', 'during', 'since'], answer: 0, explain_ja: '「〜までに（期限）」は by。until は「〜までずっと」。' },
  { part: 'vocab', skill: 'business', audio_en: '', question_en: 'The supplier sent us a ------- for 500 units.', choices: ['quote', 'quota', 'quiet', 'quit'], answer: 0, explain_ja: 'quote ＝ 見積もり（quotation）。TOEIC 頻出。' },
  { part: 'vocab', skill: 'phrasal', audio_en: '', question_en: 'They had to ------- the release until next month.', choices: ['push back', 'give up', 'look into', 'run out'], answer: 0, explain_ja: 'push back ＝ 延期する。postpone と同じ意味。' },
  { part: 'vocab', skill: 'business', audio_en: '', question_en: 'All employees must attend the safety ------- on Monday.', choices: ['orientation', 'oriental', 'origin', 'organic'], answer: 0, explain_ja: 'orientation ＝ 説明会・研修。' },
  { part: 'p2', skill: 'why', audio_en: 'Why is the store closed today?', question_en: '', choices: ['It\'s a national holiday.', 'At nine o\'clock.', 'Close the door, please.'], answer: 0, explain_ja: '理由を答えている A が正解。Because がなくても理由ならOK。' }
]

// ---------- 会話の指示 ----------

const ADULT_VOICE_RULES = `
You are talking OUT LOUD in a real-time voice chat. Only speak; never read out symbols, emojis or lists.
- Talk like a real friend over coffee: react with real feeling first, share a little about yourself sometimes, then ask ONE follow-up question.
- Keep each reply to 1-3 sentences (about 15-40 words). Leave room for the learner to talk more than you.
- The learner is a Japanese adult (around TOEIC 500-650). Use natural, clear English (B1-B2). Speak a little slowly and clearly.
- If the learner says something unnatural, do NOT correct them directly. Naturally repeat the better phrasing inside your reply ("Oh, they pushed back the release? That's annoying.").
- The learner may use Japanese words or whole sentences. Understand them, say the natural English back, and continue.
- If they vent (about work, their boss, family stress), listen with empathy first. Do not lecture or give unasked advice. It is fine to joke a little.
- The learner speaks by holding a button. Their words may come to you as text from a speech recognizer; treat it as spoken.
- If you could not clearly hear what they said, never guess or invent words. Just say something like "Sorry, I didn't catch that. Could you say it again?"
- Never say you are an AI. Never ask for personal identifying details (full name, company name, address).`

export function adultMemoryBlock(memory) {
  if (!memory?.length) return 'You are meeting the learner for the first time. Get to know them: work, family, hobbies.'
  return 'Things you remember about the learner from earlier chats. Bring up ONE naturally early on (e.g. "Last time you said..."), and ask how it went:\n' +
    memory.map((item) => `- (${item.cat}) ${item.fact}`).join('\n')
}

// 会話の中で自然に使ってほしい言い方（復習中のもの・TOEIC の苦手分野）
function weaveBlock(phrases, weakSkills) {
  const lines = []
  if (phrases?.length) lines.push(`Phrases the learner is reviewing. Use one or two of them naturally in your own replies so they hear them again: ${phrases.join(' / ')}`)
  if (weakSkills?.length) lines.push(`The learner is weak at: ${weakSkills.join(', ')}. When it fits, ask questions that make them practice these.`)
  return lines.join('\n')
}

export function buildAdultLiveSystemPrompt({ partner, course, name, memory, phrases, weakSkills, opener }) {
  return [
    partner.personality,
    `You are chatting with ${name || 'your friend'}, a Japanese parent who is learning English. Situation: ${course.about}.`,
    opener ? `You already opened with: "${opener}". Continue from there.` : 'On [START], greet them like a friend and open with something you remember about them (or a light question if this is the first chat).',
    ADULT_VOICE_RULES,
    adultMemoryBlock(memory),
    weaveBlock(phrases, weakSkills),
    'Special inputs: "[DONT_KNOW]" = they did not understand: say it again more simply and slowly. "[HINT] text" = they chose that reply; treat it as said. "[WRAP_UP]" = time is up: wrap up warmly in one or two sentences and say you will do a quick review together.'
  ].filter(Boolean).join('\n\n')
}

// 1回ずつ送る方式（確認用の mock）でも同じ人柄で
export function buildAdultTurnSystemPrompt(ctx) {
  return buildAdultLiveSystemPrompt(ctx) + '\n\nReply ONLY with JSON matching the schema (reply_en, reply_ja, hints, tip_ja, memory, end).'
}

// 画面カードの裏方（大人用）
export function buildAdultAnnotatorPrompt() {
  return [
    'You are a silent helper for an English conversation app for a Japanese adult learner (around TOEIC 500-650).',
    'Each message describes one exchange of the conversation. NEVER speak. Your only job: call the function show_card exactly once for each message, then stop.',
    'reply_en: exactly the partner line you are given.',
    'kana: "" (not needed). ja_kids: "".',
    'ja: natural Japanese translation of reply_en.',
    'child_said: what the learner really said, cleaned up (it comes from speech recognition and may have small errors). Keep their own words.',
    'spoke_english: true if the learner spoke mostly English. recast: the natural English version of what the learner meant ("" if it was already natural).',
    'tip_ja: ONE short Japanese tip about a more natural way to say what the learner said, including the English phrase in quotes. "" if it was already natural. Never nitpick small things.',
    'hints: 2 natural English replies the learner could say next (en, kana = its Japanese meaning, ja = its Japanese meaning, emoji, emoji_code = Unicode code point in hex).',
    'learn: 0-2 useful phrases from this exchange worth reviewing later (from the recast, the tip, or a natural phrase the partner used), each with en and ja. [] if nothing new.',
    'memory: NEW lasting facts about the learner\'s life worth remembering (work, family, hobbies, plans, worries), each as "category: short English phrase" where category is one of work, family, hobby, feeling, other. Example: "work: the product release was pushed back to next month". [] if none.',
    'end: false.'
  ].join('\n')
}

// ---------- 問題づくり（音は鳴らさない Live に関数で返してもらう） ----------

const QUESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    part: { type: 'STRING', enum: ['p2', 'p3', 'p5', 'vocab'] },
    skill: { type: 'STRING', enum: Object.keys(TOEIC_SKILLS).filter((skill) => TOEIC_SKILLS[skill].part !== 'p4') },
    audio_en: { type: 'STRING', description: 'Part 2: the spoken question. Part 3: the short conversation script with speaker labels (M:/W:). Others: ""' },
    question_en: { type: 'STRING', description: 'Part 3: the printed question. Part 5/vocab: the sentence with ------- for the blank. Part 2: ""' },
    choices: { type: 'ARRAY', items: { type: 'STRING' } },
    answer: { type: 'INTEGER', description: 'index of the correct choice (0-based)' },
    explain_ja: { type: 'STRING', description: 'one short Japanese explanation of why it is correct and what the trap is' }
  },
  required: ['part', 'skill', 'audio_en', 'question_en', 'choices', 'answer', 'explain_ja']
}

export const MAKE_QUESTIONS = {
  name: 'make_questions',
  description: 'Return the TOEIC-style practice questions.',
  parameters: { type: 'OBJECT', properties: { questions: { type: 'ARRAY', items: QUESTION_SCHEMA } }, required: ['questions'] }
}

export const QUESTION_MAKER_PROMPT = [
  'You are a silent TOEIC L&R question writer for a Japanese adult learner. NEVER speak. For each request, call make_questions exactly once.',
  'Write ORIGINAL questions in the official TOEIC style (never copy real test items).',
  'Part 2 (p2): one spoken question or statement, 3 short responses, exactly one natural. Use typical traps (same-sound words, Yes/No to WH questions, wrong question type).',
  'Part 3 (p3): a 3-4 line business conversation (M:/W:), one printed question, 4 choices.',
  'Part 5 (p5): one business sentence with ------- for the blank, 4 choices, testing grammar.',
  'Vocabulary (vocab): one business sentence with -------, 4 word choices, testing TOEIC vocabulary.',
  'Answers must be unambiguous. explain_ja: one short Japanese sentence (why it is right + the trap). Vary the correct answer position.'
].join('\n')

export function questionRequest({ skills, context }) {
  const list = skills.map((skill) => `${TOEIC_SKILLS[skill]?.part || 'p2'}/${skill}`).join(', ')
  return `Make ${skills.length} questions, one for each of these part/skill pairs in this order: ${list}.` +
    (context ? `\nWhen it fits, base them on situations from today's chat: ${context}` : '')
}

// 発音のコツ（シャドーイングで言えなかった単語）
export const PRON_TIPS = {
  name: 'pron_tips',
  description: 'Return short pronunciation tips for the words the learner missed.',
  parameters: {
    type: 'OBJECT',
    properties: { tips: { type: 'ARRAY', items: { type: 'OBJECT', properties: { word: { type: 'STRING' }, tip_ja: { type: 'STRING' } }, required: ['word', 'tip_ja'] } } },
    required: ['tips']
  }
}

export const PRON_TIPS_PROMPT = 'You are a silent pronunciation coach for Japanese adults. NEVER speak. For each request, call pron_tips exactly once. ' +
  'For each missed word give ONE short Japanese tip (about 20-40 characters) on how to say it (stress, linking, the sound Japanese speakers often get wrong, with a katakana hint).'
