import { reportError } from '@/lib/observability/report-error'
import { NotificationService } from '@/server/services/notification-service'

export async function notifyPayoutRequested(input: {
  userId: string
  payoutId: string
  phaseAccountId: string
  amount: number
  requestId?: string
}) {
  try {
    await NotificationService.send({
      userId: input.userId,
      type: 'SYSTEM',
      title: 'Payout Requested',
      message: `Request for $${input.amount.toFixed(2)} submitted.`,
      data: {
        payoutId: input.payoutId,
        amount: input.amount,
        phaseAccountId: input.phaseAccountId,
      },
    })
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'notify-payout-created',
      entityId: input.payoutId,
      ...(input.requestId ? { requestId: input.requestId } : {}),
    })
  }
}
