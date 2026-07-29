'use client'

import { useEffect, useState } from 'react'
import { format, subDays } from 'date-fns'
import { toast } from 'sonner'
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

export function useAiWorkspaceLoader(isDemoMode: boolean | undefined) {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [savedInsights, setSavedInsights] = useState<SavedInsight[]>([])
  const [weeklyAIReviews, setWeeklyAIReviews] = useState<WeeklyReview[]>([])
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [paywallError, setPaywallError] = useState<string | null>(null)
  const [aiSettings, setAiSettings] = useState<Record<string, unknown>>({})
  const [aiConsentGranted, setAiConsentGranted] = useState(false)

  const loadWorkspaceData = async () => {
    setIsLoadingChats(true)
    setPaywallError(null)
    try {
      const [chatsRes, insightsRes, profileRes] = await Promise.all([
        fetch('/api/v1/ai/chats'), fetch('/api/v1/ai/insights'), fetch('/api/auth/profile'),
      ])

      if (chatsRes.status === 403 || insightsRes.status === 403) {
        const payload = await chatsRes.json()
        setPaywallError(payload.error?.message || 'Upgrade to a Pro plan to use the AI assistant.')
        return
      }

      if (chatsRes.ok) setChats((await chatsRes.json()).data || [])
      if (insightsRes.ok) setSavedInsights((await insightsRes.json()).data || [])
      if (profileRes.ok) {
        const payload = await profileRes.json()
        const settings = payload.data?.aiSettings && typeof payload.data.aiSettings === 'object'
          ? payload.data.aiSettings as Record<string, unknown> : {}
        setAiSettings(settings)
        setAiConsentGranted(Boolean(settings.dataProcessingConsentAt && settings.dataProcessingConsentVersion === AI_DATA_CONSENT_VERSION))
      }

      const reviewsRes = await fetch('/api/v1/weekly-review')
      let loadedReviews: WeeklyReview[] = []
      if (reviewsRes.ok) {
        const payload = await reviewsRes.json()
        if (payload.success && Array.isArray(payload.data)) loadedReviews = payload.data
      }
      if (loadedReviews.length === 0) {
        const liveRes = await fetch(`/api/v1/journal/ai-analysis?startDate=${format(subDays(new Date(), 30), 'yyyy-MM-dd')}&endDate=${format(new Date(), 'yyyy-MM-dd')}`)
        if (liveRes.ok) {
          const payload = await liveRes.json()
          if (payload.data?.analysis) loadedReviews = [payload.data.analysis]
        }
      }
      setWeeklyAIReviews(loadedReviews)
    } catch {
      toast.error('Failed to load AI Assistant data.')
    } finally {
      setIsLoadingChats(false)
    }
  }

  useEffect(() => {
    if (isDemoMode) {
      setChats(DEMO_CHATS)
      setSavedInsights(DEMO_INSIGHTS)
      setIsLoadingChats(false)
    } else {
      void loadWorkspaceData()
    }
  }, [isDemoMode])

  return {
    chats, setChats, savedInsights, setSavedInsights, weeklyAIReviews, setWeeklyAIReviews,
    isLoadingChats, paywallError, aiSettings, setAiSettings, aiConsentGranted, setAiConsentGranted,
    loadWorkspaceData,
  }
}
