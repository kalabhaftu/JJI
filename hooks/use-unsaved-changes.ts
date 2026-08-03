'use client'

import { useCallback, useEffect, useState } from 'react'

export interface UnsavedChangesController {
  isDirty: boolean
  requestLeave(destination: string): boolean
  confirmLeave(): void
  cancelLeave(): void
}

export function useUnsavedChanges(isDirty: boolean): UnsavedChangesController {
  const [confirmed, setConfirmed] = useState(false)
  const effectiveDirty = isDirty && !confirmed

  useEffect(() => {
    if (!effectiveDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [effectiveDirty])

  return {
    isDirty: effectiveDirty,
    requestLeave: useCallback((destination: string) => {
      void destination
      return !effectiveDirty
    }, [effectiveDirty]),
    confirmLeave: useCallback(() => setConfirmed(true), []),
    cancelLeave: useCallback(() => setConfirmed(false), []),
  }
}
