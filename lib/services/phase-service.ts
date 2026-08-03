import { db } from '@/lib/db/client'
import { PhaseAccount, MasterAccount, BreachRecord, Notification } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { PhaseEvaluationEngine } from '@/lib/prop-firm/phase-evaluation-engine'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { reportError } from '@/lib/observability/report-error'
import { dispatchPhaseRiskAlerts } from '@/lib/services/phase-notifications'
import { recordAuditEvent } from '@/lib/audit-logger'
import logger from '@/lib/logger'

async function applyPhaseEvaluation(
  phase: any,
  evaluation: Awaited<ReturnType<typeof PhaseEvaluationEngine.evaluatePhase>>,
  requestId?: string,
) {
  const masterAccount = await db.query.MasterAccount.findFirst({
    where: (table, { eq }) => eq(table.id, phase.masterAccountId),
    with: {
      PhaseAccount: {
        orderBy: (table, { asc }) => [asc(table.phaseNumber)],
      },
    },
  })

  if (!masterAccount) return false

  if (evaluation.isFailed) {
    return db.transaction(async (tx) => {
      const transitioned = await tx.update(PhaseAccount)
        .set({ status: 'failed', endDate: new Date() })
        .where(and(eq(PhaseAccount.id, phase.id), eq(PhaseAccount.status, 'active')))
        .returning({ id: PhaseAccount.id })

      if (transitioned.length === 0) return false

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
      await recordAuditEvent({
        userId: masterAccount.userId,
        action: 'PHASE_FAILED',
        entityType: 'PhaseAccount',
        entityId: phase.id,
        source: 'background-job',
        ...(requestId ? { requestId } : {}),
        beforeData: { status: 'active' },
        afterData: {
          status: 'failed',
          breachType: evaluation.drawdown.breachType,
          breachAmount: evaluation.drawdown.breachAmount,
        },
      }, tx as never)
      return true
    })
  }

  if (!evaluation.isPassed || !evaluation.canAdvance) return false

  const currentPhase = masterAccount.PhaseAccount.find((candidate) => candidate.id === phase.id)
  if (!currentPhase) return false

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
    return db.transaction(async (tx) => {
      const transitioned = await tx.update(PhaseAccount)
        .set({ status: 'passed', endDate: new Date() })
        .where(and(eq(PhaseAccount.id, currentPhase.id), eq(PhaseAccount.status, 'active')))
        .returning({ id: PhaseAccount.id })

      if (transitioned.length === 0) return false

      await tx.update(PhaseAccount)
        .set({ status: 'active', startDate: new Date() })
        .where(and(eq(PhaseAccount.id, nextPhase.id), eq(PhaseAccount.status, 'pending')))
      await tx.update(MasterAccount)
        .set({ currentPhase: nextPhase.phaseNumber })
        .where(and(eq(MasterAccount.id, masterAccount.id), eq(MasterAccount.status, 'active')))
      await recordAuditEvent({
        userId: masterAccount.userId,
        action: 'PHASE_ADVANCED',
        entityType: 'MasterAccount',
        entityId: masterAccount.id,
        source: 'background-job',
        ...(requestId ? { requestId } : {}),
        beforeData: { currentPhase: currentPhase.phaseNumber },
        afterData: { currentPhase: nextPhase.phaseNumber },
      }, tx as never)
      return true
    })
  }

  const notificationType = isTransitioningToFunded
    ? 'FUNDED_PENDING_APPROVAL'
    : 'PHASE_TRANSITION_PENDING'
  const message = isTransitioningToFunded
    ? `Your ${masterAccount.accountName} has passed all evaluation phases. Please confirm your firm's approval.`
    : `Your ${masterAccount.accountName} has met the profit target. Enter your ${nextPhaseName} account ID to continue.`

  return db.transaction(async (tx) => {
    const updated = await tx.update(PhaseAccount)
      .set({ status: 'pending_approval', endDate: new Date() })
      .where(and(eq(PhaseAccount.id, currentPhase.id), eq(PhaseAccount.status, 'active')))
      .returning({ id: PhaseAccount.id })

    if (updated.length === 0) return false

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
    await recordAuditEvent({
      userId: masterAccount.userId,
      action: 'PHASE_PENDING_APPROVAL',
      entityType: 'PhaseAccount',
      entityId: currentPhase.id,
      source: 'background-job',
      ...(requestId ? { requestId } : {}),
      beforeData: { status: 'active' },
      afterData: {
        status: 'pending_approval',
        nextPhaseNumber: nextPhase?.phaseNumber ?? currentPhase.phaseNumber + 1,
      },
    }, tx as never)
    return true
  })
}


export async function evaluateAllActivePhases(options?: {
  masterAccountId?: string
  phaseAccountId?: string
  requestId?: string
}) {
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
    

    const activePhases = activePhasesRaw.filter(p => p.MasterAccount?.status === 'active')

    results.totalPhases = activePhases.length


    for (const phase of activePhases) {
      try {
        const evaluation = await PhaseEvaluationEngine.evaluatePhase(
          phase.masterAccountId,
          phase.id,
          options?.requestId ? { requestId: options.requestId } : {},
        )

        results.evaluated++

        const stateChanged = await applyPhaseEvaluation(
          phase,
          evaluation,
          options?.requestId,
        )
        if (!evaluation.isFailed || stateChanged) {
          await dispatchPhaseRiskAlerts(
            evaluation.alerts,
            options?.requestId ? { requestId: options.requestId } : {},
          )
        }

        logger.info({
          event: 'phase_evaluation_completed',
          phaseAccountId: phase.id,
          masterAccountId: phase.masterAccountId,
          requestId: options?.requestId,
          outcome: evaluation.isFailed
            ? 'failed'
            : evaluation.isPassed
              ? 'passed'
              : 'continued',
          stateChanged,
        }, 'Phase evaluation completed')

        if (evaluation.isFailed) results.failed++


        if (evaluation.isPassed && !evaluation.isFailed) {
          results.passed++
        }

      } catch (error) {
        const errorMsg = `Phase ${phase.id} (${phase.MasterAccount.accountName}): evaluation failed`
        results.errors.push(errorMsg)
        reportError(error, {
          surface: 'phase-evaluation',
          operation: 'evaluate-active-phase',
          entityId: phase.id,
          ...(options?.requestId ? { requestId: options.requestId } : {}),
          extra: { masterAccountId: phase.masterAccountId },
        })
      }
    }
  } catch (err) {
    results.errors.push(`General Evaluation Error: ${err instanceof Error ? err.message : 'unknown error'}`)
    reportError(err, {
      surface: 'phase-evaluation',
      operation: 'evaluate-all-active-phases',
      ...(options?.requestId ? { requestId: options.requestId } : {}),
    })
  }

  return results
}

