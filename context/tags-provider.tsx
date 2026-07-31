'use client'

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { CACHE_DURATION_MEDIUM } from '@/lib/constants'

export interface TradeTag {
  id: string
  name: string
  color: string
}

interface TagsContextType {
  tags: TradeTag[]
  isLoading: boolean
  error: string | null
  getTagById: (tagId: string) => TradeTag | undefined
  getTagsByIds: (tagIds: string[]) => TradeTag[]
  refetchTags: (force?: boolean) => Promise<TradeTag[]>
}

const TagsContext = createContext<TagsContextType | undefined>(undefined)

// Cache for tags to prevent redundant fetches
let tagsCache: TradeTag[] | null = null
let lastFetchTime = 0
let fetchPromise: Promise<TradeTag[]> | null = null

export function TagsProvider({ children }: { children: React.ReactNode }) {
  const [tags, setTags] = useState<TradeTag[]>(() => tagsCache || [])
  const [isLoading, setIsLoading] = useState(!tagsCache)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchTags = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && tagsCache && (now - lastFetchTime) < CACHE_DURATION_MEDIUM) {
      setTags(tagsCache)
      setIsLoading(false)
      return tagsCache
    }

    // Deduplicate in-flight requests
    if (fetchPromise && !force) {
      const cached = await fetchPromise
      if (mountedRef.current) {
        setTags(cached)
        setIsLoading(false)
      }
      return cached
    }

    setIsLoading(true)
    setError(null)

    fetchPromise = (async () => {
      try {
        const response = await fetch('/api/v1/tags', {
          headers: { 'Cache-Control': 'no-cache' }
        })
        
        if (response.ok) {
          const data = await response.json()
          const fetchedTags = data.tags || []
          
          tagsCache = fetchedTags
          lastFetchTime = Date.now()
          
          return fetchedTags
        } else if (response.status === 401 || response.status === 403) {
          return []
        } else {
          throw new Error('Failed to fetch tags')
        }
      } catch (err) {
        if (mountedRef.current) {
          setError('Failed to fetch tags')
        }
        return tagsCache || []
      } finally {
        fetchPromise = null
      }
    })()

    const result = await fetchPromise
    if (mountedRef.current) {
      setTags(result)
      setIsLoading(false)
    }
    return result
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchTags()
    
    return () => {
      mountedRef.current = false
    }
  }, [fetchTags])

  const getTagById = (tagId: string): TradeTag | undefined => {
    return tags.find(tag => tag.id === tagId)
  }

  const getTagsByIds = (tagIds: string[]): TradeTag[] => {
    return tagIds.map(id => getTagById(id)).filter((tag): tag is TradeTag => tag !== undefined)
  }

  return (
    <TagsContext.Provider value={{ tags, isLoading, error, getTagById, getTagsByIds, refetchTags: fetchTags }}>
      {children}
    </TagsContext.Provider>
  )
}

export function useTags() {
  const context = useContext(TagsContext)
  if (context === undefined) {
    throw new Error('useTags must be used within a TagsProvider')
  }
  return context
}

