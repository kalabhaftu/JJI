'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import type { TradeType } from '@/lib/db/schema/trades';

import { importTradesThroughApi } from '@/lib/api/trade-import-client'
import ImportTypeSelection, { ImportType } from './import-type-selection'
import FileUpload from './file-upload'
import HeaderSelection from './header-selection'
import AccountSelection from './account-selection'
import { useData } from '@/context/data-provider'
import ColumnMapping from './column-mapping'
import { platforms } from './config/platforms-card'
import { FormatPreview } from './components/format-preview'
import { useUserStore } from '@/store/user-store'
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

import { generateTradeHash } from '@/lib/trading/trade-grouping'
import { reportClientError } from '@/lib/observability/report-error'

export type Step = 
  | 'select-import-type'
  | 'upload-file'
  | 'select-headers'
  | 'map-columns'
  | 'select-account'
  | 'preview-trades'
  | 'complete'
  | 'process-file'
  | 'process-trades'

interface ImportTradesCardProps {
  accountId: string
}

export default function ImportTradesCard({ accountId }: ImportTradesCardProps) {
  const [step, setStep] = useState<Step>('select-import-type')
  const [importType, setImportType] = useState<ImportType>('')
  const [files] = useState<File[]>([])
  const [rawCsvData, setRawCsvData] = useState<string[][]>([])
  const [csvData, setCsvData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mappings, setMappings] = useState<{ [key: string]: string }>({})
  const [accountNumber, setAccountNumber] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [processedTrades, setProcessedTrades] = useState<TradeType[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const user = useUserStore(state => state.user)
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const { refreshTrades } = useData()
  const router = useRouter()

  const handleSave = async () => {

    const currentUser = user || supabaseUser
    if (!currentUser?.id) {
      toast.error("Authentication Error", {
        description: "User not authenticated. Please log in and try again.",
      })
      return
    }

    setIsSaving(true)
    
    try {

      toast.info("Processing Trades", {
        description: "Checking for duplicates and saving trades...",
        duration: 3000,
      })
      let newTrades: TradeType[] = []
          newTrades = processedTrades.map(trade => {

            const cleanTrade = Object.fromEntries(
              Object.entries(trade).filter(([_, value]) => value !== undefined)
            ) as Partial<TradeType>
            
            return {
              ...cleanTrade,
              accountNumber: cleanTrade.accountNumber || accountNumber || accountId,
              userId: currentUser.id,
              id: generateTradeHash({ ...cleanTrade, userId: currentUser.id }),

              instrument: cleanTrade.instrument || '',
              entryPrice: cleanTrade.entryPrice || '',
              closePrice: cleanTrade.closePrice || '',
              entryDate: cleanTrade.entryDate || '',
              closeDate: cleanTrade.closeDate || '',
              quantity: cleanTrade.quantity ?? 0,
              pnl: cleanTrade.pnl || 0,
              timeInPosition: cleanTrade.timeInPosition || 0,
              side: cleanTrade.side || '',
              commission: cleanTrade.commission || 0,
              entryId: cleanTrade.entryId || null,
              comment: cleanTrade.comment || null,
              groupId: cleanTrade.groupId || null,
              createdAt: cleanTrade.createdAt || new Date(),
            } as TradeType
          })
     

          newTrades = newTrades.filter(trade => {
            return trade.accountNumber &&
              trade.instrument &&
              trade.quantity !== null && trade.quantity !== undefined &&
              (trade.entryPrice || trade.closePrice) &&
              (trade.entryDate || trade.closeDate);
          });


      const latestJob = await importTradesThroughApi({
        accountId,
        trades: newTrades,
      })
      if (latestJob.status === 'cancelled') {
        toast.info('Import cancelled', {
          description: 'The import job was cancelled before completion.',
          duration: 5000,
        })
        return
      }
      const result = {
        success: true,
        linkedCount: latestJob.importedCount || 0,
      }

      if (!result?.success) {
        toast.error("Import Failed", {
          description: "Failed to link trades to account phase. Please try again.",
        })
        setIsSaving(false)
        return
      }
      

      const importedCount = result.linkedCount || 0
      
      if (importedCount === 0) {
        toast.info("No New Trades", {
          description: `All ${newTrades.length} trades have already been imported to this account. No duplicates were added.`,
          duration: 5000,
        })
        setIsSaving(false)
        

        resetImportState()
        router.push(`/dashboard/prop-firm/accounts/${accountId}/trades`)
        return
      }
      

      resetImportState()
      

      router.push(`/dashboard/prop-firm/accounts/${accountId}/trades`)
      

      refreshTrades()
      

      toast.success("Import Completed", {
        description: `Successfully imported ${importedCount} ${importedCount === 1 ? 'trade' : 'trades'}.`,
        duration: 5000,
      })

    } catch (error: any) {
      reportClientError(error, { operation: 'import-trades-card', route: '/api/v1/data/import' })
      

      const errorMessage = error?.message || String(error)
      
      if (errorMessage.includes('Authentication')) {
        toast.error("Authentication Error", {
          description: "Your session has expired. Please log in again.",
        })
      } else if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        toast.error("Connection Error", {
          description: "Unable to connect to the server. Please check your internet connection and try again.",
        })
      } else {
        toast.error("Import Failed", {
          description: "An unexpected error occurred. Please try again or contact support if the issue persists.",
        })
      }
    } finally {
      setIsSaving(false)
    }
  }

  const resetImportState = () => {
    setImportType('')
    setStep('select-import-type')
    setRawCsvData([])
    setCsvData([])
    setHeaders([])
    setMappings({})
    setAccountNumber('')
    setProcessedTrades([])
    setError(null)
  }

  const handleNextStep = () => {
    const platform = platforms.find(p => p.type === importType) || platforms.find(p => p.platformName === 'csv-ai')
    if (!platform) return

    const currentStepIndex = platform.steps.findIndex(s => s.id === step)
    if (currentStepIndex === -1) return

    if (step === 'upload-file' && importType === 'pdf') {
      if (files.length === 0) {
        setError("Please select a PDF file to continue")
        return
      }
      setStep('process-file')
      return
    }

    const nextStep = platform.steps[currentStepIndex + 1]
    if (!nextStep) {
      handleSave()
      return
    }

    setStep(nextStep.id)
  }

  const handleBackStep = () => {
    const platform = platforms.find(p => p.type === importType) || platforms.find(p => p.platformName === 'csv-ai')
    if (!platform) return

    const currentStepIndex = platform.steps.findIndex(s => s.id === step)
    if (currentStepIndex === 0) {
      setImportType('')
      setStep('select-import-type')
      return
    }
    if (currentStepIndex < 0) return

    const prevStep = platform.steps[currentStepIndex - 1]
    if (!prevStep) return

    setStep(prevStep.id)
  }

  const renderStep = () => {
    const platform = platforms.find(p => p.type === importType) || platforms.find(p => p.platformName === 'csv-ai')
    if (!platform) return null

    const currentStep = platform.steps.find(s => s.id === step)
    if (!currentStep) return null

    const Component = currentStep.component

    if (Component === ImportTypeSelection) {
      return (
        <div className="flex flex-col gap-4 h-full">
          <Component
            selectedType={importType}
            setSelectedType={setImportType}
            setIsOpen={() => {}}
          />
        </div>
      )
    }

    if (Component === FileUpload) {
      return (
        <Component
          importType={importType}
          setRawCsvData={setRawCsvData}
          setCsvData={setCsvData}
          setHeaders={setHeaders}
          setStep={setStep}
          setError={setError}
        />
      )
    }

    if (Component === HeaderSelection) {
      return (
        <Component
          rawCsvData={rawCsvData}
          setCsvData={setCsvData}
          setHeaders={setHeaders}
          setError={setError}
        />
      )
    }

    if (Component === AccountSelection) {
      return (
        <Component
          accountNumber={accountNumber}
          setAccountNumber={setAccountNumber}
        />
      )
    }

    if (Component === ColumnMapping) {
      return (
        <Component
          headers={headers}
          csvData={csvData}
          mappings={mappings}
          setMappings={setMappings}
          error={error}
          importType={importType}
        />
      )
    }

    if (Component === FormatPreview) {
      return (
        <Component
          trades={csvData}
          processedTrades={processedTrades}
          setProcessedTrades={setProcessedTrades}
          setIsLoading={setIsLoading}
          isLoading={isLoading}
          headers={headers}
          mappings={mappings}
        />
      )
    }
    

    if (platform.processorComponent && Component === platform.processorComponent) {
      return (
        <platform.processorComponent
          csvData={csvData}
          headers={headers}
          setProcessedTrades={setProcessedTrades}
          accountNumber={accountNumber || accountId}
        />
      )
    }

    if (platform.customComponent) {
      const CustomComponent = platform.customComponent
      return (
        <CustomComponent
          setIsOpen={() => {}}
          onBack={resetImportState}
        />
      )
    }
    
    if (platform.customCardComponent && Component === platform.customCardComponent) {
      return <platform.customCardComponent accountId={accountId} />
    }

    return null
  }

  const isNextDisabled = () => {
    if (isLoading) return true
    
    const platform = platforms.find(p => p.type === importType) || platforms.find(p => p.platformName === 'csv-ai')
    if (!platform) {

      return step === 'select-import-type' && !importType
    }

    const currentStep = platform.steps.find(s => s.id === step)
    if (!currentStep) return true


    if (currentStep.component === ImportTypeSelection && !importType) return true
    

    if (currentStep.component === FileUpload && csvData.length === 0) return true
    

    if (currentStep.component === AccountSelection && !accountNumber) return true


    if (currentStep.component === FormatPreview && processedTrades.length === 0) return true

    return false
  }

  return (
    <Card className="w-full border border-border bg-card rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="border-b border-border/30 p-5">
        <CardTitle className="text-base font-bold text-foreground/90">Import Trades</CardTitle>
        <CardDescription className="text-xs text-muted-foreground mt-0.5">Select a synchronization method to pull in your trading history</CardDescription>
      </CardHeader>
      <CardContent className="p-0 flex flex-col">
        <div className="p-5">
          {renderStep()}
        </div>

        <div className="p-4 border-t border-border/30">
          <div className="flex justify-end items-center gap-2">
            {step !== 'select-import-type' && (
              <Button 
                variant="secondary" 
                onClick={handleBackStep}
                className="w-fit min-w-[90px] h-9 text-xs border-border/50 hover:bg-muted"
              >
                Back
              </Button>
            )}
            {(step !== 'select-import-type' || (step === 'select-import-type' && importType)) && (
              <Button 
                onClick={handleNextStep}
                className="w-fit min-w-[90px] h-9 text-xs shadow-sm"
                disabled={isNextDisabled()}
              >
                {isSaving ? "Saving..." : 
                 step === 'preview-trades' || step === 'process-file' ? "Save Trades" : 
                 "Next"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
