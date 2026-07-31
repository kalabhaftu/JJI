import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { TRADE_COUNT_SELECT, buildGroupedTradeCountSummary } from '@/lib/trade-counts'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { logActivity, getClientIp } from '@/lib/activity-logger'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger';
import { withCache, getUserCacheVersion } from '@/lib/cache/helpers'
import { CacheKeys, CacheTTL } from '@/lib/cache/keys'

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

    const { id: accountId } = await params
    const internalUserId = identity.internalUserId
    const userVersion = await getUserCacheVersion(internalUserId)

    const data = await withCache(
      CacheKeys.accountMetrics(accountId, userVersion),
      CacheTTL.accountMetrics,
      async () => {
        const account = await db.query.Account.findFirst({
          where: (table, { eq, and }) => and(eq(table.id, accountId), eq(table.userId, internalUserId)),
        })

        if (!account) return null

        const trades = await db.query.Trade.findMany({
          where: (table, { eq }) => eq(table.accountId, account.id),
          columns: TRADE_COUNT_SELECT,
          orderBy: (table, { desc }) => [desc(table.entryDate)]
        })

        const transactions = await db.query.LiveAccountTransaction.findMany({
          where: (table, { eq }) => eq(table.accountId, account.id),
          columns: {
            amount: true,
          }
        })

        const profitLoss = trades.reduce(
          (sum: number, trade: { pnl: number; commission: number | null }) => sum + trade.pnl,
          0
        )

        const totalTransactions = transactions.reduce(
          (sum: number, tx: { amount: number }) => sum + tx.amount,
          0
        )

        const currentEquity = (account.startingBalance ?? 0) + profitLoss + totalTransactions
        const lastTradeDate = trades.length > 0 ? trades[0]?.entryDate : null
        const tradeCounts = buildGroupedTradeCountSummary(trades as any)

        return {
          id: account.id,
          number: account.number,
          name: account.name,
          broker: account.broker,
          accountType: 'live',
          displayName: account.name || account.number,
          startingBalance: account.startingBalance,
          currentEquity,
          profitLoss,
          status: 'active',
          tradeCount: tradeCounts.groupedTradeCount,
          lastTradeDate,
          createdAt: account.createdAt,
        }
      }
    )

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    Sentry.captureException(error, { extra: { route: '/api/v1/accounts/[id]', method: 'GET' } })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch account' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, apiLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const internalUserId = identity.internalUserId
    const { id: accountId } = await params
    const body = await request.json()
    const { name, broker, isArchived, startingBalance, number } = body

    const existingAccount = await db.query.Account.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, accountId), eq(table.userId, internalUserId)),
    })

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    const updateData: any = {}

    if (typeof isArchived === 'boolean') {
      updateData.isArchived = isArchived
    }

    // Name is always editable
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
      }
      updateData.name = name.trim()
    }

    // Balance, Broker, and Number are one-time editable if the account is not yet "fully configured"
    // or if they are currently defaults (like 0 balance).
    if (!existingAccount.isConfigured) {
      if (startingBalance !== undefined) {
        updateData.startingBalance = parseFloat(startingBalance)
      }
      if (number !== undefined) {
        updateData.number = number.trim()
      }
      if (broker !== undefined) {
        if (!broker.trim()) {
          return NextResponse.json({ success: false, error: 'Broker is required' }, { status: 400 })
        }
        updateData.broker = broker.trim()
      }

      // If we performed a one-time edit of these sensitive fields, lock them for the future
      if (startingBalance !== undefined || number !== undefined || broker !== undefined) {
        updateData.isConfigured = true
      }
    } else {
      // If already configured, we ignore startingBalance, number, and broker updates
      // but we still allowed 'name' above.
      // Optionally log or notify that these fields are locked.
    }

    const updatedAccount = (await db.update(schema.Account).set(updateData).where(and(
      eq(schema.Account.id, accountId),
      eq(schema.Account.userId, internalUserId),
    )).returning())[0]
    if (!updatedAccount) {
      return NextResponse.json({ success: false, error: 'Account not found during update' }, { status: 404 })
    }

    if (typeof isArchived === 'boolean') {
      const { invalidateUserCaches } = await import('@/server/accounts')
      await invalidateUserCaches(internalUserId)
    }

    const action = typeof isArchived === 'boolean'
      ? (isArchived ? 'ACCOUNT_ARCHIVED' : 'ACCOUNT_UNARCHIVED')
      : (existingAccount.isConfigured ? 'ACCOUNT_RENAMED' : 'ACCOUNT_CONFIGURED')

    logActivity({
      userId: internalUserId,
      action,
      entity: 'Account',
      entityId: accountId,
      metadata: { updatedFields: Object.keys(updateData), accountNumber: updatedAccount.number },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedAccount.id,
        number: updatedAccount.number,
        name: updatedAccount.name,
        broker: updatedAccount.broker,
        displayName: updatedAccount.name || updatedAccount.number,
        startingBalance: updatedAccount.startingBalance,
        isArchived: updatedAccount.isArchived,
        isConfigured: updatedAccount.isConfigured,
      }
    })
  } catch (error) {
    Sentry.captureException(error, { extra: { route: '/api/v1/accounts/[id]', method: 'PATCH' } })
    return NextResponse.json(
      { success: false, error: 'Failed to update account' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, apiLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const internalUserId = identity.internalUserId
    const { id: accountId } = await params

    const existingAccount = await db.query.Account.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, accountId), eq(table.userId, internalUserId)),
    })

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    // Fetch all trade images for the account before deleting
    const accountTrades = await db.query.Trade.findMany({
      where: (table, { eq, and }) => and(eq(table.accountId, accountId), eq(table.userId, internalUserId)),
      columns: {
        imageOne: true,
        imageTwo: true,
        imageThree: true,
        imageFour: true,
        imageFive: true,
        imageSix: true,
        cardPreviewImage: true,
      },
    })

    const imageUrls = accountTrades.flatMap((t) => [
      t.imageOne,
      t.imageTwo,
      t.imageThree,
      t.imageFour,
      t.imageFive,
      t.imageSix,
      t.cardPreviewImage,
    ]).filter((url): url is string => !!url)

    if (imageUrls.length > 0) {
      try {
        const { deletePublicStorageUrls } = await import('@/server/storage-admin')
        await deletePublicStorageUrls(imageUrls)
      } catch (err) {
        logger.error('Failed to delete account trade images from storage: ' + (err instanceof Error ? err.message : String(err)))
        // We continue with DB deletion even if storage cleanup fails
      }
    }

    await db.delete(schema.Account).where(and(
      eq(schema.Account.id, accountId),
      eq(schema.Account.userId, internalUserId),
    ))

    const { invalidateUserCaches } = await import('@/server/accounts')
    await invalidateUserCaches(internalUserId)

    logActivity({
      userId: internalUserId,
      action: 'ACCOUNT_DELETED',
      entity: 'Account',
      entityId: accountId,
      metadata: { accountNumber: existingAccount.number },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({
      success: true,
      message: 'Account and all associated trades deleted successfully'
    })
  } catch (error) {
    Sentry.captureException(error, { extra: { route: '/api/v1/accounts/[id]', method: 'DELETE' } })
    return NextResponse.json(
      { success: false, error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
