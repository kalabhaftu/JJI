import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from "next/server";
import { directSyncUnavailablePayload } from '@/lib/integrations/direct-sync-status'

export async function POST(request: NextRequest) {
  try {
    await request.json().catch(() => null)
    return NextResponse.json(directSyncUnavailablePayload('Tradovate'), { status: 503 });
  } catch (error) {
    logger.error({ error }, "Error performing Tradovate sync:");
    return NextResponse.json(
      { success: false, message: "Failed to perform Tradovate sync" },
      { status: 500 }
    );
  }
}
