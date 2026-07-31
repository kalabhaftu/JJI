import { NextRequest, NextResponse } from 'next/server'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db/client'
import { and } from 'drizzle-orm'
import { enqueuePhaseEvaluation } from '@/server/phase-evaluation-events'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    const { id: masterAccountId } = await params
    // ID is pure masterAccountId (UUID), not composite

    // Verify the master account belongs to the user
    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq, ne }) => and(
        eq(table.id, masterAccountId),
        eq(table.userId, internalUserId),
        ne(table.status, 'failed')
      ),
      with: {
        PhaseAccount: {
          where: (table, { eq }) => eq(table.status, 'active'),
          orderBy: (table, { asc }) => [asc(table.phaseNumber)],
          limit: 1
        }
      }
    })

    if (!masterAccount) {
      return NextResponse.json(
        { success: false, error: 'Master account not found or unauthorized' },
        { status: 404 }
      )
    }

    const activePhase = masterAccount.PhaseAccount[0]
    if (!activePhase) {
      return NextResponse.json(
        { success: false, error: 'No active phase found' },
        { status: 400 }
      )
    }

    await enqueuePhaseEvaluation({
      source: 'manual-api',
      masterAccountId,
      phaseAccountId: activePhase.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        masterAccountId,
        phaseAccountId: activePhase.id,
        phaseNumber: activePhase.phaseNumber,
        evaluation: null,
        queued: true,
      }
    })

  } catch (error: any) {
    logger.error({ error: error?.message, context: 'api' }, 'POST /api/v1/prop-firm/accounts/[id]/evaluate')
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to evaluate phase'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const internalUserId = identity.internalUserId

    const { id: masterAccountId } = await params
    // ID is pure masterAccountId (UUID), not composite

    const masterAccount = await db.query.MasterAccount.findFirst({
      where: (table, { eq }) => and(
        eq(table.id, masterAccountId),
        eq(table.userId, internalUserId)
      ),
      with: {
        PhaseAccount: {
          where: (table, { eq }) => eq(table.status, 'active'),
          orderBy: (table, { asc }) => [asc(table.phaseNumber)],
          limit: 1
        }
      }
    })

    if (!masterAccount) {
      return NextResponse.json(
        { success: false, error: 'Master account not found' },
        { status: 404 }
      )
    }

    const activePhase = masterAccount.PhaseAccount[0]
    if (!activePhase) {
      return NextResponse.json(
        { success: false, error: 'No active phase found' },
        { status: 400 }
      )
    }

    await enqueuePhaseEvaluation({
      source: 'manual-status-api',
      masterAccountId,
      phaseAccountId: activePhase.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        masterAccountId,
        phaseAccountId: activePhase.id,
        phaseNumber: activePhase.phaseNumber,
        evaluation: null,
        queued: true,
      }
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get evaluation status'
      },
      { status: 500 }
    )
  }
}
