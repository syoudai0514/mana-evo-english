// 大人モードの状態。子どもの状態とは別に保存する（大人の記憶は子ども側に出さない）。
// 関数はすべて「前の状態 → 新しい状態」の純粋関数にして、テストしやすくしている。

import { TOEIC_PARTS, TOEIC_SKILLS } from '../data/adult.js'
import { normalizePhrase, todayKey } from './state.js'

export const ADULT_KEY = 'mee-adult-v1'

const LIMITS = { memory: 60, cards: 400, answers: 300, sessions: 15, shadows: 100 }
const DAY = 86400000

export function initialAdultStore() {
  return { version: 1, current: null, adults: {}, order: [], pinRequired: true }
}

export function newAdult({ name = 'パパ', emoji = '🧔', target = 730 } = {}, date = new Date()) {
  return {
    id: `a${date.getTime().toString(36)}`,
    name,
    emoji,
    target,
    partner: 'alex',
    createdAt: date.toISOString(),
    memory: [], // { id, fact, cat, date }
    cards: [], // 復習カード { id, en, ja, from, created, due, interval, reps, lapses }
    answers: [], // TOEIC の解答 { part, skill, correct, date }
    diagnosed: false,
    sessions: [],
    shadows: [], // { score, date }
    streak: { last: null, count: 0 }
  }
}

export function loadAdultStore(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(ADULT_KEY)
    if (!raw) return initialAdultStore()
    const store = { ...initialAdultStore(), ...JSON.parse(raw) }
    // 古い保存データに、あとから増えた項目を足す（読みこみで落ちないように）
    const adults = {}
    for (const [id, saved] of Object.entries(store.adults || {})) adults[id] = { ...newAdult({}), ...saved, id }
    return { ...store, adults, order: (store.order || []).filter((id) => adults[id]) }
  } catch {
    return initialAdultStore()
  }
}

// 保存できたら true。いっぱいなら古い会話の記録を減らしてもう一度ためす
export function saveAdultStore(store, storage = globalThis.localStorage) {
  try { storage?.setItem(ADULT_KEY, JSON.stringify(store)); return true } catch {}
  try {
    const adults = {}
    for (const [id, adult] of Object.entries(store.adults)) adults[id] = { ...adult, sessions: adult.sessions.slice(-3), answers: adult.answers.slice(-100) }
    storage?.setItem(ADULT_KEY, JSON.stringify({ ...store, adults }))
    return true
  } catch {
    return false
  }
}

export function withAdult(store, adult) {
  const order = store.order.includes(adult.id) ? store.order : [...store.order, adult.id]
  return { ...store, adults: { ...store.adults, [adult.id]: adult }, order }
}

export function updateAdult(store, id, fn) {
  const adult = store.adults[id]
  return adult ? { ...store, adults: { ...store.adults, [id]: fn(adult) } } : store
}

export function withoutAdult(store, id) {
  const adults = { ...store.adults }
  delete adults[id]
  return { ...store, adults, order: store.order.filter((item) => item !== id), current: store.current === id ? null : store.current }
}

// ---------- 記憶 ----------

// "work: the release was pushed back" → { cat: 'work', fact: 'the release was pushed back' }
export function parseMemory(text) {
  const match = /^\s*(work|family|hobby|feeling|other)\s*[:：]\s*(.+)$/i.exec(String(text || ''))
  if (match) return { cat: match[1].toLowerCase(), fact: match[2].trim() }
  return { cat: 'other', fact: String(text || '').trim() }
}

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'is', 'was', 'are', 'were', 'be', 'been', 'his', 'her', 'their', 'my', 'in', 'on', 'at', 'for', 'with', 'still', 'again', 'now'])
function factWords(fact) {
  return new Set(normalizePhrase(fact).split(' ').filter((word) => word && !STOP.has(word)))
}

// ほぼ同じ話（言いかえ）か：同じ分類で、大事なことばの半分以上が重なる
export function sameFact(a, b) {
  if (a.cat !== b.cat) return false
  const x = factWords(a.fact)
  const y = factWords(b.fact)
  if (!x.size || !y.size) return a.fact.toLowerCase() === b.fact.toLowerCase()
  let shared = 0
  for (const word of x) if (y.has(word)) shared += 1
  return shared / Math.min(x.size, y.size) >= 0.6
}

