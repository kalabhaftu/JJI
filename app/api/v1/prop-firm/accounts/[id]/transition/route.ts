import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { revalidateTag } from 'next/cache'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { eq, ne, and } from 'drizzle-orm'
// NOTE: Do NOT import triggerDataRefresh here - it's a client-only module ('use client')
// Use revalidateTag for cache invalidation instead

interface RouteParams {
  params: Promise<{ id: string }>
}

// Validation schema for phase transition
const PhaseTransitionSchema = z.object({
  nextPhaseId: z.string().min(1, 'Next phase ID is required')
})

/**
 * Helper function to determine if a phase number represents the funded stage
 * based on the evaluation type.
 */
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
    // NO PARSING NEEDED - phase transition receives pure masterAccountId, not composite ID
    const body = await request.json()
    const { nextPhaseId } = PhaseTransitionSchema.parse(body)

    // Verify the master account belongs to the user
    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq, ne, and }) => and(
        eq(table.id, masterAccountId),
        eq(table.userId, internalUserId),
        ne(table.status, 'failed')
      ),
      with: {
        PhaseAccount: {
          orderBy: (table, { asc }) => [asc(table.phaseNumber)]
        }
      }
    })

    if (!masterAccount) {
      return NextResponse.json(
        { success: false, error: 'Master account not found or unauthorized' },
        { status: 404 }
      )
    }

    // Find the current phase (can be 'active' or 'pending_approval' if profit target was met)
    const currentPhase = masterAccount.PhaseAccount.find(
      (phase: (typeof masterAccount.PhaseAccount)[number]) =>
        phase.phaseNumber === masterAccount.currentPhase &&
        (phase.status === 'active' || phase.status === 'pending_approval')
    )

    if (!currentPhase) {
      return NextResponse.json(
        { success: false, error: 'No active or pending approval phase found to transition from' },
        { status: 400 }
      )
    }

    // Determine the next phase number
    const nextPhaseNumber = masterAccount.currentPhase + 1
    
    // Find the next phase
    const nextPhase = masterAccount.PhaseAccount.find(
      (phase: (typeof masterAccount.PhaseAccount)[number]) =>
        phase.phaseNumber === nextPhaseNumber
    )

    if (!nextPhase) {
      return NextResponse.json(
        { success: false, error: 'Next phase not found' },
        { status: 400 }
      )
    }

    // Perform the transition in a transaction
    const result = await db.transaction(async (tx) => {
      // Mark the current phase as passed (not archived)
      await tx.update(schema.PhaseAccount)
        .set({ status: 'passed', endDate: new Date() })
        .where(and(
          eq(schema.PhaseAccount.id, currentPhase.id),
          eq(schema.PhaseAccount.masterAccountId, masterAccountId),
        ))
        .returning()

      // Activate the next phase and set its phaseId
      const updatedNextPhase = (await tx.update(schema.PhaseAccount)
        .set({ status: 'active', phaseId: nextPhaseId, startDate: new Date() })
        .where(and(
          eq(schema.PhaseAccount.id, nextPhase.id),
          eq(schema.PhaseAccount.masterAccountId, masterAccountId),
        ))
        .returning())[0]

      // Determine if the next phase is the funded phase based on evaluation type
      const isTransitioningToFunded = isFundedPhase(masterAccount.evaluationType, nextPhaseNumber)

      // Update the master account's current phase and status
      const updatedMasterAccount = (await tx.update(schema.MasterAccount)
        .set({
          currentPhase: nextPhaseNumber,
          status: isTransitioningToFunded ? 'funded' : 'active',
          updatedAt: new Date()
        })
        .where(and(
          eq(schema.MasterAccount.id, masterAccountId),
          eq(schema.MasterAccount.userId, internalUserId),
        ))
        .returning())[0]

      return {
        masterAccount: updatedMasterAccount,
        previousPhase: currentPhase,
        currentPhase: updatedNextPhase
      }
    })

    // Determine display name for the next phase
    const nextPhaseName = isFundedPhase(masterAccount.evaluationType, nextPhaseNumber)
      ? 'Funded'
      : `Phase ${nextPhaseNumber}`

    // Invalidate cache so UI updates on refresh
    revalidateTag(`accounts-${internalUserId}`)
    // NOTE: Real-time refresh is handled client-side via polling or manual refresh
    // triggerDataRefresh cannot be used here as it's a client-only module

    return NextResponse.json({
      success: true,
      data: result,
      message: `Successfully transitioned to ${nextPhaseName}`
    })

  } catch (error) {
    logger.error({ error }, 'Phase transition error:')
    
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
        error: 'Failed to transition phase'
      },
      { status: 500 }
    )
  }
}
