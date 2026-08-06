import { Account } from '@/context/data-provider'
import { type InferSelectModel } from 'drizzle-orm'
import { User as schemaUser } from '@/lib/db/schema'
type User = InferSelectModel<typeof schemaUser>
import { User as SupabaseUser } from '@supabase/supabase-js'
import { create } from 'zustand'
import { UserSettingsShape } from '@/lib/user-settings'

type MergedUser = User & UserSettingsShape

const USE_24H_STORAGE_KEY = 'jji_use_24h_format'

function hasWorkingStorage(): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return false
  return typeof window.localStorage.getItem === 'function' && typeof window.localStorage.setItem === 'function'
}

function loadUse24HourFormat(): boolean {
  if (!hasWorkingStorage()) return true
  const stored = window.localStorage.getItem(USE_24H_STORAGE_KEY)
  return stored !== 'false'
}

type UserStore = {
  user: MergedUser | null
  supabaseUser: SupabaseUser | null
  accounts: Account[]
  dashboardLayout: {
    id: string
    userId: string
    desktop: any[]
    mobile: any[]
    createdAt: Date
    updatedAt: Date
  } | null
  isLoading: boolean
  isMobile: boolean
  timezone: string
  use24HourFormat: boolean
  setTimezone: (timezone: string) => void
  setUse24HourFormat: (value: boolean) => void
  setUser: (user: MergedUser | null) => void
  setSupabaseUser: (supabaseUser: SupabaseUser | null) => void
  setAccounts: (accounts: Account[]) => void
  addAccount: (account: Account) => void
  updateAccount: (accountId: string, data: Partial<Account>) => void
  removeAccount: (accountId: string) => void
  setDashboardLayout: (layout: any) => void
  updateDashboardLayout: (type: 'desktop' | 'mobile', layout: any[]) => void
  setIsLoading: (value: boolean) => void
  setIsMobile: (value: boolean) => void
  resetUser: () => void
}

export const useUserStore = create<UserStore>()((
    (set, get) => ({
      user: null,
      supabaseUser: null,
      accounts: [],
      dashboardLayout: null,
      isLoading: false,
      isMobile: false,
      timezone: 'America/New_York',
      use24HourFormat: loadUse24HourFormat(),
      setTimezone: (timezone: string) => set({ timezone }),
      setUse24HourFormat: (use24HourFormat: boolean) => {
        set({ use24HourFormat })
        if (hasWorkingStorage()) {
          window.localStorage.setItem(USE_24H_STORAGE_KEY, String(use24HourFormat))
        }
      },
      setUser: (user) => set({ user }),
      setSupabaseUser: (supabaseUser) => set({ supabaseUser }),
      setAccounts: (accounts) => set({ accounts }),
      addAccount: (account) => set((state) => ({ 
        accounts: [...state.accounts, account] 
      })),
      updateAccount: (accountId, data) => set((state) => ({
        accounts: state.accounts.map(account => 
          account.id === accountId ? { ...account, ...data } : account
        )
      })),
      removeAccount: (accountId) => set((state) => ({ 
        accounts: state.accounts.filter(account => account.id !== accountId) 
      })),
      setDashboardLayout: (layout) => set({
        dashboardLayout: {
          id: layout.id,
          userId: layout.userId,
          desktop: typeof layout.desktop === 'string' ? JSON.parse(layout.desktop) : layout.desktop,
          mobile: typeof layout.mobile === 'string' ? JSON.parse(layout.mobile) : layout.mobile,
          createdAt: layout.createdAt,
          updatedAt: layout.updatedAt
        }
      }),
      updateDashboardLayout: (type, layout) => set((state) => ({
        dashboardLayout: state.dashboardLayout ? {
          ...state.dashboardLayout,
          [type]: layout
        } : {
          id: '',
          userId: '',
          desktop: type === 'desktop' ? layout : [],
          mobile: type === 'mobile' ? layout : [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })),
      setIsLoading: (value) => set({ isLoading: value }),
      setIsMobile: (value) => set({ isMobile: value }),
      resetUser: () => set({ 
        user: null, 
        accounts: [], 
        dashboardLayout: null
      }),
    })
  )
) 