import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { applyRateLimit, publicLimiter } from '@/lib/rate-limiter'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { logger } from '@/lib/logger'

interface Props {
  params: Promise<{ slug: string }>
}

const sharedReportSlugPattern = /^[a-z0-9]{10}$/

export async function POST(request: NextRequest, { params }: Props) {
  const rateLimitResponse = await applyRateLimit(request, publicLimiter)
  if (rateLimitResponse) return rateLimitResponse

  const { slug } = await params
  if (!sharedReportSlugPattern.test(slug)) {
    return createErrorResponse('Not found', 404)
  }

  const cookieName = `shared-report-viewed-${slug}`

  try {
    const report = await db.query.SharedReport.findFirst({
      where: (table, { eq }) => eq(table.slug, slug),
      columns: { id: true, isPublic: true, expiresAt: true, viewCount: true },
    })

    if (!report || !report.isPublic || (report.expiresAt && report.expiresAt < new Date())) {
      return createErrorResponse('Not found', 404)
    }

    const alreadyCounted = request.cookies.get(cookieName)?.value === '1'
    if (alreadyCounted) {
      return createSuccessResponse({ viewCount: report.viewCount, counted: false })
    }

    const updated = (await db.update(schema.SharedReport).set({ viewCount: (report.viewCount || 0) + 1 }).where(eq(schema.SharedReport.slug, slug)).returning({ viewCount: schema.SharedReport.viewCount }))[0]

    const response = createSuccessResponse({ viewCount: updated!.viewCount, counted: true })
    response.cookies.set(cookieName, '1', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: `/reports/shared/${slug}`,
    })
    return response
  } catch (error) {
    logger.error('Shared report view count failed' + ' : ' + error)
    return createErrorResponse('Internal server error', 500)
  }
}