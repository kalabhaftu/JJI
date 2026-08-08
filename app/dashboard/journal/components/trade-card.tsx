'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import type { TradeType as Trade } from '@/lib/db/schema';

import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowUpRight01Icon, ArrowDownRight01Icon, MoreVerticalIcon, EyeIcon, PencilEdit01Icon, Delete02Icon, AlertCircleIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import {
  classifyTrade,
  formatCurrency,
  formatQuantity,
  formatTradeData,
} from '@/lib/trading/trade-formatting'
import { formatTradePrice } from '@/lib/trading/precision'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RevealAction } from '@/components/ui/reveal-action'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTags } from '@/context/tags-provider'
import { formatTimeInZone } from '@/lib/time-utils'
import { useUserStore } from '@/store/user-store'
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { parseTradePreviewImageValue } from '@/lib/trade-preview-image'
import { TradePreviewImage } from '@/components/trades/trade-preview-image'
import { DEFAULT_TRADE_PREVIEW_TRANSFORM } from '@/lib/trade-preview'
import { getTradeNetPnl, getTradePnlByMode, normalizePnlDisplayMode } from '@/lib/metrics/pnl'

interface TradeCardProps {
  trade: Trade
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onView?: () => void
  breakEvenThreshold?: number
}

export function TradeCard({
  trade,
  onClick,
  onEdit,
  onDelete,
  onView,
  breakEvenThreshold
}: TradeCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const { getTagsByIds } = useTags()
  const timezone = useUserStore((state) => state.timezone)
  const pnlDisplayMode = normalizePnlDisplayMode(
    useUserStore((state) => state.user?.pnlDisplayMode)
  )
  const threshold = getBreakEvenThreshold(breakEvenThreshold)

  const netPnl = getTradeNetPnl(trade)
  const displayPnl = getTradePnlByMode(trade, pnlDisplayMode)
  const outcome = classifyTrade(netPnl, threshold)
  const isWin = outcome === 'win'
  const isLoss = outcome === 'loss'
  const isBreakEven = outcome === 'breakeven'
  const previewImage = parseTradePreviewImageValue((trade as any).cardPreviewImage)
  const hasPreviewImage = !!previewImage.src && String(previewImage.src).trim() !== ''

  const tradeTagIds = Array.isArray((trade as any).tags) ? (trade as any).tags : []
  const tradeTags = getTagsByIds(tradeTagIds)

  const getStatusVariant = (pnl: number): "default" | "secondary" | "destructive" | "outline" => {
    if (pnl > threshold) return 'default'
    if (pnl < -threshold) return 'destructive'
    return 'outline'
  }

  const calculateRiskRewardRatio = (trade: Trade): { ratio: number; hasIncompleteData: boolean } => {

    const entryPrice = parseFloat(String(trade.entryPrice))
    const closePrice = parseFloat(String(trade.closePrice))

    const stopLossRaw = (trade as any).stopLoss || null
    const takeProfitRaw = (trade as any).takeProfit || null

    const stopLoss = stopLossRaw && parseFloat(stopLossRaw.toString()) !== 0 ? parseFloat(stopLossRaw.toString()) : null
    const takeProfit = takeProfitRaw && parseFloat(takeProfitRaw.toString()) !== 0 ? parseFloat(takeProfitRaw.toString()) : null

    const side = trade.side?.toUpperCase()
    const isWin = netPnl > threshold

    const hasIncompleteData = !entryPrice || !closePrice || !stopLoss || !side

    if (hasIncompleteData) {

      const analyticsRR = (trade as any).tradeAnalytics?.riskRewardRatio
      if (analyticsRR && analyticsRR > 0) {
        return { ratio: analyticsRR, hasIncompleteData: false }
      }
      return { ratio: 0.00, hasIncompleteData: true }
    }

    let potentialRisk: number
    let potentialReward: number

    if (side === 'BUY' || side === 'LONG') {

      potentialRisk = entryPrice - stopLoss

      if (isWin) {
        potentialReward = closePrice - entryPrice
      } else {

        potentialReward = takeProfit ? (takeProfit - entryPrice) : Math.abs(closePrice - entryPrice)
      }
    } else if (side === 'SELL' || side === 'SHORT') {

      potentialRisk = stopLoss - entryPrice

      if (isWin) {
        potentialReward = entryPrice - closePrice
      } else {

        potentialReward = takeProfit ? (entryPrice - takeProfit) : Math.abs(entryPrice - closePrice)
      }
    } else {
      return { ratio: 0.00, hasIncompleteData: true }
    }

    if (potentialRisk <= 0 || potentialReward <= 0) {
      return { ratio: 0.00, hasIncompleteData: true }
    }

    const rrRatio = potentialReward / potentialRisk

    return { ratio: Math.min(rrRatio, 99.99), hasIncompleteData: false }
  }

  const rrResult = calculateRiskRewardRatio(trade)
  const rrRatio = rrResult.ratio
  const hasIncompleteRRData = rrResult.hasIncompleteData
  const duration = trade.timeInPosition || 0

  const formatDuration = (timeInPosition: number) => {
    const hours = Math.floor(timeInPosition / 3600)
    const minutes = Math.floor((timeInPosition % 3600) / 60)
    const seconds = Math.floor(timeInPosition % 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  const hasPartials = (trade as any).isGrouped || (trade as any).partialTrades?.length > 1
  const partialCount = (trade as any).partialTrades?.length || 1

  return (
    <Card className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 h-full flex flex-col w-full max-w-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                isWin ? "bg-long" : isLoss ? "bg-short" : "bg-muted-foreground"
              )} />
              <h3 className="font-semibold text-foreground truncate text-base">
                {trade.instrument}
              </h3>
              {hasPartials && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
                  Partial {partialCount}x
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {trade.accountNumber ? `${trade.accountNumber}` : 'No Account'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(trade as any).isMissedTrade ? (
              <Badge variant="secondary" className="text-xs font-medium px-2 bg-purple-500/10 text-purple-500 border-purple-500/20">
                GHOST
              </Badge>
            ) : (
              <Badge
                variant={getStatusVariant(netPnl)}
                className={cn(
                  "text-xs font-medium px-2",
                  isWin ? "bg-long/10 text-long border-long/20" : isLoss ? "bg-short/10 text-short border-short/20" : "bg-muted/10 text-muted-foreground border-border"
                )}
              >
                {isWin ? 'WIN' : isLoss ? 'LOSS' : 'BE'}
              </Badge>
            )}
            {(trade as any).tradingModel && (
              <Badge variant="secondary" className="text-[10px] whitespace-nowrap hidden sm:inline-flex px-1.5">
                {(trade as any).tradingModel}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <RevealAction size="icon" className="h-10 w-10" aria-label="Trade options">
                  <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
                </RevealAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onView}>
                  <HugeiconsIcon icon={EyeIcon} className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <HugeiconsIcon icon={PencilEdit01Icon} className="h-4 w-4 mr-2" />
                  Edit Trade
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 mr-2" />
                  Delete Trade
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 flex-1 flex flex-col pt-0">
        {                   }
        <div className="relative aspect-video overflow-hidden rounded-xl border border-border/30 bg-muted/20 shadow-inner">
          {hasPreviewImage ? (
            <>
              <TradePreviewImage
                src={previewImage.src || ''}
                alt={`Trade ${trade.instrument} ${trade.side}`}
                transform={(trade as any).cardPreviewTransform ?? DEFAULT_TRADE_PREVIEW_TRANSFORM}
                imageClassName="transition-transform duration-300 group-hover:scale-[1.02]"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                unoptimized
              />
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 bg-muted/50" />
              )}
              {imageError && (
                <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                  <div className="text-muted-foreground text-xs">Image not available</div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 bg-muted/30 flex items-center justify-center">
              <div className="text-muted-foreground/50 text-xs">No preview</div>
            </div>
          )}
        </div>

        {                       }
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">P&L</p>
            <div className="flex items-center gap-1">
              {(trade as any).isMissedTrade ? (
                <div className="h-3 w-3 rounded-full border border-purple-500 flex-shrink-0" />
              ) : isWin ? (
                <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3 w-3 text-long flex-shrink-0" strokeWidth={2} color="currentColor" />
              ) : isLoss ? (
                <HugeiconsIcon icon={ArrowDownRight01Icon} className="h-3 w-3 text-short flex-shrink-0" strokeWidth={2} color="currentColor" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-muted-foreground flex-shrink-0" />
              )}
              <p className={cn(
                "font-semibold truncate",
                (trade as any).isMissedTrade ? 'text-purple-500' : isWin ? 'text-long' : isLoss ? 'text-short' : 'text-muted-foreground'
              )}>
                {(trade as any).isMissedTrade ? '-' : formatCurrency(displayPnl)}
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Quantity</p>
            <p className="font-semibold text-foreground truncate">
              {formatTradeData(trade).quantityWithUnit}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Entry Price</p>
            <p className="font-semibold text-foreground text-sm truncate">
              {formatTradePrice(trade.entryPrice, trade.instrument)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Exit Price</p>
            <p className="font-semibold text-foreground text-sm truncate">
              {formatTradePrice(trade.closePrice, trade.instrument)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Side</p>
            <Badge variant="outline" className="text-xs w-fit">
              {trade.side || 'N/A'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Date</p>
            <p className="font-semibold text-foreground text-sm truncate">
              {formatTimeInZone(trade.entryDate, 'MMM dd, yyyy', timezone)}
            </p>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-xs text-muted-foreground">R:R</p>
              {hasIncompleteRRData && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HugeiconsIcon icon={AlertCircleIcon} className="h-3 w-3 text-muted-foreground flex-shrink-0" strokeWidth={2} color="currentColor" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Trade has incomplete SL or TP data</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="font-semibold text-foreground text-sm truncate">
              {hasIncompleteRRData ? '-' : rrRatio.toFixed(2)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Duration</p>
            <p className="font-semibold text-foreground text-sm truncate">{formatDuration(duration)}</p>
          </div>
        </div>

        {          }
        {tradeTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t">
            {tradeTags.slice(0, 3).map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-[10px] px-1.5 py-0.5 h-5"
                style={{ backgroundColor: tag.color, color: 'white', borderColor: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
            {tradeTags.length > 3 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 h-5"
              >
                +{tradeTags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
