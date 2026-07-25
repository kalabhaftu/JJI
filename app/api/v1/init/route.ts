import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getInitBootstrapData } from '@/server/init-bootstrap'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { getCountryLabel, normalizeCityName, normalizeCountryCode } from '@/lib/geo'

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, apiLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const payload = await getInitBootstrapData()
    
    // Background Geo Logging
    if (payload.isAuthenticated && payload.user?.id) {
      const headerList = await headers()
      const countryCode = normalizeCountryCode(headerList.get('x-vercel-ip-country'))
      const city = normalizeCityName(headerList.get('x-vercel-ip-city'))
      const country = countryCode ? getCountryLabel(undefined, countryCode) : null
      
      if (countryCode || city) {
        // Run completely asynchronously without blocking the payload delivery
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
            }).returning().then((rows) => rows[0]).catch((err: unknown) => logger.error('Geo logging failed' + ' : ' + err))
          }
        }).catch((err: unknown) => logger.error('Geo logging failed on ip' + ' : ' + err))
      }
    }

    const response = NextResponse.json(payload)
    
    // Access and payment state must reflect immediately after webhook-driven updates.
    response.headers.set('Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate')
    return response
    
  } catch (error: any) {
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('/api/v1/init failed' + ' : ' + error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
