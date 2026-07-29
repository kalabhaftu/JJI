import { formatInTimeZone } from 'date-fns-tz'

import type { TradeType as Trade } from '@/lib/db/schema/trades'
import {
  calculateWinRate as calculateOutcomeWinRate,
  classifyOutcome,
  DEFAULT_BREAK_EVEN_THRESHOLD,
} from '@/lib/metrics/outcome'
import { getTradeGrossPnl, getTradeNetPnl } from '@/lib/metrics/pnl'
import {
  getTradeClosePriceValue,
  getTradeEntryPriceValue,
  getTradeEntryTimestamp,
  getTradeExitTimestamp,
  parseTradeChartLinks,
} from '@/lib/trade-core'
import { formatTradePrice, getDecimalPlaces } from '@/lib/trading/precision'
import type { ExtendedTrade, MarketBias } from '@/types/trade-extended'

export const DEFAULT_TIMEZONE = 'America/New_York'

export function ensureExtendedTrade(trade: Trade): ExtendedTrade {
  return {
    ...trade,
    tags: Array.isArray(trade.tags) ? trade.tags as string[] : [],
    selectedRules: Array.isArray(trade.selectedRules)
      ? trade.selectedRules as string[]
      : [],
    marketBias: (trade.marketBias as MarketBias) || null,
    selectedNews: (trade.selectedNews as string) || null,
    chartLinks: parseTradeChartLinks(trade),
  } as ExtendedTrade
}

export function calculateWinRate(winCount: number, lossCount: number): number {
  return calculateOutcomeWinRate(winCount, lossCount)
}

export function classifyTrade(
  netPnl: number,
  threshold = DEFAULT_BREAK_EVEN_THRESHOLD,
): 'win' | 'loss' | 'breakeven' {
  return classifyOutcome(netPnl, threshold)
}

export function getPnlIntensity(pnl: number): number {
  const absolutePnl = Math.abs(pnl)
  if (absolutePnl === 0) return 0
  if (absolutePnl < 100) return 0.08
  if (absolutePnl < 500) return 0.12
  if (absolutePnl < 1_000) return 0.18
  if (absolutePnl < 5_000) return 0.25
  return 0.35
}

export function formatTradeDate(
  date: string | Date | null | undefined,
  timezone = DEFAULT_TIMEZONE,
  includeDayOfWeek = true,
): string {
  if (!date) return 'N/A'
  const parsedDate = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(
    parsedDate,
    timezone,
    includeDayOfWeek ? 'EEE, MMM d, yyyy' : 'MMM d, yyyy',
  )
}

export function formatNumber(value: number, maxDecimals = 4): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return '0'
  return Number.parseFloat(value.toFixed(maxDecimals)).toString()
}

export function formatCurrency(value: number, maxDecimals = 2): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  }).format(value)
}

export function formatPercent(value: number, maxDecimals = 2): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return '0%'
  return `${Number.parseFloat(value.toFixed(maxDecimals))}%`
}

export function formatQuantity(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined) return '0'
  const numericValue = typeof value === 'string'
    ? Number.parseFloat(value)
    : value
  if (Number.isNaN(numericValue) || !Number.isFinite(numericValue)) return '0'
  return Number.parseFloat(numericValue.toFixed(4)).toString()
}

function formatPrice(
  price: string | number | { toString(): string },
  instrument: string,
  forAggregation = false,
): string {
  if (price === null || price === undefined || price === '') return '0'
  const numericPrice = typeof price === 'object'
    ? Number.parseFloat(price.toString())
    : typeof price === 'string'
      ? Number.parseFloat(price)
      : price
  if (Number.isNaN(numericPrice) || !Number.isFinite(numericPrice)) return '0'
  if (forAggregation) {
    return numericPrice.toFixed(getDecimalPlaces(instrument, numericPrice))
  }
  return formatTradePrice(numericPrice, instrument)
}

