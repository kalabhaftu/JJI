import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { eq, and, asc } from 'drizzle-orm'

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  content: z.object({
    root: z.object({
      children: z.array(z.any()),
      direction: z.string(),
      format: z.string(),
      indent: z.number(),
      type: z.string(),
      version: z.number(),
    }),
  }),
})

const MAX_CUSTOM_TEMPLATES = 3

function isMissingJournalTemplateTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybePrismaError = error as {
    code?: string
    meta?: { modelName?: string; table?: string }
  }

  if (maybePrismaError.code !== 'P2021') return false

  return (
    maybePrismaError.meta?.modelName === 'JournalTemplate' ||
    maybePrismaError.meta?.table === 'public.JournalTemplate'
  )
}

export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const templates = await db.query.JournalTemplate.findMany({
      where: (table, { eq }) => eq(table.userId, identity.internalUserId),
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      columns: {
        id: true,
        name: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    if (isMissingJournalTemplateTableError(error)) {
      return NextResponse.json({
        templates: [],
        migrationRequired: true,
      })
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = createTemplateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid template payload' }, { status: 400 })
  }

  const { name, content } = parsed.data
  const userId = identity.internalUserId

  try {
    const existingByName = await db.query.JournalTemplate.findFirst({
      where: (table, { eq, and }) => and(eq(table.userId, userId), eq(table.name, name)),
      columns: { id: true },
    })

    if (existingByName) {
      const updated = (await db.update(schema.JournalTemplate).set({ content }).where(and(
        eq(schema.JournalTemplate.id, existingByName.id),
        eq(schema.JournalTemplate.userId, userId),
      )).returning())[0]
      return NextResponse.json({ template: updated, updated: true })
    }

    const count = await db.$count(schema.JournalTemplate, eq(schema.JournalTemplate.userId, userId))

    if (count >= MAX_CUSTOM_TEMPLATES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CUSTOM_TEMPLATES} custom templates allowed` },
        { status: 409 }
      )
    }

    const created = (await db.insert(schema.JournalTemplate).values({ userId, name, content }).returning())[0]

    return NextResponse.json({ template: created, created: true }, { status: 201 })
  } catch (error) {
    if (isMissingJournalTemplateTableError(error)) {
      return NextResponse.json(
        {
          error: 'Custom templates are temporarily unavailable until the latest database migration is applied.',
          migrationRequired: true,
        },
        { status: 503 }
      )
    }
    throw error
  }
}
