'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { useData } from '@/context/data-provider'
import { useAccounts } from '@/hooks/use-accounts'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { apiRequest } from '@/lib/api/client'

interface ImportJobResponse {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  stage: string
  progress: number
  importedCount: number
  skippedCount: number
  error?: string | null
}

export function ImportDialog() { // Kept name for compatibility
  const { refreshTrades } = useData()
  const { refetch: refetchAccounts } = useAccounts()
  const [isOpen, setIsOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResults, setImportResults] = useState<any>(null)
  const [importJob, setImportJob] = useState<ImportJobResponse | null>(null)

  const waitForImportCompletion = async (initialJob: ImportJobResponse) => {
    const isTerminal = (status: string) =>
      status === 'completed' || status === 'failed' || status === 'cancelled'
    let latestJob = initialJob

    while (!isTerminal(latestJob.status)) {
      const processResponse = await apiRequest<{
        job: ImportJobResponse
        done: boolean
      }>(`/api/v1/data/import/jobs/${latestJob.id}/process`, {
        method: 'POST'
      })
      if (!processResponse.data?.job) throw new Error('Restore processing failed')
      latestJob = processResponse.data.job
      setImportJob(latestJob)

      if (!isTerminal(latestJob.status)) {
        await new Promise(resolve => setTimeout(resolve, 400))
      }
    }

    if (latestJob.status === 'cancelled') {
      toast.info('Restore cancelled', {
        description: 'Restore job was cancelled before completion.'
      })
      return
    }
    if (latestJob.status === 'failed') {
      throw new Error(latestJob.error || 'Restore job failed')
    }

    setImportResults({
      imported: latestJob.importedCount || 0,
      skipped: latestJob.skippedCount || 0
    })
    toast.success('System Restore Complete!', {
      description: `Restored ${latestJob.importedCount || 0} trades. Skipped ${latestJob.skippedCount || 0} duplicates.`
    })
    setTimeout(() => {
      refreshTrades()
      refetchAccounts()
    }, 1000)
  }

  const handleImport = async () => {
    if (!selectedFile) return

    try {
      setIsImporting(true)
      setImportResults(null)
      setImportJob(null)
      toast.info('Restore started', {
        description: 'Uploading backup and preparing restore job.',
        duration: 3000
      })

      const formData = new FormData()
      formData.append('file', selectedFile)

      const createJobResponse = await apiRequest<{ job: ImportJobResponse }>('/api/v1/data/import/jobs', {
        method: 'POST',
        body: formData
      })
      const createdJob = createJobResponse.data?.job
      if (!createdJob) throw new Error('Failed to create restore job')
      setImportJob(createdJob)
      await waitForImportCompletion(createdJob)

    } catch (error) {
      toast.error('Restore Failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleResumeImport = async () => {
    if (!importJob?.id || !['failed', 'cancelled'].includes(importJob.status)) return
    try {
      setIsImporting(true)
      setImportResults(null)
      const response = await apiRequest<{ job: ImportJobResponse }>(
        `/api/v1/data/import/jobs/${importJob.id}/resume`,
        { method: 'POST' },
      )
      if (!response.data?.job) throw new Error('Resume returned no import job')
      setImportJob(response.data.job)
      await waitForImportCompletion(response.data.job)
    } catch (error) {
      toast.error('Resume Failed', {
        description: error instanceof Error ? error.message : 'Unable to resume restore job',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setImportResults(null)
    setImportJob(null)
  }

  const handleClose = () => {
    if (isImporting) return
    handleReset()
    setIsOpen(false)
  }

  const handleCancelImport = async () => {
    if (!importJob?.id || !isImporting) return

    try {
      const response = await apiRequest<{ job: ImportJobResponse }>(`/api/v1/data/import/jobs/${importJob.id}/cancel`, {
        method: 'POST'
      })
      if (response.data?.job) {
        setImportJob(response.data.job)
      }

      toast.info('Cancelling restore', {
        description: 'The job is being cancelled. Please wait...'
      })
    } catch (error) {
      toast.error('Cancel Failed', {
        description: error instanceof Error ? error.message : 'Unable to cancel restore job'
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && isImporting) return
      setIsOpen(open)
      if (!open) handleReset()
    }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <RotateCcw className="mr-2 h-4 w-4" /> Restore Backup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Restore System Backup</DialogTitle>
          <DialogDescription>
            Restore your database from a previously exported ZIP backup.
            This process reconstructs accounts, trades, and images.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Selection */}
          {!importResults && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Safe Restore:</strong> This process will <strong>not</strong> overwrite existing data. It only adds missing records. Duplicates are automatically skipped.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <FileDropzone
                  onDrop={(files) => {
                    const file = files[0]
                    if (file) {
                      if (!file.name.endsWith('.zip')) {
                        toast.error('Please select a valid Backup ZIP file')
                        return
                      }
                      setSelectedFile(file)
                      setImportResults(null)
                    }
                  }}
                  accept={{ 'application/zip': ['.zip'] }}
                  variant="default"
                  description="Drag & drop your backup ZIP file here, or click to browse"
                  value={selectedFile}
                  onClear={handleReset}
                  isLoading={isImporting}
                />
              </div>

              {isImporting && importJob && (
                <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Restore Progress</p>
                    <p className="text-xs text-muted-foreground uppercase">{importJob.stage}</p>
                  </div>
                  <Progress value={Math.max(2, importJob.progress || 0)} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Status: {importJob.status}</span>
                    <span>{importJob.progress || 0}%</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="space-y-4">
              <Alert className="border-long/20 bg-long/5">
                <CheckCircle2 className="h-4 w-4 text-long" />
                <AlertDescription className="text-long">
                  <strong>Restore operation completed successfully.</strong>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                  <span className="text-sm font-medium text-muted-foreground">Imported</span>
                  <span className="text-2xl font-bold text-long">
                    {importResults.imported || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                  <span className="text-sm font-medium text-muted-foreground">Skipped (Duplicates)</span>
                  <span className="text-2xl font-bold text-warning">
                    {importResults.skipped || 0}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 pt-4">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={handleReset}>
                  Restore Another
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!importResults && (
          <div className="flex items-center justify-between pt-4 border-t">
            {isImporting ? (
              <Button variant="destructive" onClick={handleCancelImport}>
                Cancel Restore
              </Button>
            ) : importJob && ['failed', 'cancelled'].includes(importJob.status) ? (
              <Button onClick={handleResumeImport}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Resume Restore
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleImport}
              disabled={!selectedFile || isImporting}
            >
              {isImporting ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Restore
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
