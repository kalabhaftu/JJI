import { inngest } from '../client'
import { createAllDailyAnchors } from '@/lib/services/anchor-service'
import logger from '@/lib/logger'

export const resetDailyAnchors = inngest.createFunction(
  {
    id: 'reset-daily-anchors',
    retries: 3,
    concurrency: { limit: 1 },
  },
  [
    { event: 'cron/daily-anchor-reset' },
    { cron: 'TZ=UTC 5 0 * * *' },
  ],
  async ({ event, step }) => {
    const eventData = event?.data && 'requestId' in event.data
      ? event.data
      : undefined
    const requestId = typeof eventData?.requestId === 'string'
      ? eventData.requestId
      : undefined
    const results = await step.run('create-daily-anchors', createAllDailyAnchors)

    logger.info(
      { event: 'daily_anchor_reset_complete', requestId, ...results },
      'Daily anchor reset complete'
    )

    return results
  }
)
