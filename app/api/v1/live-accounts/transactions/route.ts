import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

// GET /api/live-accounts/transactions - Get all transactions for user's accounts
export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const userId = identity.internalUserId

    // Get all transactions for user's accounts
    const transactions = await db.query.LiveAccountTransaction.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
      orderBy: (table, { desc }) => [desc(table.createdAt)]
    })

    return NextResponse.json({
      success: true,
      data: transactions
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}