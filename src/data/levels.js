// 子どもの段階。会話のふるまい（文の長さ、日本語への対応、読みの補助）を決める。

export const LEVELS = [
  {
    level: 1,
    label: '聞く',
    kidLabel: 'きく',
    prompt:
      'Stage 1 (listening). Use 3-6 word sentences with very common words. Ask yes/no questions or "A or B?" questions. ' +
      'Repeat key words. Celebrate any answer, even a nod-like "yes". Speak slowly.',
    japanese: 'understand',
    reading: 'show',
    speechRate: 0.78,
    maxWords: 10
  },
  {
    level: 2,
    label: '選ぶ',
    kidLabel: 'えらぶ',
    prompt:
      'Stage 2 (choosing). Use short sentences (up to 8 words). Mostly "A or B?" questions and simple "Do you like...?" questions. ' +
      'When the child answers with one word, recast it into a full short sentence.',
    japanese: 'understand',
    reading: 'show',
    speechRate: 0.82,
    maxWords: 12
  },
  {
    level: 3,
    label: '単語',
    kidLabel: 'たんご',
    prompt:
      'Stage 3 (single words). Use short natural sentences (up to 10 words). Mix choice questions with easy open questions ' +
      '("What do you like?", "What color is it?"). Recast one-word answers into sentences naturally. Never ask the child to repeat after you.',
    japanese: 'understand',
    reading: 'hidden',
    speechRate: 0.86,
    maxWords: 16
  },
  {
    level: 4,
    label: '型で文',
    kidLabel: 'かたで ぶん',
    prompt:
      'Stage 4 (patterns). Use natural sentences (up to 14 words). Ask open questions that invite patterns like ' +
      '"I like ___", "I want ___", "I went to ___", "Can I ___?". Add small follow-up questions ("Why?", "What else?").',
    japanese: 'understand',
    reading: 'hidden',
    speechRate: 0.9,
    maxWords: 22
  },
  {
    level: 5,
    label: '自由に',
    kidLabel: 'じゆうに',
    prompt:
      'Stage 5 (free talk, about Eiken grade 3). Talk naturally like a friendly native speaker to a child, with normal sentence ' +
      'length. Ask open questions, share opinions, use a little natural slang ("Cool!", "No way!").',
    japanese: 'english-only',
    reading: 'ipa',
    speechRate: 0.95,
    maxWords: 35
  }
]

export function levelOf(level) {
  return LEVELS.find((item) => item.level === level) || LEVELS[0]
}

// 直近の子どもの発話から、上がってよい段階を返す。下げるのは保護者だけ。
// utterances: [{ english: boolean, words: number }]
export function suggestLevel(current, utterances) {
  const recent = utterances.slice(-20)
  if (recent.length < 12) return current
  const englishRate = recent.filter((item) => item.english).length / recent.length
  const english = recent.filter((item) => item.english)
  const avgWords = english.length ? english.reduce((sum, item) => sum + item.words, 0) / english.length : 0
  let next = 1
  if (englishRate >= 0.3) next = 2
  if (englishRate >= 0.5 && avgWords >= 1.5) next = 3
  if (englishRate >= 0.7 && avgWords >= 3) next = 4
  // 段階5（全部英語）は会話が大きく変わるので、自動では上げず保護者が決める
  return Math.max(current, Math.min(next, 4))
}

export const WORLD_UNLOCK_LEVEL = 4
