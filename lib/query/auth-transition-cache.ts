'use client'

import type { QueryClient } from '@tanstack/react-query'

export interface AuthTransitionCacheCoordinator {
  beginTransition(nextUserId: string | null): void
  clearPrivateQueryData(): Promise<void>
  clearPrivateModuleCaches(): void
  clearProviderIntegrationState(): void
  completeTransition(userId: string | null): void
}

export interface AuthTransitionCacheDeps {
  queryClient: QueryClient
  clearModuleCaches?: () => void
  clearProviderState?: () => void
}

const PRIVATE_LOCAL_STORAGE_KEYS = ['jji_user_data'] as const

export function createAuthTransitionCacheCoordinator({
  queryClient,
  clearModuleCaches,
  clearProviderState,
}: AuthTransitionCacheDeps): AuthTransitionCacheCoordinator {
  return {
    beginTransition() {
      queryClient.cancelQueries()
    },

    async clearPrivateQueryData() {
      queryClient.clear()
    },

    clearPrivateModuleCaches() {
      clearModuleCaches?.()
      if (typeof window === 'undefined') return
      for (const key of PRIVATE_LOCAL_STORAGE_KEYS) {
        window.localStorage.removeItem(key)
      }
    },

    clearProviderIntegrationState() {
      clearProviderState?.()
    },

    completeTransition() {},
  }
}

export function isAuthIdentityChange(
  previousUserId: string | null | undefined,
  nextUserId: string | null | undefined,
): boolean {
  const previous = previousUserId ?? null
  const next = nextUserId ?? null
  return previous !== next
}

export async function runAuthTransition(
  coordinator: AuthTransitionCacheCoordinator,
  nextUserId: string | null,
): Promise<void> {
  coordinator.beginTransition(nextUserId)
  await coordinator.clearPrivateQueryData()
  coordinator.clearPrivateModuleCaches()
  coordinator.clearProviderIntegrationState()
  coordinator.completeTransition(nextUserId)
}
