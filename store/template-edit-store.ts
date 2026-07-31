import { create } from 'zustand'
import type { WidgetLayout } from '@/server/dashboard-templates'

interface TemplateEditState {
  isEditMode: boolean
  hasUnsavedChanges: boolean
  currentLayout: WidgetLayout[] | null
  originalLayout: WidgetLayout[] | null
  
  // Actions
  enterEditMode: (layout: WidgetLayout[]) => void
  exitEditMode: () => void
  updateLayout: (layout: WidgetLayout[]) => void
  saveChanges: () => void
  discardChanges: () => void
  setUnsavedChanges: (value: boolean) => void
}

export const useTemplateEditStore = create<TemplateEditState>((set, get) => ({
  isEditMode: false,
  hasUnsavedChanges: false,
  currentLayout: null,
  originalLayout: null,

  enterEditMode: (layout) => {
    set({
      isEditMode: true,
      currentLayout: JSON.parse(JSON.stringify(layout)), // Deep clone
      originalLayout: JSON.parse(JSON.stringify(layout)),
      hasUnsavedChanges: false,
    })
  },

  exitEditMode: () => {
    set({
      isEditMode: false,
      currentLayout: null,
      originalLayout: null,
      hasUnsavedChanges: false,
    })
  },

  updateLayout: (layout) => {
    const { currentLayout } = get()
    // Reference check only - avoids JSON.stringify on every drag frame
    if (currentLayout === layout) return
    set({
      currentLayout: layout,
      hasUnsavedChanges: true,
    })
  },

  saveChanges: () => {
    const { currentLayout } = get()
    set({
      originalLayout: currentLayout ? JSON.parse(JSON.stringify(currentLayout)) : null,
      hasUnsavedChanges: false,
    })
  },

  discardChanges: () => {
    const { originalLayout } = get()
    set({
      currentLayout: originalLayout ? JSON.parse(JSON.stringify(originalLayout)) : null,
      hasUnsavedChanges: false,
    })
  },

  setUnsavedChanges: (value) => {
    set({ hasUnsavedChanges: value })
  },
}))
