'use client'

import type { TradeType } from '@/lib/db/schema/trades';

import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useUserStore } from '@/store/user-store'
import { ImportLoading } from '../components/import-loading'

interface ExnessProcessorProps {
  csvData: string[][]
  headers: string[]
  setProcessedTrades: React.Dispatch<React.SetStateAction<TradeType[]>>
  accountNumber: string
}

const ExnessProcessor = ({
  csvData,
  headers,
  setProcessedTrades,
  accountNumber
}: ExnessProcessorProps) => {
  const user = useUserStore(state => state.user)
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const processData = async () => {
      const currentUser = user || supabaseUser
      if (!currentUser?.id) {
        return
      }

      setIsProcessing(true)

      const trades: TradeType[] = []

      for (const row of csvData) {

        const entryDateStr = row[headers.indexOf('opening_time_utc')]
        const closeDateStr = row[headers.indexOf('closing_time_utc')]
        
        if (!entryDateStr || !closeDateStr) {
          continue
        }


        const entryDate = entryDateStr.endsWith('Z') ? new Date(entryDateStr) : new Date(entryDateStr + 'Z')
        const closeDate = closeDateStr.endsWith('Z') ? new Date(closeDateStr) : new Date(closeDateStr + 'Z')


        const timeInPosition = Math.round((closeDate.getTime() - entryDate.getTime()) / 1000)


        const quantity = parseFloat(row[headers.indexOf('lots')] || '0') || 0
        const entryPrice = parseFloat(row[headers.indexOf('opening_price')] || '0') || 0
        const closePrice = parseFloat(row[headers.indexOf('closing_price')] || '0') || 0
        
        const commissionIdx = headers.indexOf('commission_usd') !== -1 ? headers.indexOf('commission_usd') : headers.indexOf('commission')
        const swapIdx = headers.indexOf('swap_usd') !== -1 ? headers.indexOf('swap_usd') : headers.indexOf('swap')
        const profitIdx = headers.indexOf('profit_usd') !== -1 ? headers.indexOf('profit_usd') : headers.indexOf('profit')

        const commission = commissionIdx !== -1 ? parseFloat(row[commissionIdx] || '0') || 0 : 0
        const swap = swapIdx !== -1 ? parseFloat(row[swapIdx] || '0') || 0 : 0
        const pnl = profitIdx !== -1 ? parseFloat(row[profitIdx] || '0') || 0 : 0
        
        const stopLossRaw = row[headers.indexOf('stop_loss')]
        const takeProfitRaw = row[headers.indexOf('take_profit')]
        const stopLoss = stopLossRaw && parseFloat(stopLossRaw) !== 0 ? stopLossRaw : null
        const takeProfit = takeProfitRaw && parseFloat(takeProfitRaw) !== 0 ? takeProfitRaw : null


        const instrument = row[headers.indexOf('symbol')] || ''
        const side = row[headers.indexOf('type')] || ''
        const tradeId = row[headers.indexOf('ticket')] || ''
        const reason = row[headers.indexOf('close_reason')] || ''
        

        const normalizedSide = side.toLowerCase() === 'buy' ? 'BUY' : 'SELL'

        const trade = {
          id: uuidv4(),
          accountNumber,
          instrument,
          entryId: tradeId,
          quantity: Math.abs(quantity),
          entryPrice: entryPrice.toString(),
          closePrice: closePrice.toString(),
          entryDate: entryDate.toISOString(),
          closeDate: closeDate.toISOString(),
          pnl: pnl + swap,
          timeInPosition,
          side: normalizedSide,
          commission,
          phaseAccountId: null,
          userId: currentUser.id,
          createdAt: new Date(),
          comment: null,
          closeReason: reason || null,
          cardPreviewImage: null,
          tradingModel: null,
          groupId: null,
          tags: null,

          symbol: instrument,
          entryTime: entryDate,
          exitTime: closeDate,
          accountId: null,
          stopLoss: stopLoss,
          takeProfit: takeProfit,
        } as any

        trades.push(trade)
      }

      setProcessedTrades(trades)
      setIsProcessing(false)
    }

    processData()
  }, [csvData, headers, accountNumber, user, supabaseUser, setProcessedTrades])

  if (isProcessing) {
    return <ImportLoading />
  }

  return <div className="text-center text-sm text-muted-foreground">Exness trades processed successfully!</div>
}

export default ExnessProcessor
