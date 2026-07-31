"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Trash2,
  Plus,
  Edit2,
  RefreshCw,
  MoreVertical,
  History,
  AlertTriangle,
  LogIn,
} from "lucide-react";
import {
  getAllRithmicData,
  clearRithmicData,
  RithmicCredentialSet,
  updateLastSyncTime,
} from "@/lib/rithmic-storage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SyncCountdown } from "./sync-countdown";
import { toast } from "sonner";
import { useRithmicSyncStore, SyncInterval } from "@/store/rithmic-sync-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserStore } from "@/store/user-store";
import { useRithmicSyncContext } from "@/context/rithmic-sync-context";
import { logger } from '@/lib/logger';

interface Synchronization {
  accountId: string;
  lastSyncedAt: string | null;
  service: string;
  userId: string;
}

interface RithmicCredentialsManagerProps {
  onSelectCredential: (credential: RithmicCredentialSet) => void;
  onLoginMissingCredential: (id: string) => void;
  onAddNew: () => void;
}

export function RithmicCredentialsManager({
  onSelectCredential,
  onLoginMissingCredential,
  onAddNew,
}: RithmicCredentialsManagerProps) {
  const [credentials, setCredentials] =
    useState<Record<string, RithmicCredentialSet>>(getAllRithmicData());
  const [synchronizations, setSynchronizations] = useState<Synchronization[]>(
    []
  );
  const [isLoadingSynchronizations, setIsLoadingSynchronizations] =
    useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState<
    string | null
  >(null);
  const {
    performSyncForCredential,
    connect,
    getWebSocketUrl,
    authenticateAndGetAccounts,
  } = useRithmicSyncContext();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingSyncId, setDeletingSyncId] = useState<string | null>(null);
  const user = useUserStore((state) => state.user);
  const { syncInterval, setSyncInterval, isAutoSyncing } =
    useRithmicSyncStore();

  const fetchSynchronizations = useCallback(async () => {
    try {
      setIsLoadingSynchronizations(true);
      const response = await fetch("/api/v1/rithmic/synchronizations", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch synchronizations");
      }

      const result = await response.json();
      setSynchronizations(result.data || []);
    } catch (error) {
      logger.error("Error fetching synchronizations: " + (error instanceof Error ? error.message : String(error)));
      toast.error("Failed to load synchronizations");
    } finally {
      setIsLoadingSynchronizations(false);
    }
  }, []);

  // Fetch synchronizations from API
  useEffect(() => {
    fetchSynchronizations();
  }, [fetchSynchronizations]);

  const isLegacySyncId = (id?: string | null) =>
    !!id && id.startsWith("rithmic_");

  const handleSync = useCallback(
    async (credential: RithmicCredentialSet) => {
      if (syncingId === credential.id) {
        return;
      }

      try {
        logger.info("Starting sync for credential: " + credential.id);
        setSyncingId(credential.id);
        const result = await performSyncForCredential(credential.id);

        if (result?.success) {
          updateLastSyncTime(credential.id);
          await fetchSynchronizations();
        }
      } catch (error) {
        toast.error("Synchronization failed");
        logger.error("Sync error: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setSyncingId(null);
      }
    },
    [syncingId, performSyncForCredential, fetchSynchronizations]
  );

  const handleLoadMoreData = useCallback(
    async (credential: RithmicCredentialSet) => {
      if (syncingId === credential.id) {
        return;
      }

      try {
        setSyncingId(credential.id);

        const authResult = await authenticateAndGetAccounts({
          ...credential.credentials,
          userId: user?.id || "",
        });

        if (!authResult.success) {
          if (authResult.rateLimited) {
            toast.error("Rate limit exceeded. Please wait before trying again.");
          } else {
            toast.error("Authentication failed. Check your password.");
          }
          return;
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 400);
        const formattedStartDate = startDate
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");

        const accountsToSync = credential.allAccounts
          ? authResult.accounts.map((acc) => acc.account_id)
          : credential.selectedAccounts;

        const wsUrl = getWebSocketUrl(authResult.websocket_url);
        connect(wsUrl, authResult.token, accountsToSync, formattedStartDate);

        updateLastSyncTime(credential.id);
      } catch (error) {
        toast.error("Synchronization failed");
        logger.error("Load more data error: " + (error instanceof Error ? error.message : String(error)));
      } finally {
        setSyncingId(null);
      }
    },
    [
      syncingId,
      authenticateAndGetAccounts,
      connect,
      getWebSocketUrl,
      user?.id,
    ]
  );

  const handleDeleteSynchronization = useCallback(
    async (accountId: string | undefined) => {
      if (!accountId) return;

      try {
        setDeletingSyncId(accountId);
        const response = await fetch("/api/v1/rithmic/synchronizations", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to delete synchronization");
        }

        setSynchronizations((prev) =>
          prev.filter((sync) => sync.accountId !== accountId)
        );
        toast.success("Synchronization connection removed");
      } catch (error) {
        logger.error("Error deleting synchronization: " + (error instanceof Error ? error.message : String(error)));
        toast.error("Failed to delete synchronization");
      } finally {
        setDeletingSyncId(null);
      }
    },
    []
  );

  const handleLoginMissing = useCallback(
    (accountId: string | undefined) => {
      if (!accountId) return;

      if (accountId.startsWith("rithmic_")) {
        toast.error("Legacy Sync ID", {
          description: "Legacy sync configurations cannot be managed here. Please recreate the connection.",
        });
        return;
      }

      onLoginMissingCredential(accountId);
    },
    [onLoginMissingCredential]
  );

  const credentialList = Object.values(credentials);
  const matchedCredentialIds = new Set<string>();

  const syncEntries = synchronizations.map((sync) => {
    if (isLegacySyncId(sync.accountId)) {
      return {
        sync,
        credential: null,
        hasLocalCredentials: false,
      };
    }

    const byId = credentials[sync.accountId];
    const byUsername = credentialList.find(
      (cred) => cred.credentials.username === sync.accountId
    );
    const localCredential = byId || byUsername;

    if (localCredential) {
      matchedCredentialIds.add(localCredential.id);
    }

    return {
      sync,
      credential: localCredential || null,
      hasLocalCredentials: !!localCredential,
    };
  });

  const syncAccountIds = new Set(synchronizations.map((s) => s.accountId));
  const localOnlyCredentials = credentialList
    .filter(
      (cred) =>
        !matchedCredentialIds.has(cred.id) &&
        !syncAccountIds.has(cred.credentials.username) &&
        !syncAccountIds.has(cred.id)
    )
    .map((credential) => ({
      sync: null,
      credential,
      hasLocalCredentials: true,
    }));

  const allEntries = [...syncEntries, ...localOnlyCredentials];

  function handleDelete(id: string) {
    clearRithmicData(id);
    setCredentials(getAllRithmicData());
    setIsDeleteDialogOpen(false);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Saved Connections</h2>
          <Button onClick={onAddNew} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add New Connection
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sync check interval:</span>
              <Select
                value={syncInterval.toString()}
                onValueChange={(value) =>
                  setSyncInterval(parseInt(value) as SyncInterval)
                }
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => {
              const allCredentials = Object.values(credentials);
              allCredentials.forEach((cred) => handleSync(cred));
            }}
            size="sm"
            variant="outline"
            disabled={true}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync All
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Last Synced</TableHead>
              <TableHead>Next Sync Check</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingSynchronizations ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-6"
                >
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Loading...
                </TableCell>
              </TableRow>
            ) : allEntries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-6"
                >
                  No saved Rithmic credentials found. Click 'Add New Connection' to connect.
                </TableCell>
              </TableRow>
            ) : (
              allEntries.map((entry) => {
                const { sync, credential, hasLocalCredentials } = entry;
                const credentialId = credential?.id || "";
                const rowId = sync?.accountId || credentialId || "";
                const lastSyncTime =
                  credential?.lastSyncTime ||
                  sync?.lastSyncedAt ||
                  new Date().toISOString();

                return (
                  <TableRow key={rowId}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        {credential ? (
                          credential.credentials.username
                        ) : (
                          <span className="text-muted-foreground">
                            {sync?.accountId || "N/A"}
                          </span>
                        )}
                        {!hasLocalCredentials && (
                          <span title="Credentials only saved in browser session. Please log in to enable scheduled background syncing.">
                            <AlertTriangle
                              className="h-4 w-4 text-yellow-500"
                            />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lastSyncTime
                        ? formatDate(lastSyncTime)
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {credential ? (
                        <SyncCountdown
                          lastSyncTime={lastSyncTime}
                          isAutoSyncing={
                            isAutoSyncing && syncingId === credentialId
                          }
                          credentialId={credentialId}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {credential ? (
                        <div className="flex justify-center items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSync(credential)}
                            disabled={isAutoSyncing}
                            aria-label="Sync credentials"
                          >
                            {syncingId === credentialId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Popover modal>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                aria-label="More options"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2" align="end">
                              <div className="flex flex-col space-y-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start text-left"
                                  onClick={() => handleLoadMoreData(credential)}
                                  disabled={isAutoSyncing}
                                >
                                  {syncingId === credentialId ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <History className="h-4 w-4 mr-2" />
                                  )}
                                  Load More Data (400 Days)
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start text-left"
                                  onClick={() => onSelectCredential(credential)}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit Credentials
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start text-left text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setSelectedCredentialId(credentialId);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Connection
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-start gap-2 text-xs text-yellow-600 dark:text-yellow-400 max-w-md">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span className="text-left text-[11px]">
                              Credentials only saved in browser session. Please log in to enable scheduled background syncing.
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() =>
                                handleLoginMissing(sync?.accountId)
                              }
                              disabled={
                                !sync?.accountId ||
                                deletingSyncId === sync.accountId
                              }
                            >
                              <LogIn className="h-4 w-4 mr-2" />
                              Log In
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                handleDeleteSynchronization(sync?.accountId)
                              }
                              disabled={deletingSyncId === sync?.accountId}
                            >
                              {deletingSyncId === sync?.accountId ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Delete Sync
                            </Button>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Credentials</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete these credentials? This will remove the connection and disable scheduled background sync.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedCredentialId && handleDelete(selectedCredentialId)
              }
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
