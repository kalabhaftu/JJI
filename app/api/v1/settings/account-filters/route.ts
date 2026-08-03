import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'
import { AccountFilterSettings, DEFAULT_FILTER_SETTINGS } from '@/types/account-filter-settings'


export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'authenticated-read')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const userSettings = await db.query.UserSettings.findFirst({
      where: (table, { eq }) => eq(table.userId, identity.internalUserId)
    })
    
    let settings = DEFAULT_FILTER_SETTINGS
    const storedValue = userSettings?.accountFilterSettings
    if (storedValue) {
      try {
        const savedSettings = JSON.parse(storedValue) as Partial<AccountFilterSettings>
        settings = {
          ...DEFAULT_FILTER_SETTINGS,
          ...savedSettings
        }
      } catch (error) {
        reportError(error, {
          surface: 'api',
          operation: 'parse-account-filter-settings',
          route: request.nextUrl.pathname,
          requestId,
          userId: identity.internalUserId,
          extra: { fallbackUsed: true },
        })
      }
    }

    return createSuccessResponse(settings, undefined, undefined, requestId, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30'
      }
    })

  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'load-account-filter-settings',
      route: request.nextUrl.pathname,
      requestId,
      extra: { fallbackUsed: true },
    })
    return createSuccessResponse(DEFAULT_FILTER_SETTINGS, undefined, {
      fallback: true,
    }, requestId, {
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  }
}


export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const rateLimitRes = await applyApiRoutePolicy(request, 'sensitive')
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
    }

    const settings: AccountFilterSettings = await request.json()
    settings.updatedAt = new Date().toISOString()

    const settingsData = {
      userId: identity.internalUserId,
      accountFilterSettings: JSON.stringify(settings),
      updatedAt: new Date()
    }
    await db.insert(schema.UserSettings)
      .values(settingsData)
      .onConflictDoUpdate({
        target: schema.UserSettings.userId,
        set: { 
          accountFilterSettings: settingsData.accountFilterSettings,
          updatedAt: new Date()
        }
      })

    return createSuccessResponse(settings, undefined, undefined, requestId, {
      headers: {
        'Cache-Control': 'no-store'
      }
    })

  } catch (error) {
    reportError(error, {
      surface: 'api',
      operation: 'save-account-filter-settings',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse(
      'Failed to save settings',
      500,
      undefined,
      'SERVER_ERROR',
      requestId,
    )
  }
}
