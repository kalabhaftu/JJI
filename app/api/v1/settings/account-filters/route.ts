import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { AccountFilterSettings, DEFAULT_FILTER_SETTINGS } from '@/types/account-filter-settings'

// GET /api/settings/account-filters - Get user's account filter settings
export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
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
        // Parse error, use defaults
      }
    }

    return NextResponse.json({
      success: true,
      data: settings
    }, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30'
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: true,
      data: DEFAULT_FILTER_SETTINGS
    }, {
      status: 200, // Return 200 with defaults rather than erroring
      headers: {
        'Cache-Control': 'no-store' // Don't cache errors
      }
    })
  }
}

// POST /api/settings/account-filters - Update user's account filter settings
export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
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

    return NextResponse.json({
      success: true,
      data: settings
    }, {
      headers: {
        'Cache-Control': 'no-store' // Don't cache POST responses
      }
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}