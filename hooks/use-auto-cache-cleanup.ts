

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { autoCleanStaleCache, clearAccountCaches, getCacheStats } from '@/lib/cache/persistent-cache'
import { queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'

interface UseAutoCacheCleanupOptions {
  userId?: string
  enabled?: boolean
}

export function useAutoCacheCleanup(options: UseAutoCacheCleanupOptions = {}) {
  const { userId, enabled = true } = options
  const hasRunRef = useRef(false)
  const lastUserIdRef = useRef<string | undefined>(undefined)
  const queryClient = useQueryClient()
  const scope = useQueryScope()

  const invalidateAccountQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
    await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.dataManagementAccounts(scope) })
  }
  
  useEffect(() => {
    if (!enabled) return
    

    if (!hasRunRef.current) {
      hasRunRef.current = true
      
      ;(async () => {
        try {
          const wasCleared = await autoCleanStaleCache()
          
          if (wasCleared) {
            await invalidateAccountQueries()
          }
        } catch (error) {

        }
      })()
    }
    
    if (userId && lastUserIdRef.current && userId !== lastUserIdRef.current) {
      clearAccountCaches()
      void invalidateAccountQueries()
    }
    
    lastUserIdRef.current = userId
  }, [userId, enabled])
  
  return {
    manualCleanup: async () => {
      await autoCleanStaleCache()
      clearAccountCaches()
      await invalidateAccountQueries()
    }
  }
}
