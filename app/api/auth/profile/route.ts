import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { logActivity, getClientIp } from '@/lib/activity-logger'
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import {
  DEFAULT_AI_SETTINGS,
  USER_SETTINGS_SELECT,
  buildUserSettingsUpdateData,
  extractUserSettingsWriteData,
  mergeUserSettings,
  normalizeAiSettings,
  pickSettingsPatch,
} from '@/lib/user-settings'
import { eq } from 'drizzle-orm'

// GET /api/auth/profile - Get user profile information
export async function GET() {
  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    const user = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.id, internalUserId),
      with: {
        settings: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...mergeUserSettings(user as any, user.settings),
        settings: undefined,
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

// PATCH /api/auth/profile - Update user profile information
export async function PATCH(request: NextRequest) {
  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    const body = await request.json()

        const {
      firstName,
      lastName,
      accentPack,
      theme,
      chartStyle,
      autoAdjustAccountDate,
      breakEvenThreshold,
      pnlDisplayMode,
      aiSettings,
      onboardingStatus,
      timezone,
      widgetStyle
    } = body

    // Validate input - only check fields that are actually provided
    if (chartStyle !== undefined && chartStyle !== 'smooth' && chartStyle !== 'sharp') {
      return NextResponse.json(
        { error: 'Invalid chartStyle format' },
        { status: 400 }
      )
    }
    if (firstName !== undefined && typeof firstName !== 'string' && firstName !== null) {
      return NextResponse.json(
        { error: 'Invalid firstName format' },
        { status: 400 }
      )
    }

    if (lastName !== undefined && typeof lastName !== 'string' && lastName !== null) {
      return NextResponse.json(
        { error: 'Invalid lastName format' },
        { status: 400 }
      )
    }

    if (breakEvenThreshold !== undefined && typeof breakEvenThreshold !== 'number') {
      return NextResponse.json(
        { error: 'Invalid breakEvenThreshold format' },
        { status: 400 }
      )
    }

    if (pnlDisplayMode !== undefined && pnlDisplayMode !== 'net' && pnlDisplayMode !== 'gross') {
      return NextResponse.json(
        { error: 'Invalid pnlDisplayMode format' },
        { status: 400 }
      )
    }

    if (timezone !== undefined && typeof timezone !== 'string' && timezone !== null) {
      return NextResponse.json(
        { error: 'Invalid timezone format' },
        { status: 400 }
      )
    }

    if (widgetStyle !== undefined && widgetStyle !== 'default' && widgetStyle !== 'glass') {
      return NextResponse.json(
        { error: 'Invalid widgetStyle format' },
        { status: 400 }
      )
    }

    // Build update data - only include fields that were sent
    const currentUser = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.id, internalUserId),
      with: {
        settings: true
      }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userUpdateData: Record<string, any> = {}
    if (firstName !== undefined) userUpdateData.firstName = firstName?.trim() || null
    if (lastName !== undefined) userUpdateData.lastName = lastName?.trim() || null

    if (onboardingStatus !== undefined) {
      const currentOnboardingStatus = currentUser.onboardingStatus && typeof currentUser.onboardingStatus === 'object'
        ? currentUser.onboardingStatus
        : {}
      userUpdateData.onboardingStatus = {
        ...currentOnboardingStatus,
        ...(typeof onboardingStatus === 'object' && onboardingStatus ? onboardingStatus : {}),
        last_updated: new Date().toISOString()
      }
    }

    const settingsPatch = pickSettingsPatch({
      accentPack,
      theme,
      chartStyle,
      timezone,
      widgetStyle,
      autoAdjustAccountDate: autoAdjustAccountDate !== undefined ? !!autoAdjustAccountDate : undefined,
      breakEvenThreshold: breakEvenThreshold !== undefined ? getBreakEvenThreshold(breakEvenThreshold) : undefined,
      pnlDisplayMode: pnlDisplayMode !== undefined ? normalizePnlDisplayMode(pnlDisplayMode) : undefined,
      aiSettings: aiSettings !== undefined
        ? normalizeAiSettings({
            ...normalizeAiSettings(currentUser.settings?.aiSettings ?? DEFAULT_AI_SETTINGS),
            ...(typeof aiSettings === 'object' && aiSettings ? aiSettings : {})
          })
        : undefined,
    })

    const updated = await db.transaction(async (tx) => {
      // The update projection is intentionally smaller than the hydrated
      // user record above; normalize it before combining settings.
      let baseUser: any = currentUser
      if (Object.keys(userUpdateData).length > 0) {
        baseUser = (await tx.update(schema.User).set(userUpdateData).where(eq(schema.User.id, internalUserId)).returning({
          id: schema.User.id,
          email: schema.User.email,
          firstName: schema.User.firstName,
          lastName: schema.User.lastName,
          onboardingStatus: schema.User.onboardingStatus,
        }))[0]
      }

      const effectiveSettings = mergeUserSettings({}, {
        ...(currentUser.settings ?? {}),
        ...settingsPatch,
      })

      const storedSettings = (await tx.insert(schema.UserSettings).values({
        userId: internalUserId,
        ...extractUserSettingsWriteData(effectiveSettings),
      }).onConflictDoUpdate({
        target: schema.UserSettings.userId,
        set: buildUserSettingsUpdateData(settingsPatch),
      }).returning())[0]

      return { baseUser, storedSettings }
    })

    const activityUserId =
      typeof updated.baseUser?.id === 'string' && updated.baseUser.id.length > 0
        ? updated.baseUser.id
        : internalUserId

    logActivity({
      userId: activityUserId,
      action: 'PROFILE_UPDATED',
      entity: 'Profile',
      metadata: { updatedFields: [...Object.keys(userUpdateData), ...Object.keys(settingsPatch)] },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({
      success: true,
      data: {
        ...mergeUserSettings(updated.baseUser as any, updated.storedSettings as any),
      },
      message: 'Profile updated successfully'
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
