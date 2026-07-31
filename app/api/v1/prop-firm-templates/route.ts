/**
 * Prop Firm Templates API
 * GET /api/prop-firm-templates - Get all prop firm rule templates
 */

import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import propFirmTemplates from '@/lib/data/prop-firm-templates.json'

export async function GET(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    return NextResponse.json({
      success: true,
      data: propFirmTemplates
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch prop firm templates' 
      },
      { status: 500 }
    )
  }
}
