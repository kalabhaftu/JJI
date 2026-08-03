'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { TradingViewAdvancedChart } from '@/components/tradingview/tradingview-advanced-chart'
import { TradingViewErrorBoundary } from '@/components/tradingview/tradingview-error-boundary'
import { ExtendedTrade } from './trade-table-review'
import { formatTimeInZone, DEFAULT_TIMEZONE } from '@/lib/time-utils'
import { useUserStore } from '@/store/user-store'

interface TradeChartModalProps {
  isOpen: boolean
  onClose: () => void
  trade: ExtendedTrade | null
}

function TradeChartModal({ isOpen, onClose, trade }: TradeChartModalProps) {
  const timezone = useUserStore(state => state.timezone)
  

  const modalKey = React.useMemo(() => {
    return trade ? `${trade.id}_${trade.entryDate}_${trade.closeDate}` : 'empty'
  }, [trade])

  if (!trade || !trade.entryDate || !trade.closeDate || !trade.entryPrice || !trade.closePrice) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Invalid trade data. Please ensure the trade has valid entry and exit dates, and prices.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }


  const symbol = trade.instrument || trade.symbol || 'UNKNOWN'
  const entryTime = new Date(trade.entryDate)
  const exitTime = new Date(trade.closeDate)


  if (isNaN(entryTime.getTime()) || isNaN(exitTime.getTime())) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Invalid trade dates. Please check the entry and exit dates.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const entryPrice = parseFloat(String(trade.entryPrice))
  const exitPrice = parseFloat(String(trade.closePrice))


  if (isNaN(entryPrice) || isNaN(exitPrice)) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Invalid trade prices. Please check the entry and exit prices.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const side = trade.side?.toUpperCase() || 'LONG'


  const timeDiff = exitTime.getTime() - entryTime.getTime()


  if (timeDiff <= 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Entry time must be before exit time.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const hours = timeDiff / (1000 * 60 * 60)

  let interval = '5'
  if (hours < 1) {
    interval = '1'
  } else if (hours < 4) {
    interval = '5'
  } else if (hours < 24) {
    interval = '15'
  } else if (hours < 72) {
    interval = '60'
  } else {
    interval = 'D'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {side.toUpperCase()} Position: {symbol}
          </DialogTitle>
          <DialogDescription>
            Professional TradingView Position Visualization • Entry: {formatTimeInZone(entryTime, 'MMM d, yyyy HH:mm', timezone)} • Exit: {formatTimeInZone(exitTime, 'MMM d, yyyy HH:mm', timezone)} • 
            P&L: {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <TradingViewErrorBoundary key={modalKey}>
            <TradingViewAdvancedChart
              key={modalKey}
              height={600}
              tradeData={{
                entryTime,
                exitTime,
                entryPrice,
                exitPrice,
                ...(trade.stopLoss ? { stopLoss: parseFloat(String(trade.stopLoss)) } : {}),
                ...(trade.takeProfit ? { takeProfit: parseFloat(String(trade.takeProfit)) } : {}),
                side,
                pnl: trade.pnl,
                symbol
              }}
            />
          </TradingViewErrorBoundary>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default TradeChartModal
