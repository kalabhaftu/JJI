import { and, eq } from 'drizzle-orm'

import { buildBulkAuditSummary } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import logger from '@/lib/logger'
import { getSafeErrorMessage, reportError } from '@/lib/observability/report-error'
import { buildSyntheticExecutionsFromTrade } from '@/lib/trade-core'
import { claimImportJob, completeClaimedImportJob, updateClaimedImportJob } from '@/server/import-job-runtime'
import { downloadImportObject } from '@/server/import-object-store'
import { computeTradeImportProgress, normalizeTrade, parseTradeImportPayload } from '@/server/trade-import-jobs/normalization'
import { parseTradeImportState, serializeTradeImportJob } from '@/server/trade-import-jobs/types'

const TRADE_IMPORT_CHUNK_SIZE = 250

export async function processTradeImportJobChunk(
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
    where: (table, { and, eq }) => and(
      eq(table.id, jobId),
      eq(table.userId, internalUserId)
    ),
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
      cancelRequested: true,
      error: true,
      createdAt: true,
      updatedAt: true,
      startedAt: true,
      completedAt: true,
      state: true,
      fileData: true,
      fileObjectPath: true,
    }
  })

  if (!job) {
    return { error: 'Import job not found', status: 404 as const }
  }

  if (!claimed && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
    return { job: serializeTradeImportJob(job), done: false, status: 200 as const }
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return { job: serializeTradeImportJob(job), done: true, status: 200 as const }
  }

  if (job.cancelRequested) {
    const cancelled = await updateClaimedImportJob({
      jobId: job.id,
      internalUserId,
      workerToken,
      data: { status: 'cancelled', stage: 'cancelled', completedAt: new Date() },
    })
    return { job: serializeTradeImportJob(cancelled), done: true, status: 200 as const }
  }

  try {
    const payload = parseTradeImportPayload(job.fileObjectPath
      ? await downloadImportObject(job.fileObjectPath)
      : job.fileData)
    let state = parseTradeImportState(job.state)

    if (job.status === 'queued') {
      await updateClaimedImportJob({
        jobId: job.id,
        internalUserId,
        workerToken,
        data: {
        status: 'processing',
        stage: 'preparing',
        startedAt: new Date(),
        progress: 1,
        },
      })
    }

    if (!state.accountType) {
      const phaseAccount = await db.query.PhaseAccount.findFirst({
        where: (table, { eq }) => eq(table.id, payload.accountId),
        with: {
          MasterAccount: {
            columns: {
              id: true,
              userId: true,
              accountName: true,
              propFirmName: true,
              evaluationType: true,
              status: true,
            }
          }
        }
      })

      if (phaseAccount && phaseAccount.MasterAccount.userId === internalUserId) {
        if (!phaseAccount.phaseId) {
          throw new Error('Current phase has no phase ID. Set phase ID before importing trades.')
        }

        state.accountType = 'prop-firm'
        state.phaseAccountId = phaseAccount.id
        state.accountNumber = phaseAccount.phaseId
        state.accountName = phaseAccount.MasterAccount.accountName
        state.propFirmName = phaseAccount.MasterAccount.propFirmName
        state.evaluationType = phaseAccount.MasterAccount.evaluationType
        state.phaseNumber = phaseAccount.phaseNumber
        state.masterAccountId = phaseAccount.MasterAccount.id
      } else {
        const account = await db.query.Account.findFirst({
          where: (table, { and, eq }) => and(
            eq(table.id, payload.accountId),
            eq(table.userId, internalUserId)
          ),
          columns: { id: true, number: true, name: true }
        })

        if (!account) {
          throw new Error('Target account not found')
        }

        state.accountType = 'live'
        state.regularAccountId = account.id
        state.accountNumber = account.number
        state.accountName = account.name || account.number
      }
    }

    const totalItems = payload.trades.length
    const endIndex = Math.min(totalItems, state.index + TRADE_IMPORT_CHUNK_SIZE)
    const chunk = payload.trades.slice(state.index, endIndex)

    state.rowErrors = state.rowErrors || []

    const preparedRows: any[] = []
    for (let i = 0; i < chunk.length; i++) {
      const rawTrade = chunk[i]
      const rowIndex = state.index + i + 1

      if (!rawTrade || typeof rawTrade !== 'object') {
        state.rowErrors.push({ row: rowIndex, message: 'Invalid trade data format' })
        continue
      }

      const trade = Object.fromEntries(
        Object.entries(rawTrade).filter(([, value]) => value !== undefined)
      ) as any

      if (!trade.instrument) {
        state.rowErrors.push({ row: rowIndex, message: 'Missing instrument/symbol' })
        continue
      }
      if (!trade.entryDate) {
        state.rowErrors.push({ row: rowIndex, message: 'Missing entry date' })
        continue
      }
      if (!trade.closeDate) {
        state.rowErrors.push({ row: rowIndex, message: 'Missing close date' })
        continue
      }
      if (isNaN(Number(trade.quantity))) {
        state.rowErrors.push({ row: rowIndex, message: 'Invalid quantity' })
        continue
      }

      const normalized = normalizeTrade(rawTrade, internalUserId, state.accountNumber || '')
      if (normalized) {
        preparedRows.push({
          ...normalized,
          accountId: state.accountType === 'live' ? state.regularAccountId || null : null,
          phaseAccountId: state.accountType === 'prop-firm' ? state.phaseAccountId || null : null,
        })
      } else {
        state.rowErrors.push({ row: rowIndex, message: 'Failed to normalize trade data' })
      }
    }

    let inserted = 0
    if (preparedRows.length > 0) {
      await db.transaction(async (tx) => {
        const insertedTrades = await tx.insert(schema.Trade)
          .values(preparedRows)
          .onConflictDoNothing()
          .returning({ id: schema.Trade.id })
        const insertedIds = new Set(insertedTrades.map(({ id }) => id))
        const insertedRows = preparedRows.filter((trade: any) => insertedIds.has(trade.id))
        inserted = insertedRows.length

        const executionRows = insertedRows.flatMap((trade: any) => buildSyntheticExecutionsFromTrade(trade))
        if (executionRows.length > 0) {
          await tx.insert(schema.TradeExecution).values(executionRows as any).onConflictDoNothing()
        }
      })
    }

    state.imported += inserted
    state.skipped += chunk.length - inserted
    state.index = endIndex

    if (state.index >= totalItems) {
      const completed = await completeClaimedImportJob({
        jobId: job.id,
        internalUserId,
        workerToken,
        data: {
          status: 'completed',
          stage: 'completed',
          progress: 100,
          processedItems: totalItems,
          importedCount: state.imported,
          skippedCount: state.skipped,
          state,
          completedAt: new Date(),
        },
        audit: {
          action: 'TRADE_IMPORT_COMPLETED',
          requestId: requestId ?? null,
          afterData: buildBulkAuditSummary({
            created: state.imported,
            skipped: state.skipped,
            entityTypes: ['Trade', 'TradeExecution'],
          }),
        },
      })
      logger.info({
        event: 'trade_import_job_completed',
        jobId: job.id,
        userId: internalUserId,
        importedCount: state.imported,
        skippedCount: state.skipped,
        requestId,
      }, 'Trade import job completed')

      return { job: serializeTradeImportJob(completed), done: true, status: 200 as const }
    }

    const processedItems = state.index
    const processing = await updateClaimedImportJob({
      jobId: job.id,
      internalUserId,
      workerToken,
      data: {
        status: 'processing',
        stage: 'trades-import',
        progress: computeTradeImportProgress(totalItems, processedItems),
        processedItems,
        importedCount: state.imported,
        skippedCount: state.skipped,
        state,
      },
    })

    return { job: serializeTradeImportJob(processing), done: false, status: 200 as const }
  } catch (error) {
    reportError(error, {
      surface: 'import',
      operation: 'process-trade-import-job',
      jobId: job.id,
      userId: internalUserId,
      ...(requestId ? { requestId } : {}),
      extra: { stage: job.stage, processedItems: job.processedItems },
    })
    const failed = await updateClaimedImportJob({
      jobId: job.id,
      internalUserId,
      workerToken,
      data: {
        status: 'failed',
        stage: 'failed',
        error: getSafeErrorMessage(error, 'Trade import failed').slice(0, 2000),
        completedAt: new Date(),
      },
    })
    logger.info({
      event: 'trade_import_job_terminal_failure',
      jobId: job.id,
      userId: internalUserId,
      stage: job.stage,
      requestId,
    }, 'Trade import job reached a terminal failure')

    return { job: serializeTradeImportJob(failed), done: true, status: 200 as const }
  }
}