export function parsePositionTime(timeInSeconds: number): string {
  const hours = Math.floor(timeInSeconds / 3_600)
  const minutes = Math.floor((timeInSeconds - hours * 3_600) / 60)
  const seconds = Math.floor(timeInSeconds - hours * 3_600 - minutes * 60)
  if ([hours, minutes, seconds].some(Number.isNaN)) return '0'
  return [
    hours > 0 ? `${hours}h` : '',
    `${minutes}m`,
    `${seconds}s`,
  ].filter(Boolean).join(' ')
}

export function formatTradeData(trade: Trade, timezone?: string) {
  const tradeWithRelations = trade as Trade & { tradingModel?: unknown }
  const instrument = trade.instrument || ''
  const grossPnl = getTradeGrossPnl(trade)
  const netPnl = getTradeNetPnl(trade)
  const entryTimestamp = getTradeEntryTimestamp(trade)
  const exitTimestamp = getTradeExitTimestamp(trade)
  const displayTimezone = timezone || DEFAULT_TIMEZONE

  return {
    instrument: instrument || 'N/A',
    accountNumber: trade.accountNumber || 'N/A',
    side: trade.side?.toUpperCase() || 'N/A',
    quantity: formatQuantity(trade.quantity),
    quantityWithUnit: `${formatQuantity(trade.quantity)} lots`,
    entryPrice: formatPrice(
      getTradeEntryPriceValue(trade) ?? trade.entryPrice,
      instrument,
    ),
    closePrice: trade.closePrice
      ? formatPrice(
          getTradeClosePriceValue(trade) ?? trade.closePrice,
          instrument,
        )
      : 'Open',
    entryPriceCurrency: `$${formatPrice(
      getTradeEntryPriceValue(trade) ?? trade.entryPrice,
      instrument,
    )}`,
    closePriceCurrency: trade.closePrice
      ? `$${formatPrice(
          getTradeClosePriceValue(trade) ?? trade.closePrice,
          instrument,
        )}`
      : 'Open',
    pnl: grossPnl,
    pnlFormatted: formatCurrency(grossPnl),
    commission: trade.commission || 0,
    commissionFormatted: formatCurrency(trade.commission || 0),
    grossPnl,
    grossPnlFormatted: formatCurrency(grossPnl),
    netPnl,
    netPnlFormatted: formatCurrency(netPnl),
    entryDate: entryTimestamp,
    closeDate: exitTimestamp,
    entryDateFormatted: entryTimestamp
      ? formatInTimeZone(entryTimestamp, displayTimezone, 'MMM d, yyyy HH:mm:ss')
      : 'N/A',
    closeDateFormatted: exitTimestamp
      ? formatInTimeZone(exitTimestamp, displayTimezone, 'MMM d, yyyy HH:mm:ss')
      : 'Open',
    entryDateShort: entryTimestamp
      ? formatInTimeZone(entryTimestamp, displayTimezone, 'MMM d, yyyy')
      : 'N/A',
    closeDateShort: exitTimestamp
      ? formatInTimeZone(exitTimestamp, displayTimezone, 'MMM d, yyyy')
      : 'Open',
    timeInPosition: trade.timeInPosition || 0,
    timeInPositionFormatted: parsePositionTime(trade.timeInPosition || 0),
    isWin: classifyTrade(netPnl) === 'win',
    isLoss: classifyTrade(netPnl) === 'loss',
    isBreakEven: classifyTrade(netPnl) === 'breakeven',
    isOpen: !trade.closeDate,
    isClosed: Boolean(trade.closeDate),
    stopLoss: trade.stopLoss || null,
    takeProfit: trade.takeProfit || null,
    closeReason: trade.closeReason || null,
    comment: trade.comment || null,
    id: trade.id,
    entryId: trade.entryId || null,
    groupId: trade.groupId || null,
    tradingModel: tradeWithRelations.tradingModel || null,
    raw: trade,
  }
}
