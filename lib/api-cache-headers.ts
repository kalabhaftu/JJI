
export const CacheHeaders = {
  noCache: {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },

  privateShort: {
    'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60',
  },

  short: {
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
  },

  medium: {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  },

  long: {
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
  },

  veryLong: {
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
  },

  /**
   * Immutable cache - For content that never changes (by hash/version)
   */
  immutable: {
    'Cache-Control': 'public, max-age=31536000, immutable',
  },
}

/**
 * Helper to add cache headers to NextResponse
 */
function withCacheHeaders(
  response: Response,
  cacheType: keyof typeof CacheHeaders = 'short'
): Response {
  const headers = new Headers(response.headers)
  const cacheHeaders = CacheHeaders[cacheType]
  
  Object.entries(cacheHeaders).forEach(([key, value]) => {
    headers.set(key, value)
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Get cache headers for a specific cache duration
 */
function getCacheHeaders(
  maxAge: number,
  staleWhileRevalidate?: number
): Record<string, string> {
  const swr = staleWhileRevalidate ?? maxAge * 2
  return {
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`,
  }
}

