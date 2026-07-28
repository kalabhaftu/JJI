import { and, eq, isNull } from 'drizzle-orm'
import { inngest } from '../client'
import { db } from '@/lib/db/client'
import { ImportJob } from '@/lib/db/schema'
import { uploadImportObject } from '@/server/import-object-store'

function toBuffer(value: unknown) {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (Array.isArray(value)) return Buffer.from(value)
  throw new Error('Legacy import payload is not binary')
}

export const migrateLegacyImportObjects = inngest.createFunction(
  {
    id: 'migrate-legacy-import-objects',
    retries: 3,
    concurrency: { limit: 1 },
  },
  { event: 'jji/import.migrate-legacy-objects' },
  async ({ step }) => {
    const jobs = await step.run('find-legacy-import-jobs', () => db.query.ImportJob.findMany({
      where: isNull(ImportJob.fileObjectPath),
      columns: { id: true, userId: true, fileName: true, fileData: true },
    }))

    let migrated = 0
    for (const job of jobs) {
      if (!job.fileData) continue

      await step.run(`migrate-${job.id}`, async () => {
        const path = await uploadImportObject({
          internalUserId: job.userId,
          jobId: job.id,
          data: toBuffer(job.fileData),
          contentType: job.fileName?.endsWith('.zip') ? 'application/zip' : 'application/json',
        })

        await db.update(ImportJob)
          .set({ fileObjectPath: path, updatedAt: new Date() })
          .where(and(eq(ImportJob.id, job.id), isNull(ImportJob.fileObjectPath)))
      })
      migrated += 1
    }

    return { migrated }
  },
)
