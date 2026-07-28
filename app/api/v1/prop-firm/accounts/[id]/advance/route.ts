import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { revalidateTag } from 'next/cache'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { eq, and, ne } from 'drizzle-orm'

interface RouteParams {
  params: Promise<{ id: string }>
}

const AdvanceSchema = z.object({
  nextPhaseId: z.string().min(1, 'Next phase ID is required'),
})

function isFundedPhase(evaluationType: string, phaseNumber: number): boolean {
  return isFundedPhaseForEvaluation(evaluationType, phaseNumber)
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { id: masterAccountId } = await params
    const body = await request.json()
    const { nextPhaseId } = AdvanceSchema.parse(body)

    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq, and }) =>
        and(
          eq(table.id, masterAccountId),
          eq(table.userId, internalUserId),
          ne(table.status, 'failed')
        ),
      with: {
        PhaseAccount: {
          orderBy: (phaseAccount, { asc }) => [asc(phaseAccount.phaseNumber)],
        },
      },
    })

    if (!masterAccount) {
      return NextResponse.json(
        { success: false, error: 'Master account not found or unauthorized' },
        { status: 404 }
      )
    }

    const currentPhase = masterAccount.PhaseAccount.find(
      (phase: any) =>
        phase.phaseNumber === masterAccount.currentPhase &&
        (phase.status === 'active' || phase.status === 'pending_approval')
    )

    if (!currentPhase) {
      return NextResponse.json(
        { success: false, error: 'No active or pending approval phase found to advance from' },
        { status: 400 }
      )
    }

    const nextPhaseNumber = masterAccount.currentPhase + 1

    const nextPhase = masterAccount.PhaseAccount.find(
      (phase: any) => phase.phaseNumber === nextPhaseNumber
    )

    if (!nextPhase) {
      return NextResponse.json(
        { success: false, error: 'Next phase not found' },
        { status: 400 }
      )
    }

    const result = await db.transaction(async (tx) => {
      await tx
        .update(schema.PhaseAccount)
        .set({
          status: 'passed',
          endDate: new Date(),
        })
        .where(and(
          eq(schema.PhaseAccount.id, currentPhase.id),
          eq(schema.PhaseAccount.masterAccountId, masterAccountId),
        ))

      const updatedNextPhase = (
        await tx
          .update(schema.PhaseAccount)
          .set({
            status: 'active',
            phaseId: nextPhaseId,
            startDate: new Date(),
          })
          .where(and(
            eq(schema.PhaseAccount.id, nextPhase.id),
            eq(schema.PhaseAccount.masterAccountId, masterAccountId),
          ))
          .returning()
      )[0]

      const isTransitioningToFunded = isFundedPhase(
        masterAccount.evaluationType,
        nextPhaseNumber
      )

      const updatedMasterAccount = (
        await tx
          .update(schema.MasterAccount)
          .set({
            currentPhase: nextPhaseNumber,
            ...(isTransitioningToFunded && { status: 'funded' }),
          })
          .where(and(
            eq(schema.MasterAccount.id, masterAccountId),
            eq(schema.MasterAccount.userId, internalUserId),
          ))
          .returning()
      )[0]

      return {
        masterAccount: updatedMasterAccount,
        previousPhase: currentPhase,
        currentPhase: updatedNextPhase,
      }
    })

    const nextPhaseName = isFundedPhase(masterAccount.evaluationType, nextPhaseNumber)
      ? 'Funded'
      : `Phase ${nextPhaseNumber}`

    revalidateTag(`accounts-${internalUserId}`)

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully advanced to ${nextPhaseName}`,
    })
  } catch (error) {
    logger.error({ error, context: 'Prop-firm Advance' }, 'Phase advance error')

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to advance phase',
      },
      { status: 500 }
    )
  }
}
