import React, { useState, useEffect } from 'react'
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { CheckCircle2, Building2, User, AlertCircle, RefreshCw, Target, Clock, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useAccounts } from "@/hooks/use-accounts"
import { useRealtimeAccounts } from "@/hooks/use-realtime-accounts"
import { OptimizedAccountSelectionLoading } from "@/components/ui/optimized-loading"
import { isFundedPhaseForEvaluation } from '@/lib/prop-firm/reporting'
import { useRouter } from 'next/navigation'

// Temporary translation function
const useTranslations = () => {
  const t = (key: string) => key
  return { t }
}

interface UnifiedAccount {
  id: string
  number: string
  name?: string
  broker?: string
  displayName: string
  accountType: 'prop-firm' | 'live'
  startingBalance: number
  status: string
  currentPhase?: number | {
    phaseNumber: number
    status: string
    phaseId: string | null
  }
  currentPhaseDetails?: {
    phaseNumber: number
    status: string
    phaseId: string
    masterAccountId?: string
    evaluationType?: string
  } | null
}

/**
 * Helper function to determine if a phase number represents the funded stage
 * based on the evaluation type.
 */
function isFundedPhase(evaluationType: string | undefined, phaseNumber: number | undefined): boolean {
  return isFundedPhaseForEvaluation(evaluationType || '', phaseNumber || 0)
}

/**
 * Helper function to get phase label
 */
function getPhaseLabel(evaluationType: string | undefined, phaseNumber: number | undefined): string {
  if (!phaseNumber) return 'PHASE 1'
  if (isFundedPhase(evaluationType, phaseNumber)) {
    return 'FUNDED'
  }
  return `PHASE ${phaseNumber}`
}

interface AccountSelectionProps {
  accountNumber: string
  setAccountNumber: React.Dispatch<React.SetStateAction<string>>
  selectedAccountId?: string
  setSelectedAccountId?: React.Dispatch<React.SetStateAction<string>>
}

