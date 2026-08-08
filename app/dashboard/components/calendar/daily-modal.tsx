'use client'

import React, { useMemo } from 'react'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { HugeiconsIcon } from '@hugeicons/react'
import { BarChartIcon, Clock01Icon, ChartDecreaseIcon, ChartIncreaseIcon } from '@hugeicons/core-free-icons'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { CalendarEntry } from '@/app/dashboard/types/calendar'
import { useData } from '@/context/data-provider'
import { dashboardModalShell } from '@/components/ui/dashboard-modal-shell'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'

interface CalendarModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  selectedDate: Date | null
  dayData: CalendarEntry | undefined
  isLoading: boolean
}

function StatBlock({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/[0.18] px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold tracking-tight',
          tone === 'positive' && 'text-long',
          tone === 'negative' && 'text-short'
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function CalendarModal({
  isOpen,
  onOpenChange,
  selectedDate,
  dayData,
  isLoading,
}: CalendarModalProps) {
  const { formatValue } = useDashboardDisplay()
  const { statistics } = useData()

  const formattedDate = selectedDate
    ? format(selectedDate, 'EEEE, MMMM d, yyyy', { locale: enUS })
    : ''

  const summary = useMemo(() => {
    const trades = dayData?.trades ?? []
    const threshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
    const totalPnL = trades.reduce((sum, trade) => sum + getTradeNetPnl(trade), 0)
    const wins = trades.filter((trade) => classifyOutcome(getTradeNetPnl(trade), threshold) === 'win').length
    const losses = trades.filter((trade) => classifyOutcome(getTradeNetPnl(trade), threshold) === 'loss').length
    const averagePnL = trades.length > 0 ? totalPnL / trades.length : 0
    const totalMinutes = trades.reduce((sum, trade) => sum + Number((trade as any).timeInPosition || 0), 0) / 60
    const avgMinutes = trades.length > 0 ? totalMinutes / trades.length : 0

    const byInstrument = Object.entries(
      trades.reduce<Record<string, { trades: number; pnl: number }>>((acc, trade) => {
        const key = trade.instrument || 'Unknown'
        if (!acc[key]) {
          acc[key] = { trades: 0, pnl: 0 }
        }
        acc[key].trades += 1
        acc[key].pnl += getTradeNetPnl(trade)
        return acc
      }, {})
    )
      .sort((a, b) => b[1].pnl - a[1].pnl)
      .slice(0, 4)

    return {
      trades,
      totalPnL,
      wins,
      losses,
      breakEven: Math.max(trades.length - wins - losses, 0),
      averagePnL,
      avgMinutes,
      byInstrument,
    }
  }, [dayData?.trades, statistics?.breakEvenThreshold])

  if (!selectedDate) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={dashboardModalShell.daily}>
        <div className="border-b border-border/50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
              <HugeiconsIcon icon={BarChartIcon} className="h-5 w-5" strokeWidth={2} color="currentColor" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">Trade Statistics</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {formattedDate}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          ) : summary.trades.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No trades recorded for this day.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Daily notes now live exclusively in Daily Journal.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatBlock
                  label="Net P&L"
                  value={formatValue(summary.totalPnL, { kind: 'money' })}
                  hint={`${summary.trades.length} trade${summary.trades.length === 1 ? '' : 's'}`}
                  tone={summary.totalPnL >= 0 ? 'positive' : 'negative'}
                />
                <StatBlock
                  label="Win Rate"
                  value={`${((summary.wins / summary.trades.length) * 100).toFixed(1)}%`}
                  hint={`${summary.wins}W / ${summary.losses}L / ${summary.breakEven} BE`}
                />
                <StatBlock
                  label="Average Trade"
                  value={formatValue(summary.averagePnL, { kind: 'money' })}
                  tone={summary.averagePnL >= 0 ? 'positive' : 'negative'}
                />
                <StatBlock
                  label="Avg Hold"
                  value={`${Math.round(summary.avgMinutes)}m`}
                  hint="Mean time in position"
                />
              </div>

              <div className="rounded-2xl border border-border/50">
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Instrument Breakdown</p>
                    <p className="text-xs text-muted-foreground">Top contributors for the selected day</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <HugeiconsIcon icon={Clock01Icon} className="h-3.5 w-3.5" strokeWidth={2} color="currentColor" />
                    Day summary
                  </div>
                </div>

                <div className="divide-y divide-border/40">
                  {summary.byInstrument.map(([instrument, item]) => {
                    const isPositive = item.pnl >= 0
                    return (
                      <div key={instrument} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{instrument}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.trades} trade{item.trades === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPositive ? (
                            <HugeiconsIcon icon={ChartIncreaseIcon} className="h-4 w-4 text-long" strokeWidth={2} color="currentColor" />
                          ) : (
                            <HugeiconsIcon icon={ChartDecreaseIcon} className="h-4 w-4 text-short" strokeWidth={2} color="currentColor" />
                          )}
                          <span className={cn('text-sm font-semibold', isPositive ? 'text-long' : 'text-short')}>
                            {formatValue(item.pnl, { kind: 'money' })}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
