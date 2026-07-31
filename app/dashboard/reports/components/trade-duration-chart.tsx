'use client'

import { useMemo } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { calculateTradeDurationPerformance } from '@/lib/dashboard/analytics-calculations'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts'

const COLORS = {
  bullish: 'hsl(var(--chart-bullish))',
  bearish: 'hsl(var(--chart-bearish))',
  muted: 'hsl(220, 15%, 55%)'
}

interface TradeDurationChartProps {
  trades: any[]
  breakEvenThreshold?: number
}

export function TradeDurationChart({ trades, breakEvenThreshold }: TradeDurationChartProps) {
  const durationData = useMemo(() => {
    if (!trades || trades.length === 0) return []
    return calculateTradeDurationPerformance(trades, breakEvenThreshold)
  }, [trades, breakEvenThreshold])

  if (durationData.length === 0) return null

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-md min-w-[160px]">
          <p className="text-[10px] uppercase font-black text-muted-foreground/70 mb-2">{d.bucket}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Net P&L</span>
              <span className={cn("font-bold font-mono", d.pnl >= 0 ? "text-long" : "text-short")}>
                {d.pnl >= 0 ? '+' : ''}{formatCurrency(d.pnl)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Trades</span>
              <span className="font-bold font-mono">{d.trades}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Win Rate</span>
              <span className="font-bold font-mono">{d.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Avg P&L</span>
              <span className={cn("font-bold font-mono", d.avgPnl >= 0 ? "text-long" : "text-short")}>
                {d.avgPnl >= 0 ? '+' : ''}{formatCurrency(d.avgPnl)}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-muted/10 border border-border/40 rounded-2xl p-6 h-[320px] flex flex-col">
      <h3 className="text-[10px] uppercase font-black text-muted-foreground mb-4 tracking-[0.2em]">Performance by Trade Duration</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={durationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="bucket"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              hide
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
            <Bar dataKey="pnl" name="P&L" radius={[6, 6, 0, 0]} maxBarSize={50}>
              {durationData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.pnl >= 0 ? COLORS.bullish : COLORS.bearish}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
