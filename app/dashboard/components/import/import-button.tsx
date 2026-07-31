'use client'

import { Spinner } from '@/components/ui/spinner'

import React, { useState, useCallback, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { toast } from "sonner"
// UploadIcon removed
import type { TradeType } from '@/lib/db/schema/trades';

import { saveAndLinkTrades } from '@/server/accounts'
import ImportTypeSelection, { ImportType } from './import-type-selection'
import FileUpload from './file-upload'
import HeaderSelection from './header-selection'
import AccountSelection from './account-selection'
import { useData } from '@/context/data-provider'
import ColumnMapping from './column-mapping'
import { FormatPreview } from './components/format-preview'
import { platforms } from './config/platforms'
import {
  Trophy,
  CheckCircle2,
  FileSpreadsheet,
  MapPin,
  Wallet,
  Eye,
  ArrowLeft,
  Loader2,
  Upload,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserStore } from '@/store/user-store'
import { motion, AnimatePresence } from 'framer-motion'
import { PhaseTransitionDialog } from '@/app/dashboard/components/prop-firm/phase-transition-dialog'
import { Progress } from '@/components/ui/progress'

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

const ASYNC_IMPORT_THRESHOLD = 500

interface TradeImportJobMeta {
  accountType?: 'prop-firm' | 'live'
  accountName?: string
  masterAccountId?: string
  phaseAccountId?: string
  evaluation?: {
    isFailed: boolean
    status?: string
    message?: string
    currentPhaseNumber?: number
    profitTargetProgress?: number
    currentPnL?: number
    evaluationType?: string
    propFirmName?: string
  }
}

interface TradeImportJobResponse {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  stage: string
  progress: number
  totalItems: number
  importedCount: number
  skippedCount: number
  error?: string | null
  meta?: TradeImportJobMeta
}

// Step icons mapping
const stepIcons: Record<string, React.ReactNode> = {
  'select-import-type': <FileSpreadsheet className="h-3.5 w-3.5" />,
  'upload-file': <Upload className="h-3.5 w-3.5" />,
  'select-headers': <MapPin className="h-3.5 w-3.5" />,
  'map-columns': <MapPin className="h-3.5 w-3.5" />,
  'select-account': <Wallet className="h-3.5 w-3.5" />,
  'preview-trades': <Eye className="h-3.5 w-3.5" />,
}

export default function ImportButton() {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleOpen = () => setIsOpen(true)
      window.addEventListener('open-import-modal', handleOpen)
      return () => window.removeEventListener('open-import-modal', handleOpen)
    }
  }, [])

  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [step, setStep] = useState<Step>('select-import-type')
  const [importType, setImportType] = useState<ImportType>('')
  const [files] = useState<File[]>([])
  const [rawCsvData, setRawCsvData] = useState<string[][]>([])
  const [csvData, setCsvData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mappings, setMappings] = useState<{ [key: string]: string }>({})
  const [accountNumber, setAccountNumber] = useState<string>('')
  const [newAccountNumber, setNewAccountNumber] = useState<string>('')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [processedTrades, setProcessedTrades] = useState<TradeType[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveProgress, setSaveProgress] = useState<number>(0)
  // uploadIconRef removed

  // Phase transition state
  const [showPhaseTransitionDialog, setShowPhaseTransitionDialog] = useState(false)
  const [phaseTransitionData, setPhaseTransitionData] = useState<{
    masterAccountId: string
    currentPhase: {
      phaseNumber: number
      profitTargetPercent?: number
      currentPnL: number
      phaseId: string
    }
    nextPhaseNumber: number
    propFirmName: string
    accountName: string
    evaluationType: string
  } | null>(null)

  const user = useUserStore(state => state.user)
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const { refreshTrades } = useData()

  // Get current platform config
  const platform = useMemo(() =>
    platforms.find(p => p.type === importType) || platforms.find(p => p.platformName === 'csv-ai'),
    [importType]
  )

  // Get current step info
  const currentStep = useMemo(() =>
    platform?.steps.find(s => s.id === step),
    [platform, step]
  )

  const currentStepIndex = useMemo(() =>
    platform?.steps.findIndex(s => s.id === step) ?? 0,
    [platform, step]
  )

  const totalSteps = platform?.steps.length ?? 1

  const isManualEntry = !!platform?.customComponent

  const resetImportState = useCallback(() => {
    setImportType('')
    setStep('select-import-type')
    setRawCsvData([])
    setCsvData([])
    setHeaders([])
    setMappings({})
    setProcessedTrades([])
    setError(null)
    setAccountNumber('')
    setNewAccountNumber('')
    setSelectedAccountId('')
    setSaveProgress(0)
    setIsSaving(false)
    setIsLoading(false)
  }, [])

  const handleSave = useCallback(async () => {
    const currentUser = user || supabaseUser
    if (!currentUser?.id) {
      toast.error("Authentication Error", {
        description: "User not authenticated. Please log in and try again.",
      })
      return
    }

    if (!selectedAccountId) {
      toast.error("Account Required", {
        description: "Please select an account to link trades to.",
      })
      return
    }

    setIsSaving(true)
    setIsLoading(true)
    setSaveProgress(10)

    try {
      setSaveProgress(30)
      const useAsyncJob = processedTrades.length >= ASYNC_IMPORT_THRESHOLD
      let result: any

      if (useAsyncJob) {
        const createJobResponse = await fetch('/api/v1/trades/import/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: selectedAccountId,
            trades: processedTrades,
          }),
        })

        const createJobData = await createJobResponse.json().catch(() => null)
        if (!createJobResponse.ok || !createJobData?.job) {
          throw new Error(createJobData?.error || 'Failed to create import job')
        }

        let latestJob = createJobData.job as TradeImportJobResponse
        const isTerminal = (status: TradeImportJobResponse['status']) =>
          status === 'completed' || status === 'failed' || status === 'cancelled'

        while (!isTerminal(latestJob.status)) {
          const processResponse = await fetch(`/api/v1/trades/import/jobs/${latestJob.id}/process`, {
            method: 'POST',
          })
          const processData = await processResponse.json().catch(() => null)

          if (!processResponse.ok || !processData?.job) {
            throw new Error(processData?.error || 'Import processing failed')
          }

          latestJob = processData.job as TradeImportJobResponse
          setSaveProgress(Math.max(30, Math.min(95, latestJob.progress || 30)))

          if (!isTerminal(latestJob.status)) {
            await new Promise((resolve) => setTimeout(resolve, 350))
          }
        }

        if (latestJob.status === 'cancelled') {
          toast.info('Import cancelled', {
            description: 'The import job was cancelled before completion.',
            duration: 5000,
          })
          return
        }

        if (latestJob.status === 'failed') {
          throw new Error(latestJob.error || 'Import failed')
        }

        result = {
          linkedCount: latestJob.importedCount || 0,
          totalTrades: latestJob.totalItems || processedTrades.length,
          isDuplicate: (latestJob.importedCount || 0) === 0,
          message: (latestJob.importedCount || 0) === 0
            ? `All ${latestJob.totalItems || processedTrades.length} trades already exist in this account - no new trades to import`
            : undefined,
          isPropFirm: latestJob.meta?.accountType === 'prop-firm',
          masterAccountId: latestJob.meta?.masterAccountId || null,
          phaseAccountId: latestJob.meta?.phaseAccountId || null,
          accountName: latestJob.meta?.accountName || 'Account',
          evaluation: latestJob.meta?.evaluation,
        }
      } else {
        // Fast path for smaller imports keeps current behavior unchanged.
        result = await saveAndLinkTrades(selectedAccountId, processedTrades)
      }

      setSaveProgress(70)

      // Invalidate accounts cache
      const { invalidateAccountsCache } = await import("@/hooks/use-accounts")
      invalidateAccountsCache('trades imported')

      setSaveProgress(90)

      setIsOpen(false)
      resetImportState()

      // Refresh data
      await refreshTrades()

      setSaveProgress(100)

      if (result.isDuplicate) {
        toast.info("No New Trades", {
          description: 'message' in result ? result.message : `All ${result.totalTrades} trades already exist`,
          duration: 5000,
        })
        return
      }

      if ('evaluation' in result && result.evaluation) {
        const evalData = result.evaluation as any

        if (evalData.status === 'failed') {
          toast.error("Account Failed", {
            description: evalData.message || 'Account failed due to rule violation',
            duration: 10000,
          })
        } else if (evalData.status === 'pending_approval') {
          toast.success("Evaluation Complete!", {
            description: "Your account has passed. Check notifications to confirm approval.",
            duration: 10000,
            icon: <Trophy className="h-4 w-4 text-primary" />
          })
        } else if ((evalData.status === 'passed' || evalData.status === 'ready_for_transition') && result.isPropFirm && result.masterAccountId && result.phaseAccountId) {
          toast.success("Profit Target Reached!", {
            description: evalData.message || 'Ready to advance to next phase',
            duration: 10000,
            icon: <CheckCircle2 className="h-4 w-4 text-long" />
          })

          const dialogData = {
            masterAccountId: result.masterAccountId,
            currentPhase: {
              phaseNumber: evalData.currentPhaseNumber || 1,
              profitTargetPercent: evalData.profitTargetProgress,
              currentPnL: evalData.currentPnL || 0,
              phaseId: result.phaseAccountId
            },
            nextPhaseNumber: (evalData.currentPhaseNumber || 1) + 1,
            propFirmName: evalData.propFirmName || 'Prop Firm',
            accountName: 'accountName' in result ? result.accountName : 'Account',
            evaluationType: evalData.evaluationType || 'Two Step'
          }

          setPhaseTransitionData(dialogData)
          setTimeout(() => setShowPhaseTransitionDialog(true), 300)
        } else {
          toast.success("Import Successful", {
            description: `Imported ${result.linkedCount} trades`,
            duration: 5000,
          })
        }
      } else {
        toast.success("Import Successful", {
          description: `Imported ${result.linkedCount} trades`,
          duration: 5000,
        })
      }

    } catch (error) {
      let errorMessage = "An error occurred while importing trades."
      let errorTitle = "Import Failed"

      if (error instanceof Error) {
        if (error.message.includes('phase transition')) {
          errorTitle = "Phase Transition Required"
          errorMessage = error.message
        } else if (error.message.includes('account')) {
          errorTitle = "Account Error"
          errorMessage = error.message
        } else {
          errorMessage = error.message
        }
      }

      toast.error(errorTitle, { description: errorMessage, duration: 8000 })
    } finally {
      setIsSaving(false)
      setIsLoading(false)
      setSaveProgress(0)
    }
  }, [user, supabaseUser, selectedAccountId, processedTrades, refreshTrades, resetImportState])

  const handleNextStep = useCallback(() => {
    if (!platform) return

    const currentIdx = platform.steps.findIndex(s => s.id === step)
    if (currentIdx === -1) return

    if (step === 'upload-file' && importType === 'pdf') {
      if (files.length === 0) {
        setError("Please select files to upload")
        return
      }
      setStep('process-file')
      return
    }

    const nextStep = platform.steps[currentIdx + 1]
    if (!nextStep) {
      handleSave()
      return
    }

    setStep(nextStep.id)
  }, [platform, step, importType, files, handleSave])

  const handleBackStep = useCallback(() => {
    if (!platform) return

    const currentIdx = platform.steps.findIndex(s => s.id === step)
    if (currentIdx === 0) {
      setImportType('')
      setStep('select-import-type')
      return
    }
    if (currentIdx < 0) return

    const prevStep = platform.steps[currentIdx - 1]
    if (prevStep) setStep(prevStep.id)
  }, [platform, step])

  const isNextDisabled = useMemo(() => {
    if (isLoading) return true
    if (!platform) return true

    const currentStepConfig = platform.steps.find(s => s.id === step)
    if (!currentStepConfig) return true

    // File upload requires files
    if (currentStepConfig.component === FileUpload && csvData.length === 0) return true

    // Account selection requires selection
    if (currentStepConfig.component === AccountSelection && !selectedAccountId) return true

    // FormatPreview requires processed trades
    if (currentStepConfig.component === FormatPreview && processedTrades.length === 0) return true

    return false
  }, [isLoading, platform, step, csvData.length, selectedAccountId, processedTrades.length])

  const hasImportProgress = useMemo(() => {
    return Boolean(
      importType ||
      step !== 'select-import-type' ||
      rawCsvData.length > 0 ||
      csvData.length > 0 ||
      headers.length > 0 ||
      Object.keys(mappings).length > 0 ||
      accountNumber ||
      newAccountNumber ||
      selectedAccountId ||
      processedTrades.length > 0 ||
      isLoading ||
      isSaving
    )
  }, [
    importType,
    step,
    rawCsvData.length,
    csvData.length,
    headers.length,
    mappings,
    accountNumber,
    newAccountNumber,
    selectedAccountId,
    processedTrades.length,
    isLoading,
    isSaving,
  ])

  const renderStep = useCallback(() => {
    if (!platform) return null

    const currentStepConfig = platform.steps.find(s => s.id === step)
    if (!currentStepConfig) return null

    const Component = currentStepConfig.component

    // Show saving state
    if (isSaving) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6 p-8 bg-background">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Spinner className="h-12 w-12 text-primary" />
            </motion.div>
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-base font-semibold text-foreground/90">Saving Your Trades</h3>
            <p className="text-xs text-muted-foreground">
              Processing and linking {processedTrades.length} trades...
            </p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            <Progress value={saveProgress} className="h-1.5" />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold px-0.5">
              <span>{saveProgress}% complete</span>
              <span>Please wait</span>
            </div>
          </div>
        </div>
      )
    }

    if (Component === ImportTypeSelection) {
      return (
        <Component
          selectedType={importType}
          setSelectedType={setImportType}
          setIsOpen={setIsOpen}
        />
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
          selectedAccountId={selectedAccountId}
          setSelectedAccountId={setSelectedAccountId}
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
          accountNumber={accountNumber || newAccountNumber}
        />
      )
    }

    if (platform.customComponent) {
      const CustomComponent = platform.customComponent
      return (
        <CustomComponent
          setIsOpen={(open) => {
            setIsOpen(open)
            if (!open) {
              resetImportState()
            }
          }}
          onBack={resetImportState}
        />
      )
    }

    return null
  }, [
    platform,
    step,
    isSaving,
    saveProgress,
    processedTrades,
    importType,
    rawCsvData,
    csvData,
    headers,
    mappings,
    error,
    accountNumber,
    selectedAccountId,
    isLoading,
    newAccountNumber,
    resetImportState,
  ])

  return (
    <div>
      {/* Phase Transition Dialog */}
      {phaseTransitionData && (
        <PhaseTransitionDialog
          isOpen={showPhaseTransitionDialog}
          onClose={() => {
            setShowPhaseTransitionDialog(false)
            setPhaseTransitionData(null)
          }}
          masterAccountId={phaseTransitionData.masterAccountId}
          currentPhase={phaseTransitionData.currentPhase}
          nextPhaseNumber={phaseTransitionData.nextPhaseNumber}
          propFirmName={phaseTransitionData.propFirmName}
          accountName={phaseTransitionData.accountName}
          evaluationType={phaseTransitionData.evaluationType}
          onSuccess={() => {
            refreshTrades()
            setShowPhaseTransitionDialog(false)
            setPhaseTransitionData(null)
          }}
        />
      )}

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="justify-start text-left font-medium w-full transition-all duration-200 hover:bg-muted/50 border-border/50"
          id="import-data"
          data-tour="import-nav-btn"
          onMouseEnter={() => { }}
          onMouseLeave={() => { }}
        >
          <Upload className="h-4 w-4 mr-2" />
          <span className='hidden md:block'>Import Trades</span>
        </Button>
      </motion.div>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsOpen(true)
            return
          }

          if (hasImportProgress) {
            setShowCloseConfirm(true)
            return
          }

          setIsOpen(false)
          resetImportState()
        }}
      >
        <DialogContent
          className="flex flex-col w-full max-w-[95vw] sm:max-w-4xl h-[85vh] p-0 bg-background border border-border shadow-xl overflow-hidden gap-0 duration-200 sm:rounded-2xl rounded-none"
          onOpenAutoFocus={(e) => {
            // Prevent auto-focus on mobile devices to avoid keyboard popup
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
              e.preventDefault()
            }
          }}
        >
          <VisuallyHidden>
            <DialogTitle>Import Trades</DialogTitle>
          </VisuallyHidden>

          {/* Header - only show for non-manual entry or show simplified for manual */}
          {!isManualEntry && (
            <div className="flex-none border-b border-border/40 p-5 bg-background">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-foreground/90">
                    {currentStep?.title || 'Import Trades'}
                  </h2>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">
                    {currentStep?.description || 'Import your trading data'}
                  </p>
                </div>
              </div>

              {/* Progress steps */}
              {platform && totalSteps > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {platform.steps.map((s, idx) => {
                    const isActive = currentStepIndex === idx;
                    const isCompleted = currentStepIndex > idx;
                    return (
                      <React.Fragment key={s.id}>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all duration-200 shrink-0 border",
                            isActive
                              ? "bg-primary text-primary-foreground font-semibold border-primary shadow-sm shadow-primary/10"
                              : isCompleted
                                ? "bg-primary/5 text-primary border-primary/20"
                                : "bg-muted/40 text-muted-foreground border-transparent"
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <div className={cn(
                              "flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold",
                              isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                            )}>
                              {idx + 1}
                            </div>
                          )}
                          <span className="hidden sm:inline font-medium">{s.title}</span>
                        </div>
                        {idx < platform.steps.length - 1 && (
                          <div className={cn(
                            "h-[1.5px] w-6 shrink-0 transition-colors duration-300",
                            isCompleted ? "bg-primary/40" : "bg-border/40"
                          )} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className={cn(
            "flex-1 overflow-hidden",
            !isManualEntry && "p-5"
          )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="h-full"
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer - only show for non-manual entry */}
          {!isManualEntry && (
            <div className="flex-none p-4 border-t border-border/30 bg-background">
              <div className="flex justify-between items-center max-w-4xl mx-auto w-full">
                <div className="text-xs text-muted-foreground/80 font-medium pl-1">
                  {processedTrades.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      {processedTrades.length} trades processed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {step !== 'select-import-type' && (
                    <Button
                      variant="outline"
                      onClick={handleBackStep}
                      disabled={isSaving}
                      className="gap-1.5 text-xs h-9 border-border/50 hover:bg-muted"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back
                    </Button>
                  )}
                  <Button
                    onClick={handleNextStep}
                    disabled={isNextDisabled || isSaving}
                    data-tour="import-next-btn"
                    className={cn(
                      "gap-1.5 text-xs h-9 min-w-[100px] shadow-sm",
                      currentStepIndex === 0 && importType === 'rithmic-sync' && "invisible"
                    )}
                  >
                    {isSaving ? (
                      <>
                        <Spinner className="h-3.5 w-3.5" />
                        Saving...
                      </>
                    ) : currentStep?.isLastStep ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Save Trades
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard import progress?</AlertDialogTitle>
            <AlertDialogDescription>
              You have import progress in this panel (selected file, mappings, or previewed trades). Closing now will reset it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowCloseConfirm(false)
                setIsOpen(false)
                resetImportState()
              }}
            >
              Discard & Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
