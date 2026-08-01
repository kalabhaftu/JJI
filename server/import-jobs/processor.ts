import JSZip from 'jszip'
import { db } from '@/lib/db/client'
import { buildBulkAuditSummary } from '@/lib/audit-logger'
import logger from '@/lib/logger'
import { getSafeErrorMessage, reportError } from '@/lib/observability/report-error'
import { validateImportArchive } from '@/lib/security/import-archive'
import { getSupabaseAdminClient } from '@/server/supabase-admin'
import {
  claimImportJob,
  completeClaimedImportJob,
  updateClaimedImportJob,
} from '@/server/import-job-runtime'
import { loadImportPayload } from '@/server/import-jobs/archive'
import { processBacktestImportChunk, processTradeImportChunk } from '@/server/import-jobs/execution'
import { resolveImportLookupMaps } from '@/server/import-jobs/lookups'
import { runImportPreparation } from '@/server/import-jobs/preparation'
import { serializeImportJob } from '@/server/import-jobs/serialization'
import { computeProcessingProgress, parseJobState } from '@/server/import-jobs/state'

const MAX_IMPORT_ITEMS = 100_000

async function updateJob(
  jobId: string,
  internalUserId: string,
  workerToken: string,
  data: Record<string, any>,
) {
  return updateClaimedImportJob({ jobId, internalUserId, workerToken, data })
}

export async function processImportJobChunk(
  jobId: string,
  internalUserId: string,
  workerToken = crypto.randomUUID(),
  eventId?: string,
  skipClaim = false,
  requestId?: string,
) {
  const claimed = skipClaim || await claimImportJob({
    jobId,
    internalUserId,
    workerToken,
    ...(eventId ? { eventId } : {}),
  })
  const job = await db.query.ImportJob.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, jobId), eq(table.userId, internalUserId)),
    columns: {
      id: true,
      userId: true,
      status: true,
      stage: true,
      progress: true,
      totalItems: true,
      processedItems: true,
      importedCount: true,
      skippedCount: true,
      fileName: true,
      fileData: true,
      fileObjectPath: true,
      state: true,
      cancelRequested: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      fileSize: true,
      error: true,
    },
  })

  if (!job) {
    return { error: 'Import job not found', status: 404 as const }
  }

  if (!claimed && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
    return { job: serializeImportJob(job), done: false, status: 200 as const }
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return { job: serializeImportJob(job), done: true, status: 200 as const }
  }

  if (job.cancelRequested) {
    const cancelled = await updateJob(job.id, internalUserId, workerToken, {
      status: 'cancelled',
      stage: 'cancelled',
      completedAt: new Date(),
    })

    return { job: serializeImportJob(cancelled), done: true, status: 200 as const }
  }

  try {
    const zip = await JSZip.loadAsync(await loadImportPayload(job.fileData, job.fileObjectPath))
    validateImportArchive(zip)
    const manifestFile = zip.file('data.json')

    if (!manifestFile) {
      reportError(new Error('Invalid export file: missing data.json'), {
        surface: 'import',
        operation: 'validate-import-manifest',
        jobId: job.id,
        userId: internalUserId,
      })
      const failed = await updateJob(job.id, internalUserId, workerToken, {
        status: 'failed',
        stage: 'failed',
        error: 'Invalid export file (missing data.json)',
        completedAt: new Date(),
      })
      return { job: serializeImportJob(failed), done: true, status: 200 as const }
    }

    const manifestContent = await manifestFile.async('string')
    const data = JSON.parse(manifestContent)

    const totalItems = (data.trades?.length || 0) + (data.backtestTrades?.length || 0)
    if (!Number.isFinite(totalItems) || totalItems > MAX_IMPORT_ITEMS) {
      throw new Error('Backup contains too many import records')
    }
    let state = parseJobState(job.state)

    if (job.status === 'queued') {
      await updateJob(job.id, internalUserId, workerToken, {
        status: 'processing',
        stage: 'preparing',
        progress: 1,
        totalItems,
        startedAt: new Date(),
      })
    }

    if (state.phase === 'preparing') {
      await runImportPreparation(data, internalUserId)

      state.phase = 'trades'

      await updateJob(job.id, internalUserId, workerToken, {
        status: 'processing',
        stage: 'trades',
        progress: totalItems > 0 ? 10 : 95,
        totalItems,
        processedItems: 0,
        importedCount: state.imported,
        skippedCount: state.skipped,
        state,
      })
    }

    const { accountMap, modelNameMap, phaseMap } = await resolveImportLookupMaps(data, internalUserId)
    const supabase = getSupabaseAdminClient()

    if (state.phase === 'trades') {
      await processTradeImportChunk({
        zip,
        data,
        state,
        internalUserId,
        supabase,
        accountMap,
        modelNameMap,
        phaseMap,
      })
    }

    if (state.phase === 'backtests') {
      await processBacktestImportChunk({
        zip,
        data,
        state,
        internalUserId,
        supabase,
        accountMap,
        modelNameMap,
        phaseMap,
      })
    }

    const processedItems = state.tradeIndex + state.backtestIndex

    if (state.phase === 'completed') {
      const completed = await completeClaimedImportJob({
        jobId: job.id,
        internalUserId,
        workerToken,
        data: {
          status: 'completed',
          stage: 'completed',
          progress: 100,
          processedItems,
          importedCount: state.imported,
          skippedCount: state.skipped,
          state,
          completedAt: new Date(),
        },
        audit: {
          action: 'DATA_IMPORT_COMPLETED',
          requestId: requestId ?? null,
          afterData: buildBulkAuditSummary({
            created: state.imported,
            skipped: state.skipped,
            entityTypes: ['Trade', 'BacktestTrade', 'Account', 'UserSettings'],
          }),
        },
      })
      logger.info({
        event: 'import_job_completed',
        jobId: job.id,
        userId: internalUserId,
        importedCount: state.imported,
        skippedCount: state.skipped,
        requestId,
      }, 'Import job completed')

      return { job: serializeImportJob(completed), done: true, status: 200 as const }
    }

    const processing = await updateJob(job.id, internalUserId, workerToken, {
      status: 'processing',
      stage: state.phase,
      progress: computeProcessingProgress(totalItems, processedItems),
      totalItems,
      processedItems,
      importedCount: state.imported,
      skippedCount: state.skipped,
      state,
    })

    return {
      job: serializeImportJob(processing),
      done: false,
      status: 200 as const,
    }
  } catch (error) {
    reportError(error, {
      surface: 'import',
      operation: 'process-import-job',
      jobId: job.id,
      userId: internalUserId,
      ...(requestId ? { requestId } : {}),
      extra: {
        stage: job.stage,
        processedItems: job.processedItems,
      },
    })
    const message = getSafeErrorMessage(error, 'Import processing failed')
    const failed = await updateJob(job.id, internalUserId, workerToken, {
      status: 'failed',
      stage: 'failed',
      error: message.slice(0, 2000),
      completedAt: new Date(),
    })
    logger.info({
      event: 'import_job_terminal_failure',
      jobId: job.id,
      userId: internalUserId,
      stage: job.stage,
      requestId,
    }, 'Import job reached a terminal failure')

    return { job: serializeImportJob(failed), done: true, status: 200 as const }
  }
}
