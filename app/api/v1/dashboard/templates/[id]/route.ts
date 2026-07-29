import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import {
  deleteDashboardTemplateForUser,
  switchDashboardTemplateForUser,
  updateDashboardTemplateLayoutForUser,
} from '@/server/dashboard-templates-domain'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const { id } = await params
    const body = await request.json().catch(() => null)
    const context = {
      source: 'api' as const,
      requestId,
      ipAddress: getClientIp(request.headers),
    }
    const template = body?.operation === 'switch'
      ? await switchDashboardTemplateForUser(identity.internalUserId, id, context)
      : await updateDashboardTemplateLayoutForUser(
          identity.internalUserId,
          id,
          body?.layout,
          context,
        )
    return createSuccessResponse(template, undefined, undefined, requestId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Template update failed'
    const expected = message.includes('not found')
      || message.includes('Cannot modify')
      || message.includes('Invalid')
    if (!expected) {
      reportError(error, {
        surface: 'api',
        operation: 'update-dashboard-template',
        route: request.nextUrl.pathname,
        requestId,
      })
    }
    return createErrorResponse(
      expected ? message : 'Failed to update dashboard template',
      message.includes('not found') ? 404 : expected ? 400 : 500,
      undefined,
      message.includes('not found') ? 'NOT_FOUND' : expected ? 'VALIDATION_ERROR' : 'SERVER_ERROR',
      requestId,
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const { id } = await params
    await deleteDashboardTemplateForUser(identity.internalUserId, id, {
      source: 'api',
      requestId,
      ipAddress: getClientIp(request.headers),
    })
    return createSuccessResponse(null, 'Template deleted', undefined, requestId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Template delete failed'
    const expected = message.includes('not found') || message.includes('Cannot delete')
    if (!expected) {
      reportError(error, {
        surface: 'api',
        operation: 'delete-dashboard-template',
        route: request.nextUrl.pathname,
        requestId,
      })
    }
    return createErrorResponse(
      expected ? message : 'Failed to delete dashboard template',
      message.includes('not found') ? 404 : expected ? 400 : 500,
      undefined,
      message.includes('not found') ? 'NOT_FOUND' : expected ? 'VALIDATION_ERROR' : 'SERVER_ERROR',
      requestId,
    )
  }
}
