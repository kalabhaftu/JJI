import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db/client'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, apiLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const internalUserId = identity.internalUserId
    const { id: accountId } = await params

    const account = await db.query.Account.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.id, accountId),
        eq(table.userId, internalUserId)
      ),
      columns: {
        id: true,
        number: true
      }
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    const trades = await db.query.Trade.findMany({
      where: (table, { eq }) => eq(table.accountId, account.id),
      columns: {
        id: true,
        pnl: true,
        commission: true,
        entryDate: true,
        closeDate: true,
        instrument: true,
        side: true,
        quantity: true,
        entryPrice: true,
        closePrice: true,
        createdAt: true,
      },
      orderBy: (table, { desc }) => [desc(table.entryDate)]
    })

    return NextResponse.json({
      success: true,
      data: trades
    })
  } catch (error) {
    Sentry.captureException(error, { extra: { route: '/api/v1/accounts/[id]/trades' } })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trades' },
      { status: 500 }
    )
  }
}