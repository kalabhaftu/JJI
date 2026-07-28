import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await applyRateLimit(req, apiLimiter)
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params
    const body = await req.json()

    const goal = await db.query.UserGoal.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })
    if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = (await db.update(schema.UserGoal).set({
      ...(body.currentValue !== undefined && { currentValue: Number(body.currentValue) }),
      ...(body.isCompleted !== undefined && {
        isCompleted: Boolean(body.isCompleted),
        completedAt: body.isCompleted ? new Date() : null,
      }),
      ...(body.title && { title: body.title }),
      ...(body.targetValue !== undefined && { targetValue: Number(body.targetValue) }),
    }).where(and(
      eq(schema.UserGoal.id, id),
      eq(schema.UserGoal.userId, internalUserId),
    )).returning())[0]
    return NextResponse.json({ goal: updated })
  } catch (err) {
    logger.error('Failed to update goal: ' + (err instanceof Error ? err.message : String(err)))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return PATCH(req, { params } as any)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await applyRateLimit(req, apiLimiter)
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { id } = await params
    const goal = await db.query.UserGoal.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
    })
    if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.delete(schema.UserGoal).where(and(
      eq(schema.UserGoal.id, id),
      eq(schema.UserGoal.userId, internalUserId),
    ))
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('Failed to delete goal: ' + (err instanceof Error ? err.message : String(err)))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
