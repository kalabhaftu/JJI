'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ReconnectRefetcher } from '@/components/reconnect-refetcher'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Deliberately false (Supabase Realtime handles focus updates).
        // Offline recovery is handled safely by ReconnectRefetcher.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // Retry failed requests twice with exponential backoff
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        // Data considered fresh for 2 minutes
        staleTime: 2 * 60 * 1000,
        // Keep unused data in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
      },
      mutations: {
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(getQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <ReconnectRefetcher />
      {children}
    </QueryClientProvider>
  )
}
