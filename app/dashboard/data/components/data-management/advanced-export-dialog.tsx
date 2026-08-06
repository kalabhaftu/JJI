'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
import { apiRequestData } from '@/lib/api/client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Database } from 'lucide-react'
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CustomDateRangePicker, DateRange } from "@/components/ui/custom-date-range-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Spinner } from '@/components/ui/spinner'
import { reportClientError } from '@/lib/observability/report-error'

type ExportOptionAccount = {
  id: string
  number: string
  name?: string
  displayName?: string
}

export function AdvancedExportDialog() {
  const scope = useQueryScope()
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const optionsQuery = useQuery({
    queryKey: queryKeys.dataExportOptions(scope),
    queryFn: ({ signal }) =>
      apiRequestData<{ data: { accounts: ExportOptionAccount[]; instruments: string[] } }>('/api/v1/data/export/options', {
        signal,
        operation: 'load-export-options',
      }),
    enabled: isOpen && isScopeReady(scope),
    staleTime: 30_000,
  })
  const exportOptionsResponse = optionsQuery.data
  const optionsLoading = optionsQuery.isPending

  useEffect(() => {
    if (!optionsQuery.error) return
    reportClientError(optionsQuery.error, { operation: 'load-export-options', route: '/api/v1/data/export/options' })
  }, [optionsQuery.error])

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([])
  const [selectAllAccounts, setSelectAllAccounts] = useState(true)
  const [selectAllInstruments, setSelectAllInstruments] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [isAllTime, setIsAllTime] = useState(true)

  const allAccounts = useMemo<ExportOptionAccount[]>(
    () => exportOptionsResponse?.data?.accounts ?? [],
    [exportOptionsResponse?.data?.accounts]
  )
  const allInstruments = useMemo<string[]>(
    () => exportOptionsResponse?.data?.instruments ?? [],
    [exportOptionsResponse?.data?.instruments]
  )

  const accountsList = useMemo(() => {
    if (!allAccounts || optionsLoading) return []
    return allAccounts.map((account: ExportOptionAccount) => ({
      id: account.id,
      name: account.displayName || account.name || account.number,
      number: account.number
    }))
  }, [allAccounts, optionsLoading])

  const instrumentsList = useMemo(() => {
    return allInstruments
  }, [allInstruments])

  useEffect(() => {
    if (accountsList.length > 0 && selectedAccounts.length === 0 && selectAllAccounts) {
      setSelectedAccounts(accountsList.map(a => a.id))
    }
  }, [accountsList, selectAllAccounts, selectedAccounts.length])

  useEffect(() => {
    if (instrumentsList.length > 0 && selectedInstruments.length === 0 && selectAllInstruments) {
      setSelectedInstruments(instrumentsList)
    }
  }, [instrumentsList, selectAllInstruments, selectedInstruments.length])

  const handleAccountChange = (accountId: string) => {
    setSelectedAccounts(prev => {
      const newSelection = prev.includes(accountId)
        ? prev.filter(a => a !== accountId)
        : [...prev, accountId]
      setSelectAllAccounts(newSelection.length === accountsList.length)
      return newSelection
    })
  }

  const handleInstrumentChange = (instrument: string) => {
    setSelectedInstruments(prev => {
      const newSelection = prev.includes(instrument)
        ? prev.filter(i => i !== instrument)
        : [...prev, instrument]
      setSelectAllInstruments(newSelection.length === instrumentsList.length)
      return newSelection
    })
  }

  const handleSelectAllAccounts = () => {
    if (selectAllAccounts) {
      setSelectedAccounts([])
      setSelectAllAccounts(false)
    } else {
      setSelectedAccounts(accountsList.map((account) => account.id))
      setSelectAllAccounts(true)
    }
  }

  const handleSelectAllInstruments = () => {
    if (selectAllInstruments) {
      setSelectedInstruments([])
      setSelectAllInstruments(false)
    } else {
      setSelectedInstruments(instrumentsList)
      setSelectAllInstruments(true)
    }
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      toast.info('Preparing system export...', {
        id: 'export',
        description: 'Generating backup archive...',
        duration: Infinity
      })

      const filters = {
        accountIds: selectAllAccounts ? undefined : selectedAccounts,
        instruments: selectAllInstruments ? undefined : selectedInstruments,
        from: !isAllTime && dateRange.from ? dateRange.from.toISOString() : undefined,
        to: !isAllTime && dateRange.to ? dateRange.to.toISOString() : undefined
      }

      const response = await fetch('/api/v1/data/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(filters)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `jji-system-backup-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('System Backup Complete', {
        id: 'export',
        description: 'Your data has been successfully exported.'
      })
      setIsOpen(false)
    } catch (error) {
      reportClientError(error, { operation: 'export-user-data', route: '/api/v1/data/export' })
      toast.error('Export Failed', {
        id: 'export',
        description: 'Could not generate backup. Please try again.'
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Database className="mr-2 h-4 w-4" /> System Backup
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>System Data Export</DialogTitle>
          <DialogDescription>
            Create a full backup of your trading history, accounts, and images.
            Select specific filters below or export everything (recommended).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">

            {                     }
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Date Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allTime"
                      checked={isAllTime}
                      onCheckedChange={(checked) => setIsAllTime(checked as boolean)}
                    />
                    <label htmlFor="allTime" className="text-sm font-medium cursor-pointer">
                      Export all history (Full System Backup)
                    </label>
                  </div>

                  {!isAllTime && (
                    <div className="flex justify-start pt-2">
                      <CustomDateRangePicker
                        selected={dateRange}
                        onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                        className="w-fit"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {                        }
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex justify-between items-center">
                  <span>Accounts</span>
                  <span className="text-xs font-normal text-muted-foreground">{selectedAccounts.length} selected</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b pb-2">
                    <Checkbox
                      id="selectAllAccounts"
                      checked={selectAllAccounts}
                      onCheckedChange={handleSelectAllAccounts}
                    />
                    <label htmlFor="selectAllAccounts" className="text-sm font-medium cursor-pointer">
                      Select All
                    </label>
                  </div>
                  <ScrollArea className="h-[200px] pr-4">
                    {optionsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Spinner className="h-6 w-6 text-muted-foreground" />
                      </div>
                    ) : accountsList.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No accounts found
                      </div>
                    ) : (
                      accountsList.map((account) => (
                        <div key={account.id} className="flex items-center space-x-2 mb-2">
                          <Checkbox
                            id={`account-${account.id}`}
                            checked={selectedAccounts.includes(account.id)}
                            onCheckedChange={() => handleAccountChange(account.id)}
                          />
                          <label htmlFor={`account-${account.id}`} className="text-sm cursor-pointer truncate">
                            {account.name} <span className="text-xs text-muted-foreground">({account.number})</span>
                          </label>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>

            {                           }
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex justify-between items-center">
                  <span>Instruments</span>
                  <span className="text-xs font-normal text-muted-foreground">{selectedInstruments.length} selected</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 border-b pb-2">
                    <Checkbox
                      id="selectAllInstruments"
                      checked={selectAllInstruments}
                      onCheckedChange={handleSelectAllInstruments}
                    />
                    <label htmlFor="selectAllInstruments" className="text-sm font-medium cursor-pointer">
                      Select All
                    </label>
                  </div>
                  <ScrollArea className="h-[200px] pr-4">
                    {instrumentsList.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No instruments available
                      </div>
                    ) : (
                      instrumentsList.map((instrument) => (
                        <div key={instrument} className="flex items-center space-x-2 mb-2">
                          <Checkbox
                            id={`instrument-${instrument}`}
                            checked={selectedInstruments.includes(instrument)}
                            onCheckedChange={() => handleInstrumentChange(instrument)}
                          />
                          <label htmlFor={`instrument-${instrument}`} className="text-sm cursor-pointer">
                            {instrument}
                          </label>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="p-4 bg-background border-t mt-auto">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Click Export to download your backup archive.
            </div>
            <Button
              onClick={handleExport}
              disabled={(selectedAccounts.length === 0 && !selectAllAccounts) || isExporting}
            >
              {isExporting ? (
                 <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Generating Archive...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Backup
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
