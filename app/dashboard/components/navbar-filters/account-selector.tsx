"use client"

import * as React from "react"
import { useState, useMemo, useEffect, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, ChevronDownIcon, ChevronRightIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useData } from "@/context/data-provider"
import { useAccountFilterSettings } from "@/hooks/use-account-filter-settings"
import { toast } from "sonner"
import { reportError } from '@/lib/observability/report-error'

interface AccountSelectorProps {
  onSave?: () => void
}

export function AccountSelector({ onSave }: AccountSelectorProps) {
  const { accountNumbers, setAccountNumbers, refreshTrades, accounts: contextAccounts } = useData()
  const { updateSettings, isSaving } = useAccountFilterSettings()


  const accounts: any[] = useMemo(
    () => ((contextAccounts as any[]) || []).map((a) => ({ ...a })),
    [contextAccounts]
  )
  const isLoading = accounts.length === 0

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())


  const prevAccountNumbersRef = React.useRef<string[]>([])


  const syncSelectedFromContext = useCallback(
    (currentNumbers: string[]) => {
      if (!accounts || accounts.length === 0) return

      const matchingAccountIds = accounts
        .filter(acc => currentNumbers.includes(acc.id) || currentNumbers.includes(acc.number))
        .map(acc => acc.id)

      if (matchingAccountIds.length > 0) {
        setSelectedAccounts(new Set(matchingAccountIds))


        const matchingAccounts = accounts.filter(acc => currentNumbers.includes(acc.id) || currentNumbers.includes(acc.number))
        const accountNames = new Set(matchingAccounts.map(acc => acc.name || acc.number))
        setExpandedAccounts(prev => new Set([...prev, ...accountNames]))
      } else if (currentNumbers.length > 0) {


        setSelectedAccounts(new Set())
      } else {

        setSelectedAccounts(new Set())
      }
    },
    [accounts]
  )


  useEffect(() => {
    if (!accounts || accounts.length === 0) return

    const prevNumbers = prevAccountNumbersRef.current
    const currentNumbers = accountNumbers || []
    const hasChanged =
      prevNumbers.length !== currentNumbers.length ||
      !prevNumbers.every(n => currentNumbers.includes(n)) ||
      !currentNumbers.every(n => prevNumbers.includes(n))

    if (hasChanged) {
      syncSelectedFromContext(currentNumbers)
      prevAccountNumbersRef.current = currentNumbers
    }
  }, [accountNumbers, accounts, syncSelectedFromContext])


  const filteredAccountsList = useMemo(() => {
    if (!accounts || !Array.isArray(accounts)) return []

    return accounts.map((a) => ({ ...a }))
  }, [accounts])


  const groupedAccountsByName = useMemo(() => {
    if (!filteredAccountsList || filteredAccountsList.length === 0) {
      return {}
    }

    const grouped: Record<string, {
      accountName: string
      propFirm: string
      phases: Array<{
        id: string
        number: string
        status: string
        tradeCount: number
        phaseDetails: any
        phaseId?: string
        currentPhase?: number
        accountType?: string
      }>
    }> = {}


    filteredAccountsList.forEach(account => {


      const accountName = account.accountType === 'prop-firm' ? account.name : account.name

      if (!grouped[accountName]) {
        grouped[accountName] = {
          accountName,
          propFirm: account.propfirm || '',
          phases: []
        }
      }

      grouped[accountName].phases.push({
        id: account.id,
        number: account.number,
        status: account.status,
        tradeCount: account.tradeCount || 0,
        phaseDetails: account.currentPhaseDetails,
        phaseId: account.currentPhaseDetails?.phaseId || account.number,
        currentPhase: account.currentPhase || account.currentPhaseDetails?.phaseNumber,
        accountType: account.accountType
      })
    })

    return grouped
  }, [filteredAccountsList])


  const filteredGroupedAccounts = useMemo(() => {
    if (!searchQuery) return groupedAccountsByName

    const query = searchQuery.toLowerCase()
    const filtered: Record<string, any> = {}

    Object.entries(groupedAccountsByName).forEach(([accountName, accountData]) => {
      if (accountName.toLowerCase().includes(query)) {
        filtered[accountName] = accountData
        return
      }


      const matchingPhases = accountData.phases.filter((phase: any) =>
        phase.number.toLowerCase().includes(query) ||
        phase.status.toLowerCase().includes(query) ||
        accountData.propFirm.toLowerCase().includes(query)
      )

      if (matchingPhases.length > 0) {
        filtered[accountName] = {
          ...accountData,
          phases: matchingPhases
        }
      }
    })

    return filtered
  }, [groupedAccountsByName, searchQuery])


  const activeAccounts = useMemo(() => {
    if (!filteredAccountsList) return []
    return filteredAccountsList.filter(account => account.status === 'active')
  }, [filteredAccountsList])


  useEffect(() => {
    if (!accounts || accounts.length === 0) return


    if (accountNumbers.length > 0 && selectedAccounts.size === 0) {
      const matchingAccounts = accounts.filter(acc =>
        accountNumbers.includes(acc.number) ||
        accountNumbers.includes(acc.id)
      )

      if (matchingAccounts.length > 0) {

        setSelectedAccounts(new Set(matchingAccounts.map(acc => acc.id)))


        const accountNames = new Set(matchingAccounts.map(acc => acc.name || acc.number))
        setExpandedAccounts(accountNames)
      }
    }
  }, [accounts, accountNumbers, selectedAccounts.size])


  const getSelectedMasterAccountCount = useMemo(() => {
    if (selectedAccounts.size === 0) return 0

    const selectedAccountObjects = Array.from(selectedAccounts)
      .map(accountId => accounts.find(acc => acc.id === accountId))
      .filter(Boolean) as any[]


    const masterAccountSet = new Set<string>()

    selectedAccountObjects.forEach(acc => {
      const accountType = acc.accountType || (acc.propfirm ? 'prop-firm' : 'live')

      if (accountType === 'prop-firm') {

        const masterId = acc.currentPhaseDetails?.masterAccountId || acc.name || acc.number
        masterAccountSet.add(masterId)
      } else {

        masterAccountSet.add(acc.id || acc.number)
      }
    })

    return masterAccountSet.size
  }, [selectedAccounts, accounts])

  const handleToggleAccount = (accountId: string, checked: boolean) => {
    const newSelected = new Set(selectedAccounts)

    if (checked) {
      newSelected.add(accountId)
    } else {
      newSelected.delete(accountId)
    }

    setSelectedAccounts(newSelected)


    const accountData = accounts?.find(acc => acc.id === accountId)
    if (accountData && checked) {
      const accountName = accountData.name || accountData.number
      setExpandedAccounts(prev => new Set([...prev, accountName]))
    }
  }

  const handleApplySelection = async () => {
    if (selectedAccounts.size === 0) {
      toast.error("Please select at least one account")
      return
    }

    try {
      const accountNumbersToSave = Array.from(selectedAccounts)

      await updateSettings({
        selectedAccounts: Array.from(selectedAccounts),
        selectedPhaseAccountIds: accountNumbersToSave,
      })

      setAccountNumbers(accountNumbersToSave)
      refreshTrades().catch((error) => reportError(error, {
        surface: 'client',
        operation: 'refresh-trades-after-account-filter',
      }))
      toast.success(`${selectedAccounts.size} account(s) selected`)
      onSave?.()
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'save-account-filter-selection',
      })
      toast.error("Failed to save account selection")
    }
  }

  const handleSelectAllPhasesForAccount = (accountName: string) => {
    const accountData = groupedAccountsByName[accountName]
    if (!accountData) return

    const phaseIds = accountData.phases.map(p => p.id)
    const newSelected = new Set(selectedAccounts)


    phaseIds.forEach(id => newSelected.add(id))

    setSelectedAccounts(newSelected)


    setExpandedAccounts(prev => new Set([...prev, accountName]))
  }

  const toggleAccountExpansion = (accountName: string) => {
    setExpandedAccounts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(accountName)) {
        newSet.delete(accountName)
      } else {
        newSet.add(accountName)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {

    const allIds = filteredAccountsList.map(acc => acc.id)
    setSelectedAccounts(new Set(allIds))
  }

  const handleClearAll = async () => {
    setSelectedAccounts(new Set())
    try {
      await updateSettings({ selectedAccounts: [], selectedPhaseAccountIds: [] })
      setAccountNumbers([])
      refreshTrades().catch((error) => reportError(error, {
        surface: 'client',
        operation: 'refresh-trades-after-account-filter-clear',
      }))
      toast.success("Selection cleared")
      onSave?.()
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'clear-account-filter-selection',
      })
      toast.error("Failed to clear selection")
    }
  }

  const handleActiveOnly = () => {

    const activeIds = activeAccounts.map(acc => acc.id)
    setSelectedAccounts(new Set(activeIds))
  }


  const totalAccounts = filteredAccountsList.length

  return (
    <div className="w-full min-w-[280px] sm:min-w-[300px] max-w-[400px] sm:max-w-[450px] flex flex-col max-h-[min(85vh,520px)] flex-1 min-h-0">
      {}
      <div className="p-3 sm:p-4 pb-2 space-y-3 flex-shrink-0 border-b">
        <div className="space-y-1">
          <h4 className="font-semibold text-sm sm:text-base">Account Filter</h4>
          <p className="text-xs text-muted-foreground">Filter dashboard by accounts. Persists across sessions.</p>
        </div>

        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" strokeWidth={2} color="currentColor" />
          <Input
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 sm:h-9 text-sm"
            disabled={isLoading}
          />
        </div>

        {}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSelectAll}
            disabled={isLoading}
            className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
          >
            Select All
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleActiveOnly}
            disabled={activeAccounts.length === 0}
            className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
          >
            Active Only
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClearAll}
            disabled={selectedAccounts.size === 0}
            className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
          >
            Clear
          </Button>
        </div>

        {}
        {selectedAccounts.size > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            {getSelectedMasterAccountCount} account{getSelectedMasterAccountCount !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      {}
      <ScrollArea className="h-[280px] sm:h-[340px] px-3 sm:px-4">
        <div className="pb-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center space-y-3">
              <div className="space-y-2 w-full px-4">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-3/4 rounded-lg" />
              </div>
            </div>
          ) : totalAccounts === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">No accounts found</p>
              <p className="text-xs text-muted-foreground mt-1">Create an account to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(filteredGroupedAccounts).map(([accountName, accountData]) => {
                const selectedPhasesCount = accountData.phases.filter((p: any) => selectedAccounts.has(p.id)).length
                const totalPhasesCount = accountData.phases.filter((p: any) => p.status !== 'pending').length

                return (
                  <Collapsible key={accountName} open={expandedAccounts.has(accountName)} onOpenChange={() => toggleAccountExpansion(accountName)}>
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="tertiary"
                          className="flex-1 justify-between p-2 h-auto text-left hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            {expandedAccounts.has(accountName) ? (
                              <HugeiconsIcon icon={ChevronDownIcon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
                            ) : (
                              <HugeiconsIcon icon={ChevronRightIcon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
                            )}
                            <div>
                              <div className="font-medium text-sm">{accountName}</div>
                              {accountData.propFirm && (
                                <div className="text-xs text-muted-foreground">{accountData.propFirm}</div>
                              )}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs h-4 px-1.5">
                            {totalPhasesCount}
                          </Badge>
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="ml-6 space-y-1 overflow-visible">
                      {accountData.phases
                        .filter((phase: any) => phase.status && phase.status !== 'pending')
                        .map((phase: any) => (
                          <div key={phase.id} className="flex items-center gap-2 py-1">
                            <Checkbox
                              checked={selectedAccounts.has(phase.id)}
                              onCheckedChange={(checked) => handleToggleAccount(phase.id, checked as boolean)}
                              id={phase.id}
                            />
                            <Label
                              htmlFor={phase.id}
                              className="flex-1 text-xs sm:text-sm cursor-pointer leading-tight"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{phase.number}</span>
                                <Badge
                                  variant={
                                    phase.status === 'active' ? 'outline' :
                                      phase.status === 'funded' || phase.status === 'passed' ? 'default' :
                                        phase.status === 'failed' || phase.status === 'archived' ? 'destructive' : 'secondary'
                                  }
                                  className="text-[10px] h-4 px-1.5 min-w-[3rem] justify-center"
                                >
                                  {phase.status === 'archived' ? 'failed' : phase.status}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 min-w-[2.5rem] justify-center">
                                  {(() => {
                                    if (phase.accountType === 'live') return 'Live'
                                    const phaseNum = phase.currentPhase || phase.phaseDetails?.phaseNumber
                                    if (!phaseNum) return 'N/A'
                                    const evalType = phase.phaseDetails?.evaluationType


                                    const isFunded = (() => {
                                      switch (evalType) {
                                        case 'Two Step':
                                          return phaseNum >= 3
                                        case 'One Step':
                                          return phaseNum >= 2
                                        case 'Instant':
                                          return phaseNum >= 1
                                        default:

                                          return phaseNum >= 3
                                      }
                                    })()
                                    return isFunded ? 'Funded' : `Phase ${phaseNum}`
                                  })()}
                                </Badge>
                                {phase.tradeCount > 0 && (
                                  <span className="text-muted-foreground text-xs">• {phase.tradeCount} trades</span>
                                )}
                              </div>
                            </Label>
                          </div>
                        ))}
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}

          {Object.keys(filteredGroupedAccounts).length === 0 && searchQuery && (
            <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
              No accounts match &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </ScrollArea>

      {}
      <div className="flex-shrink-0 p-3 sm:p-4 border-t space-y-2">
        <Button
          className="w-full h-9 sm:h-10"
          onClick={handleApplySelection}
          disabled={isSaving || selectedAccounts.size === 0}
        >
          {isSaving ? "Applying..." : `Apply Filter ${selectedAccounts.size > 0 ? `(${selectedAccounts.size})` : ''}`}
        </Button>
      </div>
    </div>
  )
}
