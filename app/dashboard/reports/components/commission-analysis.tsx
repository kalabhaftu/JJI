'use client'

import { useMemo } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts'

interface CommissionAnalysisProps {
  trades: any[]
}

export function CommissionAnalysis({ trades }: CommissionAnalysisProps) {
  const stats = useMemo(() => {
    if (!trades || trades.length === 0) return null

    let totalCommission = 0
    let totalGrossPnl = 0
    let totalNetPnl = 0
    let tradesWithCommission = 0
    const byInstrument: Record<string, { commission: number; grossPnl: number; trades: number }> = {}

    trades.forEach((trade: any) => {
      const commission = Math.abs(Number(trade.commission || 0))
      const grossPnl = Number(trade.pnl || 0)
      const netPnl = getTradeNetPnl(trade)

      totalCommission += commission
      totalGrossPnl += grossPnl
      totalNetPnl += netPnl
      if (commission > 0) tradesWithCommission++

      const instrument = (trade.instrument || trade.symbol || 'Unknown').trim()
      if (!byInstrument[instrument]) byInstrument[instrument] = { commission: 0, grossPnl: 0, trades: 0 }
      byInstrument[instrument].commission += commission
      byInstrument[instrument].grossPnl += grossPnl
      byInstrument[instrument].trades++
    })

    if (totalCommission === 0) return null

    const commissionPct = totalGrossPnl !== 0 ? (totalCommission / Math.abs(totalGrossPnl)) * 100 : 0
    const avgPerTrade = trades.length > 0 ? totalCommission / trades.length : 0

    // Top instruments by commission
    const topInstruments = Object.entries(byInstrument)
      .map(([name, data]) => ({
        name,
        commission: data.commission,
        grossPnl: data.grossPnl,
        trades: data.trades,
        avgCommission: data.trades > 0 ? data.commission / data.trades : 0,
      }))
      .filter(i => i.commission > 0)
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 8)

    return {
      totalCommission,
      totalGrossPnl,
      totalNetPnl,
      commissionPct,
      avgPerTrade,
      tradesWithCommission,
      totalTrades: trades.length,
      topInstruments,
    }
  }, [trades])

  if (!stats) return null

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-md min-w-[140px]">
          <p className="text-[10px] uppercase font-black text-muted-foreground/70 mb-2">{d.name}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Commission</span>
              <span className="font-bold font-mono text-short">{formatCurrency(d.commission)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Trades</span>
              <span className="font-bold font-mono">{d.trades}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Avg/Trade</span>
              <span className="font-bold font-mono">{formatCurrency(d.avgCommission)}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-muted/10 border border-border/40 rounded-2xl p-6">
      <h3 className="text-[10px] uppercase font-black text-muted-foreground mb-4 tracking-[0.2em]">Commission & Fee Impact</h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border/20 bg-background/30 p-3">
          <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Total Fees</p>
          <p className="text-lg font-black font-mono text-short mt-1">${formatCurrency(stats.totalCommission)}</p>
        </div>
        <div className="rounded-xl border border-border/20 bg-background/30 p-3">
          <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Fee Impact</p>
          <p className="text-lg font-black font-mono text-short mt-1">{stats.commissionPct.toFixed(1)}%</p>
          <p className="text-[9px] text-muted-foreground/50">of gross P&L</p>
        </div>
        <div className="rounded-xl border border-border/20 bg-background/30 p-3">
          <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Avg / Trade</p>
          <p className="text-lg font-black font-mono mt-1">${formatCurrency(stats.avgPerTrade)}</p>
        </div>
        <div className="rounded-xl border border-border/20 bg-background/30 p-3">
          <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Gross → Net</p>
          <p className={cn("text-lg font-black font-mono mt-1", stats.totalGrossPnl >= 0 ? "text-long" : "text-short")}>
            {formatCurrency(stats.totalGrossPnl)}
          </p>
          <p className={cn("text-[9px] font-bold font-mono", stats.totalNetPnl >= 0 ? "text-long" : "text-short")}>
            → {formatCurrency(stats.totalNetPnl)}
          </p>
        </div>
      </div>

      {/* Commission by Instrument Chart */}
      {stats.topInstruments.length > 0 && (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.topInstruments} margin={{ top: 5, right: 5, left: 5, bottom: 0 }} layout="vertical">
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                width={70}
              />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.15)' }} />
              <Bar dataKey="commission" name="Commission" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {stats.topInstruments.map((_, index) => (
                  <Cell key={`cell-${index}`} fill="hsl(var(--chart-bearish))" fillOpacity={0.6 + (index === 0 ? 0.3 : 0)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
