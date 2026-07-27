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

function parsePublicStorageUrl(url: string): StorageObjectRef | null {
  try {
    const parsed = new URL(url)
    if (!isExpectedStorageOrigin(parsed)) {
      return null
    }

    const marker = '/storage/v1/object/public/'
    const markerIndex = parsed.pathname.indexOf(marker)

    if (markerIndex === -1) {
      return null
    }

    const objectPath = parsed.pathname.slice(markerIndex + marker.length)
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
    Sentry.captureException(error, { extra: { route: 'server/storage-admin', phase: 'parsePublicStorageUrl' } })
    return null
  }
}

export async function deletePublicStorageUrls(urls: string[]) {
  const supabase = getSupabaseAdminClient()
  const grouped = new Map<string, Set<string>>()

  for (const url of urls) {
    const parsed = parsePublicStorageUrl(url)
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
