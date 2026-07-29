'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ExtendedTrade } from './trade-table-review'
import { formatTimeInZone } from '@/lib/time-utils'
import { useUserStore } from '@/store/user-store'
import { TradeReplayer } from '../trade-replay/trade-replayer'

interface TradeReplayModalProps {
  isOpen: boolean
  onClose: () => void
  trade: ExtendedTrade | null
}

function TradeReplayModal({ isOpen, onClose, trade }: TradeReplayModalProps) {
  const timezone = useUserStore(state => state.timezone)
  
  if (!trade || !trade.entryDate || !trade.closeDate) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Invalid trade data. Please ensure the trade has valid entry and exit dates.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const symbol = trade.instrument || trade.symbol || 'UNKNOWN'
  const entryTime = new Date(trade.entryDate)
  const exitTime = new Date(trade.closeDate)
  const side = trade.side?.toUpperCase() || 'LONG'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Trade Replay: {side} {symbol}
          </DialogTitle>
          <DialogDescription>
            Entry: {formatTimeInZone(entryTime, 'MMM d, yyyy HH:mm', timezone)} • Exit: {formatTimeInZone(exitTime, 'MMM d, yyyy HH:mm', timezone)} • 
            P&L: {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-[500px]">
          {isOpen && trade && (
            <TradeReplayer trade={trade} className="w-full h-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default TradeReplayModal
