import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { getImportJobForUser, serializeImportJob } from '@/server/import-jobs'
import { enqueueImportJob } from '@/server/import-job-events'
import { applyRateLimit, importLimiter } from '@/lib/rate-limiter'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const rateLimitResponse = await applyRateLimit(request, importLimiter)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const job = await getImportJobForUser(id, identity.internalUserId)
    if (!job) {
      return NextResponse.json({ success: false, error: 'Import job not found' }, { status: 404 })
    }

    if (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
      await enqueueImportJob({ jobId: id, internalUserId: identity.internalUserId, kind: 'archive' })
    }

    return NextResponse.json({
      success: true,
      done: job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled',
      job: serializeImportJob(job),
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to process import job' }, { status: 500 })
  }
}
