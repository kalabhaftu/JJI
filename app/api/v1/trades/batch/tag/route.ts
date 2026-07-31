import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { inArray, eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tradeIds, tags } = body as { tradeIds: string[]; tags: string[] }

    if (!Array.isArray(tradeIds) || tradeIds.length === 0) {
      return NextResponse.json({ success: false, error: 'tradeIds must be a non-empty array' }, { status: 400 })
    }
    if (!Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json({ success: false, error: 'tags must be a non-empty array' }, { status: 400 })
    }

    const result = await db.update(schema.Trade)
      .set({ tags })
      .where(and(
        inArray(schema.Trade.id, tradeIds),
        eq(schema.Trade.userId, identity.internalUserId)
      ))
      .returning({ id: schema.Trade.id })

    return NextResponse.json({ success: true, updated: result.length })
  } catch (error: any) {
    logger.error({ error, layer: 'Batch Tag' }, 'Failed to batch tag trades')
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}