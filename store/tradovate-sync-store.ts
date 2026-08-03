import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TradovateAccount {
  id: number
  name: string
  nickname: string
  accountType: string
  active: boolean
  clearingHouse: string
  riskCategoryId: number
  autoLiqProfileId: number
  marginCalculationType: string
  legalStatus: string
  nickname2?: string
}

type TradovateEnvironment = 'demo' | 'live'

interface TradovateOAuthState {
  isAuthenticated: boolean
  expiresAt?: string | undefined
  accounts?: TradovateAccount[] | undefined
  lastSync?: string | undefined
  oauthState?: string | undefined
  environment: TradovateEnvironment
}

interface TradovateSyncStore extends TradovateOAuthState {

  setAuthenticated: (authenticated: boolean) => void
  setAccounts: (accounts: TradovateAccount[]) => void
  setOAuthState: (state: string) => void
  clearOAuthState: () => void
  updateLastSync: () => void
  clearAll: () => void
  setEnvironment: (environment: TradovateEnvironment) => void
  getApiBaseUrl: () => string
}

export function persistedTradovateState(state: TradovateOAuthState & { accessToken?: unknown; refreshToken?: unknown }) {
  return {
    isAuthenticated: state.isAuthenticated,
    expiresAt: state.expiresAt,
    accounts: state.accounts,
    lastSync: state.lastSync,
    environment: state.environment,
    oauthState: state.oauthState,
  }
}

export function clearTradovateLegacyStorage(storage: Pick<Storage, 'removeItem'> = sessionStorage) {
  for (const key of ['tradovate_access_token', 'tradovate_refresh_token', 'tradovate_token_expiration', 'tradovate_environment']) storage.removeItem(key)
}

export const useTradovateSyncStore = create<TradovateSyncStore>()(
  persist(
    (set, get) => ({

      isAuthenticated: false,
      expiresAt: undefined,
      accounts: undefined,
      lastSync: undefined,
      oauthState: undefined,
      environment: 'demo',


      setAuthenticated: (authenticated: boolean) => {
        set({ isAuthenticated: authenticated })
      },

      setAccounts: (accounts: TradovateAccount[]) => {
        set({ accounts })
      },

      setOAuthState: (oauthState: string) => {
        set({ oauthState })
      },

      clearOAuthState: () => {
        set({ oauthState: undefined })
      },

      updateLastSync: () => {
        set({ lastSync: new Date().toISOString() })
      },

      clearAll: () => {
        set({
          isAuthenticated: false,
          expiresAt: undefined,
          accounts: undefined,
          lastSync: undefined,
          oauthState: undefined

        })
      },

      setEnvironment: (environment: TradovateEnvironment) => {

        set({
          environment,
          isAuthenticated: false,
          expiresAt: undefined,
          accounts: undefined,
          lastSync: undefined,
          oauthState: undefined
        })
      },

      getApiBaseUrl: () => {
        const state = get()
        return state.environment === 'demo' 
          ? 'https://demo.tradovateapi.com' 
          : 'https://live.tradovateapi.com'
      },



    }),
    {
      name: 'tradovate-sync-storage',
      partialize: (state) => persistedTradovateState(state),
      onRehydrateStorage: () => () => clearTradovateLegacyStorage(),
    }
  )
)
