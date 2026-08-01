'use client'

import dynamic from 'next/dynamic'
import { ReactNode } from 'react'
import { DIRECT_SYNC_STATUS } from '@/lib/integrations/direct-sync-status'

const LazyTradovateProvider = dynamic(
  () => import('@/context/tradovate-sync-context').then(m => ({ default: m.TradovateSyncContextProvider })),
  { ssr: false }
)
const LazyDxFeedProvider = dynamic(
  () => import('@/context/dxfeed-sync-context').then(m => ({ default: m.DxFeedSyncContextProvider })),
  { ssr: false }
)
const LazyRithmicProvider = dynamic(
  () => import('@/context/rithmic-sync-context').then(m => ({ default: m.RithmicSyncContextProvider })),
  { ssr: false }
)

export function SyncContextWrapper({ children }: { children: ReactNode }) {
  return (
    <LazyTradovateProvider disabled={DIRECT_SYNC_STATUS.isPaused}>
      <LazyDxFeedProvider disabled={DIRECT_SYNC_STATUS.isPaused}>
        <LazyRithmicProvider disabled={DIRECT_SYNC_STATUS.isPaused}>
          {children}
        </LazyRithmicProvider>
      </LazyDxFeedProvider>
    </LazyTradovateProvider>
  )
}
