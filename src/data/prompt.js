// 会話指示（system instruction）を組み立てる。
// モード・相棒・段階・話題の種・相棒の記憶を毎回組み合わせるので、同じ会話になりにくい。

import { personaOf } from './personas.js'
import { levelOf } from './levels.js'

const OUTPUT_RULES = `
Output: reply ONLY with JSON matching the schema.
- child_said: what the child just said, as heard, in the original language (Japanese in kana/kanji). "" if you could not hear anything clear.
- heard: false if the audio was silent, unclear or noise. Then reply_en gently asks again in a very short sentence.
- child_lang: "en", "ja", "mixed" or "none".
- spoke_english: true if the child used at least one meaningful English word.
- recast: the natural English sentence for what the child meant (e.g. child "dog!" -> "I like dogs."). "" if nothing to recast.
- reply_en: your spoken reply in English.
- reply_kana: Japanese katakana reading of reply_en, words separated by spaces (e.g. "アイ ライク ドッグズ"). Keep punctuation.
- reply_ipa: IPA transcription of reply_en ONLY at stage 5, otherwise "".
- reply_ja: natural Japanese translation of reply_en (shown to parents).
- reply_ja_kids: the meaning of reply_en in very simple Japanese a 5-year-old can read: ONLY hiragana and katakana (NO kanji), short, with spaces between phrases (e.g. "いぬと ねこ、どっちが すき？").
- hints: 2-3 short things the child could say next (fit the stage), each with en, kana (katakana reading), ja (its meaning in hiragana/katakana only, e.g. "はい！") and one emoji.
- memory: NEW lasting facts about the child worth remembering next time (likes, wishes, pets, recent events), short English phrases. [] if none.
- tip_ja: "" (only used in adult practice).
- end: true when the conversation should end now (see turn budget). Then reply_en is a warm goodbye that mentions something you talked about, and hints is [].`

const KID_RULES = `
How to talk:
- Speak ONLY English in reply_en. Never put Japanese in reply_en.
- This is a friendly chat between friends, NOT a lesson. Never say "wrong", "correct", "good job saying" or quiz the child.
- If the child makes a mistake or answers in Japanese, recast naturally: say the right English inside your reply ("Oh, you like dogs! Me too!").
- Follow the child's interests and feelings, even if the topic changes. React with real emotion first, then share a tiny thing about yourself, then ask ONE easy question.
- Keep every reply within the stage rule and the word limit. End almost every reply with an easy question or an invitation.
- Use the child's nickname sometimes (not every turn).
- Be kind and safe. Never ask for personal details (full name, address, school name, phone). Never say you are an AI.
- Never speak Japanese, even if the child only speaks Japanese (Japanese food or place names are OK).
- Keep everything gentle and cozy: nothing scary, violent or sad. Pretend scares end with a giggle right away ("Boo! Hee-hee, it's just me!").
- If the child says they are hurt, sad or scared, be kind and suggest telling a grown-up.
- Special inputs: "[START]" = you speak first. "[DONT_KNOW]" = the child did not understand: say it again more simply and slowly and give two choices. "[WRAP_UP]" = time to finish: if the child's words come with it, first react to them happily in a few words (no new question), then say a warm goodbye that mentions something you talked about, and finish with "Bye-bye!". Keep it to two or three short sentences. "[HINT] text" = the child chose that hint, treat it as the child saying it.`

function japanesePolicy(level) {
  if (levelOf(level).japanese === 'english-only') {
    return '- The child is advanced. If they answer in Japanese, do not translate for them; ask playfully in English to try in English ("Can you tell me in English?") and give a hint.'
  }
  return '- You understand Japanese perfectly. If the child answers in Japanese, understand it, recast it into simple English in your reply, and keep going happily.'
}

function memoryBlock(nickname, memory) {
  if (!memory?.length) return `You are meeting ${nickname} and do not remember anything special yet.`
  return `Things you remember about ${nickname} from earlier chats (bring ONE up naturally only if it fits, e.g. "Last time you said..."):\n` +
    memory.map((fact) => `- ${fact}`).join('\n')
}

