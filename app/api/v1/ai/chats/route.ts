import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { checkAIAccess } from '@/lib/services/ai-guard-service'
import { hasCurrentAiDataConsent } from '@/lib/services/ai-consent'
import { z } from 'zod'

const createChatSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  accounts: z.array(z.string().min(1).max(256)).max(100).default([]),
  dateRange: z.enum(['all-time', 'last-7-days', 'last-30-days', 'last-90-days', 'custom']).default('last-30-days'),
  customFrom: z.string().datetime().or(z.string().date()).nullable().optional(),
  customTo: z.string().datetime().or(z.string().date()).nullable().optional(),
  dataSources: z.array(z.enum(['trades', 'journals', 'performance', 'statistics', 'reviews'])).max(5).default([]),
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
    // Check general AI access
    const aiGuard = await checkAIAccess(userId)
    if (!aiGuard.hasAccess) {
      return NextResponse.json({ error: aiGuard.reason, code: 'PAYWALL' }, { status: 403 })
    }

    const chats = await db.query.AIChat.findMany({
      where: (table, { eq, and }) => and(eq(table.userId, userId), eq(table.isDeleted, false)),
      orderBy: (table, { desc }) => [desc(table.isPinned), desc(table.updatedAt)],
      columns: {
        id: true,
        title: true,
        isPinned: true,
        isArchived: true,
        accounts: true,
        dateRange: true,
        customFrom: true,
        customTo: true,
        dataSources: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: chats })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
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
    // Check AI access
    const aiGuard = await checkAIAccess(userId)
    if (!aiGuard.hasAccess) {
      return NextResponse.json({ error: aiGuard.reason, code: 'PAYWALL' }, { status: 403 })
    }

    if (!(await hasCurrentAiDataConsent(userId))) {
      return NextResponse.json({ error: 'AI data processing consent is required', code: 'AI_DATA_CONSENT_REQUIRED' }, { status: 412 })
    }

    const { title, accounts, dateRange, customFrom, customTo, dataSources } = createChatSchema.parse(await request.json())

    const chat = (await db.insert(schema.AIChat).values({
      userId,
      title: title || 'New Conversation',
      accounts: accounts || [],
      dateRange: dateRange || 'last-30-days',
      customFrom: customFrom ? new Date(customFrom) : null,
      customTo: customTo ? new Date(customTo) : null,
      dataSources: dataSources || [],
    }).returning())[0]

    return NextResponse.json({ success: true, data: chat })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid chat configuration' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 })
  }
}
