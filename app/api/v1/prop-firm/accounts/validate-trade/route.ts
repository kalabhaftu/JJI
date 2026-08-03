import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'


const ValidateTradeSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required')
})

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const internalUserId = identity.internalUserId

    const body = await request.json()
    const { accountNumber } = ValidateTradeSchema.parse(body)


    const [phaseResult] = await db
      .select({ phaseAccount: schema.PhaseAccount })
      .from(schema.PhaseAccount)
      .innerJoin(
        schema.MasterAccount,
        eq(schema.PhaseAccount.masterAccountId, schema.MasterAccount.id)
      )
      .where(and(
        eq(schema.PhaseAccount.phaseId, accountNumber),
        eq(schema.PhaseAccount.status, 'active'),
        eq(schema.MasterAccount.userId, internalUserId)
      ))
      .limit(1)
    const phaseAccount = phaseResult?.phaseAccount

    if (phaseAccount) {

      if (!phaseAccount.phaseId) {
        return createErrorResponse(
          'Please set the ID for the current phase before adding trades.',
          403,
          undefined,
          'PHASE_ID_REQUIRED',
          requestId,
        )
      }


      return createSuccessResponse(
        {
          accountType: 'prop-firm',
          phaseNumber: phaseAccount.phaseNumber,
          masterAccountId: phaseAccount.masterAccountId
        },
        undefined,
        undefined,
        requestId,
      )
    }


    const regularAccount = await db.query.Account.findFirst({
      where: (table, { and, eq }) => and(
        eq(table.number, accountNumber),
        eq(table.userId, internalUserId)
      )
    })

    if (regularAccount) {

      return createSuccessResponse(
        {
          accountType: 'regular',
          accountId: regularAccount.id
        },
        undefined,
        undefined,
        requestId,
      )
    }


    return createErrorResponse('Account not found or unauthorized', 404, undefined, 'NOT_FOUND', requestId)

  } catch (error) {
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('Validation failed', 400, error.errors, 'VALIDATION_ERROR', requestId)
    }

    reportError(error, { surface: 'api', operation: 'validate-trade-account', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Failed to validate trade', 500, undefined, 'TRADE_VALIDATION_FAILED', requestId)
  }
}
