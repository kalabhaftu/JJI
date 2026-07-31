import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

const ValidateTradeSchema = z.object({
  accountNumber: z.string().min(1, 'Account number is required')
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
        return NextResponse.json(
          { 
            success: false, 
            error: 'Please set the ID for the current phase before adding trades.' 
          },
          { status: 403 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          accountType: 'prop-firm',
          phaseNumber: phaseAccount.phaseNumber,
          masterAccountId: phaseAccount.masterAccountId
        }
      })
    }

    const regularAccount = await db.query.Account.findFirst({
      where: (table, { and, eq }) => and(
        eq(table.number, accountNumber),
        eq(table.userId, internalUserId)
      )
    })

    if (regularAccount) {
      return NextResponse.json({
        success: true,
        data: {
          accountType: 'regular',
          accountId: regularAccount.id
        }
      })
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Account not found or unauthorized' 
      },
      { status: 404 }
    )

  } catch (error) {
    
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

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to validate trade' 
      },
      { status: 500 }
    )
  }
}
