import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { randomUUID } from 'crypto'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rl = await applyRateLimit(req, apiLimiter)
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()

    const settings = await db.query.UserSettings.findFirst({
      where: (table, { eq }) => eq(table.userId, internalUserId),
    })

    const token = settings?.webhookToken ?? null
    return NextResponse.json({
      hasToken: Boolean(token),
      token,
    })
  } catch (err) {
    logger.error('Failed to get webhook token: ' + (err instanceof Error ? err.message : String(err)))
    return NextResponse.json({ error: 'Failed to fetch webhook token' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const rl = await applyRateLimit(req, apiLimiter)
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const token = randomUUID()

    await db
      .insert(schema.UserSettings)
      .values({ userId: internalUserId, webhookToken: token })
      .onConflictDoUpdate({
        target: schema.UserSettings.userId,
        set: { webhookToken: token },
      })

    return NextResponse.json({ token })
  } catch (err) {
    logger.error('Failed to regenerate webhook token: ' + (err instanceof Error ? err.message : String(err)))
    return NextResponse.json({ error: 'Failed to regenerate webhook token' }, { status: 500 })
  }
}