import { NextResponse } from 'next/server'

/**
 * API endpoint to return the current build ID
 * Used by deployment detection to identify when a new version is deployed.
 * Baked at build time from VERCEL_GIT_COMMIT_SHA so the response is static
 * and cacheable; clients compare it against the id inlined in their bundle.
 */
export async function GET() {
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID || 'local-dev'

  return NextResponse.json(
    { buildId },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export const dynamic = 'force-static'

