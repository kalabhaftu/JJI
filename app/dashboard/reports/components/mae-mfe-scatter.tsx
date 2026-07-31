'use client'

import { useMemo } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts'

const COLORS = {
  bullish: 'hsl(var(--chart-bullish))',
  bearish: 'hsl(var(--chart-bearish))',
  muted: 'hsl(220, 15%, 55%)'
}

interface MaeMfeScatterProps {
  trades: any[]
}

export function MaeMfeScatter({ trades }: MaeMfeScatterProps) {
  const { data, stats } = useMemo(() => {
    if (!trades || trades.length === 0) return { data: [], stats: null }

    const points = trades
      .filter((t: any) => t.mae != null && t.mfe != null && (t.mae !== 0 || t.mfe !== 0))
      .map((t: any) => {
        const pnl = getTradeNetPnl(t)
        return {
          mae: Math.abs(Number(t.mae)),
          mfe: Math.abs(Number(t.mfe)),
          pnl,
          instrument: t.instrument || t.symbol || '-',
          isWin: pnl > 0,
        }
      })

    if (points.length === 0) return { data: [], stats: null }

    const avgMae = points.reduce((s, p) => s + p.mae, 0) / points.length
    const avgMfe = points.reduce((s, p) => s + p.mfe, 0) / points.length
    const edgeRatio = avgMfe > 0 && avgMae > 0 ? avgMfe / avgMae : 0

    // Capture efficiency: how much of MFE was captured as actual P&L
    const wins = points.filter(p => p.isWin)
    const captureEfficiency = wins.length > 0
      ? (wins.reduce((s, p) => s + (p.mfe > 0 ? p.pnl / p.mfe : 0), 0) / wins.length) * 100
      : 0

    return {
      data: points,
      stats: {
        avgMae: avgMae,
        avgMfe: avgMfe,
        edgeRatio,
        captureEfficiency,
        totalPoints: points.length
      }
    }
  }, [trades])

  if (data.length === 0) return null

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-md min-w-[150px]">
          <p className="text-[10px] uppercase font-black text-muted-foreground/70 mb-2">{d.instrument}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">MAE</span>
              <span className="font-bold font-mono text-short">-{formatCurrency(d.mae)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">MFE</span>
              <span className="font-bold font-mono text-long">+{formatCurrency(d.mfe)}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-border/20 pt-1 mt-1">
              <span className="text-muted-foreground">P&L</span>
              <span className={cn("font-bold font-mono", d.pnl >= 0 ? "text-long" : "text-short")}>
                {d.pnl >= 0 ? '+' : ''}{formatCurrency(d.pnl)}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-muted/10 border border-border/40 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.2em]">MAE vs MFE Analysis</h3>
          <p className="text-[9px] text-muted-foreground/60 mt-0.5">Maximum Adverse / Favorable Excursion per trade</p>
        </div>
        {stats && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Avg MAE</p>
              <p className="text-sm font-black font-mono text-short">-{formatCurrency(stats.avgMae)}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Avg MFE</p>
              <p className="text-sm font-black font-mono text-long">+{formatCurrency(stats.avgMfe)}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Edge Ratio</p>
              <p className={cn("text-sm font-black font-mono", stats.edgeRatio >= 1 ? "text-long" : "text-short")}>
                {stats.edgeRatio.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Capture %</p>
              <p className="text-sm font-black font-mono text-primary">{stats.captureEfficiency.toFixed(1)}%</p>
            </div>
          </div>
        )}
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <XAxis
              type="number"
              dataKey="mae"
              name="MAE"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              label={{ value: 'MAE (Max Adverse)', position: 'insideBottom', offset: -10, fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              type="number"
              dataKey="mfe"
              name="MFE"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              label={{ value: 'MFE (Max Favorable)', angle: -90, position: 'insideLeft', offset: 5, fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <ReferenceLine
              segment={[{ x: 0, y: 0 }, { x: Math.max(...data.map(d => d.mae)), y: Math.max(...data.map(d => d.mae)) }]}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeOpacity={0.3}
            />
            <Scatter data={data} fillOpacity={0.7}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isWin ? COLORS.bullish : COLORS.bearish}
                  r={4}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
