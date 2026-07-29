import { and, eq, ne } from 'drizzle-orm'

import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { DomainError } from '@/lib/domain-error'
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { invalidateUserAccountCaches } from '@/server/accounts/cache'

export async function advancePropFirmPhaseForUser(input: {
  userId: string
  masterAccountId: string
  nextPhaseId: string
  context: {
    requestId?: string
    ipAddress?: string | null
    source: 'api' | 'background-job'
  }
}) {
  const masterAccount = await db.query.MasterAccount.findFirst({
    where: (table, operators) => operators.and(
      operators.eq(table.id, input.masterAccountId),
      operators.eq(table.userId, input.userId),
      operators.ne(table.status, 'failed'),
    ),
    with: {
      PhaseAccount: {
        orderBy: (table, operators) => [operators.asc(table.phaseNumber)],
      },
    },
  })
  if (!masterAccount) {
    throw new DomainError(
      'Master account not found or unauthorized',
      'NOT_FOUND',
      404,
    )
  }

  const currentPhase = masterAccount.PhaseAccount.find(
    (phase) => phase.phaseNumber === masterAccount.currentPhase
      && (phase.status === 'active' || phase.status === 'pending_approval'),
  )
  if (!currentPhase) {
    throw new DomainError(
      'No active or pending approval phase found to advance from',
      'NO_ACTIVE_PHASE',
      400,
    )
  }

  const nextPhaseNumber = masterAccount.currentPhase + 1
  const nextPhase = masterAccount.PhaseAccount.find(
    (phase) => phase.phaseNumber === nextPhaseNumber,
  )
  if (!nextPhase) {
    throw new DomainError('Next phase not found', 'NEXT_PHASE_NOT_FOUND', 400)
  }
  const isFunded = isFundedPhaseForEvaluation(
    masterAccount.evaluationType,
    nextPhaseNumber,
  )

  const result = await db.transaction(async (tx) => {
    await tx.update(schema.PhaseAccount)
      .set({ status: 'passed', endDate: new Date() })
      .where(and(
        eq(schema.PhaseAccount.id, currentPhase.id),
        eq(schema.PhaseAccount.masterAccountId, input.masterAccountId),
      ))

    const [updatedNextPhase] = await tx.update(schema.PhaseAccount)
      .set({
        status: 'active',
        phaseId: input.nextPhaseId,
        startDate: new Date(),
      })
      .where(and(
        eq(schema.PhaseAccount.id, nextPhase.id),
        eq(schema.PhaseAccount.masterAccountId, input.masterAccountId),
      ))
      .returning()
    const [updatedMasterAccount] = await tx.update(schema.MasterAccount)
      .set({
        currentPhase: nextPhaseNumber,
        status: isFunded ? 'funded' : 'active',
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.MasterAccount.id, input.masterAccountId),
        eq(schema.MasterAccount.userId, input.userId),
        ne(schema.MasterAccount.status, 'failed'),
      ))
      .returning()
    if (!updatedNextPhase || !updatedMasterAccount) {
      throw new Error('Phase transition lost its ownership predicate')
    }

    await recordAuditEvent({
      userId: input.userId,
      action: 'PHASE_ADVANCED',
      entityType: 'MasterAccount',
      entityId: input.masterAccountId,
      source: input.context.source,
      requestId: input.context.requestId ?? null,
      ipAddress: input.context.ipAddress ?? null,
      beforeData: {
        currentPhase: masterAccount.currentPhase,
        phaseAccountId: currentPhase.id,
        status: masterAccount.status,
      },
      afterData: {
        currentPhase: nextPhaseNumber,
        phaseAccountId: updatedNextPhase.id,
        status: updatedMasterAccount.status,
      },
    }, tx as never)

    return {
      masterAccount: updatedMasterAccount,
      previousPhase: currentPhase,
      currentPhase: updatedNextPhase,
    }
  })

  await invalidateUserAccountCaches(input.userId, input.context.requestId)
  return {
    ...result,
    nextPhaseName: isFunded ? 'Funded' : `Phase ${nextPhaseNumber}`,
  }
}
