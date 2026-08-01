import { NextRequest } from 'next/server'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import {
  createOnboardingSampleWorkspace,
  deleteOnboardingSampleWorkspaceForUser,
} from '@/server/accounts/lifecycle'
import { isDomainError } from '@/lib/domain-error'

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)

    const account = await createOnboardingSampleWorkspace(identity.internalUserId, {
      source: 'api',
      requestId,
      ipAddress: getClientIp(request.headers),
    })

    return createSuccessResponse({
      ...account,
      accountType: 'live',
      displayName: account.name || account.number,
    }, undefined, undefined, requestId, { status: 201 })
  } catch (error) {
    if (isDomainError(error)) {
      return createErrorResponse(error.message, error.status, undefined, error.code, requestId)
    }
    reportError(error, { surface: 'api', operation: 'create-onboarding-sample-workspace', requestId })
    return createErrorResponse('Could not create the sample workspace', 500, undefined, 'SAMPLE_WORKSPACE_CREATE_FAILED', requestId)
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitResponse = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)

    const body = await request.json() as { accountId?: string }
    if (!body.accountId) {
      return createErrorResponse('accountId is required', 400, undefined, 'VALIDATION_ERROR', requestId)
    }

    await deleteOnboardingSampleWorkspaceForUser(identity.internalUserId, body.accountId, {
      source: 'api',
      requestId,
      ipAddress: getClientIp(request.headers),
    })

    return createSuccessResponse({ deleted: true }, undefined, undefined, requestId)
  } catch (error) {
    if (isDomainError(error)) {
      return createErrorResponse(error.message, error.status, undefined, error.code, requestId)
    }
    reportError(error, { surface: 'api', operation: 'delete-onboarding-sample-workspace', requestId })
    return createErrorResponse('Could not remove the sample workspace', 500, undefined, 'SAMPLE_WORKSPACE_DELETE_FAILED', requestId)
  }
}
