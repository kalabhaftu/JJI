'use client'

import React from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useData } from '@/context/data-provider'
import { TradeEditPanel } from './tables/trade-edit-panel'
import { TradeDetailPanel } from './tables/trade-detail-panel'
import { ensureExtendedTrade } from '@/lib/trading/trade-formatting'

export function GlobalTradeController() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { formattedTrades, updateTrades } = useData()

  const action = searchParams.get('action')
  const tradeId = searchParams.get('tradeId')

  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('action')
    params.delete('tradeId')
    router.replace(`${pathname}?${params.toString()}` as any, { scroll: false })
  }

  const handleSave = async (updatedTrade: any) => {
    if (tradeId) {
      await updateTrades([tradeId], updatedTrade)
      handleClose()
    }
  }

  if (!action || !tradeId) return null

  const trade = formattedTrades.find((t: any) => t.id === tradeId)

  if (!trade) return null

  if (action === 'edit') {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <TradeEditPanel
          trade={ensureExtendedTrade(trade)}
          onClose={handleClose}
          onSave={handleSave}
        />
      </div>
    )
  }

  if (action === 'view') {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <TradeDetailPanel
          trade={trade}
          onClose={handleClose}
          basePath={pathname}
        />
      </div>
    )
  }

  return null
}
