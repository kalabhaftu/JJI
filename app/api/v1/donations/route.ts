import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(req: NextRequest) {
  const requestId = resolveRequestId(req.headers)
  const rl = await applyApiRoutePolicy(req, 'public-read')
  if (rl) return rl

  try {
    const addresses = await db.query.DonationAddress.findMany({
      where: (table, { eq }) => eq(table.isActive, true),
      orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.createdAt)],
      columns: { token: true, network: true, address: true },
    })

    return createSuccessResponse(addresses, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'list-donation-addresses',
      route: req.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to fetch addresses',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}
