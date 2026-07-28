import { db } from '@/lib/db/client'
import { PhaseAccount, MasterAccount, BreachRecord, Notification } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { PhaseEvaluationEngine } from '@/lib/prop-firm/phase-evaluation-engine'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'

async function applyPhaseEvaluation(phase: any, evaluation: Awaited<ReturnType<typeof PhaseEvaluationEngine.evaluatePhase>>) {
  const masterAccount = await db.query.MasterAccount.findFirst({
    where: (table, { eq }) => eq(table.id, phase.masterAccountId),
    with: {
      PhaseAccount: {
        orderBy: (table, { asc }) => [asc(table.phaseNumber)],
      },
    },
  })

  if (!masterAccount) return

  if (evaluation.isFailed) {
    await db.transaction(async (tx) => {
      await tx.update(PhaseAccount)
        .set({ status: 'failed', endDate: new Date() })
        .where(and(eq(PhaseAccount.id, phase.id), eq(PhaseAccount.status, 'active')))

      await tx.update(MasterAccount)
        .set({ status: 'failed' })
        .where(and(eq(MasterAccount.id, phase.masterAccountId), eq(MasterAccount.status, 'active')))

      await tx.insert(BreachRecord).values({
        id: crypto.randomUUID(),
        phaseAccountId: phase.id,
        breachType: evaluation.drawdown.breachType || 'max_drawdown',
        breachAmount: evaluation.drawdown.breachAmount || 0,
        breachTime: evaluation.drawdown.breachTime || new Date(),
        currentEquity: evaluation.drawdown.currentEquity,
        accountSize: masterAccount.accountSize,
        dailyStartBalance: evaluation.drawdown.dailyStartBalance,
        highWaterMark: evaluation.drawdown.highWaterMark,
        notes: `Auto-detected breach during phase evaluation. ${evaluation.drawdown.breachType?.replace('_', ' ')} exceeded by $${evaluation.drawdown.breachAmount?.toFixed(2)}`,
        updatedAt: new Date(),
      }).onConflictDoNothing({
        target: [BreachRecord.phaseAccountId, BreachRecord.breachType],
      })
    })
    return
  }

  if (!evaluation.isPassed || !evaluation.canAdvance) return

  const currentPhase = masterAccount.PhaseAccount.find((candidate) => candidate.id === phase.id)
  if (!currentPhase) return

  const nextPhase = masterAccount.PhaseAccount.find(
    (candidate) => candidate.phaseNumber === currentPhase.phaseNumber + 1,
  )
  const isTransitioningToFunded = isFundedPhaseForEvaluation(
    masterAccount.evaluationType,
    currentPhase.phaseNumber + 1,
  )
  const nextPhaseName = isTransitioningToFunded
    ? 'Funded'
    : `Phase ${currentPhase.phaseNumber + 1}`

  if (nextPhase?.phaseId?.trim()) {
    await db.transaction(async (tx) => {
      const transitioned = await tx.update(PhaseAccount)
        .set({ status: 'passed', endDate: new Date() })
        .where(and(eq(PhaseAccount.id, currentPhase.id), eq(PhaseAccount.status, 'active')))
        .returning({ id: PhaseAccount.id })

      if (transitioned.length === 0) return

      await tx.update(PhaseAccount)
        .set({ status: 'active', startDate: new Date() })
        .where(and(eq(PhaseAccount.id, nextPhase.id), eq(PhaseAccount.status, 'pending')))
      await tx.update(MasterAccount)
        .set({ currentPhase: nextPhase.phaseNumber })
        .where(and(eq(MasterAccount.id, masterAccount.id), eq(MasterAccount.status, 'active')))
    })
    return
  }

  const notificationType = isTransitioningToFunded
    ? 'FUNDED_PENDING_APPROVAL'
    : 'PHASE_TRANSITION_PENDING'
  const message = isTransitioningToFunded
    ? `Your ${masterAccount.accountName} has passed all evaluation phases. Please confirm your firm's approval.`
    : `Your ${masterAccount.accountName} has met the profit target. Enter your ${nextPhaseName} account ID to continue.`

  await db.transaction(async (tx) => {
    const updated = await tx.update(PhaseAccount)
      .set({ status: 'pending_approval', endDate: new Date() })
      .where(and(eq(PhaseAccount.id, currentPhase.id), eq(PhaseAccount.status, 'active')))
      .returning({ id: PhaseAccount.id })

    if (updated.length === 0) return

    await tx.insert(Notification).values({
      userId: masterAccount.userId,
      type: notificationType,
      title: isTransitioningToFunded ? 'Evaluation complete' : `Phase ${currentPhase.phaseNumber} complete`,
      message,
      data: {
        masterAccountId: masterAccount.id,
        phaseAccountId: currentPhase.id,
        accountName: masterAccount.accountName,
        propFirmName: masterAccount.propFirmName,
        currentPhaseNumber: currentPhase.phaseNumber,
        nextPhaseNumber: nextPhase?.phaseNumber ?? currentPhase.phaseNumber + 1,
        evaluationType: masterAccount.evaluationType,
      },
      actionRequired: true,
      updatedAt: new Date(),
    })
  })
}

/**
 * Phase Service
 * Handles bulk evaluation and management of prop firm phase accounts.
 */

export async function evaluateAllActivePhases(options?: { masterAccountId?: string; phaseAccountId?: string }) {
  const results = {
    totalPhases: 0,
    evaluated: 0,
    failed: 0,
    passed: 0,
    errors: [] as string[]
  }

  try {
    const activePhasesRaw = await db.query.PhaseAccount.findMany({
      where: (table, { and, eq }) => and(
        eq(table.status, 'active'),
        ...(options?.masterAccountId ? [eq(table.masterAccountId, options.masterAccountId)] : []),
        ...(options?.phaseAccountId ? [eq(table.id, options.phaseAccountId)] : []),
      ),
      with: {
        MasterAccount: {
          columns: {
            id: true,
            accountName: true,
            accountSize: true,
            status: true
          }
        }
      }
    })
    
    // Filter to those whose MasterAccount is also active
    const activePhases = activePhasesRaw.filter(p => p.MasterAccount?.status === 'active')

    results.totalPhases = activePhases.length

    // Evaluate each active phase
    for (const phase of activePhases) {
      try {
        const evaluation = await PhaseEvaluationEngine.evaluatePhase(
          phase.masterAccountId,
          phase.id
        )

        results.evaluated++

        await applyPhaseEvaluation(phase, evaluation)

        if (evaluation.isFailed) results.failed++

        // If account passed (profit target met)
        if (evaluation.isPassed && !evaluation.isFailed) {
          results.passed++
        }

      } catch (error) {
        const errorMsg = `Phase ${phase.id} (${phase.MasterAccount.accountName}): evaluation failed`
        results.errors.push(errorMsg)
      }
    }
  } catch (err) {
    results.errors.push(`General Evaluation Error: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  return results
}
