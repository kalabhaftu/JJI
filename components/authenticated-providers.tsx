'use client'

import { AuthProvider } from '@/context/auth-provider'
import { QueryProvider } from '@/lib/query/query-provider'

export function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  )
}