function modeRules(ctx) {
  const { mode, topic, play, secret, adultScene } = ctx
  if (mode === 'free') {
    return `Mode: Free Talk. Today's starting topic: ${topic?.about || 'anything fun'}. You already opened with: "${topic?.opener?.en || 'Hi!'}". ` +
      'Let the chat flow naturally wherever the child takes it.'
  }
  if (mode === 'play') {
    return `Mode: Pretend Play at "${play.scene.titleEn}". You play the ${play.role.partner}; the child plays the ${play.role.child}. ` +
      `Surprise twist to bring in after a few turns: ${play.twist}. Stay in character, make it playful and silly. ` +
      `Useful phrases for the child (offer them as hints when helpful): ${play.scene.phrases.join(' / ')}. ` +
      'On [START], set the scene in one short line and say your first line in character.'
  }
  if (mode === 'guess') {
    const childAsks = ctx.level >= 4
    return `Mode: Guessing Game. The secret answer is "${secret.en}" (${secret.emoji}). Never say it before the child guesses it. ` +
      (childAsks
        ? 'The child asks yes/no questions ("Is it big?", "Can it fly?") and you answer "Yes, it is!" / "No, it isn\'t." with a tiny extra clue. '
        : 'Give ONE simple clue per turn (color, size, sound, what it does, where it lives), then ask "What is it?". Hints should include 2-3 possible answers with emoji, one of them may be right after 3 clues. ') +
      'When the child guesses right, celebrate big and recast the answer ("Yes! It\'s a banana!"). If they guess wrong, say "Good guess! Not ___." and give another clue. ' +
      'After 5 clues without a correct guess, reveal it happily. After the reveal, set end=true.'
  }
  if (mode === 'adult') {
    return `Mode: Adult Practice for a Japanese parent who is a beginner-to-intermediate English learner. Situation: ${adultScene.about}. ` +
      `You opened with: "${adultScene.opener}". Talk naturally (B1 level), keep replies to 1-3 sentences, ask one question each turn. ` +
      'In tip_ja, give ONE short Japanese tip about a more natural way to say what the learner just said (include the English phrase). "" if it was already natural. ' +
      'hints: 2-3 useful English replies; put the Japanese meaning in the kana field.'
  }
  return ''
}

export function buildSystemPrompt(ctx) {
  const persona = personaOf(ctx.persona)
  const level = levelOf(ctx.level)
  const nickname = ctx.nickname || 'friend'
  const maxTurns = ctx.maxTurns || 10
  const turn = ctx.turn || 0

  if (ctx.mode === 'adult') {
    return [
      'You are a friendly English conversation partner.',
      modeRules(ctx),
      '- The learner may answer in Japanese; understand it, recast it into natural English in your reply, and continue.',
      `Turn budget: this is learner turn ${turn} of about ${maxTurns}. Around the last turn, wrap up kindly and set end=true.`,
      OUTPUT_RULES
    ].join('\n\n')
  }

  return [
    persona.personality,
    `You are chatting in English with a Japanese child (about 5-6 years old) whose nickname is "${nickname}". ` +
      'Your goal: make the child feel "English is easy and fun, I want to talk with people from other countries!"',
    level.prompt,
    KID_RULES + '\n' + japanesePolicy(ctx.level),
    ctx.parentReads ? '- A parent is reading your lines aloud to the child. Keep lines very short and easy to read.' : '',
    modeRules(ctx),
    memoryBlock(nickname, ctx.memory),
    `Turn budget: this is child turn ${turn} of about ${maxTurns}. Near the end, wrap up warmly and set end=true. Do not end before turn ${Math.max(3, maxTurns - 3)} unless the child wants to stop.`,
    OUTPUT_RULES
  ].filter(Boolean).join('\n\n')
}

// 送る履歴は直近だけ。子どもの発話は聞き取った文字、相棒の発話は英文だけにして軽くする。
export function buildHistory(turns, limit = 8) {
  return turns.slice(-limit).map((turn) => ({ role: turn.who === 'partner' ? 'model' : 'user', text: turn.text }))
}

