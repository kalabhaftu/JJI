import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { generateTradeHash } from '@/lib/utils'
import { buildSyntheticExecutionsFromTrade, buildTradePersistenceData } from '@/lib/trade-core'
import { and, eq } from 'drizzle-orm'
import { claimImportJob, updateClaimedImportJob } from '@/server/import-job-runtime'
import { downloadImportObject, uploadImportObject } from '@/server/import-object-store'

const TRADE_IMPORT_CHUNK_SIZE = 250

interface TradeImportPayload {
  accountId: string
  trades: any[]
}

interface TradeImportJobState {
  kind: 'trade_import'
  index: number
  imported: number
  skipped: number
  accountType?: 'prop-firm' | 'live' | undefined
  accountName?: string | undefined
  propFirmName?: string | undefined
  evaluationType?: string | undefined
  phaseNumber?: number | undefined
  phaseAccountId?: string | undefined
  regularAccountId?: string | undefined
  accountNumber?: string | undefined
  masterAccountId?: string | undefined
  evaluation?: {
    isFailed: boolean
    isPassed?: boolean | undefined
    canAdvance?: boolean | undefined
    status?: string | undefined
    message?: string | undefined
    currentPhaseNumber?: number | undefined
    profitTargetProgress?: number | undefined
    currentPnL?: number | undefined
    evaluationType?: string | undefined
    propFirmName?: string | undefined
  } | undefined
  rowErrors?: Array<{ row: number, message: string }>
}

const DEFAULT_TRADE_IMPORT_STATE: TradeImportJobState = {
  kind: 'trade_import',
  index: 0,
  imported: 0,
  skipped: 0,
}

function parseTradeImportState(state: unknown): TradeImportJobState {
  if (!state || typeof state !== 'object') return { ...DEFAULT_TRADE_IMPORT_STATE }

  const obj = state as Partial<TradeImportJobState>
  return {
    kind: 'trade_import',
    index: Number.isFinite(obj.index) ? Number(obj.index) : 0,
    imported: Number.isFinite(obj.imported) ? Number(obj.imported) : 0,
    skipped: Number.isFinite(obj.skipped) ? Number(obj.skipped) : 0,
    accountType: obj.accountType,
    accountName: obj.accountName,
    propFirmName: obj.propFirmName,
    evaluationType: obj.evaluationType,
    phaseNumber: Number.isFinite(obj.phaseNumber) ? Number(obj.phaseNumber) : undefined,
    phaseAccountId: obj.phaseAccountId,
    regularAccountId: obj.regularAccountId,
    accountNumber: obj.accountNumber,
    masterAccountId: obj.masterAccountId,
    evaluation: obj.evaluation,
    rowErrors: Array.isArray(obj.rowErrors) ? obj.rowErrors : [],
  }
}

function parsePayload(fileData: unknown): TradeImportPayload {
  const buffer = Buffer.isBuffer(fileData)
    ? fileData
    : fileData instanceof Uint8Array
      ? Buffer.from(fileData)
      : Buffer.from(fileData as any)

  const parsed = JSON.parse(buffer.toString('utf-8')) as TradeImportPayload

  if (!parsed?.accountId || !Array.isArray(parsed.trades)) {
    throw new Error('Invalid trade import payload')
  }

  return parsed
}

function serializeTradeImportJob(job: any) {
  const state = parseTradeImportState(job.state)

  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    totalItems: job.totalItems,
    processedItems: job.processedItems,
    importedCount: job.importedCount,
    skippedCount: job.skippedCount,
    cancelRequested: job.cancelRequested,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    meta: {
      kind: state.kind,
      accountType: state.accountType,
      accountName: state.accountName,
      propFirmName: state.propFirmName,
      evaluationType: state.evaluationType,
      phaseNumber: state.phaseNumber,
      masterAccountId: state.masterAccountId,
      phaseAccountId: state.phaseAccountId,
      regularAccountId: state.regularAccountId,
      evaluation: state.evaluation,
      rowErrors: state.rowErrors,
    }
  }
}

function normalizeTrade(rawTrade: any, internalUserId: string, accountNumber: string) {
  if (!rawTrade || typeof rawTrade !== 'object') return null

  const trade = Object.fromEntries(
    Object.entries(rawTrade).filter(([, value]) => value !== undefined)
  ) as any

  if (!trade.instrument || !trade.entryDate || !trade.closeDate) {
    return null
  }

  const quantity = Number(trade.quantity ?? 0)
  const pnl = Number(trade.pnl ?? 0)
  const commission = Number(trade.commission ?? 0)
  const timeInPosition = Number(trade.timeInPosition ?? 0)

  const normalized = buildTradePersistenceData({
    ...trade,
    id: trade.id || generateTradeHash({
      userId: internalUserId,
      accountNumber,
      instrument: trade.instrument || '',
      entryDate: trade.entryDate || '',
      closeDate: trade.closeDate || '',
      quantity,
      entryId: trade.entryId || '',
      timeInPosition,
    } as any),
    userId: internalUserId,
    accountNumber,
    instrument: String(trade.instrument || ''),
    entryPrice: String(trade.entryPrice || ''),
    closePrice: String(trade.closePrice || ''),
    entryDate: String(trade.entryDate || ''),
    closeDate: String(trade.closeDate || ''),
    quantity,
    pnl,
    commission,
    timeInPosition,
    createdAt: trade.createdAt ? new Date(trade.createdAt) : new Date(),
    side: trade.side || '',
    entryId: trade.entryId || null,
    comment: trade.comment || null,
    groupId: trade.groupId || null,
    symbol: trade.symbol || null,
    entryTime: trade.entryTime ? new Date(trade.entryTime) : null,
    exitTime: trade.exitTime ? new Date(trade.exitTime) : null,
    closeReason: trade.closeReason || null,
    stopLoss: trade.stopLoss || null,
    takeProfit: trade.takeProfit || null,
    tags: Array.isArray(trade.tags) ? trade.tags : [],
    marketBias: trade.marketBias || null,
    modelId: trade.modelId || null,
    selectedRules: trade.selectedRules || null,
    outcome: trade.outcome || null,
    ruleBroken: typeof trade.ruleBroken === 'boolean' ? trade.ruleBroken : null,
    newsDay: typeof trade.newsDay === 'boolean' ? trade.newsDay : null,
    selectedNews: trade.selectedNews || null,
    newsTraded: typeof trade.newsTraded === 'boolean' ? trade.newsTraded : null,
    biasTimeframe: trade.biasTimeframe || null,
    narrativeTimeframe: trade.narrativeTimeframe || null,
    entryTimeframe: trade.entryTimeframe || null,
    structureTimeframe: trade.structureTimeframe || null,
    orderType: trade.orderType || null,
    chartLinks: trade.chartLinks || null,
    cardPreviewImage: trade.cardPreviewImage || null,
    imageOne: trade.imageOne || null,
    imageTwo: trade.imageTwo || null,
    imageThree: trade.imageThree || null,
    imageFour: trade.imageFour || null,
    imageFive: trade.imageFive || null,
    imageSix: trade.imageSix || null,
  })

  return normalized
}

