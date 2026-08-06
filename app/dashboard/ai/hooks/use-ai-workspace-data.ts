'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { toast } from 'sonner'
import { apiRequest, apiRequestData, ApiClientError } from '@/lib/api/client'
import { queryKeys, queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
import { AI_DATA_CONSENT_VERSION } from '@/lib/user-settings'
import type { ChatSession, SavedInsight, WeeklyReview } from '../types'

const DEMO_CHATS: ChatSession[] = [
  {
    id: 'demo-1', title: 'Review Risk on NQ & ES', isPinned: true, isArchived: false,
    accounts: ['demo-funded'], dateRange: 'last-30-days', customFrom: null, customTo: null,
    dataSources: ['trades', 'statistics'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-2', title: 'Psychology review: anxious days', isPinned: false, isArchived: false,
    accounts: ['demo-personal'], dateRange: 'last-90-days', customFrom: null, customTo: null,
    dataSources: ['journals'], createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
]

const DEMO_INSIGHTS: SavedInsight[] = [{
  id: 'insight-1', title: 'Revenge Trading Pattern Identified',
  content: 'Data shows a 73% loss rate on trades taken within 45 minutes of a losing trade. Sizing is 1.5x larger on average due to revenge impulse.',
  category: 'mistake', createdAt: new Date().toISOString(),
}]

export function useAiWorkspaceData(isDemoMode: boolean | undefined) {
  const scope = useQueryScope()
  const queryClient = useQueryClient()
  const enabled = !isDemoMode && isScopeReady(scope)

  const chatsQuery = useQuery<ChatSession[]>({
    queryKey: queryKeys.aiChats(scope),
    queryFn: async () => {
      const data = await apiRequestData<ChatSession[] | null>('/api/v1/ai/chats', {
        retry: { mode: 'safe' },
        operation: 'load-ai-chats',
      })
      return Array.isArray(data) ? data : []
    },
    enabled,
    ...(isDemoMode ? { initialData: DEMO_CHATS } : {}),
    staleTime: 5 * 60 * 1000,
  })

  const insightsQuery = useQuery<SavedInsight[]>({
    queryKey: queryKeys.aiInsights(scope),
    queryFn: async () => {
      const data = await apiRequestData<SavedInsight[] | null>('/api/v1/ai/insights', {
        retry: { mode: 'safe' },
        operation: 'load-ai-insights',
      })
      return Array.isArray(data) ? data : []
    },
    enabled,
    ...(isDemoMode ? { initialData: DEMO_INSIGHTS } : {}),
    staleTime: 5 * 60 * 1000,
  })

  const reviewsQuery = useQuery<WeeklyReview[]>({
    queryKey: queryKeys.aiReviews(scope),
    queryFn: async () => {
      const data = await apiRequestData<WeeklyReview[] | null>('/api/v1/weekly-review', {
        retry: { mode: 'safe' },
        operation: 'load-weekly-reviews',
      })
      if (Array.isArray(data) && data.length > 0) return data
      const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      const endDate = format(new Date(), 'yyyy-MM-dd')
      const fallback = await apiRequestData<{ analysis?: WeeklyReview } | null>(
        `/api/v1/journal/ai-analysis?startDate=${startDate}&endDate=${endDate}`,
        { retry: { mode: 'safe' }, operation: 'load-ai-analysis' },
      )
      return fallback?.analysis ? [fallback.analysis] : []
    },
    enabled,
    initialData: [],
    staleTime: 5 * 60 * 1000,
  })

  const profileQuery = useQuery<Record<string, unknown>>({
    queryKey: queryKeys.aiProfile(scope),
    queryFn: async () => {
      const payload = await apiRequestData<{ aiSettings?: Record<string, unknown> } | null>(
        '/api/auth/profile',
        { retry: { mode: 'safe' }, operation: 'load-profile' },
      )
      const settings = payload?.aiSettings && typeof payload.aiSettings === 'object'
        ? payload.aiSettings
        : {}
      return settings
    },
    enabled,
    initialData: {},
    staleTime: 5 * 60 * 1000,
  })

  const chats = chatsQuery.data ?? []
  const savedInsights = insightsQuery.data ?? []
  const weeklyAIReviews = reviewsQuery.data ?? []
  const isLoadingChats = chatsQuery.isLoading
  const aiSettings = profileQuery.data ?? {}

  const paywallError = (() => {
    for (const query of [chatsQuery, insightsQuery]) {
      if (query.error instanceof ApiClientError && query.error.kind === 'forbidden') {
        return query.error.message
      }
    }
    return null
  })()

  const aiConsentGranted = Boolean(
    aiSettings.dataProcessingConsentAt &&
    aiSettings.dataProcessingConsentVersion === AI_DATA_CONSENT_VERSION,
  )

  const loadErrorToastShown = useRef(false)
  useEffect(() => {
    const loadError = chatsQuery.error ?? insightsQuery.error ?? profileQuery.error
    if (loadError && !loadErrorToastShown.current) {
      loadErrorToastShown.current = true
      if (loadError instanceof ApiClientError && loadError.kind === 'forbidden') return
      toast.error('Failed to load AI Assistant data.')
    }
  }, [chatsQuery.error, insightsQuery.error, profileQuery.error])

  const updateChats = (updater: (prev: ChatSession[] | undefined) => ChatSession[]) => {
    queryClient.setQueryData(queryKeys.aiChats(scope), updater)
  }

  const updateInsights = (updater: (prev: SavedInsight[] | undefined) => SavedInsight[]) => {
    queryClient.setQueryData(queryKeys.aiInsights(scope), updater)
  }

  const setWeeklyAIReviews = (reviews: WeeklyReview[]) => {
    queryClient.setQueryData(queryKeys.aiReviews(scope), reviews)
  }

  const refetchChats = () => {
    void chatsQuery.refetch()
  }

  const refreshProfile = () => {
    return queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.aiProfile(scope) })
  }

  const saveConsent = async (consentAt: string) => {
    const nextSettings = {
      ...aiSettings,
      dataProcessingConsentAt: consentAt,
      dataProcessingConsentVersion: AI_DATA_CONSENT_VERSION,
    }
    await apiRequest('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ aiSettings: nextSettings }),
      retry: { mode: 'never' },
      operation: 'save-ai-data-consent',
    })
    queryClient.setQueryData(queryKeys.aiProfile(scope), nextSettings)
  }

  const revokeConsent = () => {
    queryClient.setQueryData(queryKeys.aiProfile(scope), (prev: Record<string, unknown> | undefined) => ({
      ...(prev ?? {}),
      dataProcessingConsentAt: undefined,
      dataProcessingConsentVersion: undefined,
    }))
  }

  return {
    chats,
    savedInsights,
    weeklyAIReviews,
    isLoadingChats,
    paywallError,
    aiConsentGranted,
    updateChats,
    updateInsights,
    setWeeklyAIReviews,
    refetchChats,
    refreshProfile,
    saveConsent,
    revokeConsent,
  }
}
