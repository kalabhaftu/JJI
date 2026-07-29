import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { recordAuditEvent } from '@/lib/audit-logger'
import { getClientIp } from '@/lib/security/client-ip'
import { and, eq } from 'drizzle-orm'

// POST /api/live-accounts/[id]/transactions - Create deposit or withdrawal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const userId = identity.internalUserId

    const { id: accountId } = await params
    const body = await request.json()
    const { type, amount, description } = body

    // Validate input
    if (!type || amount === undefined || amount === null || amount === '') {
      return createErrorResponse('Type and amount are required', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    if (!['DEPOSIT', 'WITHDRAWAL'].includes(type)) {
      return createErrorResponse('Type must be DEPOSIT or WITHDRAWAL', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return createErrorResponse('Amount must be a positive number', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    // Validate minimum amounts
    if (type === 'DEPOSIT' && numericAmount < 5) {
      return createErrorResponse('Minimum deposit amount is $5', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    if (type === 'WITHDRAWAL' && numericAmount < 10) {
      return createErrorResponse('Minimum withdrawal amount is $10', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    // Verify account belongs to user
    const account = await db.query.Account.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, accountId), eq(table.userId, userId))
    })

    if (!account) {
      return createErrorResponse('Account not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    // For withdrawals, check if account has sufficient balance
    if (type === 'WITHDRAWAL') {
      // Calculate current balance including trades and previous transactions
      const trades = await db.query.Trade.findMany({
        where: (table, { eq, and }) => and(
          eq(table.userId, userId),
          eq(table.accountNumber, account.number),
        )
      })

      const transactions = await db.query.LiveAccountTransaction.findMany({
        where: (table, { eq, and }) => and(
          eq(table.userId, userId),
          eq(table.accountId, accountId),
        )
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
        return createErrorResponse(
          `Insufficient balance. Current balance: $${currentBalance.toFixed(2)}`,
          400,
          undefined,
          'INSUFFICIENT_BALANCE',
          requestId,
        )
      }
    }

    // Create transaction
    const transactionAmount = type === 'DEPOSIT' ? numericAmount : -numericAmount

    const transaction = await db.transaction(async (tx) => {
      const created = (await tx.insert(schema.LiveAccountTransaction).values({
        id: crypto.randomUUID(),
        accountId,
        userId,
        type: type as 'DEPOSIT' | 'WITHDRAWAL',
        amount: transactionAmount,
        description: typeof description === 'string' ? description.slice(0, 500) : null,
      }).returning())[0]
      await recordAuditEvent({
        userId,
        action: `LIVE_ACCOUNT_${type}`,
        entityType: 'LiveAccountTransaction',
        entityId: created.id,
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
        afterData: { accountId, type, amount: transactionAmount },
      }, tx as never)
      return created
    })

    return createSuccessResponse(transaction, undefined, undefined, requestId)

  } catch (error) {
    reportError(error, { surface: 'api', operation: 'create-live-account-transaction', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Internal server error', 500, undefined, 'LIVE_ACCOUNT_TRANSACTION_FAILED', requestId)
  }
}

// GET /api/live-accounts/[id]/transactions - Get transaction history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const userId = identity.internalUserId

    const { id: accountId } = await params

    // Verify account belongs to user
    const account = await db.query.Account.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, accountId), eq(table.userId, userId))
    })

    if (!account) {
      return createErrorResponse('Account not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    // Get transactions
    const transactions = await db.query.LiveAccountTransaction.findMany({
      where: (table, { eq, and }) => and(
        eq(table.userId, userId),
        eq(table.accountId, accountId),
      ),
      orderBy: (table, { desc }) => [desc(table.createdAt)]
    })

    return createSuccessResponse(transactions, undefined, undefined, requestId)

  } catch (error) {
    reportError(error, { surface: 'api', operation: 'list-live-account-transactions', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Internal server error', 500, undefined, 'LIVE_ACCOUNT_TRANSACTIONS_FAILED', requestId)
  }
}
