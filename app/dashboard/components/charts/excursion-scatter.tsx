'use client'

import React, { useMemo } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
  ReferenceLine
} from 'recharts'
import { useWidgetData } from '@/hooks/use-widget-data'
import { WidgetCard, CHART_COLORS } from '../widget-card'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { format } from 'date-fns'

interface ExcursionScatterProps {
  size?: any
}

export default function ExcursionScatter({ size }: ExcursionScatterProps) {
  const { data: trades, isLoading } = useWidgetData('filteredTrades')
  const { formatValue } = useDashboardDisplay()

  const scatterData = useMemo(() => {
    if (!trades || !Array.isArray(trades)) return []

    return trades
      .map((trade: any) => {
        if (trade.mae == null || trade.mfe == null) return null
        
        const pnl = getTradeNetPnl(trade)
        return {
          id: trade.id,
          mae: Math.abs(trade.mae),
          mfe: Math.abs(trade.mfe),
          pnl,
          symbol: trade.symbol || trade.instrument || 'Unknown',
          date: trade.entryDate || trade.entryTime,
          isWin: pnl > 0,
        }
      })
      .filter(Boolean)
  }, [trades])

  if (isLoading) {
    return (
      <WidgetCard title="Excursion Analysis (MAE/MFE)" className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </WidgetCard>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-md">
          <p className="font-bold text-xs mb-1">{data.symbol}</p>
          <p className="text-[10px] text-muted-foreground mb-2">
             {data.date ? format(new Date(data.date), 'MMM d, yyyy HH:mm') : ''}
          </p>
          <div className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">MAE:</span>
              <span className="font-mono">{formatValue(data.mae, { kind: 'money' })}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">MFE:</span>
              <span className="font-mono">{formatValue(data.mfe, { kind: 'money' })}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Net P&L:</span>
              <span className={`font-mono font-bold ${data.isWin ? 'text-long' : 'text-short'}`}>
                {formatValue(data.pnl, { kind: 'money' })}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <WidgetCard title="Excursion Analysis (MAE vs MFE)" className="overflow-hidden">
      <div className="w-full h-full min-h-[200px] pt-4">
        {scatterData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.4)" />
              <XAxis 
                type="number" 
                dataKey="mae" 
                name="MAE"
                tickFormatter={(val) => formatValue(val, { kind: 'money', compact: true, emptyLabel: '$0' })}
                stroke="hsl(var(--muted-foreground) / 0.5)"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Maximum Adverse Excursion', position: 'bottom', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <YAxis 
                type="number" 
                dataKey="mfe" 
                name="MFE"
                tickFormatter={(val) => formatValue(val, { kind: 'money', compact: true, emptyLabel: '$0' })}
                stroke="hsl(var(--muted-foreground) / 0.5)"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <ZAxis type="number" range={[40, 40]} />
              <Tooltip cursor={{ strokeDasharray: '3 3', stroke: 'hsl(var(--muted-foreground) / 0.5)' }} content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground) / 0.2)" />
              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground) / 0.2)" />
              <Scatter data={scatterData} fill={CHART_COLORS.bullish}>
                {scatterData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry?.isWin ? CHART_COLORS.bullish : CHART_COLORS.bearish} 
                    fillOpacity={0.6}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No MAE/MFE data available
          </div>
        )}
      </div>
    </WidgetCard>
  )
}
