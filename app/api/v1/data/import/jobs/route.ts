import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { createImportJob } from '@/server/import-jobs'
import { enqueueImportJob } from '@/server/import-job-events'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024
const ZIP_MIME_TYPES = new Set(['application/zip', 'application/x-zip-compressed', 'application/octet-stream'])

function sanitizeZipFileName(name: string) {
  const baseName = name.split(/[\\/]/).pop() || 'backup.zip'
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180)
  return safeName.toLowerCase().endsWith('.zip') ? safeName : `${safeName}.zip`
}

function hasZipSignature(bytes: ArrayBuffer) {
  const header = new Uint8Array(bytes.slice(0, 4))
  return (
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    (header[2] === 0x03 || header[2] === 0x05 || header[2] === 0x07) &&
    (header[3] === 0x04 || header[3] === 0x06 || header[3] === 0x08)
  )
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'import')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return createErrorResponse('No file provided', 400)
    }

    const sanitizedFileName = sanitizeZipFileName(file.name)

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return createErrorResponse('Only ZIP backup files are supported', 400)
    }

    if (file.type && !ZIP_MIME_TYPES.has(file.type)) {
      return createErrorResponse('Uploaded backup must be a ZIP file', 400)
    }

    if (file.size <= 0) {
      return createErrorResponse('File is empty', 400)
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return createErrorResponse(
        `Backup file is too large. Max supported size is ${Math.floor(MAX_IMPORT_FILE_BYTES / (1024 * 1024))}MB`,
        413,
      )
    }

    const fileData = await file.arrayBuffer()

    if (!hasZipSignature(fileData)) {
      return createErrorResponse('Uploaded backup is not a valid ZIP file', 400)
    }

    const job = await createImportJob({
      internalUserId: identity.internalUserId,
      fileName: sanitizedFileName,
      fileSize: file.size,
      fileData,
    })
    if (!job) {
      return createErrorResponse('Failed to create import job', 500)
    }

    await enqueueImportJob({
      jobId: job.id,
      internalUserId: identity.internalUserId,
      kind: 'archive',
      requestId,
    })

    return createSuccessResponse(
      { job },
      'Import job created',
      undefined,
      requestId,
      { status: 201 },
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'create-archive-import-job',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to create import job', 500, undefined, 'SERVER_ERROR', requestId)
  }
}
