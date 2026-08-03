import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { isRedisConfigured, redis } from '@/lib/cache/client'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const status: {
    database: 'up' | 'down'
    redis: 'up' | 'down' | 'not_configured'
    overall: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: string
  } = {
    database: 'down',
    redis: 'down',
    overall: 'unhealthy',
    timestamp: new Date().toISOString()
  }

  try {

    await db.execute('SELECT 1')
    status.database = 'up'
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'health-database-check',
      route: request.nextUrl.pathname,
      requestId,
    })
    status.database = 'down'
  }

  if (!isRedisConfigured()) {
    status.redis = 'not_configured'
  } else {
    try {
      const ping = await redis.ping()
      if (ping === 'PONG') status.redis = 'up'
     } catch (error) {
       reportError(error, {
         surface: 'api',
         operation: 'health-redis-check',
         route: request.nextUrl.pathname,
         requestId,
       })
       status.redis = 'down'
     }
  }

  if (status.database === 'up' && status.redis === 'up') {
    status.overall = 'healthy'
  } else if (status.database === 'up') {
    status.overall = 'degraded'
  }

  return NextResponse.json(status, {
    status: status.overall === 'unhealthy' ? 503 : 200
  })
}
