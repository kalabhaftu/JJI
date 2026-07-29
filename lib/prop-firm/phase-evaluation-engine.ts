import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getDateInTimezone } from '@/lib/prop-firm/phase-evaluation/breach'
import {
  calculateDailyAnchorEquity,
  getDailyAnchorDate,
  resolveDailyAnchorValue,
} from '@/lib/prop-firm/phase-evaluation/anchor'
import {
  buildPhaseEvaluationMetrics,
  evaluateCurrentPhase,
  evaluateHistoricalBreaches,
} from '@/lib/prop-firm/phase-evaluation/evaluate'
import type {
  PhaseEvaluationResult,
  PhaseMasterInput,
  PhaseRulesInput,
  PhaseTradeInput,
} from '@/lib/prop-firm/phase-evaluation/types'
import { reportError } from '@/lib/observability/report-error'

export type {
  DrawdownCalculation,
  PhaseEvaluationResult,
  PhaseProgress,
  PhaseRiskAlert,
} from '@/lib/prop-firm/phase-evaluation/types'

interface EvaluationContext {
  requestId?: string
  evaluatedAt?: Date
}

export class PhaseEvaluationEngine {
  static async evaluatePhase(
    masterAccountId: string,
    phaseAccountId: string,
    context: EvaluationContext = {},
  ): Promise<PhaseEvaluationResult> {
    const evaluatedAt = context.evaluatedAt ?? new Date()

    try {
      const phaseAccount = await db.query.PhaseAccount.findFirst({
        where: eq(schema.PhaseAccount.id, phaseAccountId),
        with: {
          MasterAccount: { with: { User: true } },
          Trade: {
            orderBy: (trade, { asc }) => [asc(trade.exitTime)],
          },
        },
      })
      if (!phaseAccount || phaseAccount.masterAccountId !== masterAccountId) {
        throw new Error('Phase account not found')
      }

      const rules = phaseAccount as PhaseRulesInput
      const trades = phaseAccount.Trade as PhaseTradeInput[]
      const master: PhaseMasterInput = {
        accountSize: phaseAccount.MasterAccount.accountSize,
        userId: phaseAccount.MasterAccount.userId,
        accountName: phaseAccount.MasterAccount.accountName,
      }
      const metrics = buildPhaseEvaluationMetrics(
        rules,
        trades,
        master,
        evaluatedAt,
      )
      const historicalFailure = evaluateHistoricalBreaches(
        phaseAccountId,
        rules,
        trades,
        master,
        metrics,
      )
      if (historicalFailure) return historicalFailure

      const dailyStartBalance = await this.getDailyStartBalance(
        phaseAccountId,
        'UTC',
        master.accountSize,
        evaluatedAt,
        context.requestId,
      )
      return evaluateCurrentPhase(
        phaseAccountId,
        rules,
        master,
        metrics,
        dailyStartBalance,
        evaluatedAt,
      )
    } catch (error) {
      reportError(error, {
        surface: 'phase-evaluation',
        operation: 'evaluate-phase',
        entityId: phaseAccountId,
        ...(context.requestId ? { requestId: context.requestId } : {}),
        extra: { masterAccountId },
      })
      throw error
    }
  }

  private static async getDailyStartBalance(
    phaseAccountId: string,
    timezone: string,
    fallbackBalance: number,
    evaluatedAt: Date,
    requestId?: string,
  ): Promise<number> {
    const today = getDateInTimezone(evaluatedAt, timezone)
    const todayDate = getDailyAnchorDate(evaluatedAt, timezone)
    const todayAnchor = await db.query.DailyAnchor.findFirst({
      where: and(
        eq(schema.DailyAnchor.phaseAccountId, phaseAccountId),
        eq(schema.DailyAnchor.date, todayDate),
      ),
    })
    if (todayAnchor) return todayAnchor.anchorEquity

    try {
      const phaseAccount = await db.query.PhaseAccount.findFirst({
        where: eq(schema.PhaseAccount.id, phaseAccountId),
        with: {
          MasterAccount: true,
          Trade: {
            where: (table, operators) => operators.or(
              operators.lt(table.exitTime, todayDate),
              operators.and(
                operators.isNull(table.exitTime),
                operators.lt(table.createdAt, todayDate),
              ),
            ),
            orderBy: (trade, { asc }) => [asc(trade.exitTime)],
          },
        },
      })
      if (!phaseAccount) return fallbackBalance

      const anchorEquity = calculateDailyAnchorEquity(
        phaseAccount.MasterAccount.accountSize,
        phaseAccount.Trade as PhaseTradeInput[],
      )
      const [anchor] = await db.insert(schema.DailyAnchor)
        .values({
          id: crypto.randomUUID(),
          phaseAccountId,
          date: todayDate,
          anchorEquity,
        })
        .onConflictDoNothing({
          target: [
            schema.DailyAnchor.phaseAccountId,
            schema.DailyAnchor.date,
          ],
        })
        .returning()
      if (anchor) return resolveDailyAnchorValue(
        anchor.anchorEquity,
        undefined,
        fallbackBalance,
      )

      const concurrentAnchor = await db.query.DailyAnchor.findFirst({
        where: and(
          eq(schema.DailyAnchor.phaseAccountId, phaseAccountId),
          eq(schema.DailyAnchor.date, todayDate),
        ),
      })
      return resolveDailyAnchorValue(
        undefined,
        concurrentAnchor?.anchorEquity,
        fallbackBalance,
      )
    } catch (error) {
      reportError(error, {
        surface: 'phase-evaluation',
        operation: 'create-daily-anchor',
        entityId: phaseAccountId,
        ...(requestId ? { requestId } : {}),
        extra: { fallbackUsed: true, date: today },
      })
      return fallbackBalance
    }
  }
}
