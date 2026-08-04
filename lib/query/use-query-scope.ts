'use client'

import { useMemo } from 'react'

import { isDemoSurface } from '@/lib/public-surface-routing'
import { useUserStore } from '@/store/user-store'

import type { QueryScope } from './query-scope'

export function useQueryScope(): QueryScope {
  const userId = useUserStore((state) => state.user?.id)
  const isDemo =
    typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)

  return useMemo<QueryScope>(
    () => (isDemo ? { surface: 'demo' } : { surface: 'authenticated', ...(userId ? { userId } : {}) }),
    [isDemo, userId],
  )
}

export function isScopeReady(scope: QueryScope): boolean {
  return scope.surface === 'demo' || Boolean(scope.userId)
}
