import { create } from 'zustand'

interface DashboardEditState {
  isCustomizing: boolean
  hasUnsavedChanges: boolean
  originalLayout: any | null
  setIsCustomizing: (value: boolean) => void
  toggleCustomizing: () => void
  setHasUnsavedChanges: (value: boolean) => void
  setOriginalLayout: (layout: any) => void
  markAsChanged: () => void
  resetChanges: () => void
}

export const useDashboardEditStore = create<DashboardEditState>((set, get) => ({
  isCustomizing: false,
  hasUnsavedChanges: false,
  originalLayout: null,

  setIsCustomizing: (value: boolean) => {
    const state = get()
    if (value && !state.isCustomizing) {
      set({ isCustomizing: value })
    } else if (!value && state.isCustomizing) {
      set({ isCustomizing: value })
    } else {
      set({ isCustomizing: value })
    }
  },

  toggleCustomizing: () => {
    const current = get().isCustomizing
    get().setIsCustomizing(!current)
  },

  setHasUnsavedChanges: (value: boolean) => set({ hasUnsavedChanges: value }),

  setOriginalLayout: (layout: any) => set({ originalLayout: layout }),

  markAsChanged: () => set({ hasUnsavedChanges: true }),

  resetChanges: () => set({ hasUnsavedChanges: false, originalLayout: null })
}))
