import { inngest } from '../client'
import logger from '@/lib/logger'
import { evaluateAllActivePhases } from '@/lib/services/phase-service'

export const checkBreaches = inngest.createFunction(
  {
    id: 'check-prop-firm-breaches',
    retries: 3,
    concurrency: { limit: 1 },
  },
  { cron: '*/15 * * * *' }, // Run every 15 minutes
  async ({ step }) => {
    return await step.run('evaluate-breaches', async () => {
      logger.info('Evaluating prop firm breaches')
      const result = await evaluateAllActivePhases()
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
