import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { accountId } = body as { accountId?: string }

    if (!accountId) {
      return NextResponse.json({ success: false, error: 'accountId is required' }, { status: 400 })
    }

    const now = new Date()
    await db
      .insert(schema.Synchronization)
      .values({
        userId: identity.internalUserId,
        service: 'rithmic',
        accountId,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.Synchronization.userId,
          schema.Synchronization.service,
          schema.Synchronization.accountId,
        ],
        set: {
          lastSyncedAt: now,
        },
      })

    return NextResponse.json({
      success: true,
      message: 'Sync marked as complete',
      lastSyncedAt: now.toISOString(),
    })
  } catch (error: any) {
    logger.error({ error: error?.message, layer: 'api' }, 'POST /api/v1/rithmic/sync-complete')
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark sync as complete',
      },
      { status: 500 }
    )
  }
}