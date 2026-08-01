import { inngest } from '../client'
import logger from '@/lib/logger'
import { evaluateAllActivePhases } from '@/lib/services/phase-service'
import { normalizeRequestId } from '@/lib/observability/request-id'

export const checkBreaches = inngest.createFunction(
  {
    id: 'check-prop-firm-breaches',
    retries: 3,
    concurrency: { limit: 1 },
  },
  [
    { cron: '*/15 * * * *' },
    { event: 'jji/phase.evaluate' },
  ],
  async ({ event, step }) => {
    return await step.run('evaluate-breaches', async () => {
      const eventData = event?.data && 'source' in event.data
        ? event.data
        : undefined
      const requestId = normalizeRequestId(eventData?.requestId)
        ?? (typeof event?.id === 'string' ? event.id : undefined)
      logger.info({
        source: eventData?.source ?? 'scheduled',
        requestId,
      }, 'Evaluating prop firm breaches')
      const result = await evaluateAllActivePhases({
        ...(eventData?.masterAccountId ? { masterAccountId: eventData.masterAccountId } : {}),
        ...(eventData?.phaseAccountId ? { phaseAccountId: eventData.phaseAccountId } : {}),
        ...(requestId ? { requestId } : {}),
      })
      return {
        checked: result.totalPhases,
        evaluated: result.evaluated,
        breached: result.failed,
        passed: result.passed,
        errors: result.errors,
      }
    })
  }
)
