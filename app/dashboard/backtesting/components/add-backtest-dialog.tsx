'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { AddBacktestForm } from './add-backtest-form'
import { Plus } from "lucide-react"

interface AddBacktestDialogProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (backtest: any) => Promise<void>
}

export function AddBacktestDialog({ isOpen, onClose, onAdd }: AddBacktestDialogProps) {
  const [isDirty, setIsDirty] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const handleAdd = async (backtest: any) => {
    await onAdd(backtest)
    setIsDirty(false)

  }

  const handleCloseAttempt = (openState: boolean) => {
    if (!openState && isDirty) {
      setShowCloseConfirm(true)
      return
    }

    if (!openState) {
      setIsDirty(false)
    }
    onClose()
  }

  const handleConfirmClose = () => {
    setShowCloseConfirm(false)
    setIsDirty(false)
    onClose()
  }

  return (
    <>
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard New Backtest?</AlertDialogTitle>
            <AlertDialogDescription>
              You've started entering data for a new backtest. Closing will discard your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="bg-destructive hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isOpen} onOpenChange={handleCloseAttempt}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl h-[90vh] max-h-[90vh] p-0 flex flex-col gap-0 border-border bg-background shadow-lg duration-200">
          <DialogHeader className="flex-shrink-0 bg-background border-b px-6 py-4">
            <DialogTitle className="flex items-center text-base sm:text-lg">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Add New Backtest
            </DialogTitle>
            <DialogDescription>
              Record a new backtested trade with all execution details and analysis.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
            <AddBacktestForm onAdd={handleAdd} onDirtyChange={setIsDirty} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

