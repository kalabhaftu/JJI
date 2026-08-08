'use client'

import React from 'react'
import { WidgetCard } from '../widget-card'
import { CircularProgress } from '@/components/ui/circular-progress'
import { useTradeStatistics } from '@/hooks/use-trade-statistics'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { HugeiconsIcon } from '@hugeicons/react'
import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import { formatBreakevenBand, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface TradeWinRateProps {
  size?: string
}

const TradeWinRate = React.memo(function TradeWinRate({ size }: TradeWinRateProps) {
  const {
    winRate,
    nbWin,
    nbLoss,
    nbBe: nbBreakeven,
    breakEvenThreshold,
    formattedTrades
  } = useTradeStatistics()
  const { isPrivacyMode } = useDashboardDisplay()
  const threshold = getBreakEvenThreshold(breakEvenThreshold)
  
  const hasData = formattedTrades && formattedTrades.length > 0

  return (
    <WidgetCard isKpi>
      <div className="h-full flex flex-col justify-between">
        {}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Trade win %
          </span>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help w-4 h-4 rounded-full border border-border/60 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={InformationCircleIcon} className="h-2.5 w-2.5 text-muted-foreground/60" strokeWidth={1.5} color="currentColor" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={5} className="max-w-[220px]">
                <p className="text-xs">
                  Percentage of winning trades out of tradable trades. Current break-even band: {formatBreakevenBand(threshold)}.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[1.65rem] min-[768px]:text-[1.85rem] min-[1440px]:text-3xl font-bold tracking-tight text-foreground">
            {!hasData ? <span className="text-muted-foreground text-xl">--</span> : isPrivacyMode ? '****%' : `${winRate.toFixed(2)}%`}
          </span>

          {}
          <CircularProgress
            value={!hasData ? 0 : isPrivacyMode ? 0 : winRate}
            size={80}
            strokeWidth={7}
            className="origin-right scale-[0.82] min-[768px]:scale-[0.9] min-[1440px]:scale-100"
            type="segmented-gauge"
            segments={!hasData ? { wins: 0, breakeven: 0, losses: 0 } : isPrivacyMode ? { wins: 0, breakeven: 0, losses: 0 } : { wins: nbWin, breakeven: nbBreakeven, losses: nbLoss }}
            showPercentage={false}
          />
        </div>
      </div>
    </WidgetCard>
  )
})

export default TradeWinRate
