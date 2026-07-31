import { inngest } from '@/lib/inngest/client'

type StorageCleanupEvent = {
  internalUserId: string
  storageOwnerIds: string[]
}

/**
 * Queue storage cleanup when Inngest is configured. Local/test environments
 * report pending work instead of making an unreachable network request.
 */
export async function enqueueUserStorageCleanup(data: StorageCleanupEvent): Promise<boolean> {
  if (!process.env.INNGEST_EVENT_KEY) return false

  await inngest.send({
    name: 'jji/user-data.storage-cleanup',
    data,
  })
  return true
}
