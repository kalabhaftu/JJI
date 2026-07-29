import { reportError } from '@/lib/observability/report-error'

const MAX_EXPORT_IMAGE_BYTES = 8 * 1024 * 1024
const EXPORT_IMAGE_TIMEOUT_MS = 8_000

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function isTrustedExportMediaUrl(value: string, supabaseUrl: string): boolean {
  try {
    const mediaUrl = new URL(value)
    const storageOrigin = new URL(supabaseUrl).origin

    return mediaUrl.protocol === 'https:'
      && mediaUrl.origin === storageOrigin
      && !mediaUrl.username
      && !mediaUrl.password
      && mediaUrl.pathname.startsWith('/storage/v1/object/')
  } catch {
    return false
  }
}

export async function fetchTrustedExportImage(
  value: string,
  supabaseUrl: string,
  fetcher: typeof fetch = fetch
): Promise<{ buffer: Buffer; extension: string } | null> {
  if (!isTrustedExportMediaUrl(value, supabaseUrl)) return null

  try {
    const response = await fetcher(value, {
      redirect: 'error',
      signal: AbortSignal.timeout(EXPORT_IMAGE_TIMEOUT_MS),
    })
    if (!response.ok || !response.body) return null

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || ''
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType]
    if (!extension) return null

    const declaredSize = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredSize) && declaredSize > MAX_EXPORT_IMAGE_BYTES) return null

    const chunks: Uint8Array[] = []
    let totalBytes = 0
    const reader = response.body.getReader()

    while (true) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      totalBytes += chunk.byteLength
      if (totalBytes > MAX_EXPORT_IMAGE_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(chunk)
    }

    return { buffer: Buffer.concat(chunks), extension }
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'fetch-export-media',
      extra: { fallbackUsed: true },
    })
    return null
  }
}
