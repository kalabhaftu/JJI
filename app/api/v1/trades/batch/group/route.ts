import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { and, inArray, eq } from 'drizzle-orm'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tradeIds } = body as { tradeIds: string[] }

    if (!Array.isArray(tradeIds) || tradeIds.length < 2) {
      return NextResponse.json({ success: false, error: 'tradeIds must be an array with at least 2 ids' }, { status: 400 })
    }

    const groupId = crypto.randomUUID()

    const result = await db.update(schema.Trade)
      .set({ groupId })
      .where(and(
        inArray(schema.Trade.id, tradeIds),
        eq(schema.Trade.userId, identity.internalUserId)
      ))
      .returning()

    return NextResponse.json({ success: true, groupId, updated: result.length })
  } catch (error: any) {
    logger.error({ error, layer: 'Batch Group' }, 'Failed to batch group trades')
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}