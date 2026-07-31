'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUserStore } from '@/store/user-store'

export interface TradeTag {
  id: string
  name: string
  color: string
}

export function useTags() {
  const queryClient = useQueryClient()
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')

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
      const response = await fetch('/api/v1/tags')
      if (!response.ok) throw new Error('Failed to fetch tags')
      const data = await response.json()
      return data.tags || []
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
    const response = await fetch('/api/v1/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color }),
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to create tag')
    }
    const data = await response.json()
    queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) => [...(old || []), data.tag])
    return data.tag
  }

  const updateTag = async (id: string, name: string, color: string): Promise<TradeTag> => {
    if (isDemo) {
      const updatedTag = { id, name: name.trim(), color }
      queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) =>
        (old || []).map((t) => (t.id === id ? updatedTag : t))
      )
      return updatedTag
    }
    const response = await fetch(`/api/v1/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color }),
    })
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Failed to update tag')
    }
    const data = await response.json()
    queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) =>
      (old || []).map((t) => (t.id === id ? data.tag : t))
    )
    return data.tag
  }

  const deleteTag = async (id: string): Promise<void> => {
    if (isDemo) {
      queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) =>
        (old || []).filter((t) => t.id !== id)
      )
      return
    }
    const response = await fetch(`/api/v1/tags/${id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to delete tag')
    queryClient.setQueryData<TradeTag[]>(['tags', isDemo], (old) =>
      (old || []).filter((t) => t.id !== id)
    )
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tags', isDemo] })

  return { tags, isLoading, error, createTag, updateTag, deleteTag, invalidate }
}
