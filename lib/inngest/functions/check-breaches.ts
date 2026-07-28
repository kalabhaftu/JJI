import { inngest } from '../client'
import logger from '@/lib/logger'
import { evaluateAllActivePhases } from '@/lib/services/phase-service'

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
      logger.info({ source: event?.data?.source ?? 'scheduled' }, 'Evaluating prop firm breaches')
      const result = await evaluateAllActivePhases({
        ...(event?.data?.masterAccountId ? { masterAccountId: event.data.masterAccountId } : {}),
        ...(event?.data?.phaseAccountId ? { phaseAccountId: event.data.phaseAccountId } : {}),
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
