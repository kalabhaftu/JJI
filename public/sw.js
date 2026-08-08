const STATIC_CACHE = 'jji-static-v1.6.0'
const PAGE_CACHE = 'jji-pages-v1.6.0'
const DATA_CACHE = 'jji-data-v1.6.0'
const IMAGE_CACHE = 'jji-images-v1.6.0'
let currentUserId = null

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => ![STATIC_CACHE, PAGE_CACHE, DATA_CACHE, IMAGE_CACHE].includes(cacheName))
          .map((cacheName) => caches.delete(cacheName)),
      )),
      self.clients.claim(),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return

  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request, url))
  } else if (isPrivateMediaRequest(url)) {
    event.respondWith(fetch(request))
  } else if (isStaticFile(url)) {
    event.respondWith(handleStaticRequest(request))
  } else if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request))
  } else if (request.mode === 'navigate') {
    event.respondWith(handlePageRequest(request))
  } else {
    event.respondWith(fetch(request))
  }
})

async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cachedResponse = await cache.match(request)
  if (cachedResponse) return cachedResponse

  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return new Response('Static resource unavailable', { status: 404 })
  }
}

async function handleAPIRequest(request, url) {
  if (!isCacheableAPIRequest(url)) {
    try {
      return await fetch(request)
    } catch {
      return offlineAPIResponse()
    }
  }

  const cache = await caches.open(DATA_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request)) || offlineAPIResponse()
  }
}

function offlineAPIResponse() {
  return new Response(
    JSON.stringify({ error: 'Offline', message: 'Live data will refresh when the connection returns.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  )
}

async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE)
  const cachedResponse = await cache.match(request)
  if (cachedResponse) return cachedResponse

  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em">Image offline</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } },
    )
  }
}

async function handlePageRequest(request) {
  const cache = await caches.open(PAGE_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    return (await cache.match(request)) || Response.error()
  }
}

// Message handling for communication with the application shell.
self.addEventListener('message', (event) => {
  if (!event.data) return

  const { type } = event.data
  if (type === 'SKIP_WAITING') {
    self.skipWaiting()
  } else if (type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllUserData())
  } else if (type === 'SET_USER_ID') {
    const nextUserId = event.data.userId
    if (currentUserId !== null && nextUserId !== currentUserId) {
      event.waitUntil(clearAllUserData())
    }
    currentUserId = nextUserId
  }
})

async function clearAllUserData() {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames
      .filter((cacheName) => [PAGE_CACHE, DATA_CACHE, IMAGE_CACHE].includes(cacheName))
      .map((cacheName) => caches.delete(cacheName)),
  )

  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('JJIOffline')
    request.onsuccess = resolve
    request.onerror = resolve
    request.onblocked = resolve
  })
}

function isStaticFile(url) {
  return ['.woff', '.woff2', '.ttf', '.eot', '.js', '.css'].some((extension) => url.pathname.endsWith(extension)) ||
    url.pathname.startsWith('/_next/static/')
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/')
}

function isCacheableAPIRequest(url) {
  return [
    '/api/v1/accounts',
    '/api/v1/trades',
    '/api/v1/reports/',
    '/api/v1/tags',
    '/api/v1/settings/account-filters',
    '/api/v1/user/trading-models',
    '/api/v1/goals',
    '/api/v1/journal/',
    '/api/v1/prop-firm/',
    '/api/v1/live-accounts/',
  ].some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix))
}

function isImageRequest(url) {
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].some((extension) => url.pathname.endsWith(extension))
}

function isPrivateMediaRequest(url) {
  return url.pathname.startsWith('/storage/v1/object/') || url.hostname.endsWith('.supabase.co')
}
