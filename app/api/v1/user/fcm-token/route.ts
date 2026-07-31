import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    await db.update(schema.User).set({ fcmToken: token }).where(eq(schema.User.id, internalUserId))

    return NextResponse.json({ success: true, message: 'FCM token updated successfully' })
  } catch (error: any) {
    logger.error('POST /api/v1/user/fcm-token' + ' : ' + error)
    if (error.message?.includes('not authenticated') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to update FCM token' }, { status: 500 })
  }
}