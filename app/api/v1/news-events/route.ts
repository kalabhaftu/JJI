/**
 * News Events API (server-only data)
 * Returns major economic news events. Data is loaded server-side only;
 * client components must fetch via this endpoint (never import lib/major-news-events).
 */

import { NextRequest, NextResponse } from 'next/server'
import { MAJOR_NEWS_EVENTS } from '@/lib/constants/major-news-events'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'

export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  return NextResponse.json(MAJOR_NEWS_EVENTS, {
    headers: CacheHeaders.medium,
  })
}