export default function AccountSelection({
  accountNumber,
  setAccountNumber,
  selectedAccountId,
  setSelectedAccountId
}: AccountSelectionProps) {
  const router = useRouter()
  const { accounts, isLoading, error, refetch } = useAccounts({
    status: 'all',
    type: 'all',
    limit: 200,
  })
  const [hasError, setHasError] = useState(false)
  const [accountsWithPhases, setAccountsWithPhases] = useState<UnifiedAccount[]>([])
  const [isLoadingPhases, setIsLoadingPhases] = useState(false)
  
  // Enable real-time updates for better UX
  const { isConnected } = useRealtimeAccounts({
    enabled: true,
    onUpdate: () => {
      // Accounts will auto-update via the useAccounts hook
    }
  })

  // Update error state when hook error changes
  useEffect(() => {
    if (error) {
      setHasError(true)
      toast.error("Error", {
        description: error,
      })
    } else {
      setHasError(false)
    }
  }, [error])

  // Filter accounts for import - only show active phases and all live accounts
  useEffect(() => {
    const prepareAccounts = () => {
      if (accounts.length === 0) {
        setAccountsWithPhases([])
        return
      }

      setIsLoadingPhases(true)
      
      try {
        // For import: only show active phases for prop-firm accounts
        const filteredAccounts = accounts.filter(acc => {
          // Show all non-archived live accounts; live accounts do not have phases.
          if (acc.accountType === 'live') return !acc.isArchived
          
          // For prop-firm accounts: only show active phases (NOT passed or failed)
          if (acc.accountType === 'prop-firm') {
            // Check phase status - must be active (not passed, not failed)
            const phaseStatus = acc.currentPhase?.status || acc.status
            return phaseStatus === 'active'
          }
          
          return false
        })

        // Map to include phase details in the expected format
        const accountsWithPhaseData = filteredAccounts.map((account) => {
          // Use phaseDetails that's already loaded from server
          if (account.accountType === 'prop-firm') {
            const phaseDetails = (account as any).phaseDetails
            if (phaseDetails) {
              return {
                ...account,
                currentPhase: {
                  phaseNumber: phaseDetails.phaseNumber || (account as any).currentPhase,
                  status: phaseDetails.status || account.status,
                  phaseId: phaseDetails.phaseId || account.number
                }
              }
            }
          }
          return account
        })
        
        setAccountsWithPhases(accountsWithPhaseData as any)
      } catch (error) {
        setAccountsWithPhases((accounts || []) as any) // Fallback to accounts without phase formatting
      } finally {
        setIsLoadingPhases(false)
      }
    }

    prepareAccounts()
  }, [accounts])

  if (isLoading || isLoadingPhases) {
    return (
      <OptimizedAccountSelectionLoading 
        accountCount={isLoading ? 3 : Math.max(3, accountsWithPhases.length)}
      />
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="space-y-1.5 flex-none">
        <Label className="text-lg font-semibold text-foreground/90">
          Select Account
        </Label>
        <p className="text-xs text-muted-foreground">
          {accounts.length === 0
            ? "No accounts found"
            : "Choose an active account to link these imported trades to"
          }
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="p-8 text-center max-w-md bg-card border border-border rounded-2xl shadow-sm">
            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3 animate-pulse" />
            <h3 className="text-base font-semibold mb-1">
              {hasError ? "Failed to Fetch Accounts" : "No Accounts Found"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              {hasError
                ? "There was an error loading your accounts. Please try again or check your connection."
                : "You need to create an account first before importing trades."
              }
            </p>
            {hasError ? (
              <Button
                onClick={() => refetch()}
                disabled={isLoading}
                size="sm"
                className="gap-2"
              >
                {isLoading ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span>Retry</span>
              </Button>
            ) : (
              <Button size="sm" onClick={() => router.push('/dashboard/accounts')}>
                Create trading account
              </Button>
            )}
          </Card>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-2 pr-1 min-h-[200px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {accountsWithPhases.map((account) => {
              const isSelected = selectedAccountId === account.id;
              return (
                <button
                  type="button"
                  key={account.id}
                  data-tour="import-account-card"
                  className={cn(
                    "relative group flex flex-col justify-between rounded-xl border p-5 text-left cursor-pointer hover:border-primary/30 hover:bg-muted/10 hover:shadow-md transition-all duration-200",
                    isSelected 
                      ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-card"
                  )}
                  onClick={() => {
                    setAccountNumber(account.number)
                    setSelectedAccountId?.(account.id)
                  }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-lg border",
                            isSelected ? "bg-background/80 border-primary/20 text-primary" : "bg-muted/40 border-border/40 text-muted-foreground"
                          )}>
                            {account.accountType === 'prop-firm' ? (
                              <Building2 className="h-3.5 w-3.5" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-long" />
                            )}
                          </div>
                          <p className="font-semibold text-sm text-foreground/90 truncate">{account.displayName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground/80 font-mono">
                          {account.number}
                        </p>
                        {account.broker && account.accountType === 'live' && (
                          <p className="text-[10px] text-muted-foreground">
                            Broker: {account.broker}
                          </p>
                        )}
                      </div>
                      
                      <div className="relative shrink-0">
                        {isSelected ? (
                          <div className="relative">
                            <CheckCircle2 className="h-5 w-5 text-primary relative z-10" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border border-border/40 group-hover:border-primary/30 transition-colors" />
                        )}
                      </div>
                    </div>

                    {account.accountType === 'prop-firm' && account.currentPhase && (
                      <div className="flex items-center gap-2 mt-3">
                        {(() => {
                          const phaseInfo = account.currentPhase;
                          const phaseNumber = typeof phaseInfo === 'number' ? phaseInfo : phaseInfo?.phaseNumber || 1;
                          const phaseStatus = typeof phaseInfo === 'object' ? phaseInfo?.status : 'active';
                          const phaseId = typeof phaseInfo === 'object' ? phaseInfo?.phaseId : null;
                          const evaluationType = account.currentPhaseDetails?.evaluationType;

                          return (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-2 py-0.5 border font-semibold gap-1",
                                phaseStatus === 'active' ? 'border-primary/30 bg-primary/5 text-primary' :
                                phaseStatus === 'passed' ? 'border-success/30 bg-success/5 text-success-foreground' :
                                'border-destructive/30 bg-destructive/5 text-destructive-foreground'
                              )}
                            >
                              {phaseStatus === 'active' && <Target className="h-2.5 w-2.5" />}
                              {phaseStatus === 'passed' && <CheckCircle2 className="h-2.5 w-2.5" />}
                              {phaseStatus === 'failed' && <AlertTriangle className="h-2.5 w-2.5" />}
                              <span>{getPhaseLabel(evaluationType, phaseNumber)}</span>
                              {phaseId && (
                                <span className="text-[9px] font-mono opacity-80">
                                  #{phaseId}
                                </span>
                              )}
                            </Badge>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/75 font-semibold">Starting Bal</span>
                    <span className="text-xs font-semibold font-mono text-foreground/90">
                      ${account.startingBalance.toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  )
}
