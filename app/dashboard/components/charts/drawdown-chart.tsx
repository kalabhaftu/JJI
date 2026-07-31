"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip as RechartsTooltip,
} from "recharts"

const AnyAreaChart = AreaChart as any
import { WidgetCard, ChartTooltip as SharedChartTooltip } from '../widget-card'
import { useWidgetData } from '@/hooks/use-widget-data'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { formatNumber } from "@/lib/utils"
import { WidgetSize } from '@/app/dashboard/types/dashboard'
import { TrendingDown } from "lucide-react"
import { useTheme } from '@/context/theme-provider'

interface DrawdownChartProps {
  size?: WidgetSize
}

interface DrawdownDataPoint {
  date: string
  drawdown: number
}

const COLORS = {
  loss: 'hsl(var(--chart-loss))',
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))'
} as const

export default function DrawdownChart({ size = 'small-long' }: DrawdownChartProps) {
  const { data: rawChartData, isLoading } = useWidgetData('dailyCumulativePnl')
  const chartData = React.useMemo(() => rawChartData ?? [], [rawChartData])
  const { formatValue, transformValue, isPrivacyMode } = useDashboardDisplay()
  const { chartStyle } = useTheme()

  const drawdownData: DrawdownDataPoint[] = React.useMemo(() => {
    if (chartData.length === 0) return []

    let peak = -Infinity
    return chartData.map((point: any) => {
      const cumPnL = point.cumulativePnL || 0
      if (cumPnL > peak) peak = cumPnL
      const drawdown = cumPnL - peak

      return {
        date: point.date,
        drawdown: transformValue(drawdown, { kind: 'money' }) ?? 0,
      }
    })
  }, [chartData, transformValue])

  const isCompact = size === 'small' || size === 'small-long'

  if (isLoading) {
    return (
      <WidgetCard title="Drawdown">
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse w-full h-[200px] bg-muted/20 rounded-xl" />
        </div>
      </WidgetCard>
    )
  }

  if (drawdownData.length === 0) {
    return (
      <WidgetCard title="Drawdown">
        <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
          No trade data available
        </div>
      </WidgetCard>
    )
  }

  const isSharp = chartStyle === 'sharp'
  const strokeColor = COLORS.loss
  const gradientColor = COLORS.loss
  const curveType = isSharp ? 'linear' : 'monotone'

  return (
    <WidgetCard title="Drawdown">
      <div className="w-full h-full min-h-[160px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AnyAreaChart
            data={drawdownData}
            margin={{ top: 8, right: 20, left: 10, bottom: 20 }}
          >
            <defs>
              <linearGradient id="drawdownFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={gradientColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke={COLORS.grid}
              strokeOpacity={0.25}
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value + 'T00:00:00Z')
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: 'UTC'
                })
              }}
              stroke={COLORS.axis}
              fontSize={isCompact ? 10 : 11}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={40}
            />

            <YAxis
              tick={isPrivacyMode ? false : { fontSize: isCompact ? 10 : 11 }}
              tickFormatter={(value) => isPrivacyMode ? "" : formatValue(value, { kind: 'money', compact: true })}
              stroke={COLORS.axis}
              fontSize={isCompact ? 10 : 11}
              tickLine={false}
              axisLine={false}
              width={isPrivacyMode ? 10 : 55}
              domain={[(dataMin: number) => Math.floor(dataMin * 1.1), 0]}
              tickCount={6}
            />

            <ReferenceLine
              y={0}
              stroke={COLORS.axis}
              strokeDasharray="3 3"
              strokeOpacity={0.4}
            />

            <RechartsTooltip
              content={<SharedChartTooltip />}
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }}
            />

            <Area
              type={curveType}
              dataKey="drawdown"
              stroke={strokeColor}
              strokeWidth={2.5}
              fill="url(#drawdownFill)"
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: 'hsl(var(--background))'
              }}
            />
          </AnyAreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  )
}
