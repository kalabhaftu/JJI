"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"
import {
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts"
import { WidgetCard, ChartTooltip as SharedChartTooltip } from '../widget-card'
import { useWidgetData } from "@/hooks/use-widget-data"
import { useDashboardDisplay } from "@/hooks/use-dashboard-display"
import { WidgetSize } from '@/app/dashboard/types/dashboard'
import { useData } from "@/context/data-provider"
import { classifyOutcome, getBreakEvenThreshold } from "@/lib/metrics/outcome"

interface PnLByInstrumentProps {
  size?: WidgetSize
}

interface InstrumentData {
  instrument: string
  symbol?: string
  pnl: number
  trades: number
  wins: number
  losses: number
  winRate: number
}

const AnyBarChart = (RechartsPrimitive as any).BarChart as React.ComponentType<any>

const COLORS = {
  profit: 'hsl(var(--chart-profit))',
  loss: 'hsl(var(--chart-loss))',
  grid: 'hsl(var(--border))',
  axis: 'hsl(var(--muted-foreground))'
} as const

const CHART_CONFIG = {
  gridOpacity: 0.25,
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

export default function PnLByInstrument({ size = 'small-long' }: PnLByInstrumentProps) {
  const { statistics } = useData()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const { formatValue } = useDashboardDisplay()
  const { data: chartData = [], isLoading } = useWidgetData('pnlByInstrument')
  const isCompact = size === 'small' || size === 'small-long'
  const normalizedChartData = React.useMemo(() => {
    return chartData.map((item: InstrumentData, index: number) => {
      const rawLabel = String(item.instrument || item.symbol || '').trim()
      const instrument = rawLabel.length > 0 ? rawLabel : `Instrument ${index + 1}`
      return {
        ...item,
        instrument,
      }
    })
  }, [chartData])
  const labelMetrics = React.useMemo(() => {
    const maxLabelLength = normalizedChartData.reduce((max: number, item: InstrumentData) => {
      return Math.max(max, item.instrument.length)
    }, 0)
    const crowded = normalizedChartData.length >= 8 || maxLabelLength > 6

    return {
      crowded,
      xAxisHeight: crowded ? 64 : 28,
      xAxisAngle: crowded ? -38 : 0,
      textAnchor: crowded ? 'end' as const : 'middle' as const,
      bottomMargin: crowded ? 44 : 20,
      maxBarSize: crowded ? 34 : 50,
      tickFontSize: crowded ? (isCompact ? 8 : 9) : (isCompact ? 9 : 10),
    }
  }, [normalizedChartData, isCompact])


  const { yDomain, yTicks } = React.useMemo(() => {
    if (!normalizedChartData.length) {
      return {
        yDomain: [-100, 100] as [number, number],
        yTicks: [-100, -50, 0, 50, 100],
      }
    }

    const pnls = normalizedChartData.map((item: any) => item.pnl)
    const minValue = Math.min(...pnls)
    const maxValue = Math.max(...pnls)

    if (minValue >= 0) {
      const step = getNiceStep(maxValue / 4 || 1)
      const niceMax = step * 4
      return {
        yDomain: [0, niceMax] as [number, number],
        yTicks: [0, niceMax / 2, niceMax],
      }
    }

    if (maxValue <= 0) {
      const step = getNiceStep(Math.abs(minValue) / 4 || 1)
      const niceMin = step * 4
      return {
        yDomain: [-niceMin, 0] as [number, number],
        yTicks: [-niceMin, -niceMin / 2, 0],
      }
    }

    const maxAbs = Math.max(Math.abs(minValue), Math.abs(maxValue))
    const step = getNiceStep(maxAbs / 4 || 1)
    const niceMax = step * 4
    const domain: [number, number] = [-niceMax, niceMax]
    const ticks = [-niceMax, -niceMax / 2, 0, niceMax / 2, niceMax]

    return { yDomain: domain, yTicks: ticks }
  }, [normalizedChartData])

  if (isLoading) {
    return (
      <WidgetCard title="P/L by Instrument">
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse w-full h-[200px] bg-muted/20 rounded-xl" />
        </div>
      </WidgetCard>
    )
  }

  if (normalizedChartData.length === 0) {
    return (
      <WidgetCard title="P/L by Instrument">
        <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
          No trade data available
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="P/L by Instrument">
      <div className="w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
          <AnyBarChart
            data={normalizedChartData}
            margin={{ top: 20, right: 20, left: 10, bottom: labelMetrics.bottomMargin }}
            barGap={4}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={COLORS.grid}
              strokeOpacity={CHART_CONFIG.gridOpacity}
              vertical={false}
            />

            <XAxis
              dataKey="instrument"
              stroke={COLORS.axis}
              fontSize={labelMetrics.tickFontSize}
              tickLine={false}
              axisLine={false}
              tickMargin={labelMetrics.crowded ? 12 : 8}
              minTickGap={0}
              interval={0}
              angle={labelMetrics.xAxisAngle}
              textAnchor={labelMetrics.textAnchor}
              height={labelMetrics.xAxisHeight}
              tickFormatter={(value) => String(value ?? '').trim()}
              allowDuplicatedCategory
            />

            <YAxis
              tickFormatter={(value) => formatValue(value, { kind: 'money', compact: true })}
              stroke={COLORS.axis}
              fontSize={isCompact ? 10 : 11}
              tickLine={false}
              axisLine={false}
              width={50}
              domain={yDomain}
              ticks={yTicks}
            />

            <ReferenceLine
              y={0}
              stroke={COLORS.axis}
              strokeDasharray="3 3"
              strokeOpacity={CHART_CONFIG.referenceLineOpacity}
            />

            <RechartsTooltip
              content={<SharedChartTooltip />}
              cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
            />

            <Bar
              dataKey="pnl"
              radius={CHART_CONFIG.barRadius}
              maxBarSize={labelMetrics.maxBarSize}
              barSize={labelMetrics.crowded ? 22 : 30}
            >
              {normalizedChartData.map((entry: any, index: number) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    classifyOutcome(entry.pnl, breakEvenThreshold) === 'win'
                      ? COLORS.profit
                      : classifyOutcome(entry.pnl, breakEvenThreshold) === 'loss'
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