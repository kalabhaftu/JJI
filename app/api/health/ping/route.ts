import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'


export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  try {
    await db.execute(sql`SELECT 1`)

    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'database-health-ping',
      route: request.nextUrl.pathname,
      requestId,
      level: process.env.NODE_ENV === 'production' ? 'error' : 'warning',
    })
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { status: 'degraded', timestamp: new Date().toISOString() },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      )
    }

    return NextResponse.json(
      { status: 'error', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}
