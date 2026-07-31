import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ insightId: string }> }
) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = identity.internalUserId

  const { insightId } = await params

  try {
    const insight = await db.query.AISavedInsight.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, insightId), eq(table.userId, userId)),
    })

    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    await db.delete(schema.AISavedInsight).where(and(
      eq(schema.AISavedInsight.id, insightId),
      eq(schema.AISavedInsight.userId, userId),
    ))

    return NextResponse.json({ success: true, message: 'Insight deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete insight' }, { status: 500 })
  }
}
