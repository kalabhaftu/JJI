'use client'

import React from 'react'
import NumberFlow from '@number-flow/react'
import { WidgetCard } from '../widget-card'
import { useData } from '@/context/data-provider'
import { useWidgetData } from '@/hooks/use-widget-data'
import { cn } from '@/lib/utils'
import { Info, Wallet } from "lucide-react"
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTradeStatistics } from '@/hooks/use-trade-statistics'
import { getPnlDisplayLabel } from '@/lib/metrics/pnl'

interface AccountBalancePnlProps {
  size?: string
}

const AccountBalancePnl = React.memo(function AccountBalancePnl({ size }: AccountBalancePnlProps) {
  const { accountNumbers, formattedTrades } = useData()
  const { data: balanceInfo } = useWidgetData('accountBalancePnl')
  const { nbTrades } = useTradeStatistics()
  const { mode, formatValue, getTradeRMultipleInfo } = useDashboardDisplay()

  const totalBalance = balanceInfo?.displayBalance ?? balanceInfo?.currentBalance ?? 0
  const displayedPnl = balanceInfo?.displayPnL ?? balanceInfo?.netPnL ?? 0
  const pnlDisplayLabel = getPnlDisplayLabel(balanceInfo?.pnlDisplayMode)
  const accountChangePercent = balanceInfo?.changePercent ?? 0

  const rStats = React.useMemo(() => {
    let totalR = 0
    let validTrades = 0

    for (const trade of formattedTrades || []) {
      const rInfo = getTradeRMultipleInfo(trade)
      if (!rInfo.hasData || rInfo.value === null) continue
      totalR += rInfo.value
      validTrades += 1
    }

    return {
      totalR,
      validTrades,
      totalTrades: formattedTrades?.length || 0,
    }
  }, [formattedTrades, getTradeRMultipleInfo])

  const primaryValue = React.useMemo(() => {
    if (mode === 'percentage') {
      return formatValue(totalBalance, { kind: 'balance', precision: 2, sensitive: true })
    }
    if (mode === 'rMultiple') {
      return formatValue(rStats.totalR, {
        kind: 'rMultiple',
        precision: 2,
        sensitive: false,
        emptyLabel: '--',
      })
    }
    return formatValue(totalBalance, { kind: 'balance', compact: true, sensitive: true })
  }, [formatValue, mode, rStats.totalR, totalBalance])

  const secondaryValue = React.useMemo(() => {
    if (mode === 'percentage') {
      return {
        label: 'Performance:',
        value: formatValue(displayedPnl, { kind: 'money', precision: 2, sensitive: true }),
        tone: displayedPnl >= 0 ? 'text-profit' : 'text-loss',
        rawNumber: displayedPnl,
      }
    }
    if (mode === 'rMultiple') {
      return {
        label: 'R coverage:',
        value: `${rStats.validTrades}/${rStats.totalTrades}`,
        tone: rStats.validTrades > 0 ? 'text-foreground' : 'text-muted-foreground',
        rawNumber: null,
      }
    }
    return {
      label: `${pnlDisplayLabel}:`,
      value: formatValue(displayedPnl, { kind: 'money', compact: true, sensitive: true }),
      tone: displayedPnl >= 0 ? 'text-profit' : 'text-loss',
      rawNumber: displayedPnl,
    }
  }, [displayedPnl, formatValue, mode, pnlDisplayLabel, rStats.totalTrades, rStats.validTrades])

  // Determine if we should use NumberFlow (dollars $ mode only)
  const useNumberFlowBalance = mode === 'dollars' && typeof totalBalance === 'number'
  const useNumberFlowPnl = (mode === 'dollars' || mode === 'percentage') && typeof secondaryValue.rawNumber === 'number'

  return (
    <WidgetCard isKpi>
      <div className="h-full flex flex-col justify-between">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Account Balance & PnL
            </span>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help w-4 h-4 rounded-full border border-border/60 flex items-center justify-center shrink-0">
                    <Info className="h-2.5 w-2.5 text-muted-foreground/60" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={5} className="max-w-[200px]">
                  <p className="text-xs">
                    {accountNumbers && accountNumbers.length > 0
                      ? `Balance for ${accountNumbers.length} selected account${accountNumbers.length > 1 ? 's' : ''}.`
                      : 'Current total balance across all accounts.'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {nbTrades > 0 && (
            <div className="ml-auto flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5">
              <NumberFlow
                value={nbTrades}
                className="text-xs font-semibold text-muted-foreground"
              />
            </div>
          )}
        </div>

        {/* Main value area */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            {/* Large balance number */}
            {useNumberFlowBalance ? (
              <NumberFlow
                value={totalBalance}
                format={{ style: 'currency', currency: 'USD', notation: Math.abs(totalBalance) >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 2 }}
                className="text-[1.65rem] min-[768px]:text-[1.85rem] min-[1440px]:text-3xl font-bold tracking-tight text-foreground"
              />
            ) : (
              <span className="text-[1.65rem] min-[768px]:text-[1.85rem] min-[1440px]:text-3xl font-bold tracking-tight text-foreground">
                {primaryValue}
              </span>
            )}

            {/* Net PnL below */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{secondaryValue.label}</span>
              {useNumberFlowPnl && secondaryValue.rawNumber !== null ? (
                <NumberFlow
                  value={secondaryValue.rawNumber}
                  format={{ style: 'currency', currency: 'USD', notation: Math.abs(secondaryValue.rawNumber) >= 1000000 ? 'compact' : 'standard', maximumFractionDigits: 2, signDisplay: 'always' }}
                  className={cn('text-sm font-semibold', secondaryValue.tone)}
                />
              ) : (
                <span className={cn('text-sm font-semibold', secondaryValue.tone)}>
                  {mode === 'percentage' && accountChangePercent >= 0 ? '+' : ''}
                  {secondaryValue.value}
                </span>
              )}
            </div>
          </div>

          {/* Chart icon */}
          <div className="rounded-lg bg-primary/10 p-1.5 min-[1440px]:p-2">
            <Wallet className="h-4 w-4 min-[1440px]:h-5 min-[1440px]:w-5 text-primary/60" />
          </div>
        </div>
      </div>
    </WidgetCard>
  )
})

export default AccountBalancePnl
