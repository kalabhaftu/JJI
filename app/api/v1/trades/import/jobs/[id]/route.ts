import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, importLimiter } from '@/lib/rate-limiter'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { getTradeImportJobForUser } from '@/server/trade-import-jobs'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, importLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const job = await getTradeImportJobForUser(id, identity.internalUserId)

    if (!job) {
      return NextResponse.json({ success: false, error: 'Import job not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, job })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch import job' }, { status: 500 })
  }
}
