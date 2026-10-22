// Build injects a content-derived cache name. APIs and authentication are never cached.
const CACHE = 'mee-__BUILD_VERSION__'
const PREFIX = 'mee-'
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch('/precache.json', { cache: 'no-store' })
      if (!response.ok) throw new Error('precache unavailable')
      const manifest = await response.json()
      const cache = await caches.open(CACHE)
      await cache.addAll(manifest.files)
      await self.skipWaiting()
    })()
  )
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const all = (await caches.keys()).filter(
        (key) => key.startsWith(PREFIX) && key !== CACHE
      )
      for (const key of all.slice(0, -1)) await caches.delete(key)
      await self.clients.claim()
    })()
  )
})
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (
    url.origin !== location.origin &&
    url.hostname !== 'fonts.googleapis.com' &&
    url.hostname !== 'fonts.gstatic.com'
  )
    return
  if (
    url.origin === location.origin &&
    (url.pathname.startsWith('/api/') || url.pathname.includes('/auth/'))
  )
    return
  if (request.mode === 'navigate') {
    const network = fetch(request).then(async (response) => {
      if (response.ok && !response.redirected && response.type === 'basic') {
        const cache = await caches.open(CACHE)
        await cache.put('/', response.clone())
      }
      return response
    })
    const offline = caches.open(CACHE).then((cache) => cache.match('/'))
    event.respondWith(
      Promise.race([
        network.catch(() => offline),
        new Promise((resolve) => setTimeout(resolve, 2500))
          .then(() => offline)
          .then((hit) => hit || network)
      ]).then((response) => response || Response.error())
    )
    event.waitUntil(network.catch(() => {}))
    return
  }
  const hashed = /^\/assets\/.+-[a-zA-Z0-9_-]+\.(js|css)$/.test(url.pathname)
  const staticFile =
    hashed ||
    /^\/(monsters|icons|learning)\//.test(url.pathname) ||
    url.pathname.endsWith('.webmanifest') ||
    url.origin !== location.origin
  if (!staticFile) return
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const hit =
        (await cache.match(request)) ||
        (hashed ? await caches.match(request) : undefined)
      if (hit) return hit
      const response = await fetch(request)
      if (response.ok || response.type === 'opaque') {
        await cache.put(request, response.clone())
      }
      return response
    })()
  )
})
