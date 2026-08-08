'use client'

import React from 'react'
import { WidgetCard } from '../widget-card'
import { CircularProgress } from '@/components/ui/circular-progress'
import { useData } from '@/context/data-provider'
import { classifyOutcome, formatBreakevenBand, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { HugeiconsIcon } from '@hugeicons/react'
import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DayWinRateProps {
  size?: string
}

const DayWinRate = React.memo(function DayWinRate({ size }: DayWinRateProps) {
  const { calendarData, statistics } = useData()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)

  const { dayWinRate, winningDays, losingDays, breakEvenDays } = React.useMemo(() => {
    const dayEntries = Object.entries(calendarData)
    const total = dayEntries.length
    const winning = dayEntries.filter(
      ([_, data]) => classifyOutcome(data.pnl, breakEvenThreshold) === 'win'
    ).length
    const losing = dayEntries.filter(
      ([_, data]) => classifyOutcome(data.pnl, breakEvenThreshold) === 'loss'
    ).length
    const breakEven = total - winning - losing
    const rate = total > 0 ? Math.round((winning / total) * 1000) / 10 : 0

    return {
      dayWinRate: rate,
      winningDays: winning,
      losingDays: losing,
      breakEvenDays: breakEven,
    }
  }, [breakEvenThreshold, calendarData])

  return (
    <WidgetCard isKpi>
      <div className="h-full flex flex-col justify-between">
        {}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Day win %
          </span>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help w-4 h-4 rounded-full border border-border/60 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={InformationCircleIcon} className="h-2.5 w-2.5 text-muted-foreground/60" strokeWidth={1.5} color="currentColor" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={5} className="max-w-[200px]">
                <p className="text-xs">
                  Percentage of profitable trading days. Current break-even band: {formatBreakevenBand(breakEvenThreshold)}.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[1.65rem] min-[768px]:text-[1.85rem] min-[1440px]:text-3xl font-bold tracking-tight text-foreground">
            {dayWinRate.toFixed(2)}%
          </span>

          {}
          <CircularProgress
            value={dayWinRate}
            size={80}
            strokeWidth={7}
            className="origin-right scale-[0.82] min-[768px]:scale-[0.9] min-[1440px]:scale-100"
            type="segmented-gauge"
            segments={{ wins: winningDays, breakeven: breakEvenDays, losses: losingDays }}
            showPercentage={false}
          />
        </div>
      </div>
    </WidgetCard>
  )
})

export default DayWinRate
