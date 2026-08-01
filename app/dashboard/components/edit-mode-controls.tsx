'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTemplateEditStore } from '@/store/template-edit-store'
import { useTemplates } from '@/context/template-provider'
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
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'

export default function EditModeControls() {
  const { isEditMode, hasUnsavedChanges, currentLayout, exitEditMode, discardChanges, saveChanges } = useTemplateEditStore()
  const { activeTemplate, updateLayout } = useTemplates()
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  if (!isEditMode) return null

  const handleSave = async () => {
    if (!activeTemplate || !currentLayout) return
    
    // Don't save temporary/fallback template or default template
    if (activeTemplate.id === 'default-temp' || activeTemplate.id === 'fallback') {
      setTimeout(() => toast.error('Cannot save temporary template. Please wait for templates to load.'), 0)
      return
    }
    
    if (activeTemplate.isDefault) {
      setTimeout(() => toast.error('Cannot modify default template', {
        description: 'Please create a new template to customize your layout.',
        duration: 4000,
      }), 0)
      return
    }
    
    setIsSaving(true)
    try {
      await updateLayout(activeTemplate.id, currentLayout)
      saveChanges()
      exitEditMode()
      setTimeout(() => toast.success('Template saved successfully'), 0)
    } catch (error) {
      reportClientError(error, { operation: 'save-dashboard-template-layout', route: '/dashboard' })
      const errorMessage = error instanceof Error ? error.message : 'Failed to save template'
      setTimeout(() => toast.error(errorMessage), 0)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    } else {
      exitEditMode()
    }
  }

  const handleDiscardAndExit = () => {
    discardChanges()
    exitEditMode()
    setShowUnsavedDialog(false)
    setTimeout(() => toast.info('Changes discarded'), 0)
  }

  return (
    <>
      <div className="fixed top-16 right-6 z-50 flex items-center gap-2 bg-background border border-border/50 rounded-lg shadow-lg p-2">
        <div className="px-3 py-1.5 text-sm text-muted-foreground">
          Edit Mode
          {hasUnsavedChanges && (
            <span className="ml-2 text-xs text-amber-400">
              • Unsaved changes
            </span>
          )}
        </div>
        
        <div className="h-6 w-px bg-border" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to exit without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardAndExit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
