import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from "next/server";
import {
  getDxFeedSynchronizations,
  removeDxFeedToken,
} from "@/app/dashboard/components/import/dxfeed/sync/actions";

export async function GET(request: NextRequest) {
  try {
    const synchronizations = await getDxFeedSynchronizations();
    
    // Clean data for client (do not send raw tokens)
    const cleaned = (synchronizations.synchronizations || []).map((sync) => ({
      id: sync.id,
      userId: sync.userId,
      service: sync.service,
      accountId: sync.accountId,
      hasToken: !!sync.token,
      lastSyncedAt: sync.lastSyncedAt,
      tokenExpiresAt: sync.tokenExpiresAt,
      dailySyncTime: sync.dailySyncTime,
      createdAt: sync.createdAt,
      updatedAt: sync.updatedAt,
      // Parse account numbers from JSON token config
      accountNumbers: (() => {
        try {
          const parsed = JSON.parse(sync.token || '{}');
          return parsed.accountNumbers || [];
         } catch (error) {
           Sentry.captureException(error, { extra: { route: '/api/v1/dxfeed/synchronizations' } })
           return [];
         }
      })()
    }));

    return NextResponse.json({ success: true, data: cleaned });
  } catch (error) {
    logger.error("Error fetching DxFeed synchronizations: " + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch synchronizations",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const accountId = body?.accountId as string | undefined;

    if (!accountId) {
      return NextResponse.json(
        { success: false, message: "accountId is required" },
        { status: 400 }
      );
    }

    await removeDxFeedToken(accountId);

    return NextResponse.json({
      success: true,
      message: "Synchronization removed successfully",
    });
  } catch (error) {
    logger.error("Error deleting DxFeed synchronization: " + (error instanceof Error ? error.message : String(error)));
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete synchronization",
      },
      { status: 500 }
    );
  }
}
