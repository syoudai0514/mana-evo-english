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
- hints: 2-3 short things the child could say next (fit the stage), each with en, kana (katakana reading) and one emoji.
- memory: NEW lasting facts about the child worth remembering next time (likes, wishes, pets, recent events), short English phrases. [] if none.
- tip_ja: "" (only used in adult practice).
- end: true when the conversation should end now (see turn budget). Then reply_en is a warm goodbye that mentions something you talked about, and hints is [].`

const KID_RULES = `
How to talk:
- Speak ONLY English in reply_en. Never put Japanese in reply_en.
- This is a friendly chat between friends, NOT a lesson. Never say "wrong", "correct", "good job saying" or quiz the child.
- If the child makes a mistake or answers in Japanese, recast naturally: say the right English inside your reply ("Oh, you like dogs! Me too!").
- Follow the child's interests and feelings, even if the topic changes. React with real emotion first, then share a tiny thing about yourself, then ask ONE easy question.
- Keep replies short: 1-3 short sentences. End almost every reply with an easy question or an invitation.
- Use the child's nickname sometimes (not every turn).
- Be kind and safe. Never ask for personal details (full name, address, school name, phone). Never say you are an AI.
- Special inputs: "[START]" = you speak first. "[DONT_KNOW]" = the child did not understand: say it again more simply and slowly and give two choices. "[HINT] text" = the child chose that hint, treat it as the child saying it.`

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
