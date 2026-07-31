import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { validatePhaseId } from '@/lib/validation/phase-id-validator'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, desc, asc } from 'drizzle-orm'

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

export async function POST(request: NextRequest) {
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

    const result = await db.transaction(async (tx) => {
      const masterAccount = (await tx.insert(schema.MasterAccount).values({
        id: crypto.randomUUID(),
        userId: internalUserId,
        accountName: validatedData.accountName,
        propFirmName: validatedData.propFirmName,
        accountSize: validatedData.accountSize,
        evaluationType: validatedData.evaluationType,
        currentPhase: 1,
        status: 'active'
      }).returning())[0]

      const phase1 = (await tx.insert(schema.PhaseAccount).values({
        id: crypto.randomUUID(),
        masterAccountId: masterAccount!.id,
        phaseNumber: 1,
        phaseId: validatedData.phase1AccountId,
        status: 'active',
        profitTargetPercent: validatedData.evaluationType === 'Instant' ? 0 : validatedData.phase1ProfitTargetPercent,
        dailyDrawdownPercent: validatedData.phase1DailyDrawdownPercent,
        maxDrawdownPercent: validatedData.phase1MaxDrawdownPercent,
        maxDrawdownType: validatedData.phase1MaxDrawdownType || 'static',
        minTradingDays: validatedData.phase1MinTradingDays,
        timeLimitDays: validatedData.phase1TimeLimitDays || undefined,
        consistencyRulePercent: validatedData.phase1ConsistencyRulePercent
      }).returning())[0]

      let phase2 = null
      if (validatedData.evaluationType === 'Two Step') {
        phase2 = (await tx.insert(schema.PhaseAccount).values({
          id: crypto.randomUUID(),
          masterAccountId: masterAccount!.id,
          phaseNumber: 2,
          phaseId: null,
          status: 'pending',
          profitTargetPercent: validatedData.phase2ProfitTargetPercent!,
          dailyDrawdownPercent: validatedData.phase2DailyDrawdownPercent!,
          maxDrawdownPercent: validatedData.phase2MaxDrawdownPercent!,
          maxDrawdownType: validatedData.phase2MaxDrawdownType || 'static',
          minTradingDays: validatedData.phase2MinTradingDays || 0,
          timeLimitDays: validatedData.phase2TimeLimitDays || undefined,
          consistencyRulePercent: validatedData.phase2ConsistencyRulePercent || 0
        }).returning())[0]
      }

      const fundedPhaseNumber = validatedData.evaluationType === 'One Step' ? 2 : 
                               validatedData.evaluationType === 'Instant' ? 1 : 3
      
      const fundedPhase = (await tx.insert(schema.PhaseAccount).values({
        id: crypto.randomUUID(),
        masterAccountId: masterAccount!.id,
        phaseNumber: fundedPhaseNumber,
        phaseId: null,
        status: validatedData.evaluationType === 'Instant' ? 'active' : 'pending',
        profitTargetPercent: 0,
        dailyDrawdownPercent: validatedData.fundedDailyDrawdownPercent,
        maxDrawdownPercent: validatedData.fundedMaxDrawdownPercent,
        maxDrawdownType: validatedData.fundedMaxDrawdownType || 'static',
        minTradingDays: 0,
        timeLimitDays: undefined,
        consistencyRulePercent: 0,
        profitSplitPercent: validatedData.fundedProfitSplitPercent,
        payoutCycleDays: validatedData.fundedPayoutCycleDays,
        minProfitForPayout: validatedData.fundedMinProfitForPayout || 100
      }).returning())[0]

      if (validatedData.evaluationType === 'Instant') {
        await tx.update(schema.PhaseAccount)
          .set({ phaseId: validatedData.phase1AccountId })
          .where(eq(schema.PhaseAccount.id, fundedPhase!.id))
        
        await tx.update(schema.MasterAccount)
          .set({ currentPhase: fundedPhaseNumber })
          .where(eq(schema.MasterAccount.id, masterAccount!.id))
      }

      return {
        masterAccount,
        phases: [phase1, phase2, fundedPhase].filter(Boolean)
      }
    })

    revalidateTag(`accounts-${internalUserId}`)
    
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

    logger.error('[API] Failed to create master account: ' + error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create master account' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch master accounts' 
      },
      { status: 500 }
    )
  }
}