import { NextRequest, NextResponse } from 'next/server'
import { directSyncUnavailablePayload } from '@/lib/integrations/direct-sync-status'

// Rithmic live sync is under development — endpoint is disabled.
export async function POST(request: NextRequest) {
  await request.json().catch(() => null)
  return NextResponse.json(directSyncUnavailablePayload('Rithmic'), { status: 503 })
}