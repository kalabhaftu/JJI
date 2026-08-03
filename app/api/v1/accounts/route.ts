import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { calculateAccountBalance } from '@/lib/utils/balance-calculator'
import { buildGroupedTradeCountSummary } from '@/lib/trade-counts'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { isDomainError } from '@/lib/domain-error'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import { createLiveAccountForUser } from '@/server/accounts/lifecycle'
import { and, eq, inArray, or } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'authenticated-read')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const internalUserId = identity.internalUserId

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    let statusFilter = searchParams.get('status') || 'all'
    const archivedParam = searchParams.get('archived')
    if (archivedParam === 'true') {
      statusFilter = 'archived'
    } else if (archivedParam === 'false' && statusFilter === 'all') {
      statusFilter = 'all'
    }
    const typeFilter = searchParams.get('type') || 'all'
    const search = searchParams.get('search')?.toLowerCase() || ''


    const liveAccounts = await db.query.Account.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    })


    const propFirmAccounts = await db.query.MasterAccount.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      with: { PhaseAccount: { orderBy: (table, { asc }) => [asc(table.phaseNumber)] } }
    })

    const isFundedPhase = (evaluationType: string, phaseNumber: number): boolean => {
      return isFundedPhaseForEvaluation(evaluationType, phaseNumber)
    }


    const unified: any[] = []

    liveAccounts.forEach(acc => {
      unified.push({
        id: acc.id,
        number: acc.number,
        name: acc.name,
        propfirm: '',
        broker: acc.broker,
        startingBalance: acc.startingBalance,
        accountType: 'live',
        displayName: acc.name || acc.number,
        tradeCount: 0,
        status: 'active',
        currentPhase: null,
        createdAt: acc.createdAt,
        isArchived: acc.isArchived || false,
        isOnboardingSample: acc.isOnboardingSample,
        currentPhaseDetails: null,
      })
    })

    propFirmAccounts.forEach(master => {
      if (master.PhaseAccount && master.PhaseAccount.length > 0) {
        master.PhaseAccount.forEach((phase: any) => {
          if (phase.status === 'pending' || phase.status === 'pending_approval') return
          if (!phase.phaseId || phase.phaseId.trim() === '') return
          
          unified.push({
            id: phase.id,
            number: phase.phaseId,
            name: master.accountName,
            propfirm: master.propFirmName,
            broker: undefined,
            startingBalance: phase.accountSize || master.accountSize,
            accountType: 'prop-firm',
            displayName: `${master.accountName} (${isFundedPhase(master.evaluationType, phase.phaseNumber) ? 'Funded' : 'Phase '+phase.phaseNumber})`,
            tradeCount: 0,
            status: phase.status,
            currentPhase: phase.phaseNumber,
            createdAt: phase.createdAt || master.createdAt,
            isArchived: master.isArchived || false,
            currentPhaseDetails: {
               phaseNumber: phase.phaseNumber,
               status: phase.status,
               phaseId: phase.phaseId,
               masterAccountId: master.id,
               evaluationType: master.evaluationType
            }
          })
        })
      }
    })


    const filtered = unified.filter(acc => {
      if (statusFilter === 'all_inclusive') {

         if (typeFilter !== 'all' && acc.accountType !== typeFilter) return false
         
         if (search) {
            if (
              !acc.displayName?.toLowerCase().includes(search) &&
              !acc.number?.toLowerCase().includes(search) &&
              !acc.broker?.toLowerCase().includes(search)
            ) {
              return false
            }
         }
         return true
      }


      if (statusFilter === 'archived') {
         if (!acc.isArchived) return false
      } else {
         if (acc.isArchived) return false
         
         const isPassed = acc.status === 'passed'
         if (isPassed) return false

         const shouldHideByDefault = acc.status === 'failed' || acc.status === 'pending'
         if (statusFilter !== 'all') {
            if (acc.status !== statusFilter) return false
         } else {
            if (shouldHideByDefault) return false
         }
      }


      if (typeFilter !== 'all' && acc.accountType !== typeFilter) return false
      
      if (search) {
         if (
           !acc.displayName?.toLowerCase().includes(search) &&
           !acc.number?.toLowerCase().includes(search) &&
           !acc.broker?.toLowerCase().includes(search)
         ) {
           return false
         }
      }

      return true
    })


    const total = filtered.length
    

    const offset = (page - 1) * limit
    const paginated = filtered.slice(offset, offset + limit)


    const liveNumbersToFetch = paginated.filter(a => a.accountType === 'live').map(a => a.number)
    const propPhaseIdsToFetch = paginated.filter(a => a.accountType === 'prop-firm').map(a => a.id)
    const propNumbersToFetch = paginated.filter(a => a.accountType === 'prop-firm').map(a => a.number)
    
    const tradeConditions: any[] = []
    
    const accountNumbersForTrades = [...liveNumbersToFetch, ...propNumbersToFetch]
    if (accountNumbersForTrades.length > 0) {
      tradeConditions.push(inArray(schema.Trade.accountNumber, accountNumbersForTrades))
    }
    
    if (propPhaseIdsToFetch.length > 0) {
      tradeConditions.push(inArray(schema.Trade.phaseAccountId, propPhaseIdsToFetch))
    }

    const relevantTrades = tradeConditions.length > 0 
      ? await db.query.Trade.findMany({
          where: (table) => and(
            eq(table.userId, internalUserId),
            or(...tradeConditions),
          ),
        })
      : []

    const relevantIds = paginated.map(p => p.id)

    
    let relevantTransactions: any[] = []
    try {
      if (relevantIds.length > 0) {
        relevantTransactions = await db.query.LiveAccountTransaction.findMany({
           where: (table) => and(
             eq(table.userId, internalUserId),
             inArray(table.accountId, relevantIds),
           ),
        })
      }
    } catch (error) {
      reportError(error, {
        surface: 'api',
        operation: 'load-account-transactions',
        route: request.nextUrl.pathname,
        requestId,
        userId: internalUserId,
      })
     }
    

    const finalAccounts = paginated.map(acc => {
      let calcTrades = []
      if (acc.accountType === 'prop-firm') {
         calcTrades = relevantTrades.filter(t => {
           if (t.phaseAccountId) {
             return t.phaseAccountId === acc.id
           }
           return t.accountNumber === acc.number
         })
      } else {
         calcTrades = relevantTrades.filter(t => t.accountNumber === acc.number)
      }

      const calculatedEquity = calculateAccountBalance(acc, calcTrades, relevantTransactions, {
         excludeFailedAccounts: false,
         includePayouts: true
      })
      
      const pnl = calculatedEquity - (acc.startingBalance || 0)
      

      const groupedCount = calcTrades.length > 0 ? buildGroupedTradeCountSummary(calcTrades as any).groupedTradeCount : 0
      
      return {
         ...acc,
         calculatedEquity,
         pnl,
         tradeCount: groupedCount
      }
    })

    return createSuccessResponse(
      finalAccounts,
      undefined,
      {
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        },
      },
      requestId,
    )

  } catch (error: any) {
    reportError(error, {
      surface: 'api',
      operation: 'list-accounts',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Internal server error', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const internalUserId = identity.internalUserId
    const body = await request.json() as {
      name?: string
      number?: string
      startingBalance?: number
      broker?: string
    }
    const account = await createLiveAccountForUser(internalUserId, {
      name: body.name ?? '',
      number: body.number ?? '',
      startingBalance: Number(body.startingBalance),
      broker: body.broker ?? '',
    }, {
      source: 'api',
      requestId,
      ipAddress: getClientIp(request.headers),
    })
    return createSuccessResponse(
      {
        ...account,
        accountType: 'live',
        displayName: account.name || account.number,
        isOnboardingSample: account.isOnboardingSample,
      },
      undefined,
      undefined,
      requestId,
      { status: 201 },
    )
  } catch (error: any) {
    if (isDomainError(error)) {
      return createErrorResponse(
        error.message,
        error.status,
        undefined,
        error.code,
        requestId,
      )
    }
    reportError(error, {
      surface: 'api',
      operation: 'create-account',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Internal server error',
      500,
      undefined,
      'ACCOUNT_CREATE_FAILED',
      requestId,
    )
  }
}