export function withAdultMemory(adult, items, date = new Date()) {
  let memory = adult.memory
  let added = 0
  for (const raw of items || []) {
    const { cat, fact } = parseMemory(raw)
    if (!fact || fact.length > 160) continue
    const item = { cat, fact }
    if (memory.some((old) => old.fact.toLowerCase() === fact.toLowerCase())) continue
    // 同じ話の続き（言いかえ・近況）は、古いほうを新しい内容に置きかえる（記憶が同じ話で埋まらないように）
    memory = memory.filter((old) => !sameFact(old, item))
    memory = [...memory, { id: `m${date.getTime().toString(36)}${added}${Math.random().toString(36).slice(2, 6)}`, fact, cat, date: todayKey(date) }]
    added += 1
  }
  if (!added) return adult
  return { ...adult, memory: memory.slice(-LIMITS.memory) }
}

export function withoutMemory(adult, id) {
  return { ...adult, memory: adult.memory.filter((item) => item.id !== id) }
}

// 会話に渡す記憶：新しいものを中心に、昔のものも少し
export function memoryForTalk(adult, random = Math.random) {
  const items = adult.memory
  if (items.length <= 10) return items
  const recent = items.slice(-8)
  const older = items.slice(0, -8)
  const picks = []
  while (picks.length < 2 && older.length) picks.push(older.splice(Math.floor(random() * older.length), 1)[0])
  return [...picks, ...recent]
}

// ホームで Alex が話しかけるひとこと
export function greetingFor(adult, date = new Date()) {
  const last = adult.memory[adult.memory.length - 1]
  const hour = date.getHours()
  const hello = hour < 11 ? 'Morning!' : hour < 18 ? 'Hey!' : 'Evening!'
  if (!last) return { en: `${hello} Nice to meet you. I'm Alex, from London. Tell me a bit about your day?`, ja: 'はじめまして。ロンドン出身のアレックスだよ。きょうはどんな一日だった？' }
  return { en: `${hello} Last time you told me ${last.fact}. How's that going?`, ja: `前回「${last.fact}」って話してたよね。その後どう？`, fact: last }
}

// ---------- 復習カード（忘れかけたころに出す） ----------

export function withCards(adult, phrases, from = '', date = new Date()) {
  const known = new Set(adult.cards.map((card) => normalizePhrase(card.en)))
  const fresh = []
  for (const phrase of phrases || []) {
    const en = String(phrase?.en || '').trim()
    const ja = String(phrase?.ja || '').trim()
    const key = normalizePhrase(en)
    if (!en || !ja || !key || en.length > 140 || known.has(key)) continue
    known.add(key)
    fresh.push({ id: `c${date.getTime().toString(36)}${fresh.length}${Math.random().toString(36).slice(2, 6)}`, en, ja, from, created: date.toISOString(), due: date.getTime(), interval: 0, reps: 0, lapses: 0 })
  }
  if (!fresh.length) return adult
  return { ...adult, cards: [...adult.cards, ...fresh].slice(-LIMITS.cards) }
}

// grade: 'again'（わからない）/ 'hard'（あやしい）/ 'good'（言えた）
export function scheduleCard(card, grade, now = Date.now()) {
  // 期限前に練習しただけなら、間隔はのばさない（同じ日に何度も「言えた」で1か月先に飛ばないように）
  if (grade !== 'again' && card.reps > 0 && card.due > now) return { ...card, reps: card.reps + 1 }
  if (grade === 'again') return { ...card, interval: 0, due: now + 10 * 60000, lapses: card.lapses + 1, reps: card.reps + 1 }
  if (grade === 'hard') {
    const interval = Math.max(card.interval + 1, Math.round(card.interval * 1.2))
    return { ...card, interval, due: now + interval * DAY, reps: card.reps + 1 }
  }
  const interval = card.interval ? Math.round(card.interval * 2.5) : 4
  return { ...card, interval, due: now + interval * DAY, reps: card.reps + 1 }
}

