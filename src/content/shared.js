export const CONTENT_VERSION = 1
export const LEVELS = ['A1', 'A2', 'B1']
export const RIGHTS = { type: 'original', author: 'mana-evo-english', license: 'Project original learning materials' }
export const REVIEW = { status: 'draft', checks: ['schema', 'references'], pending: ['independent language review', 'listening review'] }
export function metadata(id, kind, title, level = 'A1', estimatedMinutes = 4) {
  return { id, version: CONTENT_VERSION, kind, title: typeof title === 'string' ? { ja: title, en: title } : title, level, estimatedMinutes, rights: RIGHTS, review: REVIEW, prerequisites: [] }
}
export function line(en, ja, extra = {}) { return { en, ja, ...extra } }
export function stableShuffle(items, seed) {
  let value = [...String(seed)].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 7)
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; const j = value % (i + 1); [copy[i], copy[j]] = [copy[j], copy[i]] }
  return copy
}