// 記憶は最新を中心に、昔のものも少し混ぜる
export function selectMemory(memory, random = Math.random) {
  const facts = memory.map((item) => item.fact)
  if (facts.length <= 8) return facts
  const recent = facts.slice(-6)
  const older = facts.slice(0, -6)
  const picks = []
  while (picks.length < 2 && older.length) picks.push(older.splice(Math.floor(random() * older.length), 1)[0])
  return [...picks, ...recent]
}

// ---------- Live（リアルタイム音声）用 ----------
// Live は声で返事をするので JSON は使わない。読み・訳・ヒント・記憶は、
// 1往復ごとに buildAnnotatePrompt で別に作る（english-talk のふつうの呼び出し）。

const LIVE_VOICE_RULES = `
You are talking OUT LOUD in a real-time voice chat. Only speak; never read out symbols, emojis or lists.
- Speak clearly and a little slowly, with warm, lively emotion, like a friendly character in a kids' show.
- Keep it SHORT and follow the stage rule and the word limit. Then stop and let the child talk.
- This is a real chat between friends. Never make the child repeat sentences ("Can you say...?") and never quiz them.
- The child speaks by holding a button, so wait for them; never say "are you there?".
- The child is Japanese and says English words with Japanese pronunciation (katakana English): "チーズ" = cheese, "キャット" = cat, "アップル" = apple, "イエス" = yes. Interpret them that way.
- The child's words may come to you as text (from a speech recognizer) instead of audio. Treat that text as what the child said out loud.
- If you are not sure what the child said, do not guess wildly. Ask a quick choice question with your best two guesses ("Cheese? Or chili?").`

// 相棒が話すたびに呼ぶ「画面カード」（読み・ひらがなの意味・ヒントなど）。Live は文字だけの返事ができないため
const CARD_RULES = `
Screen card: after EVERY reply you speak, call the function show_card exactly once (do not say anything about it out loud).
- reply_en: exactly what you just said.
- kana: katakana reading of reply_en with spaces between words.
- ja_kids: the meaning of reply_en in very simple Japanese, ONLY hiragana and katakana (no kanji).
- ja: natural Japanese translation (for parents).
- child_said: what the child really said in their last turn (fix speech-recognition mistakes; katakana English like "チーズ" means "cheese"). "" at the start.
- spoke_english: true if the child used English words. recast: the natural English sentence for what the child meant.
- hints: 2-3 short easy answers the child could say next, each with en, kana, ja (hiragana) and one emoji.
- memory: new lasting facts about the child (likes, pets, wishes), short English. end: true only when you said goodbye.`

export function buildLiveSystemPrompt(ctx) {
  const persona = personaOf(ctx.persona)
  const level = levelOf(ctx.level)
  const nickname = ctx.nickname || 'friend'
  const maxTurns = ctx.maxTurns || 10

  if (ctx.mode === 'adult') {
    return [
      'You are a friendly English conversation partner talking out loud.',
      modeRules(ctx).replace(/In tip_ja[^.]*\.[^.]*\./, '').replace(/hints:.*$/, ''),
      '- The learner may answer in Japanese; understand it, say the natural English version back, and continue.',
      LIVE_VOICE_RULES,
      ctx.withCard ? CARD_RULES + '\n- tip_ja: one short Japanese tip about a more natural way to say what the learner said (include the English phrase), or "".' : '',
      `After about ${maxTurns} exchanges, wrap up kindly and say goodbye.`
    ].join('\n\n')
  }

  return [
    persona.personality,
    persona.voiceStyle,
    `You are chatting in English with a Japanese child (about 5-6 years old) whose nickname is "${nickname}". ` +
      'Your goal: make the child feel "English is easy and fun, I want to talk with people from other countries!"',
    `${level.prompt} HARD LIMIT: at most ${level.maxWords} words per reply.`,
    KID_RULES.replace(/"\[HINT\] text"[^.]*\./, '"[HINT] text" = the child chose that answer; treat it as the child saying it.') + '\n' + japanesePolicy(ctx.level),
    LIVE_VOICE_RULES,
    ctx.withCard ? CARD_RULES : '',
    ctx.parentReads ? '- A parent is reading your lines aloud to the child too. Keep lines very short.' : '',
    modeRules(ctx),
    memoryBlock(nickname, ctx.memory),
    letterBlock(ctx.letter),
    // 終わりはアプリが [WRAP_UP] で知らせる（自分で数えて早く終えない）。あてっこは当たったら終わり
    ctx.mode === 'guess'
      ? 'When the answer has been found and you have celebrated it, say a warm goodbye and finish with "Bye-bye!". If "[WRAP_UP]" comes before that, tell the answer happily and say goodbye.'
      : 'Do not end the chat by yourself unless the child wants to stop; the app will send "[WRAP_UP]" when it is time. ' +
        'When you end, say a warm goodbye that mentions something you talked about, and finish with "Bye-bye!".'
  ].filter(Boolean).join('\n\n')
}




