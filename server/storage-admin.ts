import { getSupabaseAdminClient } from '@/server/supabase-admin'
import * as Sentry from '@sentry/nextjs'

const ALLOWED_PUBLIC_DELETE_BUCKETS = new Set(['trade-images', 'feedback-attachments'])

export type StorageObjectRef = {
  bucket: string
  path: string
}

function isExpectedStorageOrigin(parsed: URL) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!configuredUrl) return false

  try {
    return parsed.origin === new URL(configuredUrl).origin
  } catch (error) {
    Sentry.captureException(error, { extra: { route: 'server/storage-admin', phase: 'isValidOrigin' } })
    return false
  }
}

export function parseStorageObjectRef(value: string): StorageObjectRef | null {
  if (value.startsWith('storage://')) {
    const objectPath = value.slice('storage://'.length)
    const [bucket, ...pathParts] = objectPath.split('/').filter(Boolean)
    if (!bucket || pathParts.length === 0 || !ALLOWED_PUBLIC_DELETE_BUCKETS.has(bucket)) return null
    return { bucket, path: pathParts.join('/') }
  }

  try {
    const parsed = new URL(value)
    if (!isExpectedStorageOrigin(parsed)) {
      return null
    }

    const markers = [
      '/storage/v1/object/public/',
      '/storage/v1/object/sign/',
      '/storage/v1/object/authenticated/',
    ]
    const marker = markers.find((candidate) => parsed.pathname.includes(candidate))
    const markerIndex = marker ? parsed.pathname.indexOf(marker) : -1

    if (markerIndex === -1) {
      return null
    }

    const objectPath = parsed.pathname.slice(markerIndex + marker!.length)
    const [bucket, ...pathParts] = objectPath.split('/').filter(Boolean)

    if (!bucket || pathParts.length === 0) {
      return null
    }

    const decodedBucket = decodeURIComponent(bucket)
    if (!ALLOWED_PUBLIC_DELETE_BUCKETS.has(decodedBucket)) {
      return null
    }

    return {
      bucket: decodedBucket,
      path: pathParts.map((part) => decodeURIComponent(part)).join('/'),
    }
  } catch (error) {
    Sentry.captureException(error, { extra: { route: 'server/storage-admin', phase: 'parseStorageObjectRef' } })
    return null
  }
}

export async function createSignedStorageUrl(value: string, expiresInSeconds = 3600) {
  const parsed = parseStorageObjectRef(value)
  if (!parsed || parsed.bucket !== 'trade-images') return null

  const { data, error } = await getSupabaseAdminClient()
    .storage.from(parsed.bucket).createSignedUrl(parsed.path, expiresInSeconds)

  if (error) throw error
  return data?.signedUrl ?? null
}

export async function deletePublicStorageUrls(urls: string[]) {
  const supabase = getSupabaseAdminClient()
  const grouped = new Map<string, Set<string>>()

  for (const url of urls) {
    const parsed = parseStorageObjectRef(url)
    if (!parsed) continue

    const bucketPaths = grouped.get(parsed.bucket) ?? new Set<string>()
    bucketPaths.add(parsed.path)
    grouped.set(parsed.bucket, bucketPaths)
  }

  const results: Array<{ bucket: string; removed: string[]; error?: string }> = []

  for (const [bucket, paths] of grouped.entries()) {
    const removeList = Array.from(paths)
    const { error } = await supabase.storage.from(bucket).remove(removeList)

    results.push({
      bucket,
      removed: removeList,
      ...(error ? { error: error.message } : {}),
    })
  }

  return results
}

const OWNER_PREFIXES: Array<{ bucket: string; prefix: (ownerId: string) => string }> = [
  { bucket: 'import-archives', prefix: (ownerId) => ownerId },
  { bucket: 'trade-images', prefix: (ownerId) => `trades/${ownerId}` },
  { bucket: 'trade-images', prefix: (ownerId) => `backtest/${ownerId}` },
  { bucket: 'trade-images', prefix: (ownerId) => `notes/${ownerId}` },
  { bucket: 'trade-images', prefix: (ownerId) => `avatars/${ownerId}` },
  { bucket: 'feedback-attachments', prefix: (ownerId) => ownerId },
  { bucket: 'weekly-calendars', prefix: (ownerId) => ownerId },
]

type StorageListEntry = {
  name: string
  id?: string | null
}

async function listObjectPaths(bucket: string, prefix: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient()
  const objectPaths: string[] = []
  const directories = [prefix]

  while (directories.length > 0) {
    const directory = directories.pop()!
    let offset = 0

    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(directory, {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })

      if (error) throw error

      const entries = (data ?? []) as StorageListEntry[]
      if (entries.length === 0) break

      for (const entry of entries) {
        const path = `${directory}/${entry.name}`
        if (entry.id) {
          objectPaths.push(path)
        } else {
          directories.push(path)
        }
      }

      if (entries.length < 1000) break
      offset += entries.length
    }
  }

  return objectPaths
}

/** Deletes canonical and legacy owner-prefixed objects after a DB purge. */
export async function deleteStorageForOwners(ownerIds: string[]) {
  const results: Array<{ bucket: string; removedCount: number }> = []
  const uniqueOwnerIds = Array.from(new Set(ownerIds.filter(Boolean)))

  for (const ownerId of uniqueOwnerIds) {
    for (const { bucket, prefix } of OWNER_PREFIXES) {
      const paths = await listObjectPaths(bucket, prefix(ownerId))
      if (paths.length === 0) continue

      const supabase = getSupabaseAdminClient()
      for (let offset = 0; offset < paths.length; offset += 100) {
        const batch = paths.slice(offset, offset + 100)
        const { error } = await supabase.storage.from(bucket).remove(batch)
        if (error) throw error
      }

      results.push({ bucket, removedCount: paths.length })
    }
  }

  return results
}
