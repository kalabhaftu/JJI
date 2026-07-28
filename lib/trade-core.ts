import type { TradeType, TradeExecutionType } from '@/lib/db/schema/trades';

import { decimalToNumber } from '@/lib/utils/decimal'

type Trade = TradeType;
type TradeExecutionKind = TradeExecutionType['kind'];

type TradeLike = Partial<Trade> & {
  chartLinksList?: string[] | null
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseTradeNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = decimalToNumber(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseTradeDate(value: unknown): Date | null {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getTradeEntryTimestamp(trade: TradeLike): Date | null {
  return parseTradeDate(trade.entryTime) ?? parseTradeDate(trade.entryDate)
}

export function getTradeExitTimestamp(trade: TradeLike): Date | null {
  return parseTradeDate(trade.exitTime) ?? parseTradeDate(trade.closeDate)
}

export function getTradeEntryPriceValue(trade: TradeLike): number | null {
  return parseTradeNumeric((trade as any).entryPriceValue) ?? parseTradeNumeric(trade.entryPrice)
}

export function getTradeClosePriceValue(trade: TradeLike): number | null {
  return parseTradeNumeric((trade as any).closePriceValue) ?? parseTradeNumeric(trade.closePrice)
}

function getTradeStopLossValue(trade: TradeLike): number | null {
  return parseTradeNumeric((trade as any).stopLossValue) ?? parseTradeNumeric(trade.stopLoss)
}

function getTradeTakeProfitValue(trade: TradeLike): number | null {
  return parseTradeNumeric((trade as any).takeProfitValue) ?? parseTradeNumeric(trade.takeProfit)
}

export function parseTradeChartLinks(trade: TradeLike | null | undefined): string[] {
  if (!trade) return []

  const list = Array.isArray(trade.chartLinksList)
    ? trade.chartLinksList
    : []

  if (list.length > 0) {
    return list.filter((link): link is string => typeof link === 'string' && link.trim().length > 0)
  }

  const legacy = normalizeString(trade.chartLinks)
  if (!legacy) return []
  return legacy
    .split(',')
    .map((link) => link.trim())
    .filter(Boolean)
}

export function serializeTradeChartLinks(links: string[]) {
  const normalized = links
    .map((link) => link.trim())
    .filter(Boolean)

  return {
    chartLinksList: normalized,
    chartLinks: normalized.length > 0 ? normalized.join(',') : null,
  }
}

export function buildTradeIdentityKey(trade: TradeLike): string {
  const userId = normalizeString(trade.userId)
  const accountNumber = normalizeString(trade.accountNumber)
  const instrument = normalizeString(trade.instrument).toUpperCase()
  const side = normalizeString(trade.side).toUpperCase()
  const quantity = Number(trade.quantity ?? 0)
  const entryTimestamp = getTradeEntryTimestamp(trade)?.toISOString() || normalizeString(trade.entryDate)
  const closeTimestamp = getTradeExitTimestamp(trade)?.toISOString() || normalizeString(trade.closeDate)
  const entryPrice = getTradeEntryPriceValue(trade)?.toFixed(8) ?? normalizeString(trade.entryPrice)
  const closePrice = getTradeClosePriceValue(trade)?.toFixed(8) ?? normalizeString(trade.closePrice)
  const pnl = Number(trade.pnl ?? 0).toFixed(8)
  const commission = Number(trade.commission ?? 0).toFixed(8)

  if (normalizeString(trade.entryId)) {
    return [
      'entry',
      userId,
      accountNumber,
      instrument,
      side,
      normalizeString(trade.entryId),
      quantity.toFixed(8),
      entryTimestamp,
      closeTimestamp,
      entryPrice,
      closePrice,
      pnl,
      commission,
    ].join('|')
  }

  return [
    'fallback',
    userId,
    accountNumber,
    instrument,
    side,
    quantity.toFixed(8),
    entryTimestamp,
    closeTimestamp,
    entryPrice,
    closePrice,
  ].join('|')
}

export function buildTradePersistenceData(trade: TradeLike) {
  const id = normalizeString(trade.id) || undefined
  const entryTime = getTradeEntryTimestamp(trade)
  const exitTime = getTradeExitTimestamp(trade)
  const entryPriceValue = getTradeEntryPriceValue(trade)
  const closePriceValue = getTradeClosePriceValue(trade)
  const stopLossValue = getTradeStopLossValue(trade)
  const takeProfitValue = getTradeTakeProfitValue(trade)

  return {
    ...trade,
    ...(id ? { id } : {}),
    entryTime,
    exitTime,
    entryPriceValue,
    closePriceValue,
    stopLossValue,
    takeProfitValue,
    tradeIdentityKey: buildTradeIdentityKey({
      ...trade,
      entryTime,
      exitTime,
      entryPriceValue,
      closePriceValue,
      stopLossValue,
      takeProfitValue,
    }),
    ...serializeTradeChartLinks(parseTradeChartLinks(trade)),
  }
}

export function buildSyntheticExecutionsFromTrade(trade: TradeLike) {
  const entryTime = getTradeEntryTimestamp(trade)
  const exitTime = getTradeExitTimestamp(trade)
  const entryPrice = getTradeEntryPriceValue(trade)
  const exitPrice = getTradeClosePriceValue(trade)
  const quantity = Number(trade.quantity ?? 0)
  const commission = Number(trade.commission ?? 0)
  const pnl = Number(trade.pnl ?? 0)

  const entryExecution = {
    id: crypto.randomUUID(),
    tradeId: String(trade.id || ''),
    userId: String(trade.userId || ''),
    kind: 'ENTRY' as TradeExecutionKind,
    quantity,
    price: entryPrice,
    executedAt: entryTime,
    pnl: 0,
    commission: 0,
    brokerExecutionId: normalizeString(trade.entryId) || null,
    legacySourceTradeId: String(trade.id || ''),
    rawSymbol: normalizeString(trade.symbol) || null,
    closeReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const exitExecution = {
    id: crypto.randomUUID(),
    tradeId: String(trade.id || ''),
    userId: String(trade.userId || ''),
    kind: 'EXIT' as TradeExecutionKind,
    quantity,
    price: exitPrice,
    executedAt: exitTime,
    pnl,
    commission,
    brokerExecutionId: normalizeString(trade.closeId) || null,
    legacySourceTradeId: String(trade.id || ''),
    rawSymbol: normalizeString(trade.symbol) || null,
    closeReason: normalizeString(trade.closeReason) || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return [entryExecution, exitExecution]
}
