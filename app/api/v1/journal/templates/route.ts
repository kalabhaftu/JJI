import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { eq, and, asc } from 'drizzle-orm'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

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
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'authenticated-read')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
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

    return createSuccessResponse({ templates }, undefined, undefined, requestId)
  } catch (error) {
    if (isMissingJournalTemplateTableError(error)) {
      return createSuccessResponse(
        { templates: [], migrationRequired: true },
        undefined,
        undefined,
        requestId,
      )
    }
    reportError(error, {
      surface: 'api',
      operation: 'list-journal-templates',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to load templates', 500, undefined, 'TEMPLATE_LIST_FAILED', requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }

  const json = await request.json().catch(() => null)
  const parsed = createTemplateSchema.safeParse(json)
  if (!parsed.success) {
    return createErrorResponse(
      'Invalid template payload',
      400,
      parsed.error.flatten(),
      'VALIDATION_ERROR',
      requestId,
    )
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
      return createSuccessResponse({ template: updated, updated: true }, undefined, undefined, requestId)
    }

    const count = await db.$count(schema.JournalTemplate, eq(schema.JournalTemplate.userId, userId))

    if (count >= MAX_CUSTOM_TEMPLATES) {
      return createErrorResponse(
        `Maximum ${MAX_CUSTOM_TEMPLATES} custom templates allowed`,
        409,
        undefined,
        'TEMPLATE_LIMIT_REACHED',
        requestId,
      )
    }

    const created = (await db.insert(schema.JournalTemplate).values({ userId, name, content }).returning())[0]

    return createSuccessResponse(
      { template: created, created: true },
      undefined,
      undefined,
      requestId,
      { status: 201 },
    )
  } catch (error) {
    if (isMissingJournalTemplateTableError(error)) {
      return createErrorResponse(
        'Custom templates are temporarily unavailable until the latest database migration is applied.',
        503,
        { migrationRequired: true },
        'MIGRATION_REQUIRED',
        requestId,
      )
    }
    reportError(error, {
      surface: 'api',
      operation: 'save-journal-template',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to save template', 500, undefined, 'TEMPLATE_SAVE_FAILED', requestId)
  }
}
