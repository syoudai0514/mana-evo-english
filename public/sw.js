// App shell cache. Navigation is network-first so a new deploy shows up on the
// next launch; hashed build assets, images and fonts are cache-first.
const CACHE = 'mee-v2'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/monsters/m049.webp', '/monsters/m186.webp']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.hostname.endsWith('supabase.co')) return

  if (request.mode === 'navigate') {
    // 電車の弱い電波で待たされないよう、3秒たったら保存してある画面を出す（新しい版は裏で保存して次回に）
    const network = fetch(request).then((response) => {
      // 駅の Wi-Fi のログイン画面やエラー画面を保存しない
      if (response.ok && response.type === 'basic' && !response.redirected) {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put('/', copy))
      }
      return response
    })
    const slow = new Promise((resolve) => setTimeout(resolve, 3000)).then(() => caches.match('/'))
    event.respondWith(
      Promise.race([network.catch(() => caches.match('/')), slow.then((hit) => hit || network)])
        .then((response) => response || network)
        .catch(() => caches.match('/'))
    )
    return
  }

  const cacheable = url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')
  if (!cacheable) return
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok || response.type === 'opaque') {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
      }
      return response
    }))
  )
})
