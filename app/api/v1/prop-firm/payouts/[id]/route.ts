/**
 * Payout Management API
 * DELETE /api/prop-firm/payouts/[id] - Delete a pending payout
 */

import { NextRequest, NextResponse } from 'next/server'
import { deletePayoutAction } from '@/server/accounts'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const { id: payoutId } = await params

    if (!payoutId) {
      return NextResponse.json(
        { success: false, error: 'Payout ID is required' },
        { status: 400 }
      )
    }

    const result = await deletePayoutAction(payoutId)

    return NextResponse.json({
      success: true,
      message: result.message
    })

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete payout'
      },
      { status: 500 }
    )
  }
}
