'use client'

import { useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { format, startOfWeek, subWeeks } from 'date-fns'
import { useUserStore } from '@/store/user-store'

/**
 * Invisible component that triggers weekly AI review generation.
 * Runs once per session on weekends/Mondays. No UI render.
 *
 * Flow:
 * 1. Wait for an authenticated user
 * 2. Check sessionStorage using a user/week specific key
 * 3. Check if today is Saturday, Sunday, or Monday
 * 4. Check if user has autoGenerateInsights enabled
 * 5. Call POST /api/v1/weekly-review (idempotent)
 */
export function WeeklyReviewTrigger() {
  const checkedRef = useRef(false)
  const retryCountRef = useRef(0)
  const [retryNonce, setRetryNonce] = useState(0)
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const internalUser = useUserStore(state => state.user)

  useEffect(() => {
    const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')
    if (isDemo || !supabaseUser?.id || !internalUser?.id || internalUser?.id === 'demo-user') return
    if (checkedRef.current) return
    checkedRef.current = true

    if (typeof window === 'undefined') return

    // Only trigger on Saturday(6), Sunday(0), Monday(1)
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
        const profileRes = await fetch('/api/auth/profile')
        if (!profileRes.ok) {
          scheduleRetry()
          return
        }

        const profileData = await profileRes.json()
        if (!profileData.success) {
          scheduleRetry()
          return
        }

        const aiSettings = profileData.data?.aiSettings
        if (!aiSettings?.autoGenerateInsights) return

        const response = await fetch('/api/v1/weekly-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientDate: new Date().toISOString() })
        })
        if (!response.ok) {
          scheduleRetry()
          return
        }

        const result = await response.json()
        if (result?.success) {
          sessionStorage.setItem(sessionKey, '1')
          retryCountRef.current = 0
          window.dispatchEvent(new CustomEvent('notifications:refresh'))
          return
        }
        scheduleRetry()
      } catch (error) {
        Sentry.captureException(error, { extra: { route: 'components/weekly-review-trigger' } })
        scheduleRetry()
      }
    }

    const timer = setTimeout(triggerReview, 3000)
    return () => clearTimeout(timer)
  }, [internalUser?.id, retryNonce, supabaseUser?.id])

  return null
}
