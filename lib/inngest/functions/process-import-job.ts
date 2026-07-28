import { inngest } from '../client'
import * as Sentry from '@sentry/nextjs'
import { acquireImportLock, claimImportJob, releaseImportJob, releaseImportLock } from '@/server/import-job-runtime'
import { processImportJobChunk } from '@/server/import-jobs'
import { processTradeImportJobChunk } from '@/server/trade-import-jobs'

type ImportKind = 'archive' | 'trade'

export const processImportJob = inngest.createFunction(
  {
    id: 'process-import-job',
    retries: 3,
    concurrency: { limit: 10, key: 'event.data.internalUserId' },
  },
  { event: 'jji/import.process' },
  async ({ event, step }) => {
    const span = Sentry.startInactiveSpan({
      name: 'imports.process_job',
      op: 'job',
      attributes: {
        'jji.import_kind': event.data?.kind === 'trade' ? 'trade' : 'archive',
      },
    })

    try {
      const jobId = String(event.data?.jobId ?? '')
      const internalUserId = String(event.data?.internalUserId ?? '')
      const kind: ImportKind = event.data?.kind === 'trade' ? 'trade' : 'archive'
      const workerToken = crypto.randomUUID()
      const eventId = typeof event.id === 'string' ? event.id : undefined

      if (!jobId || !internalUserId) {
        throw new Error('Import event is missing job ownership')
      }

      const lockAcquired = await step.run('acquire-import-lock', () => acquireImportLock(jobId, workerToken))
      if (!lockAcquired) return { jobId, skipped: true, reason: 'redis-lock-held' }

      const claimed = await step.run('claim-import-job', () => claimImportJob({
        jobId,
        internalUserId,
        workerToken,
        ...(eventId ? { eventId } : {}),
      }))

      if (!claimed) {
        await step.run('release-import-lock-after-claim-miss', () => releaseImportLock(jobId, workerToken))
        return { jobId, skipped: true }
      }

      const result = await step.run('process-import-chunk', () => kind === 'trade'
        ? processTradeImportJobChunk(jobId, internalUserId, workerToken, eventId, true)
        : processImportJobChunk(jobId, internalUserId, workerToken, eventId, true))

      if (!('done' in result)) {
        throw new Error(result.error)
      }

      await step.run('release-import-lease', () => releaseImportJob({
        jobId,
        internalUserId,
        workerToken,
      }))
      await step.run('release-import-lock', () => releaseImportLock(jobId, workerToken))

      if (!result.done && result.status === 200) {
        await step.sendEvent('schedule-next-import-chunk', {
          name: 'jji/import.process',
          data: { jobId, internalUserId, kind },
        })
      }

      if (kind === 'trade' && result.done) {
        const meta = (result.job as { meta?: {
          masterAccountId?: string
          phaseAccountId?: string
        }} | undefined)?.meta

        if (meta?.masterAccountId && meta.phaseAccountId) {
          await step.sendEvent('evaluate-imported-phase', {
            name: 'jji/phase.evaluate',
            data: {
              source: 'trade-import-completed',
              masterAccountId: meta.masterAccountId,
              phaseAccountId: meta.phaseAccountId,
            },
          })
        }
      }

      return { jobId, done: result.done }
    } catch (error) {
      Sentry.captureException(error, { extra: { function: 'process-import-job' } })
      throw error
    } finally {
      span.end()
    }
  },
)
