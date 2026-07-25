'use client'

import { useMemo } from 'react'
import { useWidgetData } from '@/hooks/use-widget-data'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { useData } from '@/context/data-provider'
import { WidgetCard } from '../widget-card'
import { cn } from '@/lib/utils'

interface StatItemProps {
  label: string
  value: string
  negative?: boolean | undefined
}

function StatItem({ label, value, negative }: StatItemProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        "text-sm font-semibold tabular-nums",
        negative === true && "text-[hsl(var(--chart-loss))]",
        negative === false && "text-[hsl(var(--chart-profit))]"
      )}>
        {value}
      </span>
    </div>
  )
}

export default function PerformanceSummaryWidget() {
  const { data: summaryMetrics, isLoading: summaryLoading } = useWidgetData('performanceSummary')
  const { data: strategies = [] } = useWidgetData('pnlByStrategy')
  const { statistics } = useData()
  const { mode, formatValue } = useDashboardDisplay()

  const stats = useMemo(() => {
    if (!statistics) return null

    const totalTrades = statistics.nbTrades || 0
    const profitFactor = statistics.profitFactor || 0
    const fees = statistics.cumulativeFees || 0
    const grossPnl = statistics.cumulativePnl || 0
    const netPnl = grossPnl - Math.abs(fees)
    const expectancy = totalTrades > 0
      ? ((statistics.averageWin * statistics.nbWin) - (Math.abs(statistics.averageLoss) * statistics.nbLoss)) / totalTrades
      : 0

    return {
      totalTrades,
      profitFactor,
      expectancy,
      maxDrawdown: summaryMetrics?.maxDrawdown ?? 0,
      avgDrawdown: summaryMetrics?.avgDrawdown ?? 0,
      fees,
      net: netPnl,
      rCoverage: summaryMetrics?.rCoverage ?? { total: 0, valid: 0, all: 0 },
      grossPnl,
      winRate: statistics.winRate || 0,
      avgWin: statistics.averageWin || 0,
      avgLoss: Math.abs(statistics.averageLoss || 0),
    }
  }, [statistics, summaryMetrics])

  const topStrategies = useMemo(() => {
    if (!Array.isArray(strategies)) return []
    return [...strategies].sort((a: any, b: any) => Math.abs(Number(b.pnl || 0)) - Math.abs(Number(a.pnl || 0))).slice(0, 6)
  }, [strategies])

  if (summaryLoading) {
    return (
      <WidgetCard title="Performance">
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse w-full h-[200px] bg-muted/20 rounded-xl" />
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Performance">
      <div className="grid h-auto xl:h-full gap-4 xl:grid-cols-[1fr_1.15fr]">
        {stats ? (
          <div className="grid content-start gap-px overflow-hidden rounded-lg border border-border/25 bg-border/20 sm:grid-cols-2">
            <div className="bg-card/80 px-3 py-3"><StatItem label="Total trades" value={String(stats.totalTrades)} /></div>
            <div className="bg-card/80 px-3 py-3"><StatItem label="Win rate" value={`${stats.winRate.toFixed(1)}%`} /></div>
            <div className="bg-card/80 px-3 py-3"><StatItem label="Profit factor" value={stats.profitFactor.toFixed(2)} negative={stats.profitFactor < 1} /></div>
            <div className="bg-card/80 px-3 py-3">
              <StatItem
                label="Expectancy"
                value={formatValue(stats.expectancy, {
                  kind: mode === 'rMultiple' ? 'rMultiple' : 'money',
                  rValue: mode === 'rMultiple' ? stats.rCoverage.total / Math.max(stats.totalTrades, 1) : null,
                })}
                negative={stats.expectancy < 0 ? true : stats.expectancy > 0 ? false : undefined}
              />
            </div>
            <div className="bg-card/80 px-3 py-3"><StatItem label="Max drawdown" value={formatValue(stats.maxDrawdown * -1, { kind: 'money' })} negative={stats.maxDrawdown > 0 ? true : undefined} /></div>
            <div className="bg-card/80 px-3 py-3"><StatItem label="Avg drawdown" value={formatValue(stats.avgDrawdown * -1, { kind: 'money' })} negative={stats.avgDrawdown > 0 ? true : undefined} /></div>
            <div className="bg-card/80 px-3 py-3"><StatItem label="Avg win" value={formatValue(stats.avgWin, { kind: 'money' })} negative={false} /></div>
            <div className="bg-card/80 px-3 py-3"><StatItem label="Avg loss" value={formatValue(stats.avgLoss * -1, { kind: 'money' })} negative /></div>
            <div className="bg-card/80 px-3 py-3"><StatItem label="Fees" value={formatValue(Math.abs(stats.fees) * -1, { kind: 'money' })} negative={stats.fees !== 0 ? true : undefined} /></div>
            <div className="bg-card/80 px-3 py-3">
              <StatItem
                label={mode === 'rMultiple' ? 'Total R' : 'Net'}
                value={mode === 'rMultiple'
                  ? formatValue(stats.rCoverage.total, { kind: 'rMultiple', sensitive: false })
                  : formatValue(stats.net, { kind: 'money' })}
                negative={stats.net < 0 ? true : stats.net > 0 ? false : undefined}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-border/25 text-xs text-muted-foreground">No data</div>
        )}

        <div className="rounded-lg border border-border/25">
          <div className="flex items-center justify-between border-b border-border/25 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Strategy Performance</p>
            <p className="text-[10px] font-bold text-muted-foreground">P&L / WR</p>
          </div>
          <div className="divide-y divide-border/25">
            {topStrategies.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">No strategy data yet</p>
            ) : topStrategies.map((strategy: any) => (
              <div key={strategy.strategy} className="grid grid-cols-[minmax(0,1fr)_max-content_max-content] sm:grid-cols-[minmax(0,1fr)_86px_56px] items-center gap-2 sm:gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{strategy.strategy}</p>
                  <p className="text-[10px] text-muted-foreground">{strategy.trades} trades / {Number(strategy.profitFactor || 0).toFixed(2)} PF</p>
                </div>
                <p className={cn('text-right font-mono text-[10px] sm:text-xs font-black', strategy.pnl >= 0 ? 'text-long' : 'text-short')}>{formatValue(strategy.pnl || 0, { kind: 'money' })}</p>
                <p className="text-right font-mono text-[10px] sm:text-xs font-bold">{Number(strategy.winRate || 0).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WidgetCard>
  )
}
