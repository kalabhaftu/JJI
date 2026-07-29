import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { ADMIN_WIDGET_DEFAULTS } from '@/lib/admin-control-plane'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited
  try {
    const records = await db.query.AdminWidgetSetting.findMany()
    const byType = new Map(records.map((record: any) => [record.widgetType, record]))
    const data = ADMIN_WIDGET_DEFAULTS.map((item) => ({
      ...item,
      ...(byType.get(item.widgetType) || {}),
    }))

    return createSuccessResponse(data, undefined, undefined, requestId)
  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'list-widget-catalog',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to fetch widget catalog',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}
