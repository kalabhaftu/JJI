import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { and, eq } from 'drizzle-orm'
import { invalidateTradesCache } from '@/lib/cache/invalidate-trade'
import { parseTradeUpdate } from '@/lib/trades/update-schema'
import { getClientIp } from '@/lib/security/client-ip'
import { z } from 'zod'
import { createSignedStorageUrl } from '@/server/storage-admin'

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

    const imageFields = ['imageOne', 'imageTwo', 'imageThree', 'imageFour', 'imageFive', 'imageSix', 'cardPreviewImage'] as const
    for (const field of imageFields) {
      if (trade[field]) {
        const signedUrl = await createSignedStorageUrl(trade[field]!, 3600)
        if (signedUrl) (trade as any)[field] = signedUrl
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

    const updated = (await db.update(schema.Trade).set(body).where(and(
      eq(schema.Trade.id, id),
      eq(schema.Trade.userId, identity.internalUserId),
    )).returning())[0]
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

    await db.delete(schema.Trade).where(and(
      eq(schema.Trade.id, id),
      eq(schema.Trade.userId, identity.internalUserId),
    ))
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
