import { NextRequest, NextResponse } from 'next/server'
import { reportApiHandlerError, withCanonicalApiResponse } from '@/lib/api/canonical-handler'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { z } from 'zod'
import { validatePhaseId } from '@/lib/validation/phase-id-validator'
import { db } from '@/lib/db/client'
import { desc, asc } from 'drizzle-orm'
import { createPropFirmAccountForUser } from '@/server/accounts/prop-firm-lifecycle'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'

const CreateMasterAccountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required'),
  propFirmName: z.string().min(1, 'Prop firm name is required'),
  accountSize: z.number().positive('Account size must be positive'),
  evaluationType: z.enum(['One Step', 'Two Step', 'Instant']),
  phase1AccountId: z.string().min(1, 'Phase 1 account ID is required'),
  phase1ProfitTargetPercent: z.number().min(0).max(100),
  phase1DailyDrawdownPercent: z.number().min(0).max(100),
  phase1MaxDrawdownPercent: z.number().min(0).max(100),
  phase1MinTradingDays: z.number().min(0).default(0),
  phase1TimeLimitDays: z.number().min(0).default(0).nullable(),
  phase1MaxDrawdownType: z.enum(['static', 'trailing']).default('static'),
  phase1ConsistencyRulePercent: z.number().min(0).max(100).default(0),
  phase2ProfitTargetPercent: z.number().min(0).max(100).optional(),
  phase2DailyDrawdownPercent: z.number().min(0).max(100).optional(),
  phase2MaxDrawdownPercent: z.number().min(0).max(100).optional(),
  phase2MinTradingDays: z.number().min(0).default(0).optional(),
  phase2TimeLimitDays: z.number().min(0).default(0).nullable().optional(),
  phase2MaxDrawdownType: z.enum(['static', 'trailing']).default('static').optional(),
  phase2ConsistencyRulePercent: z.number().min(0).max(100).default(0).optional(),
  fundedDailyDrawdownPercent: z.number().min(0).max(100),
  fundedMaxDrawdownPercent: z.number().min(0).max(100),
  fundedMaxDrawdownType: z.enum(['static', 'trailing']).default('static'),
  fundedProfitSplitPercent: z.number().min(0).max(100),
  fundedPayoutCycleDays: z.number().min(1),
  fundedMinProfitForPayout: z.number().min(0).default(100)
})

async function createPropFirmAccount(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes
  const requestId = resolveRequestId(request.headers)

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    const body = await request.json()
    const validatedData = CreateMasterAccountSchema.parse(body)

    const phaseIdValidation = await validatePhaseId(internalUserId, validatedData.phase1AccountId)
    if (!phaseIdValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: phaseIdValidation.error,
          conflictingAccount: phaseIdValidation.conflictingAccount
        },
        { status: 400 }
      )
    }

    const result = await createPropFirmAccountForUser(
      internalUserId,
      validatedData,
      {
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
      },
    )
    
    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error?.code === 'P1001') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed. Please check your internet connection and try again.',
          retryable: true
        },
        { status: 503 }
      )
    }

    if (error?.code === 'P2028' || error?.message?.includes('Transaction already closed')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Request timed out due to network issues. Please try again.',
          retryable: true
        },
        { status: 408 }
      )
    }

    if (error?.code === 'P2002') {
      const target = error?.meta?.target
      if (target?.includes('accountName')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'An account with this name already exists. Please choose a different name.',
            field: 'accountName'
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { 
          success: false, 
          error: 'A record with these details already exists.',
          field: target
        },
        { status: 400 }
      )
    }

    reportApiHandlerError(request, error, 'create-prop-firm-account')
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create master account' 
      },
      { status: 500 }
    )
  }
}

async function listPropFirmAccounts(request: NextRequest) {
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
    const internalUserId = identity.internalUserId

    const masterAccounts = await db.query.MasterAccount.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      with: {
        PhaseAccount: {
          orderBy: (table, { asc }) => [asc(table.phaseNumber)]
        }
      },
      orderBy: (table, { desc }) => [desc(table.createdAt)]
    })

    return NextResponse.json({
      success: true,
      data: masterAccounts
    })

  } catch (error) {
    reportApiHandlerError(request, error, 'list-prop-firm-accounts')
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch master accounts' 
      },
      { status: 500 }
    )
  }
}

export const POST = withCanonicalApiResponse(createPropFirmAccount)
export const GET = withCanonicalApiResponse(listPropFirmAccounts)
