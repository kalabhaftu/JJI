'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { getKillzoneBadge, getTradingSession } from '@/lib/time-utils'
import { cn, formatNumber, parsePositionTime } from '@/lib/utils'
import { formatTradePrice } from '@/lib/trading/precision'
import { ChevronDown, ChevronRight, BarChart3, Eye, Pencil } from 'lucide-react'
import { formatInTimeZone } from 'date-fns-tz'
import { ExtendedTrade } from './trade-table-review'

interface TradeTableMobileCardProps {
  trade: ExtendedTrade
  timezone: string
  isSelected: boolean
  isExpanded: boolean
  canExpand: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onViewDetails: () => void
  onEdit: () => void
  onViewChart: () => void
}

export function TradeTableMobileCard({
  trade,
  timezone,
  isSelected,
  isExpanded,
  canExpand,
  onToggleSelect,
  onToggleExpand,
  onViewDetails,
  onEdit,
  onViewChart,
}: TradeTableMobileCardProps) {
  const { formatValue, getTradeRMultipleInfo, isPrivacyMode, maskSensitiveValue } = useDashboardDisplay()
  const entryDateFormatted = formatInTimeZone(
    new Date(trade.entryDate),
    timezone,
    'MMM d, yyyy HH:mm'
  )

  const closeDateFormatted = trade.closeDate
    ? formatInTimeZone(new Date(trade.closeDate), timezone, 'MMM d, yyyy HH:mm')
    : 'Open'

  const isProfitable = trade.pnl >= 0
  const positionTime = parsePositionTime(trade.timeInPosition ?? 0)
  const tradeRInfo = getTradeRMultipleInfo(trade)

  return (
    <div
      className={cn(
        "border rounded-xl p-3 sm:p-4 space-y-3 transition-all touch-manipulation",
        "active:scale-[0.99] active:bg-muted/20",
        isSelected && "ring-2 ring-primary bg-primary/5",
        canExpand && "bg-muted/30",
        isExpanded && "bg-muted/50"
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
          {canExpand && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-base">{trade.instrument}</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                  trade.side === 'BUY' || trade.side === 'LONG' || trade.side === 'B'
                    ? "bg-long/10 text-long border-long/20"
                    : "bg-short/10 text-short border-short/20"
                )}
              >
                {trade.side}
              </Badge>
              {trade.entryTime && (
                <>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-primary/20 bg-primary/5 text-primary">
                    {getTradingSession(trade.entryTime)}
                  </Badge>
                   {getKillzoneBadge(trade.entryTime, trade.symbol || undefined) && (
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-warning/20 bg-warning/5 text-warning">
                      {getKillzoneBadge(trade.entryTime, trade.symbol || undefined)}
                    </Badge>
                  )}
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isPrivacyMode ? maskSensitiveValue() : trade.accountNumber}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={cn(
            "font-bold text-lg",
            isProfitable ? "text-long" : "text-short"
          )}>
            {formatValue(trade.pnl, { kind: 'money', rValue: tradeRInfo.value })}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Entry</p>
          <p className="font-medium">{entryDateFormatted}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Exit</p>
          <p className="font-medium">{closeDateFormatted}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Entry Price</p>
          <p className="font-medium">{formatTradePrice(trade.entryPrice, trade.instrument)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Exit Price</p>
          <p className="font-medium">{formatTradePrice(trade.closePrice, trade.instrument)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Size</p>
          <p className="font-medium">{trade.quantity ? formatNumber(trade.quantity) : 'N/A'}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Duration</p>
          <p className="font-medium">{positionTime}</p>
        </div>
        {trade.commission !== 0 && (
          <div>
            <p className="text-muted-foreground text-xs">Commission</p>
            <p className="font-medium">{formatValue(trade.commission ?? 0, { kind: 'money' })}</p>
          </div>
        )}
      </div>

      {/* Actions - larger touch targets for mobile */}
      <div className="flex gap-2 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDetails}
          className="flex-1 h-10 sm:h-9 text-xs sm:text-sm touch-manipulation"
        >
          <Eye className="h-4 w-4 mr-1.5" />
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="flex-1 h-10 sm:h-9 text-xs sm:text-sm touch-manipulation"
        >
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit
        </Button>
        {(trade as any).imageOne && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewChart}
            className="flex-1 h-10 sm:h-9 text-xs sm:text-sm touch-manipulation"
          >
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Chart
          </Button>
        )}
      </div>

      {/* Expanded Content - Show child trades */}
      {isExpanded && trade.trades && trade.trades.length > 0 && (
        <div className="pl-6 pt-3 border-t space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Grouped Trades ({trade.trades.length})
          </p>
          {trade.trades.map((childTrade, idx) => {
            const childTradeRInfo = getTradeRMultipleInfo(childTrade)
            return (
            <div key={idx} className="text-xs border-l-2 border-muted-foreground/30 pl-3 py-1">
              <div className="flex justify-between">
                <span>{childTrade.instrument}</span>
                <span className={cn(
                  "font-semibold",
                  childTrade.pnl >= 0 ? "text-long" : "text-short"
                )}>
                  {formatValue(childTrade.pnl, { kind: 'money', rValue: childTradeRInfo.value })}
                </span>
              </div>
              <p className="text-muted-foreground">
                {formatInTimeZone(new Date(childTrade.entryDate), timezone, 'MMM d, HH:mm')}
              </p>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