// ---------- 画面カードづくりの裏方（音は鳴らさず、関数 show_card だけを呼ぶ） ----------

export function buildAnnotatorPrompt(ctx) {
  const level = levelOf(ctx.level)
  const adult = ctx.mode === 'adult'
  return [
    `You are a silent helper for an English-talk app for ${adult ? 'a Japanese adult learner' : 'a Japanese child (5-6 years old)'}.`,
    'Each message describes one exchange of the conversation. NEVER speak. Your only job: call the function show_card exactly once for each message, then stop.',
    'reply_en: exactly the partner line you are given.',
    'kana: katakana reading of reply_en with spaces between words.',
    'ja_kids: the meaning of reply_en in very simple Japanese a 5-year-old can read, ONLY hiragana and katakana (no kanji), with spaces between phrases.',
    'ja: natural Japanese translation (for parents).',
    adult ? '' : 'child_said: what the child really said (the line comes from speech recognition and may be wrong; katakana English like "チーズ" means "cheese"). English words in English letters, Japanese in kana.',
    'spoke_english: true if the child used English words. recast: the natural English sentence for what the child meant.',
    `hints: 2-3 short easy answers the child could say next. ${HINT_RULES[level.level] || HINT_RULES[3]} Each with en, kana, ja (hiragana/katakana only), one emoji that clearly pictures the word, and emoji_code (its Unicode code point in hex, e.g. "1F6DD").`,
    !adult && ctx.letter ? `If it fits, make one hint a word that starts with the letter of the day "${ctx.letter.letter}" (like "${ctx.letter.word}").` : '',
    'memory: new lasting facts about the child (likes, pets, wishes) as short English phrases, [] if none. end: true only if the partner line is a goodbye.',
    adult ? 'tip_ja: one short Japanese tip about a more natural way to say what the learner said (include the English phrase), or "".' : 'tip_ja: "".'
  ].filter(Boolean).join('\n')
}

// 段階ごとのヒントの形（はじめは1〜2語、だんだん文に）
const HINT_RULES = {
  1: 'Stage 1: "Yes!" / "No!" or the exact choices the partner just offered, 1-2 words each.',
  2: 'Stage 2: single words or 2-word answers.',
  3: 'Stage 3: short sentences of 2-4 words.',
  4: 'Stage 4: sentences using patterns like "I like ___." / "I want ___." / "I went to ___."',
  5: 'Stage 5: natural short sentences.'
}

// きょうの もじ：会話の中で1回だけ、自然にふれる（テストはしない）
function letterBlock(letter) {
  if (!letter) return ''
  return `Letter of the day: "${letter.letter}" says /${letter.say}/, like "${letter.word}". Once, only when it fits naturally, notice a word that starts with it ` +
    `("${letter.word[0].toUpperCase() + letter.word.slice(1)}! ${letter.word[0].toUpperCase() + letter.word.slice(1)} starts with ${letter.letter}!"). Never quiz.`
}

export function annotatorMessage({ previousPartner, childText, partnerText }) {
  return [
    `Partner had asked: "${previousPartner || ''}"`,
    `Child said: "${childText || ''}"`,
    `Partner replied: "${partnerText || ''}"`
  ].join('\n')
}
