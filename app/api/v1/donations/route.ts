import { NextResponse, NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db/client'
import { applyRateLimit, publicLimiter } from '@/lib/rate-limiter'

export async function GET(req: NextRequest) {
  const rl = await applyRateLimit(req, publicLimiter)
  if (rl) return rl

  try {
    const addresses = await db.query.DonationAddress.findMany({
      where: (table, { eq }) => eq(table.isActive, true),
      orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.createdAt)],
      columns: { token: true, network: true, address: true },
    })

    return NextResponse.json({ success: true, data: addresses })
  } catch (error) {
    Sentry.captureException(error, { extra: { route: '/api/v1/donations' } })
    return NextResponse.json({ success: false, error: 'Failed to fetch addresses' }, { status: 500 })
  }
}