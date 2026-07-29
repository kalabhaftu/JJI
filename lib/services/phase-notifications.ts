import type { PhaseRiskAlert } from '@/lib/prop-firm/phase-evaluation/types'
import { reportError } from '@/lib/observability/report-error'
import { createRiskAlert } from '@/lib/services/notification-service'

type CreateRiskAlert = typeof createRiskAlert

export async function dispatchPhaseRiskAlerts(
  alerts: PhaseRiskAlert[],
  context: {
    requestId?: string
    createAlert?: CreateRiskAlert
    report?: typeof reportError
  } = {},
): Promise<{ sent: number; failed: number }> {
  const send = context.createAlert ?? createRiskAlert
  const report = context.report ?? reportError
  let sent = 0
  let failed = 0

  for (const alert of alerts) {
    try {
      const result = await send(
        alert.userId,
        alert.phaseAccountId,
        alert.riskType,
        alert.currentPercentage,
        alert.metadata,
      )
      if (!result.success) {
        throw new Error(result.error ?? 'Risk notification failed')
      }
      sent += 1
    } catch (error) {
      failed += 1
      report(error, {
        surface: 'phase-evaluation',
        operation: 'dispatch-risk-alert',
        entityId: alert.phaseAccountId,
        ...(context.requestId ? { requestId: context.requestId } : {}),
        extra: {
          riskType: alert.riskType,
          percentage: alert.currentPercentage,
        },
      })
    }
  }

  return { sent, failed }
}
