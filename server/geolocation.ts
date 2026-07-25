import logger from '@/lib/logger';
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getClientIp } from '@/lib/security/client-ip'

/**
 * Capture coarse platform-provided location without sending an IP address to a
 * third party or persisting the raw address.
 */
export async function captureUserGeo(userId: string, headers: Headers): Promise<void> {
  try {
    const countryCode = headers.get('x-vercel-ip-country') || undefined
    const region = headers.get('x-vercel-ip-country-region') || undefined
    const encodedCity = headers.get('x-vercel-ip-city')
    const city = encodedCity ? decodeURIComponent(encodedCity) : undefined
    if (!countryCode && !region && !city) return

    await db.insert(schema.UserGeoLog).values({
      userId,
      countryCode,
      city,
      region,
    })
  } catch (err) {
    // Silent failure - geo tracking should never break the user flow
    logger.error({ event: 'system_error', error: err }, '[GeoCapture] Failed:')
  }
}

export function extractIP(headers: Headers): string {
  return getClientIp(headers)
}
