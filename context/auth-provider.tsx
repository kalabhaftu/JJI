'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, useCallback, useRef, startTransition } from 'react'
import { toast } from 'sonner'
import { Session } from '@supabase/supabase-js'
import { signOut } from '@/server/auth/providers'
import { createClient } from '@/lib/supabase'
import { useUserStore } from '@/store/user-store'
import { useAutoCacheCleanup } from '@/hooks/use-auto-cache-cleanup'
import { useQueryClient } from '@tanstack/react-query'
import { mutate } from 'swr'
import { useTradesStore } from '@/store/trades-store'
import { reportClientError } from '@/lib/observability/report-error'

interface AuthContextType {
  isLoading: boolean
  isAuthenticated: boolean
  session: Session | null
  user: any | null
  checkAuth: () => Promise<boolean>
  forceClearAuth: () => void
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  isAuthenticated: false,
  session: null,
  user: null,
  checkAuth: async () => false,
  forceClearAuth: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const [authCheckCache, setAuthCheckCache] = useState<{timestamp: number, isAuthenticated: boolean} | null>(null)
  const lastSyncedSessionRef = useRef<string | null>(null)
  const syncInFlightRef = useRef<Map<string, Promise<boolean>>>(new Map())
  const lastRefreshKeyRef = useRef<string | null>(null)

  const setUser = useUserStore(state => state.setUser)
  const setSupabaseUser = useUserStore(state => state.setSupabaseUser)
  const resetUser = useUserStore(state => state.resetUser)
  const user = useUserStore(state => state.user)
  

  useAutoCacheCleanup({
    ...(user?.id && { userId: user.id }),
    enabled: true
  })

