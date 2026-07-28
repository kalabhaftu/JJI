import { inngest } from '../client'
import { deleteStorageForOwners } from '@/server/storage-admin'
import logger from '@/lib/logger'

export const cleanupUserStorage = inngest.createFunction(
  {
    id: 'cleanup-user-storage',
    retries: 3,
    concurrency: { limit: 1, key: 'event.data.internalUserId' },
  },
  { event: 'jji/user-data.storage-cleanup' },
  async ({ event, step }) => {
    const ownerIds = Array.isArray(event.data?.storageOwnerIds)
      ? event.data.storageOwnerIds.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
      : []

    if (ownerIds.length === 0) {
      return { removed: 0 }
    }

    const results = await step.run('remove-owner-storage', () => deleteStorageForOwners(ownerIds))
    const removed = results.reduce((count, result) => count + result.removedCount, 0)

    logger.info({ event: 'user_storage_cleanup_complete', removed }, 'User storage cleanup complete')
    return { removed }
  },
)
