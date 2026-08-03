'use client'

import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useWidgetData } from '@/hooks/use-widget-data'
import { WidgetCard } from '../widget-card'

const COLORS = {
  Wins: 'hsl(var(--chart-profit))',
  Losses: 'hsl(var(--chart-loss))',
  Breakeven: 'hsl(220, 15%, 55%)',
} as Record<string, string>

export default function OutcomeDistributionWidget() {
  const { data: widgetData, isLoading } = useWidgetData('outcomeDistribution')

  if (isLoading) {
    return (
      <WidgetCard title="Outcome Distribution">
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse w-[150px] h-[150px] rounded-full bg-muted/20" />
        </div>
      </WidgetCard>
    )
  }

  const { data = [], totalTrades = 0 } = widgetData || {}

  if (data.length === 0) {
    return (
      <WidgetCard title="Outcome Distribution">
        <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
          No trade data available
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Outcome Distribution">
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="relative w-full max-w-[200px] aspect-square">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="85%"
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.name] || 'hsl(220, 15%, 55%)'}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0]
                  if (!item) return null
                  return (
                    <div className="bg-card border border-border p-2.5 rounded-lg shadow-md">
                      <div className="text-[10px] font-bold text-muted-foreground/70 mb-1">{item.name}</div>
                      <div className="text-sm font-mono font-black">{item.value} trades</div>
                      <div className="text-[10px] text-muted-foreground/50">
                        {((Number(item.value) / totalTrades) * 100).toFixed(1)}%
                      </div>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-black font-mono tracking-tighter">{totalTrades}</span>
            <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground/50">Trades</span>
          </div>
        </div>

        {}
        <div className="flex items-center gap-4">
          {data.map((entry: any) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: COLORS[entry.name] || 'hsl(220, 15%, 55%)' }}
              />
              <span className="text-[10px] font-bold text-muted-foreground">
                {entry.name} ({entry.value})
              </span>
            </div>
          ))}
        </div>
      </div>
    </WidgetCard>
  )
}
