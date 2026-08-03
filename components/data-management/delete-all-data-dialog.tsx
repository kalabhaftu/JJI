'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog, AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Trash2,
  AlertTriangle,
  Download,
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react"
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'

interface DeleteAllDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'warning' | 'confirm' | 'final'

export function DeleteAllDataDialog({ open, onOpenChange }: DeleteAllDataDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('warning')
  const [confirmText, setConfirmText] = useState('')
  const [finalConfirm, setFinalConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false)
  const [backupDownloaded, setBackupDownloaded] = useState(false)

  const resetState = () => {
    setStep('warning')
    setConfirmText('')
    setFinalConfirm(false)
    setBackupDownloaded(false)
  }

  const handleClose = () => {
    if (!isDeleting) {
      resetState()
      onOpenChange(false)
    }
  }

  const handleDownloadBackup = async () => {
    try {
      setIsDownloadingBackup(true)

      const response = await fetch('/api/v1/user/data/backup')

      if (!response.ok) {
        throw new Error('Failed to generate backup')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url


      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      a.download = filenameMatch?.[1] || 'jji-backup.json'

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setBackupDownloaded(true)
      toast.success('Backup downloaded successfully', {
        description: 'Your data has been saved to your downloads folder.'
      })
    } catch (error) {
      reportClientError(error, { operation: 'download-user-backup', route: '/dashboard/data' })
      toast.error('Failed to download backup', {
        description: 'Please try again or contact support.'
      })
    } finally {
      setIsDownloadingBackup(false)
    }
  }

  const handleDeleteAllData = async () => {
    if (confirmText !== 'DELETE ALL DATA' || !finalConfirm) {
      return
    }

    try {
      setIsDeleting(true)

      const response = await fetch('/api/v1/user/data', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirmation: 'DELETE ALL DATA'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to delete data')
      }

      toast.success('All data deleted', {
        description: 'Your account data has been permanently removed.'
      })

      try {
        localStorage.clear()
      } catch (e) {

      }

      handleClose()

      window.location.href = '/dashboard'

    } catch (error) {
      reportClientError(error, { operation: 'delete-user-data', route: '/dashboard/data' })
      toast.error('Failed to delete data', {
        description: error instanceof Error ? error.message : 'Please try again.'
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete All Data
          </AlertDialogTitle>
        </AlertDialogHeader>

        {step === 'warning' && (
          <>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>This action cannot be undone</AlertTitle>
                  <AlertDescription>
                    All your trading data will be permanently deleted. Your user account will remain active.
                  </AlertDescription>
                </Alert>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p className="font-medium">This will delete:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>All trading accounts and their configurations</li>
                    <li>All imported trades and trade history</li>
                    <li>All prop firm accounts and evaluation progress</li>
                    <li>All groups, tags, and notes</li>
                    <li>All backtest trades</li>
                    <li>Dashboard layouts and filter settings</li>
                  </ul>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <p className="text-sm font-medium">Recommended: Download a backup first</p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleDownloadBackup}
                    disabled={isDownloadingBackup}
                  >
                    {isDownloadingBackup ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        Generating backup...
                      </>
                    ) : backupDownloaded ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-profit" />
                        Backup downloaded
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Backup
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </AlertDialogDescription>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => setStep('confirm')}
              >
                Continue
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  To confirm deletion, type <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">DELETE ALL DATA</code> below:
                </p>

                <div className="space-y-2">
                  <Label htmlFor="confirm-text" className="sr-only">
                    Confirmation text
                  </Label>
                  <Input
                    id="confirm-text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE ALL DATA"
                    className="font-mono"
                    autoComplete="off"
                  />
                  {confirmText && confirmText !== 'DELETE ALL DATA' && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Text does not match
                    </p>
                  )}
                  {confirmText === 'DELETE ALL DATA' && (
                    <p className="text-xs text-profit flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Confirmation matches
                    </p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>

            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setStep('warning')}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep('final')}
                disabled={confirmText !== 'DELETE ALL DATA'}
              >
                Continue
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {step === 'final' && (
          <>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Final Warning</AlertTitle>
                  <AlertDescription>
                    You are about to permanently delete all your data. This action is irreversible.
                  </AlertDescription>
                </Alert>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="final-confirm"
                    checked={finalConfirm}
                    onCheckedChange={(checked) => setFinalConfirm(checked === true)}
                    className="mt-1"
                  />
                  <Label
                    htmlFor="final-confirm"
                    className="text-sm cursor-pointer leading-relaxed"
                  >
                    I understand that this will permanently delete all my trading data, accounts, and settings. This action cannot be reversed.
                  </Label>
                </div>
              </div>
            </AlertDialogDescription>

            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setStep('confirm')} disabled={isDeleting}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAllData}
                disabled={!finalConfirm || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All My Data
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
