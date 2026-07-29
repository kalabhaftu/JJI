import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { eq, and } from 'drizzle-orm'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { resolveRequestId } from '@/lib/observability/request-id'

interface RouteParams {
  params: Promise<{ id: string }>
}

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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const requestId = resolveRequestId(request.headers)
  const limited = await applyApiRoutePolicy(request, 'sensitive')
  if (limited) return limited

  const identity = await getResolvedUserIdentitySafe()
  if (!identity) {
    return createErrorResponse('Unauthorized', 401, undefined, 'UNAUTHORIZED', requestId)
  }

  const { id } = await params

  try {
    const existing = await db.query.JournalTemplate.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, id), eq(table.userId, identity.internalUserId)),
      columns: { id: true },
    })

    if (!existing) {
      return createErrorResponse('Template not found', 404, undefined, 'NOT_FOUND', requestId)
    }

    await db
      .delete(schema.JournalTemplate)
      .where(and(
        eq(schema.JournalTemplate.id, id),
        eq(schema.JournalTemplate.userId, identity.internalUserId),
      ))

    return createSuccessResponse({ deleted: true }, undefined, undefined, requestId)
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
      operation: 'delete-journal-template',
      route: request.nextUrl.pathname,
      requestId,
    })
    return createErrorResponse('Failed to delete template', 500, undefined, 'TEMPLATE_DELETE_FAILED', requestId)
  }
}
