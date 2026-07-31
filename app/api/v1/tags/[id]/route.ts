import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { eq, and } from 'drizzle-orm'

export async function PUT(
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
    const userId = identity.internalUserId

    const { id } = await params
    const body = await request.json()
    const { name, color } = body

    // Verify tag ownership
    const existingTag = await db.query.TradeTag.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, userId))
    })

    if (!existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    if (name && name !== existingTag.name) {
      const nameConflict = await db.query.TradeTag.findFirst({
        where: (table, { eq, and }) => and(eq(table.name, name), eq(table.userId, userId))
      })

      if (nameConflict) {
        return NextResponse.json(
          { error: 'Tag with this name already exists' },
          { status: 400 }
        )
      }
    }

    const updatedTag = (await db.update(schema.TradeTag).set({
      ...(name && { name }),
      ...(color && { color })
    }).where(eq(schema.TradeTag.id, id)).returning())[0]

    return NextResponse.json({ tag: updatedTag })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update tag' },
      { status: 500 }
    )
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
    const userId = identity.internalUserId

    const { id } = await params

    // Verify tag ownership
    const existingTag = await db.query.TradeTag.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, userId))
    })

    if (!existingTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Remove tag from all trades that have this tag
    const trades = await db.query.Trade.findMany({
      where: (table, { eq }) => eq(table.userId, userId)
    })

    for (const trade of trades) {
      const updatedTags = (trade.tags || []).filter((tagId: string) => tagId !== id)
      await db.update(schema.Trade).set({ tags: updatedTags }).where(and(
        eq(schema.Trade.id, trade.id),
        eq(schema.Trade.userId, userId),
      )).returning()
    }

    await db.delete(schema.TradeTag).where(and(
      eq(schema.TradeTag.id, id),
      eq(schema.TradeTag.userId, userId),
    )).returning()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete tag' },
      { status: 500 }
    )
  }
}
