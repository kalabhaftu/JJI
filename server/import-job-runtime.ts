import { and, eq, isNull, lt, ne, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { ImportJob } from '@/lib/db/schema'
import { isRedisConfigured, redis } from '@/lib/cache/client'
import { reportError } from '@/lib/observability/report-error'
import { recordAuditEvent, type AuditEventInput } from '@/lib/audit-logger'

export const IMPORT_JOB_LEASE_MS = 5 * 60 * 1000

function importLockKey(jobId: string) {
  return `lock:import-job:${jobId}`
}

/** Redis is the fast duplicate-worker guard; the database lease remains authoritative. */
export async function acquireImportLock(jobId: string, workerToken: string, ttlSeconds = 300) {
  if (!isRedisConfigured()) return true

  try {
    const result = await redis.set(importLockKey(jobId), workerToken, { nx: true, ex: ttlSeconds })
    return result === 'OK'
  } catch (error) {
    reportError(error, {
      surface: 'import',
      operation: 'acquire-import-lock',
      jobId,
    })
    // The database lease is the authoritative CAS guard. Keep imports
    // available during a Redis outage while preserving duplicate protection.
    return true
  }
}

export async function releaseImportLock(jobId: string, workerToken: string) {
  if (!isRedisConfigured()) return

  try {
    const key = importLockKey(jobId)
    const currentToken = await redis.get<string>(key)
    if (currentToken === workerToken) await redis.del(key)
  } catch (error) {
    reportError(error, {
      surface: 'import',
      operation: 'release-import-lock',
      jobId,
    })
  }
}

export async function claimImportJob(params: {
  jobId: string
  internalUserId: string
  workerToken: string
  eventId?: string
}) {
  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + IMPORT_JOB_LEASE_MS)
  const isNewEvent = params.eventId
    ? or(isNull(ImportJob.eventId), ne(ImportJob.eventId, params.eventId))
    : undefined

  const [claimed] = await db.update(ImportJob)
    .set({
      status: 'processing',
      workerToken: params.workerToken,
      leaseExpiresAt,
      eventId: params.eventId ?? null,
      attempt: sql<number>`coalesce(${ImportJob.attempt}, 0) + 1`,
      startedAt: sql`coalesce(${ImportJob.startedAt}, ${now})`,
      updatedAt: now,
    })
    .where(and(
      eq(ImportJob.id, params.jobId),
      eq(ImportJob.userId, params.internalUserId),
      isNewEvent,
      or(eq(ImportJob.cancelRequested, false), isNull(ImportJob.cancelRequested)),
      or(
        eq(ImportJob.status, 'queued'),
        and(
          eq(ImportJob.status, 'processing'),
          or(isNull(ImportJob.leaseExpiresAt), lt(ImportJob.leaseExpiresAt, now)),
        ),
        and(
          eq(ImportJob.status, 'processing'),
          eq(ImportJob.workerToken, params.workerToken),
        ),
      ),
    ))
    .returning({ id: ImportJob.id })

  return Boolean(claimed)
}

export async function releaseImportJob(params: {
  jobId: string
  internalUserId: string
  workerToken: string
}) {
  await db.update(ImportJob)
    .set({
      workerToken: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(ImportJob.id, params.jobId),
      eq(ImportJob.userId, params.internalUserId),
      eq(ImportJob.workerToken, params.workerToken),
    ))
}

export async function updateClaimedImportJob(params: {
  jobId: string
  internalUserId: string
  workerToken: string
  data: Record<string, any>
}) {
  const [updated] = await db.update(ImportJob)
    .set({ ...params.data, updatedAt: new Date() })
    .where(and(
      eq(ImportJob.id, params.jobId),
      eq(ImportJob.userId, params.internalUserId),
      eq(ImportJob.workerToken, params.workerToken),
    ))
    .returning()

  if (!updated) throw new Error('Import job lease lost')
  return updated
}

export async function completeClaimedImportJob(params: {
  jobId: string
  internalUserId: string
  workerToken: string
  data: Record<string, any>
  audit: Omit<AuditEventInput, 'userId' | 'entityId' | 'entityType' | 'source'>
}) {
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(ImportJob)
      .set({ ...params.data, updatedAt: new Date() })
      .where(and(
        eq(ImportJob.id, params.jobId),
        eq(ImportJob.userId, params.internalUserId),
        eq(ImportJob.workerToken, params.workerToken),
      ))
      .returning()
    if (!updated) throw new Error('Import job lease lost')

    await recordAuditEvent({
      userId: params.internalUserId,
      entityId: params.jobId,
      entityType: 'ImportJob',
      source: 'background-job',
      ...params.audit,
    }, tx as never)
    return updated
  })
}
