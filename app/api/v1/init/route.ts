import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getInitBootstrapData } from '@/server/init-bootstrap'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { getCountryLabel, normalizeCityName, normalizeCountryCode } from '@/lib/geo'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  try {
    const payload = await getInitBootstrapData()
    

    if (payload.isAuthenticated && payload.user?.id) {
      const headerList = await headers()
      const countryCode = normalizeCountryCode(headerList.get('x-vercel-ip-country'))
      const city = normalizeCityName(headerList.get('x-vercel-ip-city'))
      const country = countryCode ? getCountryLabel(undefined, countryCode) : null
      
      if (countryCode || city) {

        db.query.UserGeoLog.findFirst({
          where: (table, { eq }) => eq(table.userId, payload.user.id),
          orderBy: (table, { desc }) => [desc(table.createdAt)]
        }).then(lastLog => {
          if (
            !lastLog ||
            normalizeCountryCode(lastLog.countryCode) !== countryCode ||
            normalizeCityName(lastLog.city) !== city
          ) {
            return db.insert(schema.UserGeoLog).values({
              userId: payload.user.id,
              countryCode: countryCode || null,
              country: country || null,
              city: city || null,
            }).returning().then((rows) => rows[0]).catch((error: unknown) => reportError(error, {
              surface: 'server',
              operation: 'record-user-geo-change',
              route: request.nextUrl.pathname,
              requestId,
            }))
          }
        }).catch((error: unknown) => reportError(error, {
          surface: 'server',
          operation: 'load-user-geo-history',
          route: request.nextUrl.pathname,
          requestId,
        }))
      }
    }

    return createSuccessResponse(payload, undefined, undefined, requestId, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
      },
    })
    
  } catch (error) {
    reportError(error, { surface: 'api', operation: 'load-init-bootstrap', route: request.nextUrl.pathname, requestId })
    return createErrorResponse('Internal server error', 500, undefined, 'INIT_FAILED', requestId)
  }
}
