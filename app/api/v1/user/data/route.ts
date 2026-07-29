import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { deleteUserData } from '@/server/user-data-deletion'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { revalidateTag } from 'next/cache'
import { enqueueUserStorageCleanup } from '@/server/storage-cleanup-events'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'

export async function DELETE(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const internalUserId = identity.internalUserId

    // Verify confirmation in request body
    const body = await request.json().catch(() => ({}))
    if (body.confirmation !== 'DELETE ALL DATA') {
      return createErrorResponse(
        'Confirmation required. Please type "DELETE ALL DATA" to confirm.',
        400,
        undefined,
        'CONFIRMATION_REQUIRED',
        requestId,
      )
    }

    const deletion = await deleteUserData({
      internalUserId,
      mode: 'purge-data',
      authUserId: identity.authUserId,
      requestId,
      ipAddress: getClientIp(request.headers),
    })

    let storageCleanup: 'queued' | 'pending' = 'pending'
    try {
      if (await enqueueUserStorageCleanup({
        internalUserId: deletion.internalUserId,
        storageOwnerIds: deletion.storageOwnerIds,
      })) storageCleanup = 'queued'
    } catch (error) {
      reportError(error, {
        surface: 'background-job',
        operation: 'enqueue-user-data-storage-cleanup',
        route: request.nextUrl.pathname,
        requestId,
        userId: internalUserId,
      })
    }

    // Invalidate all caches (use internal user ID for consistency with other cache keys)
    revalidateTag(`trades-${internalUserId}`)
    revalidateTag(`accounts-${internalUserId}`)
    revalidateTag(`user-data-${internalUserId}`)

    return createSuccessResponse(
      { storageCleanup },
      'All user data has been permanently deleted. Your account remains active.',
      undefined,
      requestId,
    )

  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'purge-user-data',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to delete data. Please try again.',
      500,
      undefined,
      'USER_DATA_DELETE_FAILED',
      requestId,
    )
  }
}

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  return createErrorResponse(
    'Method not allowed',
    405,
    undefined,
    'METHOD_NOT_ALLOWED',
    requestId,
  )
}
