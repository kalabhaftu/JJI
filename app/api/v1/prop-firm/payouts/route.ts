/**
 * Payout Management API
 * POST /api/prop-firm/payouts - Request a new payout
 * DELETE /api/prop-firm/payouts/[id] - Delete a pending payout
 */

import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { savePayoutAction } from '@/server/accounts'

export async function POST(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const body = await request.json()
    const { masterAccountId, phaseAccountId, amount, notes } = body

    if (!masterAccountId || !phaseAccountId || amount === undefined || amount === null || amount === '') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: masterAccountId, phaseAccountId, and amount' },
        { status: 400 }
      )
    }

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    const result = await savePayoutAction({
      masterAccountId,
      phaseAccountId,
      amount: numericAmount,
      notes: notes || undefined
    })

    return NextResponse.json({
      success: true,
      data: result.data,
      message: result.message
    })

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create payout'
      },
      { status: 500 }
    )
  }
}
