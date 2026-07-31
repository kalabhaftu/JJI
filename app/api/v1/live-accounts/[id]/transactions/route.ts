import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

// POST /api/live-accounts/[id]/transactions - Create deposit or withdrawal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: accountId } = await params
    const body = await request.json()
    const { type, amount, description } = body

    // Validate input
    if (!type || amount === undefined || amount === null || amount === '') {
      return NextResponse.json(
        { success: false, error: 'Type and amount are required' },
        { status: 400 }
      )
    }

    if (!['DEPOSIT', 'WITHDRAWAL'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be DEPOSIT or WITHDRAWAL' },
        { status: 400 }
      )
    }

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    // Validate minimum amounts
    if (type === 'DEPOSIT' && numericAmount < 5) {
      return NextResponse.json(
        { success: false, error: 'Minimum deposit amount is $5' },
        { status: 400 }
      )
    }

    if (type === 'WITHDRAWAL' && numericAmount < 10) {
      return NextResponse.json(
        { success: false, error: 'Minimum withdrawal amount is $10' },
        { status: 400 }
      )
    }

    // Verify account belongs to user
    const account = await db.query.Account.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, accountId), eq(table.userId, userId))
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    // For withdrawals, check if account has sufficient balance
    if (type === 'WITHDRAWAL') {
      // Calculate current balance including trades and previous transactions
      const trades = await db.query.Trade.findMany({
        where: (table, { eq }) => eq(table.accountNumber, account.number)
      })

      const transactions = await db.query.LiveAccountTransaction.findMany({
        where: (table, { eq }) => eq(table.accountId, accountId)
      })

      const totalPnL = trades.reduce(
        (sum: number, trade: any) =>
          sum + Number(trade.pnl || 0),
        0
      )
      const totalTransactions = transactions.reduce(
        (sum: number, tx: { amount: number }) => sum + tx.amount,
        0
      )
      const currentBalance = Number(account.startingBalance || 0) + totalPnL + totalTransactions

      if (currentBalance < numericAmount) {
        return NextResponse.json(
          { success: false, error: `Insufficient balance. Current balance: $${currentBalance.toFixed(2)}` },
          { status: 400 }
        )
      }
    }

    // Create transaction
    const transactionAmount = type === 'DEPOSIT' ? numericAmount : -numericAmount

    const transaction = (await db.insert(schema.LiveAccountTransaction).values({
      id: crypto.randomUUID(),
      accountId,
      userId,
      type: type as 'DEPOSIT' | 'WITHDRAWAL',
      amount: transactionAmount,
      description: description || null
    }).returning())[0]

    return NextResponse.json({
      success: true,
      data: transaction
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/live-accounts/[id]/transactions - Get transaction history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: accountId } = await params

    // Verify account belongs to user
    const account = await db.query.Account.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, accountId), eq(table.userId, userId))
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    // Get transactions
    const transactions = await db.query.LiveAccountTransaction.findMany({
      where: (table, { eq }) => eq(table.accountId, accountId),
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