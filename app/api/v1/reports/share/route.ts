import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentity } from '@/server/user-identity'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { calculateReportStatistics } from '@/lib/statistics/report-statistics'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { reportApiHandlerError } from '@/lib/api/canonical-handler'
import { getWebsiteURL } from '@/server/auth/client'
import { and, eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function generateSlug(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const boundedString = (max: number) => z.preprocess(
  (value) => (value === '' || value === 'all' ? undefined : value),
  z.string().trim().max(max).optional().nullable()
)
const dateString = z.preprocess(
  (value) => {
    if (value === '' || value == null) return undefined
    if (typeof value !== 'string') return value
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toISOString().slice(0, 10)
  },
  z.string().date().optional().nullable()
)

const shareReportSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  dateFrom: dateString,
  dateTo: dateString,
  accountId: boundedString(128),
  accountNumbers: z.preprocess(
    (value) => Array.isArray(value) ? value.filter((item) => item !== '' && item !== 'all') : value,
    z.array(z.string().trim().min(1).max(128)).max(50).optional()
  ),
  symbol: boundedString(32),
  session: boundedString(64),
  outcome: boundedString(32),
  strategy: boundedString(128),
  ruleBroken: z.union([z.boolean(), z.enum(['broken', 'not-broken'])]).optional().nullable(),
  snapshot: z.record(z.string(), z.unknown()).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional().nullable(),
}).strict()

function normalizeRuleBroken(value: z.infer<typeof shareReportSchema>['ruleBroken']) {
  if (typeof value === 'boolean') return value ? 'broken' : 'not-broken'
  return value || undefined
}

export async function POST(req: NextRequest) {
  const rl = await applyApiRoutePolicy(req)
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const body = await req.json().catch(() => null)
    const parsed = shareReportSchema.safeParse(body)

    if (!parsed.success) {
      logger.warn('Reports share validation failed' + ' : ' + JSON.stringify({ fields: parsed.error.flatten().fieldErrors }))
      return createErrorResponse('Validation failed', 400, parsed.error.flatten(), 'VALIDATION_ERROR')
    }

    const payload = parsed.data
    const sharingPolicy = await db.query.AdminSharingPolicy.findFirst({ where: (table, { eq }) => eq(table.key, 'default') }).catch(() => null)

    if (sharingPolicy?.publicSharingEnabled === false) {
      return createErrorResponse('Public report sharing is currently disabled', 403)
    }

    if (payload.dateFrom && payload.dateTo && payload.dateFrom > payload.dateTo) {
      return createErrorResponse('dateFrom must be before dateTo', 400, undefined, 'INVALID_DATE_RANGE')
    }

    const serverSnapshot = await calculateReportStatistics({
      userId: internalUserId,
      accountId: payload.accountId || undefined,
      accountNumbers: payload.accountNumbers,
      dateFrom: payload.dateFrom || undefined,
      dateTo: payload.dateTo || undefined,
      symbol: payload.symbol || undefined,
      session: payload.session || undefined,
      outcome: payload.outcome || undefined,
      strategy: payload.strategy || undefined,
      ruleBroken: normalizeRuleBroken(payload.ruleBroken),
    } as any)

    const snapshotPayload = JSON.parse(JSON.stringify({
      version: 2,
      generatedAt: new Date().toISOString(),
      filters: {
        accountId: payload.accountId || null,
        accountNumbers: payload.accountNumbers || [],
        dateFrom: payload.dateFrom || null,
        dateTo: payload.dateTo || null,
        symbol: payload.symbol || null,
        session: payload.session || null,
        outcome: payload.outcome || null,
        strategy: payload.strategy || null,
        ruleBroken: normalizeRuleBroken(payload.ruleBroken) || null,
      },
      reportData: serverSnapshot,
      legacySnapshot: payload.snapshot || null,
    }))

    const slug = generateSlug()
    const policyDays = sharingPolicy?.defaultExpirationDays || null
    const resolvedExpirationDays = payload.expiresInDays || policyDays
    const expiresAt = resolvedExpirationDays
      ? new Date(Date.now() + resolvedExpirationDays * 24 * 60 * 60 * 1000)
      : null

    if (sharingPolicy?.requireExpiration && !expiresAt) {
      return createErrorResponse('Shared reports require an expiration date', 400)
    }

    const shared = (await db.insert(schema.SharedReport).values({
      id: nanoid(),
      userId: internalUserId,
      slug,
      title: payload.title || 'Trading Report',
      dateFrom: payload.dateFrom || null,
      dateTo: payload.dateTo || null,
      accountId: payload.accountId || null,
      snapshot: snapshotPayload,
      isPublic: true,
      expiresAt,
    }).returning())[0]

    const appUrl = await getWebsiteURL()
    return createSuccessResponse({ slug, url: new URL(`/reports/shared/${slug}`, appUrl).toString(), id: shared!.id })
  } catch (err) {
    reportApiHandlerError(req, err, 'create-shared-report')
    return createErrorResponse('Internal server error', 500)
  }
}

export async function GET(req: NextRequest) {
  const rl = await applyApiRoutePolicy(req)
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const reports = await db.query.SharedReport.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      columns: {
        id: true,
        slug: true,
        title: true,
        dateFrom: true,
        dateTo: true,
        viewCount: true,
        isPublic: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    })
    return createSuccessResponse({ reports })
  } catch (err) {
    reportApiHandlerError(req, err, 'list-shared-reports')
    return createErrorResponse('Internal server error', 500)
  }
}

export async function DELETE(req: NextRequest) {
  const rl = await applyApiRoutePolicy(req)
  if (rl) return rl

  try {
    const { internalUserId } = await getResolvedUserIdentity()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return createErrorResponse('Missing report ID', 400)
    }

    const report = await db.query.SharedReport.findFirst({
      where: (table, { eq }) => eq(table.id, id),
      columns: { userId: true },
    })

    if (!report) {
      return createErrorResponse('Report not found', 404)
    }

    if (report.userId !== internalUserId) {
      return createErrorResponse('Unauthorized', 403)
    }

    await db.delete(schema.SharedReport).where(and(
      eq(schema.SharedReport.id, id),
      eq(schema.SharedReport.userId, internalUserId),
    ))

    return createSuccessResponse({ deleted: true })
  } catch (err) {
    reportApiHandlerError(req, err, 'delete-shared-report')
    return createErrorResponse('Internal server error', 500)
  }
}
