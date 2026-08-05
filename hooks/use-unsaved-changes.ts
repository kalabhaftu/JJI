'use client'

import { useCallback, useMemo, useRef } from 'react'

export interface UnsavedChangesController {
  isDirty: boolean
  requestLeave(destination: string): boolean
  confirmLeave(): void
  cancelLeave(): void
}

export function useUnsavedChanges(isDirty: boolean): UnsavedChangesController {
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty
  const pendingDestinationRef = useRef<string | null>(null)
  const leaveCommittedRef = useRef(false)

  const requestLeave = useCallback((destination: string) => {
    if (leaveCommittedRef.current || !dirtyRef.current) return true
    pendingDestinationRef.current = destination
    return false
  }, [])

  const confirmLeave = useCallback(() => {
    pendingDestinationRef.current = null
    leaveCommittedRef.current = true
  }, [])

  const cancelLeave = useCallback(() => {
    pendingDestinationRef.current = null
    leaveCommittedRef.current = false
  }, [])

  return useMemo(() => ({ isDirty: dirtyRef.current, requestLeave, confirmLeave, cancelLeave }), [isDirty, requestLeave, confirmLeave, cancelLeave])
}
