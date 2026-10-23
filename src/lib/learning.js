import { todayKey } from './state.js'
export const LEARNING_KEY = 'mee-learning-v1'
export const EMPTY_LEARNER = {
  completed: {},
  drafts: {},
  reports: [],
  lastLesson: null
}
export function initialLearning() {
  return { version: 1, learners: {} }
}
export function loadLearning(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(LEARNING_KEY) || 'null')
    return saved?.version === 1 &&
      saved.learners &&
      typeof saved.learners === 'object'
      ? saved
      : initialLearning()
  } catch {
    return initialLearning()
  }
}
export function saveLearning(store, storage = globalThis.localStorage) {
  try {
    if (!storage) return false
    storage.setItem(LEARNING_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}
export function learnerKey({ adult, profile }) {
  return adult
    ? `adult:${adult.id}`
    : `kid:${profile?.createdAt || profile?.nickname || 'local'}`
}
export function learnerProgress(store, key) {
  return { ...EMPTY_LEARNER, ...store.learners[key] }
}
export function patchLearner(store, key, fn) {
  return {
    ...store,
    learners: { ...store.learners, [key]: fn(learnerProgress(store, key)) }
  }
}
export function saveLessonDraft(store, key, id, draft) {
  return patchLearner(store, key, (p) => ({
    ...p,
    lastLesson: id,
    drafts: {
      ...p.drafts,
      [id]: { ...draft, updatedAt: new Date().toISOString() }
    }
  }))
}
export function completeLesson(store, key, item, result, date = new Date()) {
  return patchLearner(store, key, (p) => {
    const drafts = { ...p.drafts }
    delete drafts[item.id]
    const before = p.completed[item.id]
    return {
      ...p,
      lastLesson: item.id,
      drafts,
      completed: {
        ...p.completed,
        [item.id]: {
          id: item.id,
          version: item.version,
          attempts: (before?.attempts || 0) + 1,
          completedAt: date.toISOString(),
          day: todayKey(date),
          result
        }
      }
    }
  })
}
export function reportContent(store, key, id, note) {
  return patchLearner(store, key, (p) => ({
    ...p,
    reports: [
      ...p.reports,
      { id, note: String(note).slice(0, 500), date: new Date().toISOString() }
    ].slice(-100)
  }))
}
export function learningDays(store, key) {
  return Object.values(learnerProgress(store, key).completed).map(
    (item) => item.day
  )
}
export function importedCards(
  adult,
  items,
  { limit = 5, now = Date.now() } = {}
) {
  const normalized = new Set(adult.cards.map((c) => c.en.trim().toLowerCase()))
  const add = []
  for (const item of items) {
    if (add.length >= Math.min(limit, Math.max(0, 400 - adult.cards.length)))
      break
    if (normalized.has(item.en.trim().toLowerCase())) continue
    normalized.add(item.en.trim().toLowerCase())
    add.push({
      id: `pack:${item.id}`,
      en: item.en,
      ja: item.ja,
      source: 'foundation',
      sourceLessonId: item.sourceLessonId,
      from: item.categoryLabel || '基礎パック',
      created: new Date(now).toISOString(),
      due: now,
      interval: 0,
      reps: 0,
      lapses: 0
    })
  }
  return { ...adult, cards: [...adult.cards, ...add] }
}
