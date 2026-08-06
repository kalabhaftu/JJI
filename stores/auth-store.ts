import { create } from 'zustand'

export type AuthStatus = 'signed-out' | 'loading' | 'signed-in'

export interface AuthUser {
  id: string
  email?: string
  billingActive?: boolean
  trialActive?: boolean
  trialEndsAt?: string | null
}

export interface AuthStoreState {
  status: AuthStatus
  user: AuthUser | null
  setSession: (session: { status: AuthStatus; user?: AuthUser | null }) => void
  signOut: () => void
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  status: 'loading',
  user: null,
  setSession: (session) => set({ status: session.status, user: session.user ?? null }),
  signOut: () => set({ status: 'signed-out', user: null }),
}))