function computeProgress(totalItems: number, processedItems: number): number {
  if (totalItems <= 0) return 100
  const pct = Math.floor((processedItems / totalItems) * 100)
  return Math.max(1, Math.min(100, pct))
}

async function assertTradeImportTarget(accountId: string, internalUserId: string) {
  const phaseAccount = await db.query.PhaseAccount.findFirst({
    where: (table, { eq }) => eq(table.id, accountId),
    with: {
      MasterAccount: {
        columns: { userId: true },
      },
    },
  })

  if (phaseAccount?.MasterAccount?.userId === internalUserId) return

  const regularAccount = await db.query.Account.findFirst({
    where: (table, { and, eq }) => and(
      eq(table.id, accountId),
      eq(table.userId, internalUserId),
    ),
    columns: { id: true },
  })

  if (!regularAccount) {
    throw new Error('Target account not found')
  }
}

export async function createTradeImportJob(params: {
  internalUserId: string
  accountId: string
  trades: any[]
}) {
  await assertTradeImportTarget(params.accountId, params.internalUserId)

  const payload: TradeImportPayload = {
    accountId: params.accountId,
    trades: params.trades || [],
  }

  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8')
  const jobId = crypto.randomUUID()
  const fileObjectPath = await uploadImportObject({
    internalUserId: params.internalUserId,
    jobId,
    data: payloadBytes,
    contentType: 'application/json',
  })

  const job = (await db.insert(schema.ImportJob).values({
    id: jobId,
    userId: params.internalUserId,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    totalItems: payload.trades.length,
    processedItems: 0,
    importedCount: 0,
    skippedCount: 0,
    fileName: 'trade-import.json',
    fileSize: payloadBytes.byteLength,
    fileData: null,
    fileObjectPath,
    state: DEFAULT_TRADE_IMPORT_STATE,
    cancelRequested: false,
    updatedAt: new Date()
  }).returning().then(r => r[0]))

  return serializeTradeImportJob(job)
}

export async function getTradeImportJobForUser(jobId: string, internalUserId: string) {
  const job = await db.query.ImportJob.findFirst({
    where: (table, { and, eq }) => and(
      eq(table.id, jobId),
      eq(table.userId, internalUserId)
    ),
    columns: {
      id: true,
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
    }
  })

  return job ? serializeTradeImportJob(job) : null
}

export async function cancelTradeImportJob(jobId: string, internalUserId: string) {
  const current = await db.query.ImportJob.findFirst({
    where: (table, { and, eq }) => and(
      eq(table.id, jobId),
      eq(table.userId, internalUserId)
    )
  })

  if (!current) {
    return { error: 'Import job not found', status: 404 as const }
  }

  if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
    return { job: serializeTradeImportJob(current), status: 200 as const }
  }

  const updated = (await db.update(schema.ImportJob).set(current.status === 'queued'
    ? {
        cancelRequested: true,
        status: 'cancelled',
        stage: 'cancelled',
        completedAt: new Date(),
      }
    : {
        cancelRequested: true,
      }).where(and(
        eq(schema.ImportJob.id, current.id),
        eq(schema.ImportJob.userId, internalUserId),
      )).returning())[0]

  return { job: serializeTradeImportJob(updated), status: 200 as const }
}

export async function processTradeImportJobChunk(jobId: string, internalUserId: string, workerToken = crypto.randomUUID(), eventId?: string, skipClaim = false) {
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
    const payload = parsePayload(job.fileObjectPath
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
      const completed = await updateClaimedImportJob({
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
      })

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
      progress: computeProgress(totalItems, processedItems),
      processedItems,
      importedCount: state.imported,
      skippedCount: state.skipped,
      state,
      },
    })

    return { job: serializeTradeImportJob(processing), done: false, status: 200 as const }
  } catch (error) {
    const failed = await updateClaimedImportJob({
      jobId: job.id,
      internalUserId,
      workerToken,
      data: {
      status: 'failed',
      stage: 'failed',
      error: error instanceof Error ? error.message.slice(0, 2000) : 'Trade import failed',
      completedAt: new Date(),
      },
    })

    return { job: serializeTradeImportJob(failed), done: true, status: 200 as const }
  }
}
