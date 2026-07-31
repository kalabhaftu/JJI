"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Plus, RefreshCw, MoreVertical } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  initiateTradovateOAuth,
  updateDailySyncTimeAction,
} from "./actions";
import { TRADOVATE_FEE_TYPE_KEYS } from "./fee-types";
import { useTradovateSyncStore } from "@/store/tradovate-sync-store";
import { useTradovateSyncContext } from "@/context/tradovate-sync-context";
import { logger } from '@/lib/logger';

function translateTradovateFeeType(key: string): string {
  switch (key) {
    case 'commission':
      return 'Commission';
    case 'exchangeFee':
      return 'Exchange Fee';
    case 'clearingFee':
      return 'Clearing Fee';
    case 'nfaFee':
      return 'NFA Fee';
    case 'brokerageFee':
      return 'Brokerage Fee';
    case 'orderRoutingFee':
      return 'Order Routing Fee';
    default:
      return key;
  }
}

export function TradovateCredentialsManager() {
  const {
    performSyncForAccount,
    performSyncForAllAccounts,
    accounts,
    deleteAccount,
    loadAccounts,
    getIncludedFeeTypesForAccount,
    updateIncludedFeeTypesForAccount,
  } = useTradovateSyncContext();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTimeDialogOpen, setIsTimeDialogOpen] = useState(false);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [dailySyncTime, setDailySyncTime] = useState<string>("");
  const [isSavingTime, setIsSavingTime] = useState(false);
  const tradovateStore = useTradovateSyncStore();

  const handleDelete = useCallback(
    async (accountId: string) => {
      try {
        await deleteAccount(accountId);
        setIsDeleteDialogOpen(false);
        toast.success(`Account ${accountId} deleted`);
      } catch (error) {
        toast.error(`Failed to delete account ${accountId}`);
        logger.error("Delete error: " + (error instanceof Error ? error.message : String(error)));
      }
    },
    [deleteAccount],
  );

  const handleStartOAuth = useCallback(async (accountId: string = "default") => {
    try {
      setIsLoading(true);
      const result = await initiateTradovateOAuth(accountId);
      if (result.error || !result.authUrl || !result.state) {
        toast.error("Failed to initiate oauth connection");
        return;
      }

      // Store the state for verification
      tradovateStore.setOAuthState(result.state);

      // Also store in sessionStorage as backup
      sessionStorage.setItem("tradovate_oauth_state", result.state);

      // Redirect to Tradovate OAuth
      window.location.href = result.authUrl;
    } catch (error) {
      toast.error("Failed to initiate oauth connection");
    } finally {
      setIsLoading(false);
    }
  }, [tradovateStore]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

  const handleReloadAccounts = useCallback(async () => {
    try {
      setIsReloading(true);
      await loadAccounts();
      toast.success("Accounts reloaded successfully");
    } catch (error) {
      toast.error("Failed to reload accounts");
      logger.error("Reload error: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsReloading(false);
    }
  }, [loadAccounts]);

  const handleSetDailySyncTime = useCallback((accountId: string, currentTime: Date | null) => {
    setSelectedAccountId(accountId);
    if (currentTime) {
      // Convert UTC time to local time for display
      const utcDate = new Date(currentTime);
      const localHours = utcDate.getHours().toString().padStart(2, '0');
      const localMinutes = utcDate.getMinutes().toString().padStart(2, '0');
      setDailySyncTime(`${localHours}:${localMinutes}`);
    } else {
      setDailySyncTime("");
    }
    setIsTimeDialogOpen(true);
  }, []);

  const handleSaveDailySyncTime = useCallback(async () => {
    if (!selectedAccountId) return;
    
    try {
      setIsSavingTime(true);
      
      // Convert local time to UTC on client side
      let utcTimeString: string | null = null;
      if (dailySyncTime) {
        const [hours = 0, minutes = 0] = dailySyncTime.split(':').map(Number);
        const localDate = new Date();
        localDate.setHours(hours, minutes, 0, 0);
        utcTimeString = localDate.toISOString();
      }
      
      const result = await updateDailySyncTimeAction(
        selectedAccountId,
        utcTimeString
      );
      
      if (result.success) {
        toast.success("Daily sync time updated");
        setIsTimeDialogOpen(false);
        await loadAccounts(); // Reload to show updated time
      } else {
        toast.error(result.error || "Failed to update daily sync time");
      }
    } catch (error) {
      toast.error("Failed to update daily sync time");
      logger.error("Update sync time error: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSavingTime(false);
    }
  }, [selectedAccountId, dailySyncTime, loadAccounts]);

  const handlePresetTime = useCallback((preset: string) => {
    let hours: number;
    let minutes: number;
    
    switch (preset) {
      case 'midday':
        hours = 12;
        minutes = 0;
        break;
      case 'after-close':
        // 22:00 UTC = 4:00 PM EST / 10:00 PM CET (after US market close)
        // Convert to local time
        const utcClose = new Date();
        utcClose.setUTCHours(22, 0, 0, 0);
        hours = utcClose.getHours();
        minutes = utcClose.getMinutes();
        break;
      case 'midnight':
        hours = 0;
        minutes = 0;
        break;
      case 'morning':
        hours = 8;
        minutes = 0;
        break;
      default:
        return;
    }
    
    setDailySyncTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
  }, []);

  function formatSyncTime(date: Date | null) {
    if (!date) return "Not Set (Manual Only)";
    
    // The date from DB is stored with UTC hours/minutes
    // We need to create a proper UTC date and convert to local
    const utcDate = new Date(date);
    const localHours = utcDate.getHours().toString().padStart(2, '0');
    const localMinutes = utcDate.getMinutes().toString().padStart(2, '0');
    
    // Get timezone abbreviation
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatter = new Intl.DateTimeFormat('en-US', { 
      timeZone, 
      timeZoneName: 'short' 
    });
    const parts = formatter.formatToParts(new Date());
    const tzName = parts.find(part => part.type === 'timeZoneName')?.value || '';
    
    return `${localHours}:${localMinutes} ${tzName}`;
  }

  const handleOpenFeeDialog = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    setIsFeeDialogOpen(true);
  }, []);

  const [feeDialogState, setFeeDialogState] = useState<Record<string, boolean>>({});
  const feeDialogInitialized = selectedAccountId && isFeeDialogOpen;

  useEffect(() => {
    if (feeDialogInitialized) {
      setFeeDialogState(getIncludedFeeTypesForAccount(selectedAccountId!));
    }
  }, [feeDialogInitialized, selectedAccountId, getIncludedFeeTypesForAccount]);

  const handleFeeDialogSave = useCallback(async () => {
    if (!selectedAccountId) return;
    const result = await updateIncludedFeeTypesForAccount(
      selectedAccountId,
      feeDialogState
    );
    if (result.success) {
      toast.success("Fee configuration updated");
      setIsFeeDialogOpen(false);
    } else {
      toast.error(result.error || "Failed to update fee configuration");
    }
  }, [selectedAccountId, feeDialogState, updateIncludedFeeTypesForAccount]);

  const allFeeSelected = TRADOVATE_FEE_TYPE_KEYS.every((k) => feeDialogState[k]);
  const handleFeeSelectAll = () => {
    setFeeDialogState(
      Object.fromEntries(TRADOVATE_FEE_TYPE_KEYS.map((k) => [k, !allFeeSelected]))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Saved Accounts</h2>
            <Button
              onClick={handleReloadAccounts}
              size="sm"
              variant="ghost"
              disabled={isReloading}
              className="h-8 w-8 p-0"
            >
              {isReloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              onClick={async () => {
                await performSyncForAllAccounts();
              }}
              size="sm"
              variant="outline"
              disabled={syncingId !== null}
              className="h-8"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync All
            </Button>
            <Button
              onClick={() => handleStartOAuth()}
              disabled={isLoading}
              size="sm"
              className="h-8"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add New Account
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Name / Firm</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Last Synced At</TableHead>
              <TableHead>Daily Sync Time (Local)</TableHead>
              <TableHead>Token Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const isExpired =
                !account.token ||
                (account.tokenExpiresAt
                  ? new Date(account.tokenExpiresAt).getTime() <= Date.now()
                  : false);

              return (
                <TableRow key={account.accountId}>
                  <TableCell className="font-medium">
                    {account.accountId}
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Demo
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(account.lastSyncedAt.toISOString())}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDailySyncTime(account.accountId, account.dailySyncTime)}
                      className="text-xs"
                    >
                      {formatSyncTime(account.dailySyncTime)}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        isExpired
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      }`}
                    >
                      {isExpired ? "Expired" : "Valid"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center items-center gap-2">
                      {isExpired && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartOAuth(account.accountId)}
                          className="h-8"
                        >
                          Reconnect
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          setSyncingId(account.accountId);
                          try {
                            await performSyncForAccount(account.accountId);
                          } finally {
                            setSyncingId(null);
                          }
                        }}
                        disabled={syncingId !== null || isExpired}
                        aria-label="Sync account"
                      >
                        {syncingId === account.accountId ? (
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
                        <PopoverContent className="w-48 p-2" align="end">
                          <div className="flex flex-col space-y-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start text-left"
                              onClick={() => handleOpenFeeDialog(account.accountId)}
                            >
                              Configure Fees
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start text-left text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedAccountId(account.accountId);
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
                  </TableCell>
                </TableRow>
              );
            })}
            {accounts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-6"
                >
                  No saved Tradovate accounts found. Connect your account to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tradovate Connection</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the Tradovate synchronization connection for account {selectedAccountId}? This will disable auto sync for this account.
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
                selectedAccountId && handleDelete(selectedAccountId)
              }
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Fees for {selectedAccountId}</DialogTitle>
            <DialogDescription>
              Select which fee components should be included in the net profit/loss calculation. By default, only commissions are deducted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-4">
              {TRADOVATE_FEE_TYPE_KEYS.map((key) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`fee-dialog-${key}`}
                    checked={!!feeDialogState[key]}
                    onCheckedChange={(checked) =>
                      setFeeDialogState((prev) => ({
                        ...prev,
                        [key]: checked === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor={`fee-dialog-${key}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {translateTradovateFeeType(key)}
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFeeSelectAll}
              >
                {allFeeSelected ? "Deselect All" : "Select All"}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsFeeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleFeeDialogSave}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isTimeDialogOpen} onOpenChange={setIsTimeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scheduled Daily Sync</DialogTitle>
            <DialogDescription>
              Specify the time of day when you want your trades to automatically sync from Tradovate. Leave empty to disable auto sync.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="syncTime">Sync Time</Label>
              <Input
                id="syncTime"
                type="time"
                value={dailySyncTime}
                onChange={(e) => setDailySyncTime(e.target.value)}
                placeholder="Select time"
              />
              <p className="text-sm text-muted-foreground">
                Time is entered in your local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}) and stored in UTC.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetTime('morning')}
                >
                  8:00 AM (Morning)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetTime('midday')}
                >
                  12:00 PM (Midday)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetTime('after-close')}
                >
                  US Close (5:00 PM EST)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePresetTime('midnight')}
                >
                  12:00 AM (Midnight)
                </Button>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsTimeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveDailySyncTime}
                disabled={isSavingTime}
              >
                {isSavingTime ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
