// アプリの状態。端末内（localStorage）に保存する。
// 関数はすべて「前の状態 → 新しい状態」の純粋関数にして、テストしやすくしている。

import { suggestLevel, tooHard } from '../data/levels.js'
import { LETTER_ORDER, letterOf } from '../data/letters.js'

export const STATE_KEY = 'mee-state-v1'
export const PIN_KEY = 'mee-parent-pin-v1'

const LIMITS = { memory: 40, utterances: 80, sessions: 60, recentTopics: 6 }

export const STICKERS = [
  '🌟', '🌈', '🍩', '🦄', '🐳', '🚀', '🍓', '🦖', '🎈', '🍦', '🐼', '⚽', '🌻', '🐙', '🍉', '🎸',
  '🦋', '🍪', '🚂', '🐧', '🌙', '🎁', '🐸', '🍕', '🦁', '🧁', '🏰', '🐬', '🌵', '🎃'
]

export function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function initialState() {
  return {
    version: 1,
    profile: null, // { nickname, partner, createdAt }
    level: 1,
    reading: 'hira',
    friendship: { howamy: 0, niji: 0 },
    stickers: [],
    streak: { last: null, count: 0 },
    memory: [],
    utterances: [],
    phrasesSaid: {},
    sessions: [],
    recentTopics: [],
    model: { date: null, startIndex: 0, done: false }
  }
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(STATE_KEY)
    if (!raw) return initialState()
    return { ...initialState(), ...JSON.parse(raw) }
  } catch {
    return initialState()
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  try { storage?.setItem(STATE_KEY, JSON.stringify(state)) } catch {}
}

export function normalizePhrase(text) {
  return String(text || '').toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function countWords(text) {
  const normalized = normalizePhrase(text)
  return normalized ? normalized.split(' ').length : 0
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)
}

export function withStreak(state, date = new Date()) {
  const today = todayKey(date)
  const { last, count } = state.streak
  if (last === today) return state
  const next = last && daysBetween(last, today) === 1 ? count + 1 : 1
  return { ...state, streak: { last: today, count: next } }
}

export function streakCount(state, date = new Date()) {
  const { last, count } = state.streak
  if (!last) return 0
  return daysBetween(last, todayKey(date)) <= 1 ? count : 0
}

export function friendshipView(points) {
  return { rank: Math.floor(points / 5) + 1, hearts: points % 5 }
}

// 子どもの1回の発話を記録する（段階の自動判定用）。hint＝ヒントをタップしただけ、dk＝「わからない」
export function withUtterance(state, { english, text, hint = false, dk = false }, date = new Date()) {
  const entry = { english: Boolean(english) && !dk, words: english ? countWords(text) : 0, day: todayKey(date), ...(hint ? { hint: true } : {}), ...(dk ? { dk: true } : {}) }
  const utterances = [...state.utterances, entry].slice(-LIMITS.utterances)
  let level = suggestLevel(state.level, utterances)
  let levelDownAt = state.levelDownAt || null
  // むずかしすぎるときは1つ下げる（下げるのは1週間に1回まで。保護者画面に出す）
  const weekPassed = !levelDownAt || (date - new Date(levelDownAt)) > 7 * 86400000
  if (level === state.level && level > 1 && level <= 4 && tooHard(utterances) && weekPassed) {
    level -= 1
    levelDownAt = date.toISOString()
  }
  return { ...state, utterances, level, levelDownAt }
}

export function withMemory(state, facts, partner, date = new Date()) {
  const known = new Set(state.memory.map((item) => item.fact.toLowerCase()))
  const fresh = (facts || [])
    .map((fact) => String(fact).trim())
    .filter((fact) => {
      const key = fact.toLowerCase()
      if (!fact || fact.length > 120 || known.has(key)) return false
      known.add(key)
      return true
    })
    .map((fact) => ({ fact, partner, date: todayKey(date) }))
  if (!fresh.length) return state
  return { ...state, memory: [...state.memory, ...fresh].slice(-LIMITS.memory) }
}

