

import { NextRequest } from 'next/server'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import propFirmTemplates from '@/lib/data/prop-firm-templates.json'
import { createSuccessResponse } from '@/lib/api-response'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'public-read')
  if (limited) return limited
  return createSuccessResponse(propFirmTemplates, undefined, undefined, requestId)
}
