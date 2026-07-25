// JJI Service Worker - Optimized for performance
// Provides offline functionality, caching, and background sync

const STATIC_CACHE = 'jji-static-v1.4.0'
const IMAGE_CACHE = 'jji-images-v1.4.0'

let currentUserId = null

// Minimal files to cache for performance
const STATIC_FILES = [
  '/',
  '/offline.html',
]

// Install event - cache static resources
self.addEventListener('install', (event) => {
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_FILES)
      }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE &&
                cacheName !== IMAGE_CACHE) {
              return caches.delete(cacheName)
            }
          })
        )
      }),
      
      // Claim all clients
      self.clients.claim()
    ])
  )
})

// Fetch event - intercept network requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return
  }


  // Handle different types of requests
  if (isStaticFile(url)) {
    event.respondWith(handleStaticRequest(request))
  } else if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request))
  } else if (isPrivateMediaRequest(url)) {
    event.respondWith(fetch(request))
  } else if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request))
  } else {
    event.respondWith(handlePageRequest(request))
  }
})

// Handle static file requests (CSS, JS, fonts)
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    return new Response('Static resource unavailable', { status: 404 })
  }
}

// Handle API requests (no caching, requires live connection)
async function handleAPIRequest(request) {
  try {
    return await fetch(request)
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'JJI needs an internet connection to sync live data.' }), 
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Handle image requests
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE)
  const cachedResponse = await cache.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    const response = await fetch(request)
    if (response.ok) {
      // Cache images for offline use
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    // Return placeholder image
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="#ddd"/><text x="50%" y="50%" text-anchor="middle" dy=".3em">Image offline</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
  }
}

// Documents are always network-only. Caching authenticated HTML in a global
// service-worker cache can expose one user's dashboard after logout or account
// switching. The explicit offline page is the supported document fallback.
async function handlePageRequest(request) {
  try {
    return await fetch(request)
  } catch (error) {
    
    // Serve offline page
    const cache = await caches.open(STATIC_CACHE)
    const offlinePage = await cache.match('/offline.html')
    
    if (offlinePage) {
      return offlinePage
    }
    
    // Fallback offline response
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - JJI</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root { color-scheme: dark; --page-bg: #070b12; --surface: #0d1420; --surface-alt: #131b29; --border: rgba(148, 163, 184, 0.14); --text: #f4f7fb; --muted: #9fb0c7; --accent: #f08a24; }
            * { box-sizing: border-box; }
            body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--page-bg); color: var(--text); font-family: Arial, sans-serif; }
            .offline-message { width: min(100%, 440px); margin: 0 auto; text-align: center; padding: 32px; background: var(--surface); border: 1px solid var(--border); border-radius: 24px; box-shadow: 0 28px 70px rgba(0, 0, 0, 0.45); }
            .mark { width: 72px; height: 72px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; border-radius: 20px; background: var(--surface-alt); border: 1px solid var(--border); }
            .mark svg { width: 30px; height: 30px; fill: currentColor; }
            p { color: var(--muted); line-height: 1.65; margin: 0 0 24px; }
            button { border: 0; border-radius: 14px; padding: 14px 18px; background: var(--accent); color: #08101a; font-weight: 700; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="offline-message">
            <div class="mark" aria-hidden="true">
              <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <rect width="512" height="512" rx="104" fill="currentColor"></rect>
                <path fill="var(--surface-alt)" d="M128 136h256v72H292v216h-72V208h-92z"></path>
              </svg>
            </div>
            <h1>You're Offline</h1>
            <p>JJI needs an internet connection to sync live data. Reconnect and try again.</p>
            <button onclick="window.location.reload()">Retry</button>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  if (!event.data) return
  
  const { type } = event.data
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
    case 'CLEAR_CACHE':
      event.waitUntil(clearAllUserData())
      break
    case 'SET_USER_ID':
      const newUserId = event.data.userId
      if (currentUserId !== null && newUserId !== currentUserId) {
        event.waitUntil(clearAllUserData())
      }
      currentUserId = newUserId
      break
  }
})

// Clear all caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    )
  } catch (error) {
  }
}

async function clearAllUserData() {
  const cacheNames = await caches.keys()
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName !== STATIC_CACHE)
      .map((cacheName) => caches.delete(cacheName))
  )
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('JJIOffline')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

// Helper functions
function isStaticFile(url) {
  const staticExtensions = ['.woff', '.woff2', '.ttf', '.eot', '.js', '.css']
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
    url.pathname.startsWith('/_next/static/')
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/')
}

function isImageRequest(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  return imageExtensions.some(ext => url.pathname.endsWith(ext))
}

function isPrivateMediaRequest(url) {
  return url.pathname.startsWith('/storage/v1/object/') || url.hostname.endsWith('.supabase.co')
}
