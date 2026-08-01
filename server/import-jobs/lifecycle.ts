import { and, eq } from 'drizzle-orm'
import { recordAuditEvent } from '@/lib/audit-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { uploadImportObject } from '@/server/import-object-store'
import { DEFAULT_JOB_STATE, parseJobState } from '@/server/import-jobs/state'
import { serializeImportJob } from '@/server/import-jobs/serialization'

export async function getImportJobForUser(jobId: string, internalUserId: string) {
  return db.query.ImportJob.findFirst({
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
      fileSize: true,
      cancelRequested: true,
      error: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function createImportJob(params: {
  internalUserId: string
  fileName: string
  fileSize: number
  fileData: ArrayBuffer
}) {
  const jobId = crypto.randomUUID()
  const fileObjectPath = await uploadImportObject({
    internalUserId: params.internalUserId,
    jobId,
    data: Buffer.from(params.fileData),
    contentType: 'application/zip',
  })

  const job = (await db.insert(schema.ImportJob).values({
    id: jobId,
    userId: params.internalUserId,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    fileName: params.fileName,
    fileSize: params.fileSize,
    fileData: null,
    fileObjectPath,
    totalItems: 0,
    processedItems: 0,
    importedCount: 0,
    skippedCount: 0,
    state: DEFAULT_JOB_STATE,
    cancelRequested: false,
    updatedAt: new Date(),
  }).returning())[0]

  return serializeImportJob(job)
}

export async function cancelImportJob(jobId: string, internalUserId: string) {
  const current = await db.query.ImportJob.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, jobId), eq(table.userId, internalUserId)),
  })

  if (!current) {
    return { error: 'Import job not found', status: 404 as const }
  }

  if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
    return { job: serializeImportJob(current), status: 200 as const }
  }

  const cancelledImmediately = current.status === 'queued'

  const updated = (await db.update(schema.ImportJob).set(cancelledImmediately
    ? {
        cancelRequested: true,
        status: 'cancelled',
        stage: 'cancelled',
        progress: current.progress,
        completedAt: new Date(),
      }
    : {
        cancelRequested: true,
      }).where(and(
        eq(schema.ImportJob.id, current.id),
        eq(schema.ImportJob.userId, internalUserId),
      )).returning())[0]

  return { job: serializeImportJob(updated), status: 200 as const }
}

export async function resumeImportJob(
  jobId: string,
  internalUserId: string,
  context: { requestId?: string; source: 'api' | 'background-job' },
) {
  const current = await db.query.ImportJob.findFirst({
    where: (table, { and, eq }) => and(
      eq(table.id, jobId),
      eq(table.userId, internalUserId),
    ),
  })
  if (!current) {
    return { error: 'Import job not found', status: 404 as const }
  }
  if (current.status !== 'failed' && current.status !== 'cancelled') {
    return {
      error: 'Only failed or cancelled import jobs can be resumed',
      status: 409 as const,
    }
  }
  const resumableStatus = current.status

  const persistedState = current.state && typeof current.state === 'object'
    ? current.state as Record<string, unknown>
    : {}
  const archivePhase = parseJobState(current.state).phase
  const resumeStage = persistedState.kind === 'trade_import'
    ? 'trades'
    : archivePhase === 'completed'
      ? 'preparing'
      : archivePhase

  const updated = await db.transaction(async (tx) => {
    const [resumed] = await tx.update(schema.ImportJob).set({
      status: 'queued',
      stage: resumeStage,
      cancelRequested: false,
      error: null,
      completedAt: null,
      workerToken: null,
      leaseExpiresAt: null,
      eventId: null,
      updatedAt: new Date(),
    }).where(and(
      eq(schema.ImportJob.id, jobId),
      eq(schema.ImportJob.userId, internalUserId),
      eq(schema.ImportJob.status, resumableStatus),
    )).returning()
    if (!resumed) {
      throw new Error('Import job changed before it could be resumed')
    }

    await recordAuditEvent({
      userId: internalUserId,
      action: 'DATA_IMPORT_RESUMED',
      entityType: 'ImportJob',
      entityId: jobId,
      source: context.source,
      requestId: context.requestId ?? null,
      beforeData: {
        status: current.status,
        stage: current.stage,
        progress: current.progress,
      },
      afterData: {
        status: resumed.status,
        stage: resumed.stage,
        progress: resumed.progress,
      },
    }, tx as never)

    return resumed
  })

  return { job: serializeImportJob(updated), status: 200 as const }
}
