const SCREENS = new Set([
  'who',
  'setup',
  'home',
  'play',
  'guess',
  'stickers',
  'friends',
  'parent',
  'adultHome',
  'adultLibrary',
  'kidLibrary',
  'lesson',
  'toeicStats',
  'toeicPractice',
  'adultMemory',
  'train',
  'cloudSettingsKid',
  'cloudSettingsAdult'
])
const ADULT = new Set([
  'adultHome',
  'adultLibrary',
  'toeicStats',
  'toeicPractice',
  'adultMemory',
  'train',
  'cloudSettingsAdult'
])
export function readRoute(hash = globalThis.location?.hash || '') {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  if (!SCREENS.has(path)) return null
  const params = new URLSearchParams(query),
    id = params.get('lesson'),
    audience = params.get('audience')
  if (
    path === 'lesson' &&
    (!id ||
      !/^[a-z0-9:.-]{1,160}$/i.test(id) ||
      !['kid', 'adult'].includes(audience))
  )
    return null
  return {
    screen: path,
    lesson: path === 'lesson' ? { id, audience } : null,
    kind: params.get('kind') || null
  }
}
export function routeIsAdult(route) {
  return Boolean(
    route &&
      (ADULT.has(route.screen) ||
        (route.screen === 'lesson' && route.lesson?.audience === 'adult'))
  )
}
export function routeHash(route) {
  if (!route || !SCREENS.has(route.screen)) return null
  const params = new URLSearchParams()
  if (route.screen === 'lesson' && route.lesson) {
    params.set('lesson', route.lesson.id)
    params.set('audience', route.lesson.audience)
  }
  if (route.kind) params.set('kind', route.kind)
  return `#/${route.screen}${params.size ? '?' + params.toString() : ''}`
}
