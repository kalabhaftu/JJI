"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useData } from "@/context/data-provider";
import { useRithmicSyncStore } from "@/store/rithmic-sync-store";
import { useTradesStore } from "@/store/trades-store";
import { useUserStore } from "@/store/user-store";
import logger from "@/lib/logger";
import { handleRithmicMessage } from '@/lib/rithmic/message-handler'
import { useRithmicSynchronization } from '@/hooks/use-rithmic-synchronization'
import { reportError } from '@/lib/observability/report-error'
import {
  type RithmicCredentials,
} from '@/lib/rithmic/sync-contract'

interface RithmicSyncContextType {

  connect: (
    url: string,
    token: string,
    accounts: string[],
    startDate: string
  ) => void;
  disconnect: () => void;
  isConnected: boolean;
  connectionStatus: string;


  handleMessage: (message: any) => void;


  performSyncForCredential: (
    credentialId: string
  ) => Promise<
    { success: boolean; rateLimited: boolean; message: string } | undefined
  >;


  calculateStartDate: (selectedAccounts: string[]) => string;
  authenticateAndGetAccounts: (credentials: RithmicCredentials) => Promise<
    | { success: false; rateLimited: boolean; message: string }
    | {
        success: true;
        rateLimited: boolean;
        token: string;
        websocket_url: string;
        accounts: { account_id: string; fcm_id: string }[];
      }
  >;
  getWebSocketUrl: (baseUrl: string) => string;
}

const RithmicSyncContext = createContext<RithmicSyncContextType | undefined>(
  undefined
);

export function RithmicSyncContextProvider({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [syncCheckInterval, setSyncCheckInterval] =
    useState<NodeJS.Timeout | null>(null);

  const { refreshTrades } = useData();

  const isLoading = useUserStore((state) => state.isLoading);
  const trades = useTradesStore((state) => state.trades);


  const {
    syncInterval,
    accountsProgress,
    currentAccount,
    isAutoSyncing,
    setLastMessage,
    addMessageToHistory,
    clearMessageHistory,
    setAccountsProgress,
    updateAccountProgress,
    setCurrentAccount,
    resetProcessingState,
    setSelectedAccounts,
    setAvailableAccounts,
    setIsAutoSyncing,
  } = useRithmicSyncStore();

  const disconnect = useCallback(() => {
    if (ws) {
      logger.debug("Disconnecting Rithmic WebSocket");
      ws.close();
      setWs(null);
      setIsConnected(false);
      setConnectionStatus("Disconnected");
      resetProcessingState();
    }
    if (syncCheckInterval) {
      clearInterval(syncCheckInterval);
      setSyncCheckInterval(null);
    }
  }, [ws, resetProcessingState, syncCheckInterval]);

  const handleMessage = useCallback((message: any) => {
    handleRithmicMessage(message, {
      accountsProgress,
      currentAccount,
      setLastMessage,
      addMessageToHistory,
      updateAccountProgress,
      setCurrentAccount,
      refreshTrades,
    })
  }, [
    accountsProgress,
    currentAccount,
    setLastMessage,
    addMessageToHistory,
    updateAccountProgress,
    setCurrentAccount,
    refreshTrades,
  ])

  const connect = useCallback(
    (url: string, token: string, accounts: string[], startDate: string) => {
      if (ws) {
        logger.debug("Closing existing Rithmic connection before creating a new one");
        ws.close();
      }

      resetProcessingState();
      clearMessageHistory();

      setSelectedAccounts(accounts);

      const initialProgress = accounts.reduce(
        (acc, accountId) => ({
          ...acc,
          [accountId]: {
            ordersProcessed: 0,
            daysProcessed: 0,
            totalDays: 0,
            isComplete: false,
            processedDates: [],
            currentDayNumber: 0,
            currentDate: "",
            lastProcessedDate: "",
            current: 0,
            total: 0,
          },
        }),
        {}
      );

      setAccountsProgress(initialProgress);
      setCurrentAccount(null);

      const newWs = new WebSocket(url);

      newWs.onopen = () => {
        setIsConnected(true);
        setConnectionStatus("Connected");

        handleMessage({
          type: "connection_status",
          status: "Connected",
          message: "WebSocket connection established",
        });

        const message = {
          type: "init",
          token,
          accounts,
          start_date: startDate,
        };
        newWs.send(JSON.stringify(message));
      };

      newWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          reportError(error, {
            surface: 'client',
            operation: 'parse-rithmic-websocket-message',
          })
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          setConnectionStatus(`Failed to parse message: ${errorMessage}`);
          handleMessage({
            type: "connection_status",
            status: `Failed to parse message: ${errorMessage}`,
            message: "Failed to parse server message",
          });
        }
      };

      newWs.onerror = (error) => {
        reportError(error, {
          surface: 'client',
          operation: 'rithmic-websocket-error',
        })
        setConnectionStatus("WebSocket error occurred");
        handleMessage({
          type: "connection_status",
          status: "WebSocket error occurred",
          message: "WebSocket connection error occurred",
        });
        setIsAutoSyncing(false);
        disconnect();
      };

      newWs.onclose = (event) => {
        setIsConnected(false);
        const closeMessage = event.reason || "Connection closed";
        const status = `Disconnected: ${closeMessage}`;
        setConnectionStatus(status);
        handleMessage({
          type: "connection_status",
          status,
          message: `WebSocket disconnected: ${closeMessage}`,
        });
        setIsAutoSyncing(false);
      };

      setWs(newWs);
    },
    [
      ws,
      handleMessage,
      disconnect,
      resetProcessingState,
      setIsAutoSyncing,
      clearMessageHistory,
      setSelectedAccounts,
      setAccountsProgress,
      setCurrentAccount,
    ]
  );

  const {
    performSyncForCredential,
    authenticateAndGetAccounts,
    calculateStartDate,
    getWebSocketUrl,
  } = useRithmicSynchronization({
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
  })

  return (
    <RithmicSyncContext.Provider
      value={disabled ? {
        connect: () => {},
        disconnect: () => {},
        isConnected: false,
        connectionStatus: "Disabled in demo mode",
        handleMessage: () => {},
        performSyncForCredential: async () => ({
          success: false,
          rateLimited: false,
          message: "Rithmic sync is disabled in demo mode",
        }),
        calculateStartDate,
        authenticateAndGetAccounts: async () => ({
          success: false,
          rateLimited: false,
          message: "Rithmic sync is disabled in demo mode",
        }),
        getWebSocketUrl,
      } : {

        connect,
        disconnect,
        isConnected,
        connectionStatus,


        handleMessage,


        performSyncForCredential,


        calculateStartDate,
        authenticateAndGetAccounts,
        getWebSocketUrl,
      }}
    >
      {children}
    </RithmicSyncContext.Provider>
  );
}

export function useRithmicSyncContext() {
  const context = useContext(RithmicSyncContext);
  if (context === undefined) {
    throw new Error(
      "useRithmicSyncContext must be used within a RithmicSyncContextProvider"
    );
  }
  return context;
}
