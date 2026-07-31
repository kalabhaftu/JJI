import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { z } from 'zod'

const createInsightSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(50_000),
  category: z.string().trim().min(1).max(64).default('insight'),
}).strict()

export async function GET(request: NextRequest) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = identity.internalUserId

  try {
    const insights = await db.query.AISavedInsight.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    })

    return NextResponse.json({ success: true, data: insights })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = identity.internalUserId

  try {
    const { title, content, category } = createInsightSchema.parse(await request.json())

    const insight = (await db.insert(schema.AISavedInsight).values({
      userId,
      title,
      content,
      category: category || 'insight',
    }).returning())[0]

    return NextResponse.json({ success: true, data: insight })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid insight' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to save insight' }, { status: 500 })
  }
}
