import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { z } from 'zod'

const updateChatSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = identity.internalUserId

  const { chatId } = await params

  try {
    const chat = await db.query.AIChat.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, chatId), eq(table.userId, userId), eq(table.isDeleted, false)),
      with: {
        messages: {
          orderBy: (table, { asc }) => [asc(table.createdAt)],
        },
      },
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: chat })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = identity.internalUserId

  const { chatId } = await params

  try {
    const chat = await db.query.AIChat.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, chatId), eq(table.userId, userId), eq(table.isDeleted, false)),
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const { title, isPinned, isArchived } = updateChatSchema.parse(await request.json())

    const updatedChat = (await db
      .update(schema.AIChat)
      .set({
        ...(title !== undefined && { title }),
        ...(isPinned !== undefined && { isPinned }),
        ...(isArchived !== undefined && { isArchived }),
      })
      .where(and(eq(schema.AIChat.id, chatId), eq(schema.AIChat.userId, userId)))
      .returning({
        id: schema.AIChat.id,
        title: schema.AIChat.title,
        isPinned: schema.AIChat.isPinned,
        isArchived: schema.AIChat.isArchived,
        createdAt: schema.AIChat.createdAt,
        updatedAt: schema.AIChat.updatedAt,
      }))[0]

    return NextResponse.json({ success: true, data: updatedChat })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid chat update' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const rl = await applyRateLimit(request, apiLimiter)
  if (rl) return rl

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = identity.internalUserId

  const { chatId } = await params

  try {
    const chat = await db.query.AIChat.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, chatId), eq(table.userId, userId), eq(table.isDeleted, false)),
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    await db
      .update(schema.AIChat)
      .set({ isDeleted: true })
      .where(and(eq(schema.AIChat.id, chatId), eq(schema.AIChat.userId, userId)))

    return NextResponse.json({ success: true, message: 'Chat deleted successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 })
  }
}
