const CACHE_NAME = 'tuotuo-blocks-shell-v1'
const APP_ENTRY = '/'

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  const response = await fetch(APP_ENTRY, { cache: 'reload' })
  if (!response.ok) throw new Error('App shell unavailable')

  await cache.put(APP_ENTRY, response.clone())
  const html = await response.text()
  const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => `${url.pathname}${url.search}`)

  await Promise.all(assetUrls.map(async (url) => {
    const asset = await fetch(url, { cache: 'reload' })
    if (asset.ok) await cache.put(url, asset)
  }))
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) await (await caches.open(CACHE_NAME)).put(APP_ENTRY, response.clone())
          return response
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(APP_ENTRY))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) await (await caches.open(CACHE_NAME)).put(request, response.clone())
      return response
    }),
  )
})
