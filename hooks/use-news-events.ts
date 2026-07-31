'use client'

import { useQuery } from '@tanstack/react-query'

export interface NewsEvent {
  id: string
  name: string
  category: string
  country: string
  description: string
  isRedFolder?: boolean
  impact?: 'high' | 'medium' | 'low'
}

async function fetchNewsEvents(): Promise<NewsEvent[]> {
  const res = await fetch('/api/v1/news-events')
  if (!res.ok) throw new Error('Failed to fetch news events')
  return res.json()
}

export function useNewsEvents() {
  const query = useQuery({
    queryKey: ['news-events'],
    queryFn: fetchNewsEvents,
    staleTime: 1000 * 60 * 60, // 1 hour - data is static
  })

  const getNewsById = (id: string): NewsEvent | undefined =>
    query.data?.find((e) => e.id === id)

  return {
    newsEvents: query.data ?? [],
    getNewsById,
    isLoading: query.isLoading,
    error: query.error,
  }
}
