"use client"

import * as React from "react"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from "recharts"

const AnyRadarChart = RadarChart as any
import { WidgetCard, ChartTooltip as SharedChartTooltip } from '../widget-card'
import { useWidgetData } from "@/hooks/use-widget-data"
import { cn } from "@/lib/utils"
import { WidgetSize } from '@/app/dashboard/types/dashboard'
import { TrendingUp, TrendingDown, Trophy, Info } from "lucide-react"

import {
  Tooltip as UiTooltip,
  TooltipContent as UiTooltipContent,
  TooltipTrigger as UiTooltipTrigger,
} from "@/components/ui/tooltip"

interface PerformanceScoreProps {
  size?: WidgetSize
}

interface MetricData {
  metric: string
  value: number
  fullMark: number
  rawValue?: number
  weight?: number
  description?: string
  target?: string
}

const COLORS = {
  profit: 'hsl(var(--chart-profit))',
  grid: 'hsl(var(--border))',
  amber: 'hsl(var(--chart-4))',
  red: 'hsl(var(--chart-loss))'
} as const

function ScoreBadge({ score, hasData }: { score: number; hasData: boolean }) {
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'text-long bg-long/10 border-long/30'
    if (s >= 40) return 'text-warning bg-warning/10 border-warning/30'
    return 'text-short bg-short/10 border-short/30'
  }

  if (!hasData) {
    return (
      <div className="p-3 rounded-xl bg-muted/30 border border-border/50 transition-colors">
        <span className="text-sm font-bold text-muted-foreground">--</span>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1 rounded-lg border",
      getScoreColor(score)
    )}>
      {score >= 60 ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      <span className="text-sm font-bold">{score}</span>
    </div>
  )
}

export default function PerformanceScore({ size = 'small-long' }: PerformanceScoreProps) {
  // DATA HOOKS (PRESERVED - DO NOT MODIFY)
  const { data: scoreData, isLoading } = useWidgetData('performanceScore')

  if (isLoading) {
    return (
      <WidgetCard title="Performance Score">
        <div className="flex items-center justify-center p-6 h-full">
          <div className="animate-pulse w-48 h-48 rounded-full bg-muted/20" />
        </div>
      </WidgetCard>
    )
  }

  const { chartData = [], overallScore = 0, hasData = false } = scoreData || {}

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-long'
    if (score >= 40) return 'text-amber-500'
    return 'text-short'
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return 'bg-long'
    if (score >= 40) return 'bg-warning'
    return 'bg-short'
  }

  const isCompact = size === 'small' || size === 'small-long'

  return (
    <WidgetCard title="Performance Score">
        {hasData ? (
          <>
            {/* Radar Chart */}
            <div className="flex-1 relative min-h-[200px]">
              <div className="absolute inset-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AnyRadarChart
                    data={chartData}
                    margin={{ top: 30, right: 40, bottom: 30, left: 40 }}
                  >
                    <PolarGrid
                      stroke={COLORS.grid}
                      strokeOpacity={0.6}
                    />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{
                        fontSize: isCompact ? 9 : 11,
                        fill: 'hsl(var(--muted-foreground))'
                      }}
                      stroke={COLORS.grid}
                      strokeOpacity={0.6}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Tooltip content={<SharedChartTooltip />} />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke={COLORS.profit}
                      fill={COLORS.profit}
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </AnyRadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score Summary */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Your Score</p>
                  <p className={cn("text-2xl font-bold", getScoreColor(overallScore))}>
                    {overallScore}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Progress</p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-colors duration-500 rounded-full", getScoreBarColor(overallScore))}
                      style={{ width: `${Math.min(overallScore, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-medium text-foreground">
                {scoreData?.reason === 'not_enough_data' ? "Not Enough Data" : "No trading data available"}
              </p>
              <p className="text-xs text-muted-foreground">
                {scoreData?.message || "Import trades to see your score"}
              </p>
            </div>
          </div>
        )}
      
    </WidgetCard>
  )
}
