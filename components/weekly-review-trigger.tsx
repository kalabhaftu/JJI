'use client'

import { useEffect, useRef, useState } from 'react'
import { format, startOfWeek, subWeeks } from 'date-fns'
import { useUserStore } from '@/store/user-store'
import { isDemoSurface } from '@/lib/public-surface-routing'
import { apiRequest, apiRequestData } from '@/lib/api/client'
import { reportError } from '@/lib/observability/report-error'


export function WeeklyReviewTrigger() {
  const checkedRef = useRef(false)
  const retryCountRef = useRef(0)
  const [retryNonce, setRetryNonce] = useState(0)
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const internalUser = useUserStore(state => state.user)

  useEffect(() => {
    const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)
    if (isDemo || !supabaseUser?.id || !internalUser?.id || internalUser?.id === 'demo-user') return
    if (checkedRef.current) return
    checkedRef.current = true

    if (typeof window === 'undefined') return


    const now = new Date()
    const dayOfWeek = now.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 1 && dayOfWeek !== 6) return

    let targetWeekStart: Date
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      targetWeekStart = startOfWeek(now, { weekStartsOn: 1 })
    } else {
      targetWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    }

    const reviewWeekKey = format(targetWeekStart, 'yyyy-MM-dd')
    const sessionKey = `jji_weekly_review_checked_${internalUser.id}_${reviewWeekKey}`
    if (sessionStorage.getItem(sessionKey)) return

    const scheduleRetry = () => {
      if (retryCountRef.current >= 3) return
      retryCountRef.current += 1
      window.setTimeout(() => {
        checkedRef.current = false
        setRetryNonce(value => value + 1)
      }, retryCountRef.current * 5000)
    }

    const triggerReview = async () => {
      try {
        const profileData = await apiRequest<{ aiSettings?: { autoGenerateInsights?: boolean } }>('/api/auth/profile', {
          method: 'GET',
          retry: { mode: 'safe' },
          operation: 'load-weekly-review-profile',
        })
        if (!profileData.data?.aiSettings?.autoGenerateInsights) return

        await apiRequestData<unknown>('/api/v1/weekly-review', {
          method: 'POST',
          body: JSON.stringify({ clientDate: new Date().toISOString() }),
          retry: { mode: 'never' },
          operation: 'trigger-weekly-review',
        })
        sessionStorage.setItem(sessionKey, '1')
        retryCountRef.current = 0
        window.dispatchEvent(new CustomEvent('notifications:refresh'))
      } catch (error) {
        reportError(error, {
          surface: 'client',
          operation: 'trigger-weekly-review',
          route: '/api/v1/weekly-review',
        })
        scheduleRetry()
      }
    }

    const timer = setTimeout(triggerReview, 3000)
    return () => clearTimeout(timer)
  }, [internalUser?.id, retryNonce, supabaseUser?.id])

  return null
}
