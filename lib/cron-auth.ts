// Accepts Authorization: Bearer <CRON_SECRET> or x-cron-secret.
// Vercel automatically sends CRON_SECRET as a bearer token for scheduled calls.

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

function safeCompareSecret(providedSecret: string, expectedSecret: string) {
  const provided = Buffer.from(providedSecret)
  const expected = Buffer.from(expectedSecret)

  if (provided.length !== expected.length) {
    return false
  }

  return timingSafeEqual(provided, expected)
}

export function validateCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET

  if (!secret && process.env.NODE_ENV === 'development') {
    return null
  }

  if (!secret) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'CRON_SECRET must be configured' },
      { status: 403 }
    )
  }

  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const headerSecret = request.headers.get('x-cron-secret')
  const providedSecret = bearerToken || headerSecret

  if (!providedSecret || !safeCompareSecret(providedSecret, secret)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing cron secret' },
      { status: 401 }
    )
  }

  return null
}
