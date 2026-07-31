'use client'

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'

interface JournalEntry {
  id: string
  userId: string
  accountId: string | null
  date: string
  note: string
  emotion: string | null
  createdAt: string
  updatedAt: string
}

export function useJournalData(startDate?: Date, endDate?: Date, accountId?: string | null) {
  const queryClient = useQueryClient()

  // Build query key from params for proper cache management
  const queryKey = useMemo(() => [
    'journal-data',
    startDate ? format(startDate, 'yyyy-MM-dd') : null,
    endDate ? format(endDate, 'yyyy-MM-dd') : null,
    accountId || 'all'
  ], [startDate, endDate, accountId])

  const { data: journals = {}, isLoading } = useQuery<Record<string, JournalEntry>>({
    queryKey,
    queryFn: async () => {
      if (!startDate || !endDate) return {}
      
      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      })
      if (accountId) params.append('accountId', accountId)
      
      const response = await fetch(`/api/v1/journal/list?${params}`)
      if (!response.ok) throw new Error('Failed to fetch journals')
      
      const data = await response.json()
      const journalMap: Record<string, JournalEntry> = {}
      data.journals?.forEach((journal: JournalEntry) => {
        const dateKey = format(new Date(journal.date), 'yyyy-MM-dd')
        journalMap[dateKey] = journal
      })
      return journalMap
    },
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000,
  })

  const hasJournalForDate = useCallback((date: Date): boolean => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return !!journals[dateKey]
  }, [journals])

  const getJournalForDate = useCallback((date: Date): JournalEntry | null => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return journals[dateKey] || null
  }, [journals])

  const refetch = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  return {
    journals,
    isLoading,
    hasJournalForDate,
    getJournalForDate,
    refetch
  }
}
