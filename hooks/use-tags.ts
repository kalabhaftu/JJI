'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUserStore } from '@/store/user-store'
import { isDemoSurface } from '@/lib/public-surface-routing'
import { apiRequest } from '@/lib/api/client'

export interface TradeTag {
  id: string
  name: string
  color: string
}

export function useTags() {
  const queryClient = useQueryClient()
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)

  const { data: tags = [], isLoading, error } = useQuery<TradeTag[]>({
    queryKey: ['tags', isDemo],
    queryFn: async () => {
      if (isDemo) {
        return [
          { id: 'tag-1', name: 'Trend', color: '#3b82f6' },
          { id: 'tag-2', name: 'Reversal', color: '#ef4444' },
          { id: 'tag-3', name: 'Breakout', color: '#10b981' },
          { id: 'tag-4', name: 'Range', color: '#f59e0b' },
          { id: 'tag-5', name: 'Session Start', color: '#8b5cf6' }
        ]
      }
      const response = await apiRequest<TradeTag[]>('/api/v1/tags')
      return response.data || []
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  const createTag = async (name: string, color: string): Promise<TradeTag> => {
    if (isDemo) {
      const newTag = { id: `tag-${Date.now()}`, name: name.trim(), color }
      queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) => [...(old || []), newTag])
      return newTag
    }
    const response = await apiRequest<TradeTag>('/api/v1/tags', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), color }),
    })
    if (!response.data) throw new Error('Failed to create tag')
    queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) => [...(old || []), response.data!])
    return response.data
  }

  const updateTag = async (id: string, name: string, color: string): Promise<TradeTag> => {
    if (isDemo) {
      const updatedTag = { id, name: name.trim(), color }
      queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) =>
        (old || []).map((t) => (t.id === id ? updatedTag : t))
      )
      return updatedTag
    }
    const response = await apiRequest<TradeTag>(`/api/v1/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: name.trim(), color }),
    })
    if (!response.data) throw new Error('Failed to update tag')
    queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) =>
      (old || []).map((t) => (t.id === id ? response.data! : t))
    )
    return response.data
  }

  const deleteTag = async (id: string): Promise<void> => {
    if (isDemo) {
      queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) =>
        (old || []).filter((t) => t.id !== id)
      )
      return
    }
    await apiRequest(`/api/v1/tags/${id}`, { method: 'DELETE' })
    queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) =>
      (old || []).filter((t) => t.id !== id)
    )
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tags', isDemo] })

  return { tags, isLoading, error, createTag, updateTag, deleteTag, invalidate }
}
