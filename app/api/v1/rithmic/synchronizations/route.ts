import { NextRequest } from "next/server";
import { directSyncUnderDevelopmentMessage } from '@/lib/integrations/direct-sync-status';
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse } from '@/lib/api-response'
import { resolveRequestId } from '@/lib/observability/request-id'


export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited
  return unavailable(requestId)
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited
  await request.json().catch(() => null);
  return unavailable(requestId)
}

export async function DELETE(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited
  await request.json().catch(() => null);
  return unavailable(requestId)
}

function unavailable(requestId: string) {
  return createErrorResponse(
    directSyncUnderDevelopmentMessage('Rithmic'),
    503,
    { underDevelopment: true },
    'DIRECT_SYNC_UNAVAILABLE',
    requestId,
  )
}
