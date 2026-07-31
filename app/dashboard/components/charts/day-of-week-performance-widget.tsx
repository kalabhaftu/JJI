'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useWidgetData } from '@/hooks/use-widget-data'
import { WidgetCard, ChartTooltip } from '../widget-card'

const COLORS = {
  bullish: 'hsl(var(--chart-profit))',
  bearish: 'hsl(var(--chart-loss))',
} as const

export default function DayOfWeekPerformanceWidget() {
  const { data: chartData, isLoading } = useWidgetData('dayOfWeekPerformance')

  if (isLoading) {
    return (
      <WidgetCard title="Performance by Day of Week">
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse w-full h-[150px] bg-muted/20 rounded-xl" />
        </div>
      </WidgetCard>
    )
  }

  if (chartData.length === 0) {
    return (
      <WidgetCard title="Performance by Day of Week">
        <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
          No trade data available
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Performance by Day of Week">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.15)" vertical={false} />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 700 }}
            minTickGap={20}
          />
          <YAxis
            hide
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
          />
          <Bar dataKey="Win" name="Win" fill={COLORS.bullish} radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="Loss" name="Loss" fill={COLORS.bearish} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  )
}
