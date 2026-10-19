// TOEIC の問題の確かめと、声の答えの読みとり
import { QUESTION_BANK, TOEIC_PARTS, TOEIC_SKILLS } from '../data/adult.js'
import { compareShadow } from './adult.js'

// 作ってもらった問題が使えるか
export function validQuestion(item) {
  if (!item || !TOEIC_PARTS[item.part] || !Array.isArray(item.choices)) return false
  const choices = item.choices.map((choice) => String(choice || '').trim())
  if (choices.length < 3 || choices.length > 4 || choices.some((choice) => !choice)) return false
  if (TOEIC_SKILLS[item.skill] && TOEIC_SKILLS[item.skill].part !== item.part) return false
  if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= choices.length) return false
  if ((item.part === 'p2' || item.part === 'p3') && !String(item.audio_en || '').trim()) return false
  if (item.part !== 'p2' && !String(item.question_en || '').trim()) return false
  return true
}

// 足りない分は予備の問題から（同じ分野 → 同じパート → なんでも）
// 選択肢の空白を取りのぞいた形にそろえる（画面と正解の番号がずれないように）
function cleanQuestion(item) {
  return { ...item, choices: item.choices.map((choice) => String(choice || '').trim()) }
}

export function fillQuestions(skills, made, bank = QUESTION_BANK) {
  const used = new Set()
  const pool = (made || []).filter(validQuestion).map(cleanQuestion)
  return skills.map((skill) => {
    const part = TOEIC_SKILLS[skill]?.part
    const take = (list, prefix, test) => list.find((item, i) => !used.has(`${prefix}${i}`) && test(item) && used.add(`${prefix}${i}`))
    return take(pool, 'm', (item) => item.skill === skill) || take(pool, 'm', (item) => item.part === part) ||
      take(bank, 'b', (item) => item.skill === skill) || take(bank, 'b', (item) => item.part === part) || take(bank, 'b', () => true)
  }).filter(Boolean)
}

// 声の答え（「B」「ビー」や選択肢そのもの）→ 何番目か
export function parseChoice(text, choices) {
  const said = String(text || '').trim().toLowerCase()
  if (!said) return -1
  const letters = [/^(a|ay|eh|エー|エイ|えー)[.!。]?$/, /^(b|bee|be|ビー|びー)[.!。]?$/, /^(c|see|sea|she|シー|しー)[.!。]?$/, /^(d|dee|the|ディー|でぃー)[.!。]?$/]
  const hit = letters.findIndex((pattern) => pattern.test(said))
  if (hit >= 0 && hit < choices.length) return hit
  let best = -1
  let bestScore = 49
  choices.forEach((choice, i) => {
    const { score } = compareShadow(choice, said)
    if (score > bestScore) { best = i; bestScore = score }
  })
  return best
}