  const clearBrowserAuthStorage = useCallback(() => {
    if (typeof window === 'undefined') return

    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        localStorage.removeItem(key)
      }
    })
    sessionStorage.clear()
  }, [])

  const isRecoverableSessionError = useCallback((error: unknown) => {
    if (!error || typeof error !== 'object') return false

    const maybeError = error as { message?: unknown; code?: unknown; status?: number }
    const message = typeof maybeError.message === 'string' ? maybeError.message.toLowerCase() : ''
    const code = typeof maybeError.code === 'string' ? maybeError.code.toLowerCase() : ''

    return (
      code === 'refresh_token_not_found' ||
      message.includes('refresh token not found') ||
      message.includes('invalid refresh token')
    )
  }, [])

  const shouldSyncSessionForPath = useCallback((path: string | null) => {
    if (!path) return false
    return path === '/dashboard' || path.startsWith('/dashboard/') || path === '/admin' || path.startsWith('/admin/')
  }, [])

  const syncSessionToServer = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.access_token || !nextSession.refresh_token || !nextSession.user?.id) {
      lastSyncedSessionRef.current = null
      return false
    }

    const sessionKey = [
      nextSession.user.id,
      nextSession.expires_at || '0',
      nextSession.access_token.slice(-12),
    ].join(':')

    if (lastSyncedSessionRef.current === sessionKey) {
      return true
    }

    const inFlight = syncInFlightRef.current.get(sessionKey)
    if (inFlight) {
      return inFlight
    }

    const syncPromise = (async () => {
      try {
        const response = await fetch('/api/auth/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: nextSession.access_token,
            refreshToken: nextSession.refresh_token,
          }),
        })

        if (!response.ok) {
          lastSyncedSessionRef.current = sessionKey
          return false
        }

        lastSyncedSessionRef.current = sessionKey

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SET_USER_ID', userId: nextSession.user.id })
        }
        setAuthCheckCache({
          timestamp: Date.now(),
          isAuthenticated: true
        })
        return true
      } catch {
        return false
      } finally {
        syncInFlightRef.current.delete(sessionKey)
      }
    })()

    syncInFlightRef.current.set(sessionKey, syncPromise)
    return syncPromise
  }, [])

  const isAuthCheckValid = () => {
    if (!authCheckCache) return false
    return Date.now() - authCheckCache.timestamp < 30000
  }

  const performAuthCheck = async (): Promise<boolean> => {
    if (isAuthCheckValid()) {
      return authCheckCache!.isAuthenticated
    }

    try {
      const response = await fetch('/api/auth/check', {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      })
      const data = await response.json()

      if (response.ok && data.authenticated) {
        setAuthCheckCache({
          timestamp: Date.now(),
          isAuthenticated: true
        })
        return true
      } else {
        resetUser()
        setSession(null)
        setAuthCheckCache({
          timestamp: Date.now(),
          isAuthenticated: false
        })
        return false
      }
    } catch (error) {
      resetUser()
      setSession(null)
      setAuthCheckCache({
        timestamp: Date.now(),
        isAuthenticated: false
      })
      return false
    }
  }

  const forceClearAuth = useCallback(() => {
    resetUser()
    setSession(null)
    setSupabaseUser(null)
    setAuthCheckCache(null)
    setIsLoading(false)
    lastSyncedSessionRef.current = null
    
    useTradesStore.getState().setTrades([])
    queryClient.clear()
    void mutate(() => true, undefined, { revalidate: false }).catch(() => undefined)

    localStorage.removeItem('jji_user_data')

    clearBrowserAuthStorage()


    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' })
    }
  }, [clearBrowserAuthStorage, resetUser, setSupabaseUser, queryClient])

  const refreshOnceForAuthEvent = useCallback((event: string, nextSession: Session | null) => {
    if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') {
      return
    }

    const tokenMarker = nextSession?.access_token?.slice(-12) || 'signed-out'
    const refreshKey = `${event}:${pathname || ''}:${tokenMarker}`
    if (lastRefreshKeyRef.current === refreshKey) {
      return
    }

    lastRefreshKeyRef.current = refreshKey
    startTransition(() => {
      router.refresh()
    })
  }, [pathname, router])

  useEffect(() => {
    const supabase = createClient()


    const urlParams = new URLSearchParams(window.location.search)
    const shouldForceClear = urlParams.get('deleted') === 'true' || urlParams.get('logout') === 'true'

    if (shouldForceClear) {
      const reason = urlParams.get('deleted') === 'true' ? 'account deletion' : 'logout'
      forceClearAuth()
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
      return
    }

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        setSession(session)


        if (session?.user) {
          setSupabaseUser(session.user)
          if (shouldSyncSessionForPath(pathname)) {
            await syncSessionToServer(session)
          }


        } else {
          setSupabaseUser(null)
          setUser(null)
          lastSyncedSessionRef.current = null
        }
      } catch (error) {
        reportClientError(error, { operation: 'check-auth-session', route: '/api/auth/session' })
        if (isRecoverableSessionError(error)) {
          clearBrowserAuthStorage()
          setSession(null)
          setSupabaseUser(null)
          setUser(null)
          lastSyncedSessionRef.current = null
        } else {
          setSession(null)
          setSupabaseUser(null)
          setUser(null)
          lastSyncedSessionRef.current = null
          toast.error('Session Error', {
            description: 'Failed to check authentication status',
          })
          await signOut()
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        setSession(session)


        if (session?.user) {
          setSupabaseUser(session.user)
          if (shouldSyncSessionForPath(pathname)) {
            void syncSessionToServer(session)
          }


        } else {
          setSupabaseUser(null)
          setUser(null)
          lastSyncedSessionRef.current = null
        }

        refreshOnceForAuthEvent(String(event || ''), session)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router, pathname, forceClearAuth, setSupabaseUser, setUser, clearBrowserAuthStorage, isRecoverableSessionError, syncSessionToServer, shouldSyncSessionForPath, refreshOnceForAuthEvent])

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated: !!session,
        session,
        user: session?.user || null,
        checkAuth: performAuthCheck,
        forceClearAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return {
    ...context,
    checkAuth: context.checkAuth,
    forceClearAuth: context.forceClearAuth,
  }
} 
