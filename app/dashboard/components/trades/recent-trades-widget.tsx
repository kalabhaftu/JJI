'use client'

import React, { useRef, useEffect, useState } from 'react'
import { WidgetCard } from '../widget-card'
import { useData } from '@/context/data-provider'
import { cn } from '@/lib/utils'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { getTradeNetPnl, getTradePnlByMode, normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import { useUserStore } from '@/store/user-store'

const ROW_HEIGHT = 36 // Approximate height of each trade row in pixels

export default function RecentTradesWidget() {
  const { formattedTrades, statistics } = useData()
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleRowCount, setVisibleRowCount] = useState(10) // Default fallback
  const threshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const pnlDisplayMode = normalizePnlDisplayMode(
    useUserStore((state) => state.user?.pnlDisplayMode)
  )
  const { formatValue, getTradeRMultipleInfo } = useDashboardDisplay()

  // CRITICAL FIX: Group trades first to handle partial closes correctly
  // This ensures partial closes are shown as single trades, not multiple entries
  const { groupTradesByExecution } = require('@/lib/utils')
  const groupedTrades = React.useMemo(() => {
    return groupTradesByExecution(formattedTrades)
  }, [formattedTrades, groupTradesByExecution])

  // All trades sorted newest-first
  const allRecentTrades = React.useMemo(() => {
    return groupedTrades
      .sort((a: any, b: any) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
  }, [groupedTrades])

  // Calculate how many rows can fit in the container
  useEffect(() => {
    const calculateVisibleRows = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight
        const rowsThatFit = Math.floor(containerHeight / ROW_HEIGHT)
        setVisibleRowCount(Math.max(1, rowsThatFit))
      }
    }

    calculateVisibleRows()

    // Use ResizeObserver for dynamic height changes (when user resizes widget)
    const resizeObserver = new ResizeObserver(calculateVisibleRows)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => resizeObserver.disconnect()
  }, [])

  // Only show trades that fit in the current container height
  const recentTrades = React.useMemo(() => {
    return allRecentTrades.slice(0, visibleRowCount)
  }, [allRecentTrades, visibleRowCount])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  return (
    <WidgetCard title="Recent Trades">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_auto] min-[1280px]:grid-cols-[1fr_1.2fr_auto] gap-2 min-[1280px]:gap-3 pb-2 border-b border-border/30 text-[9px] min-[1280px]:text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 shrink-0">
          <div>Date</div>
          <div>Symbol</div>
          <div className="text-right min-w-[58px] min-[1280px]:min-w-[70px]">P&L</div>
        </div>

        {/* Trades List - shows only what fits, no scrolling */}
        <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden">
          {recentTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <div className="p-3 bg-muted/30 rounded-full mb-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-50"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p className="text-sm font-bold">No recent trades</p>
              <p className="text-[10px] text-muted-foreground/50">Trades you take will appear here</p>
            </div>
          ) : (
            recentTrades.map((trade: any, index: number) => {
              const displayPnl = getTradePnlByMode(trade, pnlDisplayMode)
              const tradeRInfo = getTradeRMultipleInfo(trade)
              const outcome = classifyOutcome(getTradeNetPnl(trade), threshold)
              const isProfitable = outcome === 'win'
              const isLoss = outcome === 'loss'

              return (
                <div
                  key={trade.id || index}
                  className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_auto] min-[1280px]:grid-cols-[1fr_1.2fr_auto] gap-2 min-[1280px]:gap-3 py-2 text-[11px] min-[1280px]:text-xs hover:bg-muted/30 rounded-lg transition-colors px-1 items-center"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="text-muted-foreground/60 font-medium truncate">
                    {formatDate(trade.entryDate)}
                  </div>
                  <div className="font-bold truncate" title={trade.instrument || trade.symbol}>
                    {trade.instrument || trade.symbol}
                  </div>
                  <div
                    className={cn(
                      'text-right font-bold font-mono min-w-[58px] min-[1280px]:min-w-[70px]',
                      isProfitable
                        ? 'text-long'
                        : isLoss
                          ? 'text-short'
                          : 'text-muted-foreground'
                    )}
                  >
                    {formatValue(displayPnl, {
                      kind: 'money',
                      compact: true,
                      rValue: tradeRInfo.value,
                      emptyLabel: '--',
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </WidgetCard>
  )
}
