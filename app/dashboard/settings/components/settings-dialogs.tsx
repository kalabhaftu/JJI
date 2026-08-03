'use client'

import { Trash2 as Trash, AlertCircle as WarningCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SettingsDialogsProps = {
  deleteOpen: boolean
  onDeleteOpenChange: (open: boolean) => void
  deleteConfirmText: string
  onDeleteConfirmTextChange: (value: string) => void
  deleting: boolean
  deleteConfirmed: boolean
  onDeleteAccount: () => void
  regenerateOpen: boolean
  onRegenerateOpenChange: (open: boolean) => void
  regenerating: boolean
  onRegenerateToken: () => Promise<void>
  signOutOpen: boolean
  onSignOutOpenChange: (open: boolean) => void
  onSignOut: () => void
}

export function SettingsDialogs({
  deleteOpen: isDeleteModalOpen,
  onDeleteOpenChange: setIsDeleteModalOpen,
  deleteConfirmText,
  onDeleteConfirmTextChange: setDeleteConfirmText,
  deleting: isDeleting,
  deleteConfirmed: isDeleteConfirmed,
  onDeleteAccount: handleDeleteAccount,
  regenerateOpen: isRegenerateWebhookDialogOpen,
  onRegenerateOpenChange: setIsRegenerateWebhookDialogOpen,
  regenerating: isRegeneratingWebhook,
  onRegenerateToken: regenerateWebhookToken,
  signOutOpen: isSignOutDialogOpen,
  onSignOutOpenChange: setIsSignOutDialogOpen,
  onSignOut,
}: SettingsDialogsProps) {
  return (
    <>
      {                          }
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <WarningCircle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-left space-y-3">
                <p className="text-sm">
                  This action is <strong>irreversible</strong> and will permanently delete:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Your account and profile</li>
                  <li>All trading data and history</li>
                  <li>Prop firm settings</li>
                  <li>Dashboard layouts and preferences</li>
                  <li>All uploaded files</li>
                </ul>
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <WarningCircle className="h-4 w-4" />
                    This data cannot be recovered.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Label htmlFor="delete-confirm" className="text-sm">
              Type <code className="bg-muted px-1 py-0.5 rounded text-xs">Delete my account</code> to confirm:
            </Label>
            <Input
              id="delete-confirm"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type here..."
              className="font-mono text-sm"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false)
                setDeleteConfirmText('')
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={!isDeleteConfirmed || isDeleting}
              loading={isDeleting}
              loadingText="Deleting..."
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isRegenerateWebhookDialogOpen} onOpenChange={setIsRegenerateWebhookDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate webhook token?</AlertDialogTitle>
            <AlertDialogDescription>
              The current TradingView webhook token will be invalid immediately. Existing alerts using it will stop importing trades until you update them with the new token.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegeneratingWebhook}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRegeneratingWebhook}
              onClick={(event) => {
                event.preventDefault()
                void regenerateWebhookToken().finally(() => setIsRegenerateWebhookDialogOpen(false))
              }}
            >
              {isRegeneratingWebhook ? 'Regenerating…' : 'Regenerate token'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isSignOutDialogOpen} onOpenChange={setIsSignOutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard profile changes and sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved profile edits will be lost. Save them first or continue signing out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={onSignOut}
            >
              Discard and sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}
