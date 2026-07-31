import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from "next/server";
import { directSyncUnavailablePayload } from '@/lib/integrations/direct-sync-status'

export async function POST(request: NextRequest) {
  try {
    await request.json().catch(() => null)
    return NextResponse.json(directSyncUnavailablePayload('DxFeed'), { status: 503 });
  } catch (error) {
    logger.error("Error performing DxFeed sync: " + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json(
      { success: false, message: "Failed to perform DxFeed sync" },
      { status: 500 }
    );
  }
}
