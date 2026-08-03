import { inngest } from '@/lib/inngest/client'
import type { StorageCleanupEventData } from '@/lib/inngest/events'


export async function enqueueUserStorageCleanup(data: StorageCleanupEventData): Promise<boolean> {
  if (!process.env.INNGEST_EVENT_KEY) return false

  await inngest.send({
    name: 'jji/user-data.storage-cleanup',
    data,
  })
  return true
}
