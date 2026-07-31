import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

/**
 * Lightweight health-check that touches the database to prevent Supabase
 * free-tier from pausing due to inactivity.
 *
 * No auth required - the query is a harmless `SELECT 1`.
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)

    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { status: 'degraded', timestamp: new Date().toISOString() },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      )
    }

    return NextResponse.json(
      { status: 'error', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}