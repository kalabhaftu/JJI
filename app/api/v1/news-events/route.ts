

import { NextRequest } from 'next/server'
import { MAJOR_NEWS_EVENTS } from '@/lib/constants/major-news-events'
import { CacheHeaders } from '@/lib/api-cache-headers'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createSuccessResponse } from '@/lib/api-response'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'public-read')
  if (limited) return limited

  return createSuccessResponse(
    MAJOR_NEWS_EVENTS,
    undefined,
    undefined,
    requestId,
    { headers: CacheHeaders.medium },
  )
}
