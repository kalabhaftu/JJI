import logger from "@/lib/logger"
import { db } from '@/lib/db/client'
import { ActivityLog, ImportJob } from '@/lib/db/schema'
import { lt, and, inArray } from 'drizzle-orm'

async function cleanupActivityLogs(daysOld = 90) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)

  logger.info({ daysOld, cutoff: cutoff.toISOString() }, '[Maintenance] Cleaning up activity logs')
  
  const result = await db.delete(ActivityLog)
    .where(lt(ActivityLog.createdAt, cutoff))
    .returning({ id: ActivityLog.id })

  return { deleted: result.length }
}

async function cleanupImportJobs(daysOld = 7) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysOld)

  logger.info({ daysOld, cutoff: cutoff.toISOString() }, '[Maintenance] Cleaning up import jobs')
  
  const result = await db.delete(ImportJob)
    .where(
      and(
        lt(ImportJob.updatedAt, cutoff),
        inArray(ImportJob.status, ['completed', 'failed', 'cancelled'])
      )
    )
    .returning({ id: ImportJob.id })

  return { deleted: result.length }
}

export async function runDailyMaintenance() {
  const results = {
    activityLogs: { deleted: 0 },
    importJobs: { deleted: 0 },
    errors: [] as string[]
  }

  try {
    results.activityLogs = await cleanupActivityLogs()
  } catch (err) {
    results.errors.push(`ActivityLogs: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  try {
    results.importJobs = await cleanupImportJobs()
  } catch (err) {
    results.errors.push(`ImportJobs: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  return results
}
