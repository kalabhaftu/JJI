import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const serviceWorker = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

describe('service worker privacy boundary', () => {
  it('does not put document responses into a shared runtime cache', () => {
    const pageHandler = serviceWorker.match(/async function handlePageRequest[\s\S]*?\/\/ Message handling/)?.[0]

    expect(pageHandler).toBeTruthy()
    expect(pageHandler).not.toContain('cache.put')
    expect(pageHandler).toContain('return await fetch(request)')
  })

  it('bypasses caching for Supabase media and clears offline data on session changes', () => {
    expect(serviceWorker).toContain('isPrivateMediaRequest(url)')
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
