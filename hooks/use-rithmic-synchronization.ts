'use client'

import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'

import logger from '@/lib/logger'
import { reportError } from '@/lib/observability/report-error'
import { getRithmicData, updateLastSyncTime } from '@/lib/rithmic-storage'
import { parseRithmicRateLimitMessage, type RithmicCredentials } from '@/lib/rithmic/sync-contract'
import { getUserId } from '@/server/auth'

interface RithmicSynchronizationInput {
  disabled: boolean
  isLoading: boolean
  isAutoSyncing: boolean
  syncInterval: number
  trades: any[]
  connect: (url: string, token: string, accounts: string[], startDate: string) => void
  handleMessage: (message: any) => void
  resetProcessingState: () => void
  clearMessageHistory: () => void
  setAvailableAccounts: (accounts: any[]) => void
  setIsAutoSyncing: (value: boolean) => void
}

export function useRithmicSynchronization(input: RithmicSynchronizationInput) {
  const {
    disabled,
    isLoading,
    isAutoSyncing,
    syncInterval,
    trades,
    connect,
    handleMessage,
    resetProcessingState,
    clearMessageHistory,
    setAvailableAccounts,
    setIsAutoSyncing,
  } = input

const getProtocols = useCallback(() => {
  const isLocalhost =
    process.env.NEXT_PUBLIC_RITHMIC_API_URL?.includes("localhost");
  return {
    http: isLocalhost ? window.location.protocol : "https:",
    ws: isLocalhost
      ? window.location.protocol === "https:"
        ? "wss:"
        : "ws:"
      : "wss:",
  };
}, []);

const getWebSocketUrl = useCallback(
  (baseUrl: string) => {
    const { ws } = getProtocols();
    return baseUrl.replace(
      "ws://your-domain",
      `${ws}//${process.env.NEXT_PUBLIC_RITHMIC_API_URL}`
    );
  },
  [getProtocols]
);

const performSyncForCredential = useCallback(
  async (credentialId: string) => {
    if (isAutoSyncing) return;

    resetProcessingState();
    clearMessageHistory();

    const userId = await getUserId();
    if (!userId || isAutoSyncing) return;

    const savedData = getRithmicData(credentialId);

    if (!savedData) return;

    setIsAutoSyncing(true);

    try {
      const { http } = getProtocols();

      const response = (await Promise.race([
        fetch(
          `${http}//${process.env.NEXT_PUBLIC_RITHMIC_API_URL}/accounts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },

            body: JSON.stringify({
              ...savedData.credentials,
              userId: userId,
            }),
          }
        ),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Auto-sync operation timed out")),
            30000
          )
        ),
      ])) as Response;

      // Handle rate limit error specifically
      if (response.status === 429) {
        const data = await response.json();
        const params = parseRithmicRateLimitMessage(data.detail);

        toast.error("Rithmic Rate Limit Exceeded", {
          description: `Maximum ${params.max} attempts allowed per ${params.period} minutes. Please wait ${params.wait} minutes.`,
        });

        return {
          success: false as const,
          rateLimited: true,
          message: data.detail || "Rate limit exceeded",
        };
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      // If allAccounts is true, use all available accounts else use selected accounts (which exist in the data.accounts array)
      const accountsToSync = savedData.allAccounts
        ? data.accounts.map((acc: any) => acc.account_id)
        : savedData.selectedAccounts.filter((account: string) =>
            data.accounts.some((acc: any) => acc.account_id === account)
          );

      setAvailableAccounts(data.accounts);
      const wsUrl = getWebSocketUrl(data.websocket_url);

      // Get most recent date for each account
      const mostRecentDates = accountsToSync
        .map((accountId: string) => {
          const accountTrades = trades.filter(
            (trade) => trade.accountNumber === accountId
          );
          if (accountTrades.length === 0) return null;
          return Math.max(
            ...accountTrades.map((trade) =>
              new Date(trade.entryDate).getTime()
            )
          );
        })
        .filter(Boolean) as number[];

      let startDate: string;

      // If no valid dates found, use 200 days ago as default
      if (mostRecentDates.length === 0) {
        const defaultDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
        startDate = defaultDate.toISOString().slice(0, 10).replace(/-/g, "");
      } else {
        // Find oldest of the most recent dates
        const oldestRecentDate = new Date(Math.min(...mostRecentDates));
        // Add 3 days buffer
        oldestRecentDate.setDate(oldestRecentDate.getDate() - 3);
        startDate = oldestRecentDate
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");
      }

      connect(wsUrl, data.token, accountsToSync, startDate);
      updateLastSyncTime(credentialId);

      handleMessage({
        type: "log",
        level: "info",
        message: `Starting automatic background sync for ${savedData.name || savedData.credentials.username}`,
      });

      // Update last sync time in the database
      // Call API route instead of server action
      const syncResponse = await fetch("/api/v1/rithmic/synchronizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: savedData.id,
          lastSyncedAt: new Date(),
        }),
      });

      if (!syncResponse.ok) {
        const errorData = await syncResponse.json();
        throw new Error(
            errorData.error?.message || errorData.message || "Failed to update synchronization"
        );
      }

      return {
        success: true,
        rateLimited: false,
        message: "Sync started successfully",
      };
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'auto-sync-rithmic-credential',
        entityId: credentialId,
      })
      handleMessage({
        type: "log",
        level: "error",
        message: `Auto-sync error for credential set ${credentialId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      });

      return {
        success: false,
        rateLimited: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      setIsAutoSyncing(false);
    }
  },
  [
    isAutoSyncing,
    connect,
    handleMessage,
    getProtocols,
    getWebSocketUrl,
    resetProcessingState,
    clearMessageHistory,
    setAvailableAccounts,
    setIsAutoSyncing,
    trades,
  ]
);

const authenticateAndGetAccounts = useCallback(
  async (credentials: RithmicCredentials) => {
    const { http } = getProtocols();
    const response = await fetch(
      `${http}//${process.env.NEXT_PUBLIC_RITHMIC_API_URL}/accounts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      }
    );

    // Handle rate limit error specifically
    if (response.status === 429) {
      const data = await response.json();
      const params = parseRithmicRateLimitMessage(data.detail);

      toast.error("Rithmic Rate Limit Exceeded", {
        description: `Maximum ${params.max} attempts allowed per ${params.period} minutes. Please wait ${params.wait} minutes.`,
      });

      return {
        success: false as const,
        rateLimited: true,
        message: data.detail || "Rate limit exceeded",
      };
    }

    const data = await response.json();
    if (!data.success) {
      return {
        success: false as const,
        rateLimited: false,
        message: data.message,
      };
    }

    return {
      success: true as const,
      rateLimited: false,
      token: data.token,
      websocket_url: getWebSocketUrl(data.websocket_url),
      accounts: data.accounts,
    };
  },
  [getProtocols, getWebSocketUrl]
);

const calculateStartDate = useCallback(
  (selectedAccounts: string[]): string => {
    // Filter trades for selected accounts
    const accountTrades = trades.filter((trade) =>
      selectedAccounts.includes(trade.accountNumber)
    );

    if (accountTrades.length === 0) {
      const date = new Date();
      date.setDate(date.getDate() - 91);
      const startDate = date.toISOString().slice(0, 10).replace(/-/g, "");
      logger.debug({ startDate }, "No Rithmic trades found; using default start date");
      return startDate;
    }

    // Find the most recent trade date for each account
    const accountDates = selectedAccounts
      .map((accountId) => {
        const accountTrades = trades.filter(
          (trade) => trade.accountNumber === accountId
        );
        if (accountTrades.length === 0) return null;
        return Math.max(
          ...accountTrades.map((trade) => new Date(trade.entryDate).getTime())
        );
      })
      .filter(Boolean) as number[];

    // Get the oldest most recent date across all accounts
    const oldestRecentDate = new Date(Math.min(...accountDates));

    // Set to next day
    oldestRecentDate.setDate(oldestRecentDate.getDate() + 1);

    // Format as YYYYMMDD
    const startDate = oldestRecentDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    logger.debug({ startDate }, "Calculated Rithmic start date from trades");
    return startDate;
  },
  [trades]
);

const checkAndPerformSyncs = useCallback(async () => {
  if (isLoading) return;
  if (isAutoSyncing) return;
  try {
    // Call API route instead of server action
    const response = await fetch("/api/v1/rithmic/synchronizations", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch synchronizations");
    }

    const result = await response.json();
    const synchronizations = result.data || [];

    for (const sync of synchronizations) {
      if (!sync.lastSyncedAt) continue;

      const lastSyncTime = new Date(sync.lastSyncedAt).getTime();
      const now = Date.now();
      const minutesSinceLastSync = (now - lastSyncTime) / (1000 * 60);

      if (minutesSinceLastSync >= syncInterval) {
        logger.debug({ accountId: sync.accountId }, "Rithmic auto-sync triggered");
        await performSyncForCredential(sync.accountId);
      }
    }
  } catch (error) {
    reportError(error, {
      surface: 'client',
      operation: 'check-rithmic-auto-synchronizations',
      extra: { fallbackUsed: true },
    })
  }
}, [syncInterval, isAutoSyncing, performSyncForCredential, isLoading]);

useEffect(() => {
  if (disabled) return;

  const intervalMs = 1 * 60 * 1000; // 1 minute

  const intervalId = setInterval(() => {
    checkAndPerformSyncs();
  }, intervalMs);

  return () => {
    clearInterval(intervalId);
  };
}, [disabled, syncInterval, checkAndPerformSyncs]);

  return {
    performSyncForCredential,
    authenticateAndGetAccounts,
    calculateStartDate,
    getWebSocketUrl,
  }
}
