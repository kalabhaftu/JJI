import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { eq } from 'drizzle-orm'
import { invalidateTradesCache } from '@/lib/cache/invalidate-trade'
import { parseTradeUpdate } from '@/lib/trades/update-schema'
import { getClientIp } from '@/lib/security/client-ip'
import { z } from 'zod'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params

    const trade = await db.query.Trade.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      with: {
        executions: true,
      },
    })

    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    if (trade.userId !== identity.internalUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Convert storage paths or public URLs to signed URLs
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const imageFields = ['imageOne', 'imageTwo', 'imageThree', 'imageFour', 'imageFive', 'imageSix', 'cardPreviewImage'] as const
    for (const field of imageFields) {
      if (trade[field]) {
        let path = trade[field]!
        // If it's a full URL, try to extract the path.
        if (path.includes('/trade-images/')) {
          const parts = path.split('/trade-images/')
          path = parts[parts.length - 1]!
        }
        
        // Remove query params if it's an old signed URL
        if (path.includes('?')) {
          path = path.split('?')[0]!
        }

        const { data } = await supabase.storage.from('trade-images').createSignedUrl(path, 3600) // 1 hour
        if (data?.signedUrl) {
          (trade as any)[field] = data.signedUrl
        }
      }
    }

    return NextResponse.json({ success: true, trade })
  } catch (error: any) {
    logger.error({ error: error?.message, layer: 'api' }, 'GET /api/v1/trades/[id] failed')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const body = parseTradeUpdate(await request.json())

    const existing = await db.query.Trade.findFirst({ where: (table, { eq }) => eq(table.id, id) })
    if (!existing) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    if (existing.userId !== identity.internalUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const updated = (await db.update(schema.Trade).set(body).where(eq(schema.Trade.id, id)).returning())[0]
    await db.insert(schema.AuditLog).values({
      userId: identity.internalUserId,
      action: 'UPDATE_TRADE',
      entityId: id,
      beforeData: existing,
      afterData: updated,
      ipAddress: getClientIp(request.headers),
    })


    await invalidateTradesCache(identity.internalUserId, existing.accountId)

    return NextResponse.json({ success: true, trade: updated })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid trade update', details: error.flatten() }, { status: 400 })
    }
    logger.error({ error: error?.message, layer: 'api' }, 'PATCH /api/v1/trades/[id] failed')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params

    const existing = await db.query.Trade.findFirst({ where: (table, { eq }) => eq(table.id, id) })
    if (!existing) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    if (existing.userId !== identity.internalUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    await db.delete(schema.Trade).where(eq(schema.Trade.id, id))
    await db.insert(schema.AuditLog).values({
      userId: identity.internalUserId,
      action: 'DELETE_TRADE',
      entityId: id,
      beforeData: existing,
      afterData: null,
      ipAddress: getClientIp(request.headers),
    })

    
    await invalidateTradesCache(identity.internalUserId, existing.accountId)

    return NextResponse.json({ success: true, message: 'Trade deleted successfully' })
  } catch (error: any) {
    logger.error({ error: error?.message, layer: 'api' }, 'DELETE /api/v1/trades/[id] failed')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
