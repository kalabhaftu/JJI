'use client'

import { useState, useEffect } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from 'zod'
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { HugeiconsIcon } from '@hugeicons/react'
import { Building01Icon } from '@hugeicons/core-free-icons'
import { reportClientError } from '@/lib/observability/report-error'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'

const editAccountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required').max(100, 'Name too long'),
})

type EditAccountForm = z.infer<typeof editAccountSchema>

interface PropFirmAccountData {
  id: string
  accountName?: string
  name?: string
  displayName?: string
  propfirm?: string
  currentPhaseDetails?: {
    masterAccountId?: string
  } | null
}

interface EditPropFirmAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: PropFirmAccountData | null
  onSuccess?: () => void
}

export function EditPropFirmAccountDialog({
  open,
  onOpenChange,
  account,
  onSuccess
}: EditPropFirmAccountDialogProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)
  const queryClient = useQueryClient()
  const scope = useQueryScope()


  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
    watch
  } = useForm<EditAccountForm>({
    resolver: zodResolver(editAccountSchema)
  })

  const formValues = watch()

  const draftKey = account?.id ? `draft-prop-firm-account-edit-${account.id}` : null

  useEffect(() => {
    if (account && open && draftKey) {
      try {
        const savedDraft = localStorage.getItem(draftKey)
        if (savedDraft) {
          const draft = JSON.parse(savedDraft)
          setValue('accountName', draft.accountName)
          setHasUnsavedChanges(true)
        } else {
          setValue('accountName', account.accountName || account.name || account.displayName || '')
        }
      } catch (error) {

        setValue('accountName', account.accountName || account.name || account.displayName || '')
      }
    }
  }, [account, open, setValue, draftKey])

  useEffect(() => {
    if (draftKey && isDirty && open) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(formValues))
        setHasUnsavedChanges(true)
      } catch (error) {

      }
    }
  }, [formValues, isDirty, draftKey, open])


  const handleClose = (forceClose = false) => {
    if (hasUnsavedChanges && isDirty && !forceClose) {
      setShowUnsavedWarning(true)
      setPendingClose(true)
    } else {
      if (draftKey && !forceClose) {
        try {
          localStorage.removeItem(draftKey)
        } catch (error) {

        }
      }
      reset()
      setHasUnsavedChanges(false)
      setPendingClose(false)
      onOpenChange(false)
    }
  }

  const handleDiscardChanges = () => {
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey)
      } catch (error) {

      }
    }
    reset()
    setHasUnsavedChanges(false)
    setShowUnsavedWarning(false)
    setPendingClose(false)
    onOpenChange(false)
  }

  const handleKeepEditing = () => {
    setShowUnsavedWarning(false)
    setPendingClose(false)
  }

  const masterAccountId = account?.currentPhaseDetails?.masterAccountId || account?.id || ''

  const updateMutation = useMutation({
    mutationFn: (data: EditAccountForm) =>
      apiRequestData<{ success: boolean }>(
        `/api/v1/prop-firm/accounts/${masterAccountId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountName: data.accountName.trim() }),
          retry: { mode: 'never' },
          operation: 'update-prop-firm-account',
        }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.propFirmAccounts(scope) })
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })

      toast.success('Account Updated', {
        description: 'Your prop firm account has been successfully updated.',
      })

      if (draftKey) {
        try {
          localStorage.removeItem(draftKey)
        } catch (error) {

        }
      }

      reset()
      setHasUnsavedChanges(false)
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      reportClientError(error, { operation: 'update-prop-firm-account', route: '/api/v1/prop-firm/accounts' })
      toast.error('Update Failed', {
        description: error instanceof Error ? error.message : 'Failed to update account',
      })
    },
    onSettled: () => {
      setIsSaving(false)
    },
  })

  const onSubmit = (data: EditAccountForm) => {
    if (!account) return
    setIsSaving(true)
    updateMutation.mutate(data)
  }

  if (!account) return null

  return (
    <>
      <Dialog open={open} onOpenChange={() => handleClose()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Building01Icon} className="h-5 w-5" strokeWidth={1.5} color="currentColor" />
              Edit Prop Firm Account
            </DialogTitle>
            <DialogDescription>
              Update your prop firm account name. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>

          <form 
            onSubmit={handleSubmit(onSubmit)} 
            onKeyDown={(e) => {

              if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                e.preventDefault()
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name *</Label>
              <Input
                id="accountName"
                placeholder="Enter account name"
                {...register('accountName')}
                disabled={isSaving}
              />
              {errors.accountName && (
                <p className="text-sm text-destructive">{errors.accountName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Prop Firm</Label>
              <Input
                value={account.propfirm || 'N/A'}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Prop firm cannot be changed
              </p>
            </div>

            {hasUnsavedChanges && isDirty && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <p className="text-sm text-warning">
                  You have unsaved changes. They will be lost if you close without saving.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => handleClose()} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !isDirty}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this account. If you close now, your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleKeepEditing}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardChanges} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
