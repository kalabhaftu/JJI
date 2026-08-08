import { NextRequest } from 'next/server'

import { handleAuthLogout } from '@/server/auth/logout-route'

export async function POST(request: NextRequest) {
  return handleAuthLogout(request, 'local')
}
