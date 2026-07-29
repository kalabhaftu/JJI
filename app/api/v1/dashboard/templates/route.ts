import { NextRequest } from 'next/server'

import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { getClientIp } from '@/lib/security/client-ip'
import {
  createDashboardTemplateForUser,
  listDashboardTemplatesForUser,
} from '@/server/dashboard-templates-domain'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    return createSuccessResponse(
      await listDashboardTemplatesForUser(identity.internalUserId),
      undefined,
      undefined,
      requestId,
    )
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'list-dashboard-templates',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to load dashboard templates', 500, undefined, 'SERVER_ERROR', requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name : ''
    const template = await createDashboardTemplateForUser(
      identity.internalUserId,
      name,
      {
        source: 'api',
        requestId,
        ipAddress: getClientIp(request.headers),
      },
    )
    return createSuccessResponse(template, 'Template created', undefined, requestId, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create template'
    const expected = message.includes('already exists') || message.includes('required')
    if (!expected) {
      reportError(error, {
        surface: 'api',
        operation: 'create-dashboard-template',
        route: request.nextUrl.pathname,
        requestId,
      })
    }
    return createErrorResponse(
      expected ? message : 'Failed to create dashboard template',
      message.includes('already exists') ? 409 : expected ? 400 : 500,
      undefined,
      message.includes('already exists') ? 'CONFLICT' : expected ? 'VALIDATION_ERROR' : 'SERVER_ERROR',
      requestId,
    )
  }
}
