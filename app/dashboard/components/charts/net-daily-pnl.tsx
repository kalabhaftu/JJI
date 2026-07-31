"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import { WidgetCard, ChartTooltip as SharedChartTooltip } from '../widget-card'
import { useWidgetData } from '@/hooks/use-widget-data'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { formatNumber } from "@/lib/utils"
import { WidgetSize } from '@/app/dashboard/types/dashboard'
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts'

const AnyBarChart = (RechartsPrimitive as any).BarChart as React.ComponentType<any>
import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useData } from "@/context/data-provider"
import { classifyOutcome, getBreakEvenThreshold } from "@/lib/metrics/outcome"

interface NetDailyPnLProps {
  size?: WidgetSize
}

interface ChartDataPoint {
  date: string
  pnl: number
  shortNumber: number
  longNumber: number
  wins: number
  losses: number
}

const COLORS = {
  profit: 'hsl(var(--chart-profit))',      // Emerald green
  loss: 'hsl(var(--chart-loss))',          // Red
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))',
  reference: 'hsl(var(--muted-foreground))'
} as const

const CHART_CONFIG = {
  gridOpacity: 0.25, // Increased from 0.1 for better visibility
  barRadius: [4, 4, 0, 0] as [number, number, number, number],
  referenceLineOpacity: 0.4
} as const

function getNiceStep(value: number): number {
  if (!isFinite(value) || value <= 0) return 25
  const exponent = Math.floor(Math.log10(value))
  const base = Math.pow(10, exponent)
  const fraction = value / base

  if (fraction <= 1) return 1 * base
  if (fraction <= 2) return 2 * base
  if (fraction <= 2.5) return 2.5 * base
  if (fraction <= 5) return 5 * base
  return 10 * base
}

function formatAxisValue(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 1000000) {
    return `${value < 0 ? '-' : ''}$${formatNumber(absValue / 1000000, 1)}M`
  }
  if (absValue >= 1000) {
    return `${value < 0 ? '-' : ''}$${formatNumber(absValue / 1000, 1)}k`
  }
  return `${value < 0 ? '-' : ''}$${formatNumber(absValue, 0)}`
}

export default function NetDailyPnL({ size = 'small-long' }: NetDailyPnLProps) {
  const { statistics } = useData()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const { data: rawChartData, isLoading } = useWidgetData('netDailyPnl')
  const { formatValue, transformValue, isPrivacyMode } = useDashboardDisplay()
  const chartData = React.useMemo(
    () =>
      (rawChartData ?? []).map((item: any) => ({
        ...item,
        originalPnl: item.pnl,
        pnl: transformValue(item.pnl, { kind: 'money' }) ?? 0,
      })),
    [rawChartData, transformValue]
  )

  const { yDomain, yTicks } = React.useMemo(() => {
    if (!chartData.length) {
      return {
        yDomain: [-100, 100] as [number, number],
        yTicks: [-100, -50, 0, 50, 100],
      }
    }

    const pnls = chartData.map((item: any) => item.pnl)
    const minValue = Math.min(0, ...pnls)
    const maxValue = Math.max(0, ...pnls)
    const maxAbs = Math.max(Math.abs(minValue), Math.abs(maxValue))

    if (maxAbs === 0) {
      return {
        yDomain: [-100, 100] as [number, number],
        yTicks: [-100, -50, 0, 50, 100],
      }
    }

    const step = getNiceStep(maxAbs / 4 || 1)
    const niceMax = step * 4
    const domain: [number, number] = [-niceMax, niceMax]
    const ticks = [-niceMax, -niceMax / 2, 0, niceMax / 2, niceMax]

    return { yDomain: domain, yTicks: ticks }
  }, [chartData])

  const isCompact = size === 'small' || size === 'small-long'

  if (isLoading) {
    return (
      <WidgetCard title="Net Daily P/L">
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse w-full h-[200px] bg-muted/20 rounded-xl" />
        </div>
      </WidgetCard>
    )
  }

  if (chartData.length === 0) {
    return (
      <WidgetCard title="Net Daily P/L">
        <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
          No trade data available
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Net Daily P/L">
      <div className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
        <AnyBarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          barCategoryGap="25%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLORS.grid}
            strokeOpacity={CHART_CONFIG.gridOpacity}
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
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={isPrivacyMode ? false : { fontSize: 10 }}
            tickFormatter={(value) => isPrivacyMode ? "" : formatValue(value, { kind: 'money', compact: true })}
            stroke={COLORS.axis}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={yDomain}
            ticks={yTicks}
            width={isPrivacyMode ? 10 : 50}
          />
          <RechartsTooltip
            content={<SharedChartTooltip />}
            cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
          />
          <ReferenceLine
            y={0}
            stroke={COLORS.reference}
            strokeDasharray="3 3"
            strokeOpacity={CHART_CONFIG.referenceLineOpacity}
          />
          <Bar
            dataKey="pnl"
            radius={CHART_CONFIG.barRadius}
            maxBarSize={60}
          >
            {chartData.map((entry: any, index: number) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  classifyOutcome(entry.originalPnl, breakEvenThreshold) === 'win'
                    ? COLORS.profit
                    : classifyOutcome(entry.originalPnl, breakEvenThreshold) === 'loss'
                      ? COLORS.loss
                      : 'hsl(var(--muted-foreground)/0.4)'
                }
              />
            ))}
          </Bar>
        </AnyBarChart>
      </ResponsiveContainer>
      </div>
    </WidgetCard>
  )
}
