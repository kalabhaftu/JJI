import { NextRequest, NextResponse } from "next/server";
import { directSyncUnavailablePayload } from '@/lib/integrations/direct-sync-status';

// Tradovate live sync is under development — all endpoints are disabled.
export async function GET() {
  return NextResponse.json(directSyncUnavailablePayload('Tradovate'), { status: 503 });
}

export async function PATCH(request: NextRequest) {
  await request.json().catch(() => null);
  return NextResponse.json(directSyncUnavailablePayload('Tradovate'), { status: 503 });
}

export async function DELETE(request: NextRequest) {
  await request.json().catch(() => null);
  return NextResponse.json(directSyncUnavailablePayload('Tradovate'), { status: 503 });
}
