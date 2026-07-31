import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { and, or, eq, isNull, inArray, not, desc, count } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, apiLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const internalUserId = identity.internalUserId

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Fetch trades for this user without any specific account/status filters
    // This is for the Data Management "everything" view
    const [trades, totalResult] = await Promise.all([
      db.query.Trade.findMany({
        where: (table, { and, or, eq, isNull, not, inArray }) => and(
          eq(table.userId, internalUserId),
          or(
            isNull(table.phaseAccountId),
            not(
              // Note: relation filter approximated; may require exists/notExists in full Drizzle setup
              inArray(schema.PhaseAccount.status, ['pending', 'pending_approval'])
            )
          )
        ),
        orderBy: (table, { desc }) => [desc(table.exitTime)],
        limit,
        offset,
      }),
      db.select({ count: count() })
        .from(schema.Trade)
        .where(and(
          eq(schema.Trade.userId, internalUserId),
          or(
            isNull(schema.Trade.phaseAccountId),
            not(inArray(schema.PhaseAccount.status, ['pending', 'pending_approval']))
          )
        ))
    ])

    const total = totalResult[0]?.count || 0

    return NextResponse.json({
      success: true,
      data: trades,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error: any) {
    logger.error('Data management trades API failed', error, 'Data Management Trades')
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}