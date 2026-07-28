import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { deleteUserData } from '@/server/user-data-deletion'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { revalidateTag } from 'next/cache'
import { enqueueUserStorageCleanup } from '@/server/storage-cleanup-events'
import * as Sentry from '@sentry/nextjs'

export async function DELETE(request: NextRequest) {
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
    const internalUserId = identity.internalUserId

    // Verify confirmation in request body
    const body = await request.json().catch(() => ({}))
    if (body.confirmation !== 'DELETE ALL DATA') {
      return NextResponse.json(
        { success: false, error: 'Confirmation required. Please type "DELETE ALL DATA" to confirm.' },
        { status: 400 }
      )
    }

    const deletion = await deleteUserData({
      internalUserId,
      mode: 'purge-data',
      authUserId: identity.authUserId,
    })

    let storageCleanup: 'queued' | 'pending' = 'pending'
    try {
      if (await enqueueUserStorageCleanup({
        internalUserId: deletion.internalUserId,
        storageOwnerIds: deletion.storageOwnerIds,
      })) storageCleanup = 'queued'
    } catch (error) {
      Sentry.captureException(error, { extra: { route: '/api/v1/user/data', phase: 'storage-enqueue' } })
      logger.error({ error, layer: 'User Data Wipe' }, 'Storage cleanup could not be queued')
    }

    // Invalidate all caches (use internal user ID for consistency with other cache keys)
    revalidateTag(`trades-${internalUserId}`)
    revalidateTag(`accounts-${internalUserId}`)
    revalidateTag(`user-data-${internalUserId}`)

    return NextResponse.json({
      success: true,
      message: 'All user data has been permanently deleted. Your account remains active.',
      storageCleanup,
    })

  } catch (error) {
    logger.error({ error, layer: 'User Data Delete' }, 'Delete all user data failed')
    return NextResponse.json(
      { success: false, error: 'Failed to delete data. Please try again.' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  )
}
