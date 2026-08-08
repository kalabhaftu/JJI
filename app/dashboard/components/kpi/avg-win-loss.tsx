'use client'

import React from 'react'
import { WidgetCard } from '../widget-card'
import { useTradeStatistics } from '@/hooks/use-trade-statistics'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { HugeiconsIcon } from '@hugeicons/react'
import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface AvgWinLossProps {
  size?: string
}

const AvgWinLoss = React.memo(function AvgWinLoss({ size }: AvgWinLossProps) {
  const { avgWin, avgLoss, riskRewardRatio } = useTradeStatistics()
  const { formatValue, isPrivacyMode } = useDashboardDisplay()

  const total = avgWin + avgLoss
  const winPercentage = isPrivacyMode ? 50 : (total > 0 ? (avgWin / total) * 100 : 50)

  return (
    <WidgetCard isKpi>
      <div className="h-full flex flex-col justify-between">
        {}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Avg win/loss trade
          </span>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help w-4 h-4 rounded-full border border-border/60 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={InformationCircleIcon} className="h-2.5 w-2.5 text-muted-foreground/60" strokeWidth={1.5} color="currentColor" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={5} className="max-w-[200px]">
                <p className="text-xs">Average profit on winning vs losing trades. Higher ratio = better risk/reward.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {}
        <div className="flex flex-col gap-2">
          {}
          <span className="text-[1.65rem] min-[768px]:text-[1.85rem] min-[1440px]:text-3xl font-bold tracking-tight text-foreground">
            {isPrivacyMode ? '****' : riskRewardRatio.toFixed(2)}
          </span>

          {}
          <div className="space-y-1.5">
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
              <div
                className="h-full bg-profit rounded-l-full transition-all duration-500"
                style={{ width: `${winPercentage}%` }}
              />
              <div
                className="h-full bg-loss rounded-r-full transition-all duration-500"
                style={{ width: `${100 - winPercentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 text-[11px] min-[1440px]:text-xs">
              <span className="font-semibold text-profit">
                {formatValue(avgWin, { kind: 'money', sensitive: true })}
              </span>
              <span className="font-semibold text-loss">
                {formatValue(avgLoss, { kind: 'money', sensitive: true })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </WidgetCard>
  )
})

export default AvgWinLoss