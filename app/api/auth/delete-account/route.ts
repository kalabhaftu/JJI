'use server'

import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/server/auth'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSupabaseAdminClient } from '@/server/supabase-admin'
import { logger } from '@/lib/logger';

export async function DELETE(request: NextRequest) {
  try {
    // Get the authenticated user ID
    const userId = await getUserId()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const dbUser = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.auth_user_id, userId),
      columns: { id: true },
    })

    if (dbUser?.id) {
      // 0. Collect all trade and backtest images for storage cleanup
      const [trades, backtestTrades] = await Promise.all([
        db.query.Trade.findMany({
          where: (table, { eq }) => eq(table.userId, dbUser.id),
          columns: {
            imageOne: true, imageTwo: true, imageThree: true,
            imageFour: true, imageFive: true, imageSix: true,
            cardPreviewImage: true
          }
        }),
        db.query.BacktestTrade.findMany({
          where: (table, { eq }) => eq(table.userId, dbUser.id),
          columns: {
            imageOne: true, imageTwo: true, imageThree: true,
            imageFour: true, imageFive: true, imageSix: true,
            cardPreviewImage: true
          }
        })
      ])

      const imageUrls = [
        ...trades.flatMap(t => [t.imageOne, t.imageTwo, t.imageThree, t.imageFour, t.imageFive, t.imageSix, t.cardPreviewImage]),
        ...backtestTrades.flatMap(t => [t.imageOne, t.imageTwo, t.imageThree, t.imageFour, t.imageFive, t.imageSix, t.cardPreviewImage])
      ].filter((url): url is string => !!url)

      if (imageUrls.length > 0) {
        try {
          const { deletePublicStorageUrls } = await import('@/server/storage-admin')
          await deletePublicStorageUrls(imageUrls)
        } catch (err) {
          logger.error('Failed to cleanup storage during user account deletion: ' + (err instanceof Error ? err.message : String(err)))
        }
      }

      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (authError) {
        return NextResponse.json(
          { error: 'Failed to delete auth account. Please try again.' },
          { status: 502 }
        )
      }

       try {
         await db.delete(schema.User).where(eq(schema.User.id, dbUser.id))
       } catch (error) {
         Sentry.captureException(error, { extra: { route: '/api/auth/delete-account' } })
         // If the auth->public FK cascade already removed the row, there's nothing left to do.
       }
    }

    return NextResponse.json({
      success: true,
      message: 'Account and all associated data have been permanently deleted'
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