import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { uploadImportObject } from '@/server/import-object-store'
import {
  DEFAULT_TRADE_IMPORT_STATE,
  serializeTradeImportJob,
  type TradeImportPayload,
} from '@/server/trade-import-jobs/types'

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
