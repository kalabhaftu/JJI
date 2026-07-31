import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'

// GET - Get backtest input mode preference
export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    const userId = identity?.internalUserId

    if (!userId) {
      return NextResponse.json({ mode: 'manual' }, { status: 200 })
    }

    const userSettings = await db.query.UserSettings.findFirst({
      where: (table, { eq }) => eq(table.userId, userId),
      columns: { backtestInputMode: true },
    })

    return NextResponse.json({ 
      mode: userSettings?.backtestInputMode || 'manual' 
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ mode: 'manual' }, { status: 200 })
  }
}

// POST - Update backtest input mode preference
export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    const userId = identity?.internalUserId

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { mode } = await request.json()

    if (!mode || !['manual', 'simple'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    await db.insert(schema.UserSettings)
      .values({ userId, backtestInputMode: mode })
      .onConflictDoUpdate({
        target: schema.UserSettings.userId,
        set: { backtestInputMode: mode },
      })

    return NextResponse.json({ success: true, mode }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update preference' },
      { status: 500 }
    )
  }
}