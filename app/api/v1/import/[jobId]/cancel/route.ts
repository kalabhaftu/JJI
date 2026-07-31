import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, importLimiter } from '@/lib/rate-limiter'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { cancelTradeImportJob } from '@/server/trade-import-jobs'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, importLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { jobId } = await params
    const result = await cancelTradeImportJob(jobId, identity.internalUserId)

    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, job: result.job }, { status: result.status })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to cancel import job' }, { status: 500 })
  }
}
