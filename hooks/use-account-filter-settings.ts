import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AccountFilterSettings, DEFAULT_FILTER_SETTINGS } from '@/types/account-filter-settings'
import { useUserStore } from '@/store/user-store'
import { isDemoSurface } from '@/lib/public-surface-routing'

const QUERY_KEY = ['account-filter-settings'] as const

async function fetchAccountFilterSettings(): Promise<AccountFilterSettings> {
  const response = await fetch('/api/v1/settings/account-filters', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch settings`)
  const data = await response.json()
  if (!data.success) throw new Error(data.error?.message || 'Failed to fetch settings')
  return data.data || DEFAULT_FILTER_SETTINGS
}

async function saveAccountFilterSettings(settings: AccountFilterSettings): Promise<AccountFilterSettings> {
  const response = await fetch('/api/v1/settings/account-filters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to save settings`)
  const data = await response.json()
  if (!data.success) throw new Error(data.error?.message || 'Failed to save settings')
  return data.data
}

export interface UseAccountFilterSettingsResult {
  settings: AccountFilterSettings
  isLoading: boolean
  isSaving: boolean
  error: string | null
  refetch: () => void
  updateSettings: (newSettings: Partial<AccountFilterSettings>) => Promise<void>
  resetToDefaults: () => Promise<void>
}

export function useAccountFilterSettings(): UseAccountFilterSettingsResult {
  const queryClient = useQueryClient()
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)

  const { data: settings = DEFAULT_FILTER_SETTINGS, isLoading, error, refetch } = useQuery({
    queryKey: [...QUERY_KEY, isDemo],
    queryFn: async () => {
      if (isDemo) {
        try {
          const cached = localStorage.getItem('settings-cache-demo')
          if (cached) {
            const parsed = JSON.parse(cached)
            return parsed || DEFAULT_FILTER_SETTINGS
          }
        } catch {
          return DEFAULT_FILTER_SETTINGS
        }
        return DEFAULT_FILTER_SETTINGS
      }
      return fetchAccountFilterSettings()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - no network call if cache is fresh
    gcTime: 1000 * 60 * 10,   // keep in memory 10 minutes
    // initialData seeds the query as if the fetch already succeeded.
    // Unlike placeholderData, this makes isLoading=false immediately
    // so the empty state never flashes while the API call is in flight.
    initialData: () => {
      if (typeof window === 'undefined') return undefined
      try {
        const key = isDemo ? 'settings-cache-demo' : 'settings-cache'
        const cached = localStorage.getItem(key)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && typeof parsed === 'object') return parsed as AccountFilterSettings
        }
      } catch {
        return undefined
      }
      return undefined
    },
    initialDataUpdatedAt: () => {
      // Treat initialData as stale immediately so a background refresh still happens,
      // but it won't block rendering or show isLoading=true.
      return 0
    },
  })

  const mutation = useMutation({
    mutationFn: async (newSettings: Partial<AccountFilterSettings>) => {
      let current = queryClient.getQueryData<AccountFilterSettings>([...QUERY_KEY, isDemo])
      if (!current) {
        try {
          if (isDemo) {
            const cached = localStorage.getItem('settings-cache-demo')
            current = cached ? JSON.parse(cached) : DEFAULT_FILTER_SETTINGS
          } else {
            current = await fetchAccountFilterSettings()
          }
        } catch {
          current = DEFAULT_FILTER_SETTINGS
        }
      }
      const baseSettings = current || DEFAULT_FILTER_SETTINGS
      const merged: AccountFilterSettings = {
        ...baseSettings,
        ...newSettings,
        updatedAt: new Date().toISOString()
      }
      if (isDemo) {
        return merged
      }
      return saveAccountFilterSettings(merged)
    },
    onSuccess: (data) => {
      queryClient.setQueryData([...QUERY_KEY, isDemo], data)
      try {
        localStorage.setItem(isDemo ? 'settings-cache-demo' : 'settings-cache', JSON.stringify(data))
      } catch {
        // ignore
      }
    },
  })

  const updateSettings = async (newSettings: Partial<AccountFilterSettings>) => {
    await mutation.mutateAsync(newSettings)
  }

  const resetToDefaults = async () => {
    await mutation.mutateAsync(DEFAULT_FILTER_SETTINGS)
  }

  return {
    settings,
    isLoading,
    isSaving: mutation.isPending,
    error: error instanceof Error ? error.message : mutation.error instanceof Error ? mutation.error.message : null,
    refetch,
    updateSettings,
    resetToDefaults,
  }
}
