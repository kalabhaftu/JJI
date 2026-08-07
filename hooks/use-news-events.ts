'use client'

import { useQuery } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { reportClientError } from '@/lib/observability/report-error'

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
  try {
    const data = await apiRequestData<NewsEvent[]>('/api/v1/news-events', {
      method: 'GET',
      retry: { mode: 'safe' },
      operation: 'load-news-events',
    })
    return data ?? []
  } catch (error) {
    reportClientError(error, { operation: 'load-news-events', route: '/api/v1/news-events' })
    throw error
  }
}

export function useNewsEvents() {
  const query = useQuery({
    queryKey: ['news-events'],
    queryFn: fetchNewsEvents,
    staleTime: 1000 * 60 * 60,
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
