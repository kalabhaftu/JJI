import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db/client'
import { isRedisConfigured, redis } from '@/lib/cache/client'

export const dynamic = 'force-dynamic'

export async function GET() {
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
    // Check DB
    await db.execute('SELECT 1')
    status.database = 'up'
  } catch (error) {
    Sentry.captureException(error, { extra: { route: '/api/health', phase: 'database-check' } })
    status.database = 'down'
  }

  if (!isRedisConfigured()) {
    status.redis = 'not_configured'
  } else {
    try {
      const ping = await redis.ping()
      if (ping === 'PONG') status.redis = 'up'
     } catch (error) {
       Sentry.captureException(error, { extra: { route: '/api/health', phase: 'redis-check' } })
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
