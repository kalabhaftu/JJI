'use client'

import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import logger from '@/lib/logger'
import { reportError } from '@/lib/observability/report-error'
import { getAllRithmicData, getRithmicData, updateLastSyncTime } from '@/lib/rithmic-storage'
import { parseRithmicRateLimitMessage, type RithmicCredentials } from '@/lib/rithmic/sync-contract'
import { apiRequestData } from '@/lib/api/client'
import { ApiClientError } from '@/lib/api/errors'
import { DIRECT_SYNC_STATUS } from '@/lib/integrations/direct-sync-status'
import { useUserStore } from '@/store/user-store'

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
  const authUserId = useUserStore((state) => state.supabaseUser?.id)
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

    if (!authUserId || isAutoSyncing) return;

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
              userId: authUserId,
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

      const accountsToSync = savedData.allAccounts
        ? data.accounts.map((acc: any) => acc.account_id)
        : savedData.selectedAccounts.filter((account: string) =>
            data.accounts.some((acc: any) => acc.account_id === account)
          );

      setAvailableAccounts(data.accounts);
      const wsUrl = getWebSocketUrl(data.websocket_url);

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

      if (mostRecentDates.length === 0) {
        const defaultDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
        startDate = defaultDate.toISOString().slice(0, 10).replace(/-/g, "");
      } else {

        const oldestRecentDate = new Date(Math.min(...mostRecentDates));

        oldestRecentDate.setDate(oldestRecentDate.getDate() - 3);
        startDate = oldestRecentDate
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");
      }

      connect(wsUrl, data.token, accountsToSync, startDate);
      updateLastSyncTime(credentialId);
      scheduleNextSyncRef.current();

      handleMessage({
        type: "log",
        level: "info",
        message: `Starting automatic background sync for ${savedData.name || savedData.credentials.username}`,
      });

      await apiRequestData<unknown>("/api/v1/rithmic/synchronizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: savedData.id,
          lastSyncedAt: new Date(),
        }),
        retry: { mode: "never" },
        operation: "update-rithmic-synchronization",
      });

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
    authUserId,
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

    const oldestRecentDate = new Date(Math.min(...accountDates));

    oldestRecentDate.setDate(oldestRecentDate.getDate() + 1);

    const startDate = oldestRecentDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    logger.debug({ startDate }, "Calculated Rithmic start date from trades");
    return startDate;
  },
  [trades]
);

const checkAndPerformSyncsRef = useRef<() => void>(() => {});
const nextSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const clearNextSyncTimer = useCallback(() => {
  if (nextSyncTimerRef.current) {
    clearTimeout(nextSyncTimerRef.current);
    nextSyncTimerRef.current = null;
  }
}, []);

const scheduleNextSync = useCallback(() => {
  clearNextSyncTimer();
  if (disabled || DIRECT_SYNC_STATUS.isPaused) return;

  const dueAt = Object.values(getAllRithmicData()).map(
    (credentialSet) =>
      new Date(credentialSet.lastSyncTime).getTime() + syncInterval * 60 * 1000
  );

  if (dueAt.length === 0) return;

  const delay = Math.max(0, Math.min(...dueAt) - Date.now());
  nextSyncTimerRef.current = setTimeout(() => {
    void checkAndPerformSyncsRef.current();
  }, Math.min(delay, 2_147_000_000));
}, [disabled, syncInterval, clearNextSyncTimer]);

const scheduleNextSyncRef = useRef(scheduleNextSync);
scheduleNextSyncRef.current = scheduleNextSync;

const checkAndPerformSyncs = useCallback(async () => {
  if (disabled || DIRECT_SYNC_STATUS.isPaused) {
    clearNextSyncTimer();
    return;
  }
  if (isLoading) return;
  if (isAutoSyncing) return;
  if (document.visibilityState === 'hidden') return;
  try {

    const synchronizations =
      (await apiRequestData<{ accountId: string; lastSyncedAt: string }[]>(
        "/api/v1/rithmic/synchronizations",
        { retry: { mode: "safe" }, operation: "check-rithmic-auto-synchronizations" }
      )) ?? [];

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
    scheduleNextSync();
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 503) {
      logger.info({ error: error.message }, 'Rithmic direct sync is paused/unavailable; stopping auto-sync polling');
      clearNextSyncTimer();
      return;
    }
    reportError(error, {
      surface: 'client',
      operation: 'check-rithmic-auto-synchronizations',
      extra: { fallbackUsed: true },
    })
    scheduleNextSync();
  }
}, [disabled, syncInterval, isAutoSyncing, performSyncForCredential, isLoading, scheduleNextSync, clearNextSyncTimer]);

checkAndPerformSyncsRef.current = checkAndPerformSyncs;

useEffect(() => {
  if (disabled || DIRECT_SYNC_STATUS.isPaused) {
    clearNextSyncTimer();
    return;
  }
  scheduleNextSync();
  return clearNextSyncTimer;
}, [disabled, scheduleNextSync, clearNextSyncTimer]);

useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') void checkAndPerformSyncsRef.current();
  };
  const handleOnline = () => {
    void checkAndPerformSyncsRef.current();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleOnline);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('online', handleOnline);
  };
}, []);

  return {
    performSyncForCredential,
    authenticateAndGetAccounts,
    calculateStartDate,
    getWebSocketUrl,
  }
}