// 会話をひとつ終えたときの記録。言えた英語・はじめて言えた表現・シール・なかよし度を更新する
export function withSessionEnd(state, session, { date = new Date(), random = Math.random } = {}) {
  const childTurns = session.turns.filter((turn) => turn.who === 'child')
  // ヒントをタップしただけのものは「言えた」に数えない
  const said = childTurns.filter((turn) => turn.english && turn.text && !turn.hint).map((turn) => turn.text)
  const phrasesSaid = { ...state.phrasesSaid }
  const newPhrases = []
  for (const text of said) {
    const key = normalizePhrase(text)
    if (!key) continue
    if (!phrasesSaid[key]) newPhrases.push(text)
    phrasesSaid[key] = (phrasesSaid[key] || 0) + 1
  }

  const completed = childTurns.length >= 3
  const today = todayKey(date)
  // シールは1日1まい（たくさん短く話してシールを集める「点数かせぎ」にしない）
  const stickerToday = state.stickers.some((item) => item.date === today)
  let stickers = state.stickers
  let sticker = null
  if (completed && !stickerToday) {
    const owned = new Set(stickers.map((item) => item.emoji))
    const pool = STICKERS.filter((emoji) => !owned.has(emoji))
    const emoji = (pool.length ? pool : STICKERS)[Math.floor(random() * (pool.length || STICKERS.length))]
    sticker = { emoji, date: todayKey(date), partner: session.partner }
    stickers = [...stickers, sticker]
  }

  const friendship = { ...state.friendship }
  if (completed && session.partner in friendship) friendship[session.partner] += 1

  const record = { ...session, endedAt: date.toISOString(), said, newPhrases, sticker }
  const sessions = [...state.sessions, record].slice(-LIMITS.sessions)
  const recentTopics = session.topicId ? [...state.recentTopics, session.topicId].slice(-LIMITS.recentTopics) : state.recentTopics

  // おはなしした日の数（つづけた日数が切れても、へらない数）
  const talkedToday = state.sessions.some((item) => item.endedAt && todayKey(new Date(item.endedAt)) === today && item.mode !== 'adult')
  const daysTalked = (state.daysTalked || 0) + (childTurns.length && !talkedToday ? 1 : 0)
  // 会話でも「きょうの もじ」にふれるので、話したら聞いたことにする
  const base = childTurns.length ? withLetterPlayed(state, date) : state
  return {
    state: withStreak({ ...base, phrasesSaid, stickers, friendship, sessions, recentTopics, daysTalked }, date),
    record: { ...record, stickerToday: stickerToday && completed },
    completed
  }
}

// モデルの切り替え状態（日付が変わったらメインのモデルに戻す）
export function modelToday(state, date = new Date()) {
  const today = todayKey(date)
  if (state.model?.date !== today) return { date: today, startIndex: 0, done: false }
  return state.model
}

export function withModelResult(state, { modelIndex, exhausted }, date = new Date()) {
  const current = modelToday(state, date)
  const model = exhausted
    ? { ...current, done: true }
    : { ...current, startIndex: Math.max(current.startIndex, modelIndex || 0) }
  return { ...state, model }
}

// 保護者画面の集計
export function todaySummary(state, date = new Date()) {
  const today = todayKey(date)
  const sessions = state.sessions.filter((session) => session.endedAt && todayKey(new Date(session.endedAt)) === today && session.mode !== 'adult')
  let minutes = 0
  let childTurns = 0
  let englishTurns = 0
  let newPhrases = 0
  for (const session of sessions) {
    minutes += Math.max(0, (new Date(session.endedAt) - new Date(session.startedAt)) / 60000)
    const turns = session.turns.filter((turn) => turn.who === 'child')
    childTurns += turns.length
    englishTurns += turns.filter((turn) => turn.english).length
    newPhrases += session.newPhrases?.length || 0
  }
  return { sessions: sessions.length, minutes: Math.ceil(minutes), childTurns, englishTurns, newPhrases }
}

// ---------- きょうの もじ ----------
// 1日1文字。その日に聞いた（タップした・会話した）ら、次の日は次の文字へ。聞かなかった日は同じ文字のまま

export function letterToday(state, date = new Date()) {
  const today = todayKey(date)
  const saved = state.letter
  let index = 0
  if (saved && saved.day === today) index = saved.index
  else if (saved) index = saved.played ? (saved.index + 1) % LETTER_ORDER.length : saved.index
  return { index, item: letterOf(LETTER_ORDER[index]), day: today, played: Boolean(saved && saved.day === today && saved.played) }
}

// きょうの もじを聞いた（ABC アルバムに入る）
export function withLetterPlayed(state, date = new Date()) {
  const current = letterToday(state, date)
  const lettersSeen = { ...(state.lettersSeen || {}) }
  if (!current.played) lettersSeen[current.item.letter] = (lettersSeen[current.item.letter] || 0) + 1
  return { ...state, letter: { index: current.index, day: current.day, played: true }, lettersSeen }
}

