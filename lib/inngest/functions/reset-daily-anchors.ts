import { inngest } from '../client'
import { createAllDailyAnchors } from '@/lib/services/anchor-service'
import logger from '@/lib/logger'

export const resetDailyAnchors = inngest.createFunction(
  {
    id: 'reset-daily-anchors',
  },
  { event: 'cron/daily-anchor-reset' },
  async ({ step }) => {
    const results = await step.run('create-daily-anchors', createAllDailyAnchors)

    logger.info(
      { event: 'daily_anchor_reset_complete', ...results },
      'Daily anchor reset complete'
    )

    return results
  }
)
