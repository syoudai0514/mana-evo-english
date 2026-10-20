// 子どもの段階。会話のふるまい（文の長さ、日本語への対応、読みの補助）を決める。

export const LEVELS = [
  {
    level: 1,
    label: '聞く',
    kidLabel: 'きく',
    prompt:
      'Stage 1 (listening). The child knows almost no English. Each reply = a 1-3 word reaction + ONE yes/no question or "A or B?" question ' +
      'that names both choices (e.g. "Wow! Dog or cat?"). Use only words a 3-year-old native child knows. Say the key word twice ' +
      '("A pumpkin! A big pumpkin!"). No idioms, no past tense, no "if". Speak slowly with little pauses. Celebrate any answer, even just "yes".',
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
      'Stage 2 (choosing). Each reply = a short reaction (recast the child\'s word into a tiny sentence) + ONE easy question. ' +
      'Mostly "A or B?" and "Do you like ___?" questions, sentences of up to 8 words, very common words only. Say the key word twice.',
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
      '("What do you like?", "What color is it?"). React, share one tiny thing about yourself, then ask ONE question. ' +
      'Recast one-word answers into sentences naturally. Never ask the child to repeat after you.',
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

// 直近の子どもの発話から、上がってよい段階を返す。
// utterances: [{ english, words, day, hint?, dk? }]（hint＝ヒントをタップしただけ、dk＝「わからない」）
// 自分の声で言えたものだけで判断し、3日以上つづけて同じくらい言えてから上げる（1回の会話だけで上がらない）
export function suggestLevel(current, utterances) {
  const recent = utterances.filter((item) => !item.hint).slice(-20)
  const days = new Set(recent.map((item) => item.day).filter(Boolean)).size
  if (recent.length < 12 || days < 3) return current
  const english = recent.filter((item) => item.english && !item.dk)
  const englishRate = english.length / recent.length
  const dontKnowRate = recent.filter((item) => item.dk).length / recent.length
  const avgWords = english.length ? english.reduce((sum, item) => sum + item.words, 0) / english.length : 0
  let next = 1
  if (englishRate >= 0.3) next = 2
  if (englishRate >= 0.5 && avgWords >= 1.5 && dontKnowRate < 0.2) next = 3
  if (englishRate >= 0.7 && avgWords >= 3 && dontKnowRate < 0.1) next = 4
  // 段階5（全部英語）は会話が大きく変わるので、自動では上げず保護者が決める。上げるのは1回に1つだけ
  return Math.max(current, Math.min(next, current + 1, 4))
}

// むずかしすぎるサイン：直近8回のうち6回以上が日本語か「わからない」なら、1つ下げてよい
export function tooHard(utterances) {
  const recent = utterances.filter((item) => !item.hint).slice(-8)
  if (recent.length < 8) return false
  return recent.filter((item) => !item.english || item.dk).length >= 6
}

// 1回の会話で、子どもが何回くらい話したら終わりにするか（5歳の集中力に合わせて、はじめは短く）
export function kidTurnLimit(level) {
  return level <= 1 ? 6 : level === 2 ? 8 : 10
}

export const WORLD_UNLOCK_LEVEL = 4
