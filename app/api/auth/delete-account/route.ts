import { NextRequest, NextResponse } from 'next/server'
import { getUserIdSafe } from '@/server/auth'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { deleteUserData } from '@/server/user-data-deletion'
import { getSupabaseAdminClient } from '@/server/supabase-admin'
import { enqueueUserStorageCleanup } from '@/server/storage-cleanup-events'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function DELETE(request: NextRequest) {
  try {
    const authUserId = await getUserIdSafe()
    
    if (!authUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const identity = await getResolvedUserIdentitySafe()
    let storageOwnerIds = [authUserId]

    // Application data must be removed before the Supabase Auth principal.
    if (identity) {
      const deletion = await deleteUserData({
        internalUserId: identity.internalUserId,
        mode: 'delete-account',
        authUserId: identity.authUserId,
      })
      storageOwnerIds = deletion.storageOwnerIds
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUserId)

    if (authError) {
      Sentry.captureException(authError, { extra: { route: '/api/auth/delete-account', phase: 'auth-delete' } })
      return NextResponse.json(
        { error: 'Application data was deleted, but the auth account could not be removed. Please contact support.' },
        { status: 502 }
      )
    }

    let storageCleanup: 'queued' | 'pending' = 'pending'
    try {
      if (await enqueueUserStorageCleanup({
        internalUserId: identity?.internalUserId ?? authUserId,
        storageOwnerIds,
      })) storageCleanup = 'queued'
    } catch (error) {
      Sentry.captureException(error, { extra: { route: '/api/auth/delete-account', phase: 'storage-enqueue' } })
      logger.error({ error }, 'Account storage cleanup could not be queued')
    }

    return NextResponse.json({
      success: true,
      message: 'Account and all associated data have been permanently deleted',
      storageCleanup,
    })

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to delete account. Please try again or contact support if the problem persists.',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      },
      { status: 500 }
    )
  }
}

// Only allow DELETE method
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
