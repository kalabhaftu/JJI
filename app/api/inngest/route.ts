import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { resetDailyAnchors } from '@/lib/inngest/functions/reset-daily-anchors'
import { checkBreaches } from '@/lib/inngest/functions/check-breaches'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    resetDailyAnchors,
    checkBreaches
  ],
})
