import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { generateJournalAnalysis } from '@/server/ai/journal-analysis'
import { listDailyJournalEntries } from '@/server/daily-journal'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { getRuntimeBreakEvenThreshold } from '@/server/user-settings'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'ai')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const accountId = searchParams.get('accountId')
    if (!startDate || !endDate) {
      return createErrorResponse(
        'Start date and end date are required',
        400,
        undefined,
        'VALIDATION_ERROR',
        requestId,
      )
    }

    const internalUserId = identity.internalUserId
    const tradesWhereStart = startDate.includes('T')
      ? startDate
      : `${startDate}T00:00:00.000Z`
    const tradesWhereEnd = endDate.includes('T')
      ? endDate
      : `${endDate}T23:59:59.999Z`

    const [
      journals,
      breakEvenThreshold,
      trades,
      propFirmAccounts,
      userTags,
      tradingModels,
      weeklyReviews,
    ] = await Promise.all([
      listDailyJournalEntries(internalUserId, {
        startDate,
        endDate,
        ...(accountId ? { accountId } : {}),
        sortOrder: 'asc',
      }),
      getRuntimeBreakEvenThreshold(internalUserId),
      db.query.Trade.findMany({
        where: (table, { eq, and, gte, lte }) => {
          const conditions = [
            eq(table.userId, internalUserId),
            gte(table.entryDate, tradesWhereStart),
            lte(table.entryDate, tradesWhereEnd),
          ]
          if (accountId) conditions.push(eq(table.accountId, accountId))
          return and(...conditions)
        },
        orderBy: (table, { asc }) => [asc(table.entryDate)],
        columns: {
          id: true,
          entryId: true,
          instrument: true,
          side: true,
          pnl: true,
          commission: true,
          accountNumber: true,
          phaseAccountId: true,
          entryDate: true,
          closeDate: true,
          quantity: true,
          entryPrice: true,
          closePrice: true,
          comment: true,
          setup: true,
          selectedRules: true,
          ruleBroken: true,
          chartLinks: true,
          chartLinksList: true,
          modelId: true,
          marketBias: true,
          newsDay: true,
          selectedNews: true,
          newsTraded: true,
          biasTimeframe: true,
          narrativeTimeframe: true,
          entryTimeframe: true,
          structureTimeframe: true,
          orderType: true,
          entryTime: true,
          exitTime: true,
        },
        with: {
          TradingModel: {
            columns: { name: true },
          },
        },
      }),
      db.query.MasterAccount.findMany({
        where: (table, { eq, and }) => and(
          eq(table.userId, internalUserId),
          eq(table.isArchived, false),
        ),
        columns: {
          accountName: true,
          propFirmName: true,
          status: true,
          accountSize: true,
          currentPhase: true,
        },
      }),
      db.query.TradeTag.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        columns: { id: true, name: true },
      }),
      db.query.TradingModel.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        columns: { id: true, name: true },
      }),
      db.query.WeeklyReview.findMany({
        where: (table, { eq, and, gte, lte }) => and(
          eq(table.userId, internalUserId),
          gte(table.startDate, new Date(startDate)),
          lte(table.startDate, new Date(endDate)),
        ),
        columns: {
          startDate: true,
          expectation: true,
          actualOutcome: true,
          isCorrect: true,
          notes: true,
        },
      }),
    ])

    const analysis = await generateJournalAnalysis(
      journals,
      trades,
      propFirmAccounts,
      userTags,
      tradingModels,
      weeklyReviews,
      breakEvenThreshold,
    )
    return createSuccessResponse({ analysis }, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'generate-journal-analysis',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to generate analysis',
      500,
      undefined,
      'JOURNAL_ANALYSIS_FAILED',
      requestId,
    )
  }
}
