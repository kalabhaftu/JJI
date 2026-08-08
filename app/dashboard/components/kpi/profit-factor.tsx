'use client'

import React from 'react'
import { WidgetCard } from '../widget-card'
import { CircularProgress } from '@/components/ui/circular-progress'
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

interface ProfitFactorProps {
  size?: string
}

const ProfitFactor = React.memo(function ProfitFactor({ size }: ProfitFactorProps) {
  const { profitFactor, grossWin, grossLosses, formattedTrades } = useTradeStatistics()
  const { isPrivacyMode } = useDashboardDisplay()
  const safeProfitFactor = Number.isFinite(profitFactor) ? profitFactor : 0
  
  const hasData = formattedTrades && formattedTrades.length > 0

  const { progressValue, color } = React.useMemo(() => {


    const progress = isPrivacyMode ? 0 : Math.min((safeProfitFactor / 3.0) * 100, 100)
    const colorValue = isPrivacyMode
      ? 'hsl(var(--border))'
      : (safeProfitFactor >= 1.0
        ? 'hsl(var(--chart-profit))'
        : 'hsl(var(--chart-loss))')

    return { progressValue: progress, color: colorValue }
  }, [safeProfitFactor, isPrivacyMode])

  return (
    <WidgetCard isKpi>
      <div className="h-full flex flex-col justify-between">
        {}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Profit factor
          </span>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-help w-4 h-4 rounded-full border border-border/60 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={InformationCircleIcon} className="h-2.5 w-2.5 text-muted-foreground/60" strokeWidth={1.5} color="currentColor" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={5} className="max-w-[220px]">
                <p className="text-xs">Total profits divided by total losses. Values above 1.0 indicate profitability.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[1.65rem] min-[768px]:text-[1.85rem] min-[1440px]:text-3xl font-bold tracking-tight text-foreground">
            {!hasData ? <span className="text-muted-foreground text-xl">--</span> : isPrivacyMode ? '****' : safeProfitFactor.toFixed(2)}
          </span>

          {}
          <CircularProgress
            value={!hasData ? 0 : progressValue}
            size={64}
            strokeWidth={6}
            color={!hasData ? 'hsl(var(--muted-foreground)/0.2)' : color}
            backgroundColor="hsl(var(--border))"
            type="circle"
            showPercentage={false}
            className="origin-right scale-[0.84] min-[768px]:scale-[0.92] min-[1440px]:scale-100"
          />
        </div>
      </div>
    </WidgetCard>
  )
})

export default ProfitFactor
