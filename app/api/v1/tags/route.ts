import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { CacheHeaders } from '@/lib/api-cache-headers'

// GET - Fetch all tags for a user
export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = identity.internalUserId

    const tags = await db.query.TradeTag.findMany({
      where: (table, { eq }) => eq(table.userId, userId),
      orderBy: (table, { asc }) => [asc(table.name)]
    })

    return NextResponse.json({ tags }, {
      headers: CacheHeaders.short // Cache for 60 seconds
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}

// POST - Create a new tag
export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = identity.internalUserId

    const body = await request.json()
    const { name, color } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      )
    }

    const existingTag = await db.query.TradeTag.findFirst({
      where: (table, { and, eq }) => and(
        eq(table.name, name),
        eq(table.userId, userId)
      )
    })

    if (existingTag) {
      return NextResponse.json(
        { error: 'Tag with this name already exists' },
        { status: 400 }
      )
    }

    const tag = (await db.insert(schema.TradeTag).values({
      id: crypto.randomUUID(),
      updatedAt: new Date(),
      name,
      color: color || '#3b82f6',
      userId
    }).returning())[0]

    return NextResponse.json({ tag })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    )
  }
}