export function withGrade(adult, cardId, grade, now = Date.now()) {
  return { ...adult, cards: adult.cards.map((card) => (card.id === cardId ? scheduleCard(card, grade, now) : card)) }
}

export function dueCards(adult, now = Date.now(), limit = 12) {
  return adult.cards.filter((card) => card.due <= now).sort((a, b) => a.due - b.due).slice(0, limit)
}

export function nextLabel(card, grade, now = Date.now()) {
  const next = scheduleCard(card, grade, now)
  if (next.interval === 0) return '10分後'
  return next.interval === 1 ? 'あした' : `${next.interval}日後`
}

export function withoutCard(adult, id) {
  return { ...adult, cards: adult.cards.filter((card) => card.id !== id) }
}

// ---------- TOEIC ----------

export function withAnswers(adult, answers, date = new Date()) {
  const rows = answers.map((item) => ({ part: item.part, skill: item.skill, correct: Boolean(item.correct), date: date.toISOString() }))
  return { ...adult, answers: [...adult.answers, ...rows].slice(-LIMITS.answers) }
}

// パートごとの正答率（直近の解答を重く見る）
export function partStats(adult) {
  const stats = {}
  for (const part of Object.keys(TOEIC_PARTS)) {
    const rows = adult.answers.filter((item) => item.part === part).slice(-30)
    stats[part] = { total: rows.length, rate: rows.length ? rows.filter((item) => item.correct).length / rows.length : null }
  }
  return stats
}

// 予想スコア（めやす）。L は Part 2・3、R は Part 5・語彙 の正答率から出す。解答が少ないうちは出さない
export function predictScore(adult) {
  const stats = partStats(adult)
  const answered = adult.answers.length
  if (answered < 8) return null
  const rate = (part, fallback) => (stats[part].rate ?? fallback)
  const overall = adult.answers.filter((item) => item.correct).length / answered
  // Part 4 は電車モードでといた分だけ（まだなければ数えない）
  const listening = stats.p4.rate === null ? (rate('p2', overall) + rate('p3', overall)) / 2 : (rate('p2', overall) + rate('p3', overall) + stats.p4.rate) / 3
  const reading = (rate('p5', overall) + rate('vocab', overall)) / 2
  const section = (value) => 5 + Math.round((490 * Math.min(1, Math.max(0, (value - 0.2) / 0.75))) / 5) * 5
  return Math.min(990, section(listening) + section(reading))
}

// 苦手トップ3（2問以上といた分野のうち、正答率が低い順）
export function weakSkills(adult, count = 3) {
  const rows = {}
  for (const item of adult.answers.slice(-120)) {
    rows[item.skill] = rows[item.skill] || { skill: item.skill, total: 0, correct: 0 }
    rows[item.skill].total += 1
    if (item.correct) rows[item.skill].correct += 1
  }
  return Object.values(rows)
    .filter((row) => row.total >= 2 && row.correct / row.total < 0.8 && TOEIC_SKILLS[row.skill])
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total)
    .slice(0, count)
    .map((row) => ({ ...row, rate: row.correct / row.total, ja: TOEIC_SKILLS[row.skill].ja }))
}

// 苦手つぶしで出す分野（苦手から順に、足りなければ広く）
export function practiceSkills(adult, count = 4) {
  // Part 4 は電車モードで聞く。苦手つぶし（画面でとく問題）には出さない
  const weak = weakSkills(adult, count + 1).map((row) => row.skill).filter((skill) => TOEIC_SKILLS[skill].part !== 'p4').slice(0, count)
  const all = Object.keys(TOEIC_SKILLS).filter((skill) => TOEIC_SKILLS[skill].part !== 'p4')
  const rest = all.filter((skill) => !weak.includes(skill))
  const picks = [...weak]
  let i = adult.answers.length
  while (picks.length < count) picks.push(rest[(i += 3) % rest.length])
  return picks.slice(0, count)
}

// 先週の予想スコア（7日以上前までの解答で計算）
export function lastWeekScore(adult, now = Date.now()) {
  const before = adult.answers.filter((item) => new Date(item.date).getTime() < now - 7 * DAY)
  return predictScore({ ...adult, answers: before })
}

