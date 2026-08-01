import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const serviceWorker = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

describe('service worker privacy boundary', () => {
  it('keeps the app shell and last successful page available without an offline document', () => {
    const pageHandler = serviceWorker.match(/async function handlePageRequest[\s\S]*?\/\/ Message handling/)?.[0]

    expect(pageHandler).toBeTruthy()
    expect(pageHandler).toContain("caches.open(PAGE_CACHE)")
    expect(pageHandler).toContain('cache.put(request, response.clone())')
    expect(pageHandler).toContain('cache.match(request)')
    expect(serviceWorker).not.toContain('/offline.html')
    expect(serviceWorker).toContain('Response.error()')
  })

  it('bypasses caching for Supabase media and clears offline data on session changes', () => {
    expect(serviceWorker).toContain('isPrivateMediaRequest(url)')
    expect(serviceWorker).toContain('DATA_CACHE')
    expect(serviceWorker).toContain('isCacheableAPIRequest(url)')
    expect(serviceWorker).toContain("indexedDB.deleteDatabase('JJIOffline')")
    expect(serviceWorker).toContain('event.waitUntil(clearAllUserData())')
  })

  it('never replays account mutations in the background', () => {
    expect(serviceWorker).not.toContain("addEventListener('sync'")
    expect(serviceWorker).not.toContain("method: 'POST'")
    expect(serviceWorker).not.toContain("method: 'PATCH'")
    expect(serviceWorker).not.toContain('pendingTrades')
    expect(serviceWorker).not.toContain('pendingProfileUpdates')
  })
})
