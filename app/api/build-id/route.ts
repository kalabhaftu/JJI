import { NextResponse } from 'next/server'


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

