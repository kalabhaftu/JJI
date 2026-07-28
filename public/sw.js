const STATIC_CACHE = 'jji-static-v1.5.0'
const IMAGE_CACHE = 'jji-images-v1.5.0'
let currentUserId = null

const STATIC_FILES = ['/', '/offline.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_FILES)),
      self.skipWaiting(),
    ]),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => ![STATIC_CACHE, IMAGE_CACHE].includes(cacheName))
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
    event.respondWith(handleAPIRequest(request))
  } else if (isPrivateMediaRequest(url)) {
    event.respondWith(fetch(request))
  } else if (isStaticFile(url)) {
    event.respondWith(handleStaticRequest(request))
  } else if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request))
  } else {
    event.respondWith(handlePageRequest(request))
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

async function handleAPIRequest(request) {
  try {
    return await fetch(request)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'JJI needs an internet connection to sync live data.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }
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

// Authenticated documents are network-only. Only the explicit offline page is cached.
async function handlePageRequest(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(STATIC_CACHE)
    const offlinePage = await cache.match('/offline.html')
    if (offlinePage) return offlinePage

    return new Response(
      '<!DOCTYPE html><html><head><title>Offline - JJI</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main><h1>You\'re Offline</h1><p>JJI needs an internet connection to sync live data. Reconnect and try again.</p><button onclick="window.location.reload()">Retry</button></main></body></html>',
      { headers: { 'Content-Type': 'text/html' } },
    )
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
      .filter((cacheName) => cacheName !== STATIC_CACHE)
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

function isImageRequest(url) {
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].some((extension) => url.pathname.endsWith(extension))
}

function isPrivateMediaRequest(url) {
  return url.pathname.startsWith('/storage/v1/object/') || url.hostname.endsWith('.supabase.co')
}
