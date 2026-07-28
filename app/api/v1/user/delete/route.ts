import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { deleteUserData } from '@/server/user-data-deletion'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { getSupabaseAdminClient } from '@/server/supabase-admin'
import { enqueueUserStorageCleanup } from '@/server/storage-cleanup-events'
import * as Sentry from '@sentry/nextjs'

export async function DELETE(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deletion = await deleteUserData({
      internalUserId: identity.internalUserId,
      mode: 'delete-account',
      authUserId: identity.authUserId,
    })

    const supabaseAdmin = getSupabaseAdminClient()
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(deletion.authUserId)
    
    if (deleteAuthError) {
      logger.error(`Failed to delete user from Supabase Auth: ${deleteAuthError.message}`)
      return NextResponse.json({ error: 'Failed to fully delete account from auth provider' }, { status: 500 })
    }

    let storageCleanup: 'queued' | 'pending' = 'pending'
    try {
      if (await enqueueUserStorageCleanup({
        internalUserId: deletion.internalUserId,
        storageOwnerIds: deletion.storageOwnerIds,
      })) storageCleanup = 'queued'
    } catch (error) {
      Sentry.captureException(error, { extra: { route: '/api/v1/user/delete', phase: 'storage-enqueue' } })
      logger.error({ error }, 'Account storage cleanup could not be queued')
    }

    return NextResponse.json({ success: true, message: 'Account deleted successfully', storageCleanup })
  } catch (error) {
    logger.error('Account deletion error: ' + (error instanceof Error ? error.message : String(error)))
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
