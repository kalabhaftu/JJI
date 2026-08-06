import { apiRequestData } from '@/lib/api/client'

export async function fetcher<T = unknown>(url: string, signal?: AbortSignal): Promise<T> {
  return apiRequestData<T>(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(signal ? { signal } : {}),
    retry: { mode: 'safe' },
  })
}

export async function postFetcher<T = unknown>(
  url: string,
  body: Record<string, unknown>
): Promise<T> {
  return apiRequestData<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    retry: { mode: 'never' },
  })
}

const queryKeys = {
  stats: (filters?: Record<string, unknown>) =>
    ['dashboard-stats', filters ?? {}] as const,

  trades: (filters?: Record<string, unknown>) =>
    ['trades', filters ?? {}] as const,
  trade: (id: string) => ['trade', id] as const,

  accounts: () => ['accounts'] as const,
  accountStats: (filters?: Record<string, unknown>) =>
    ['account-stats', filters ?? {}] as const,

  userProfile: () => ['user-profile'] as const,

  tags: () => ['tags'] as const,

  journal: (params?: Record<string, unknown>) =>
    ['journal', params ?? {}] as const,
  journalDaily: (date: string) => ['journal-daily', date] as const,

  reportStats: (filters?: Record<string, unknown>) =>
    ['report-stats', filters ?? {}] as const,

  notifications: () => ['notifications'] as const,
} as const
