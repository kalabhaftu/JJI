import { NextRequest } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { deleteUserData } from '@/server/user-data-deletion'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { getSupabaseAdminClient } from '@/server/supabase-admin'
import { enqueueUserStorageCleanup } from '@/server/storage-cleanup-events'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'

export async function DELETE(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'account-delete')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const deletion = await deleteUserData({
      internalUserId: identity.internalUserId,
      mode: 'delete-account',
      authUserId: identity.authUserId,
      requestId,
      ipAddress: getClientIp(request.headers),
    })

    const supabaseAdmin = getSupabaseAdminClient()
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(deletion.authUserId)
    
    if (deleteAuthError) {
      reportError(deleteAuthError, {
        surface: 'api',
        operation: 'delete-auth-principal',
        route: request.nextUrl.pathname,
        requestId,
        userId: identity.internalUserId,
      })
      return createErrorResponse(
        'Failed to fully delete account from auth provider',
        502,
        undefined,
        'AUTH_ACCOUNT_DELETE_FAILED',
        requestId,
      )
    }

    let storageCleanup: 'queued' | 'pending' = 'pending'
    try {
      if (await enqueueUserStorageCleanup({
        internalUserId: deletion.internalUserId,
        storageOwnerIds: deletion.storageOwnerIds,
        requestId,
      })) storageCleanup = 'queued'
    } catch (error) {
      reportError(error, {
        surface: 'background-job',
        operation: 'enqueue-account-storage-cleanup',
        route: request.nextUrl.pathname,
        requestId,
        userId: identity.internalUserId,
      })
    }

    return createSuccessResponse(
      { storageCleanup },
      'Account deleted successfully',
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'delete-user-account',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to delete account',
      500,
      undefined,
      'ACCOUNT_DELETE_FAILED',
      requestId,
    )
  }
}
