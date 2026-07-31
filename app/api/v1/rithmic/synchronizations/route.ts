import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from "next/server";
import {
  getRithmicSynchronizations,
  setRithmicSynchronization,
  removeRithmicSynchronization,
} from "@/app/dashboard/components/import/rithmic/sync/actions";

export async function GET(request: NextRequest) {
  try {
    const synchronizations = await getRithmicSynchronizations();
    return NextResponse.json({ success: true, data: synchronizations });
  } catch (error) {
    logger.error({ error }, "Error fetching Rithmic synchronizations:");
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await setRithmicSynchronization(body);
    return NextResponse.json({
      success: true,
      message: "Synchronization updated successfully",
    });
  } catch (error) {
    logger.error({ error }, "Error setting Rithmic synchronization:");
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update synchronization",
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

    await removeRithmicSynchronization(accountId);

    return NextResponse.json({
      success: true,
      message: "Synchronization removed successfully",
    });
  } catch (error) {
    logger.error({ error }, "Error deleting Rithmic synchronization:");
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
