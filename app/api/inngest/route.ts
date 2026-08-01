import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { resetDailyAnchors } from '@/lib/inngest/functions/reset-daily-anchors'
import { checkBreaches } from '@/lib/inngest/functions/check-breaches'
import { cleanupUserStorage } from '@/lib/inngest/functions/cleanup-user-storage'
import { processImportJob } from '@/lib/inngest/functions/process-import-job'
import { migrateLegacyImportObjects } from '@/lib/inngest/functions/migrate-legacy-import-objects'
import { reportInngestFunctionFailure } from '@/lib/inngest/functions/report-function-failure'
import { processWhopWebhook } from '@/lib/inngest/functions/process-whop-webhook'
import { cancelWhopMembership } from '@/lib/inngest/functions/cancel-whop-membership'
import { reconcileWhopBilling } from '@/lib/inngest/functions/reconcile-whop-billing'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    resetDailyAnchors,
    checkBreaches,
    cleanupUserStorage,
    processImportJob,
    migrateLegacyImportObjects,
    reportInngestFunctionFailure,
    processWhopWebhook,
    cancelWhopMembership,
    reconcileWhopBilling,
  ],
})