// ---------- シャドーイング ----------

function words(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)
}

// お手本の単語ごとに、言えたか（文字起こしに出てきたか）を順番どおりに調べる
export function compareShadow(target, said) {
  const heard = words(said)
  const tokens = String(target || '').split(/(\s+)/)
  let cursor = 0
  let hit = 0
  let total = 0
  const marks = tokens.map((token) => {
    const word = words(token)[0]
    if (!word) return { text: token, ok: null }
    total += 1
    const found = heard.indexOf(word, cursor)
    const near = found >= 0 && found - cursor <= 3
    if (near) { cursor = found + 1; hit += 1 }
    return { text: token, ok: near, word }
  })
  return { marks, score: total ? Math.round((hit / total) * 100) : 0, missed: marks.filter((mark) => mark.ok === false).map((mark) => mark.word) }
}

export function withShadow(adult, score, date = new Date()) {
  return { ...adult, shadows: [...adult.shadows, { score, date: date.toISOString() }].slice(-LIMITS.shadows) }
}

// シャドーイングする文：最近の会話で相棒が言った文（短めのもの）と、復習カード
export function shadowSentences(adult, count = 3) {
  const lines = []
  for (const session of [...adult.sessions].reverse()) {
    for (const turn of session.turns || []) {
      if (turn.who !== 'partner' || !turn.text) continue
      for (const sentence of turn.text.split(/(?<=[.!?])\s+/)) {
        const n = words(sentence).length
        if (n >= 5 && n <= 14) lines.push({ en: sentence.trim(), ja: '' })
      }
    }
    if (lines.length >= 12) break
  }
  for (const card of adult.cards.slice(-10)) if (words(card.en).length >= 3) lines.push({ en: card.en, ja: card.ja })
  const seen = new Set()
  return lines.filter((line) => !seen.has(line.en) && seen.add(line.en)).slice(0, count)
}

// ---------- 会話の記録・つづけた日数 ----------

export function withAdultSession(adult, session, date = new Date()) {
  // 保存するのは、あとで使う分だけ（シャドーイング・電車モードの文）。全部ためると端末の保存がいっぱいになる
  const record = {
    mode: session.mode, title: session.title, startedAt: session.startedAt, endedAt: date.toISOString(),
    turns: (session.turns || []).slice(-40).map((turn) => ({ who: turn.who, text: turn.text }))
  }
  const today = todayKey(date)
  const { last, count } = adult.streak
  const yesterday = todayKey(new Date(date.getTime() - DAY))
  const streak = last === today ? adult.streak : { last: today, count: last === yesterday ? count + 1 : 1 }
  return { ...adult, sessions: [...adult.sessions, record].slice(-LIMITS.sessions), streak }
}

export function adultStreak(adult, date = new Date()) {
  const { last, count } = adult.streak
  if (!last) return 0
  const yesterday = todayKey(new Date(date.getTime() - DAY))
  return last === todayKey(date) || last === yesterday ? count : 0
}

// 1日の学習（つづけた日数）だけ記録する（復習やシャドーイングだけの日も数える）
export function withStudyDay(adult, date = new Date()) {
  const today = todayKey(date)
  const { last, count } = adult.streak
  if (last === today) return adult
  const yesterday = todayKey(new Date(date.getTime() - DAY))
  return { ...adult, streak: { last: today, count: last === yesterday ? count + 1 : 1 } }
}

// ---------- きょうのメニュー ----------

// short：時間がない日の「5分だけ」
export function todayPlan(adult, { now = Date.now(), short = false } = {}) {
  const due = dueCards(adult, now, short ? 6 : 12).length
  const steps = []
  if (due) steps.push({ id: 'review', count: due, minutes: short ? 2 : 3 })
  if (!short && shadowSentences(adult).length >= 2) steps.push({ id: 'shadow', count: 3, minutes: 3 })
  steps.push({ id: 'chat', minutes: short ? 3 : 6 })
  if (!short) steps.push({ id: adult.diagnosed ? 'toeic' : 'diagnosis', count: adult.diagnosed ? 4 : 10, minutes: adult.diagnosed ? 3 : 6 })
  return steps
}
