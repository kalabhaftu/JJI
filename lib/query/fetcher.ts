import { fetchWithError } from '@/lib/utils/fetch-with-error'

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const response = await fetchWithError(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  return response as T
}

export async function postFetcher<T = unknown>(
  url: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetchWithError(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return response as T
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

  tradingModels: () => ['trading-models'] as const,

  notifications: () => ['notifications'] as const,
} as const
