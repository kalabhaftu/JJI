'use client'

import React, { useMemo } from 'react'
import { WidgetCard } from '../widget-card'
import { useData } from '@/context/data-provider'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { FireIcon, ChartIncreaseIcon, ChartDecreaseIcon, InformationCircleIcon } from '@hugeicons/core-free-icons'
import { calculateTradingOverviewKpis } from '@/lib/dashboard/analytics-calculations'
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface StreakKpiProps {
  size?: string
}

const StreakKpi = React.memo(function StreakKpi({ size }: StreakKpiProps) {
  const { formattedTrades, statistics } = useData()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)

  const streakInfo = useMemo(() => {
    if (!formattedTrades || formattedTrades.length === 0) {
      return {
        currentStreak: 0,
        isWinning: true,
        longestWinStreak: 0,
        longestLoseStreak: 0,
      }
    }

    const { streakData } = calculateTradingOverviewKpis(
      formattedTrades as any,
      breakEvenThreshold
    )

    return streakData
  }, [formattedTrades, breakEvenThreshold])

  const streakIcon = streakInfo.isWinning ? ChartIncreaseIcon : ChartDecreaseIcon

  return (
    <WidgetCard isKpi>
      <div className="h-full flex flex-col justify-between">
        {}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium text-muted-foreground">
              Trade Streak
            </span>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help w-4 h-4 rounded-full border border-border/60 flex items-center justify-center shrink-0">
                    <HugeiconsIcon icon={InformationCircleIcon} className="h-2.5 w-2.5 text-muted-foreground/60" strokeWidth={2} color="currentColor" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={5} className="max-w-[220px]">
                  <p className="text-xs">Your current consecutive win or loss streak, along with your best streaks of all time.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className={cn(
            "rounded-lg p-1.5 min-[1440px]:p-2 shrink-0",
            streakInfo.currentStreak > 0 && streakInfo.isWinning
              ? "bg-long/10"
              : streakInfo.currentStreak > 0
                ? "bg-short/10"
                : "bg-muted/10"
          )}>
            {streakInfo.currentStreak >= 3 && streakInfo.isWinning ? (
              <HugeiconsIcon icon={FireIcon} className="h-4 w-4 min-[1440px]:h-5 min-[1440px]:w-5 text-long/60" strokeWidth={2} color="currentColor" />
            ) : (
              <HugeiconsIcon icon={streakIcon} className={cn(
                "h-4 w-4 min-[1440px]:h-5 min-[1440px]:w-5",
                streakInfo.isWinning ? "text-long/60" : "text-short/60"
              )} strokeWidth={2} color="currentColor" />
            )}
          </div>
        </div>

        {}
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            {}
            <div className="flex items-baseline gap-1.5">
              <span className={cn(
                "text-[1.65rem] min-[768px]:text-[1.85rem] min-[1440px]:text-3xl font-bold tracking-tight tabular-nums",
                streakInfo.currentStreak === 0
                  ? "text-muted-foreground/50"
                  : streakInfo.isWinning
                    ? "text-long"
                    : "text-short"
              )}>
                {streakInfo.currentStreak}
              </span>
              <span className={cn(
                "text-xs font-bold",
                streakInfo.currentStreak === 0
                  ? "text-muted-foreground/30"
                  : streakInfo.isWinning
                    ? "text-long/60"
                    : "text-short/60"
              )}>
                {streakInfo.isWinning ? 'W' : 'L'}
              </span>
            </div>

            {}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50">
                Best:
              </span>
              <span className="text-[10px] font-bold text-long/70 tabular-nums">
                {streakInfo.longestWinStreak}W
              </span>
              <span className="text-[10px] text-muted-foreground/20">|</span>
              <span className="text-[10px] font-bold text-short/70 tabular-nums">
                {streakInfo.longestLoseStreak}L
              </span>
            </div>
          </div>
        </div>
      </div>
    </WidgetCard>
  )
})

export default StreakKpi
