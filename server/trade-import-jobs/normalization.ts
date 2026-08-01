import { buildTradePersistenceData } from '@/lib/trade-core'
import { generateTradeHash } from '@/lib/trading/trade-grouping'
import type { TradeImportPayload } from '@/server/trade-import-jobs/types'

export function parseTradeImportPayload(fileData: unknown): TradeImportPayload {
  const buffer = Buffer.isBuffer(fileData)
    ? fileData
    : fileData instanceof Uint8Array
      ? Buffer.from(fileData)
      : Buffer.from(fileData as any)

  const parsed = JSON.parse(buffer.toString('utf-8')) as TradeImportPayload

  if (!parsed?.accountId || !Array.isArray(parsed.trades)) {
    throw new Error('Invalid trade import payload')
  }

  return parsed
}

export function normalizeTrade(rawTrade: any, internalUserId: string, accountNumber: string) {
  if (!rawTrade || typeof rawTrade !== 'object') return null

  const trade = Object.fromEntries(
    Object.entries(rawTrade).filter(([, value]) => value !== undefined)
  ) as any

  if (!trade.instrument || !trade.entryDate || !trade.closeDate) {
    return null
  }

  const quantity = Number(trade.quantity ?? 0)
  const pnl = Number(trade.pnl ?? 0)
  const commission = Number(trade.commission ?? 0)
  const timeInPosition = Number(trade.timeInPosition ?? 0)

  const normalized = buildTradePersistenceData({
    ...trade,
    id: trade.id || generateTradeHash({
      userId: internalUserId,
      accountNumber,
      instrument: trade.instrument || '',
      entryDate: trade.entryDate || '',
      closeDate: trade.closeDate || '',
      quantity,
      entryId: trade.entryId || '',
      timeInPosition,
    } as any),
    userId: internalUserId,
    accountNumber,
    instrument: String(trade.instrument || ''),
    entryPrice: String(trade.entryPrice || ''),
    closePrice: String(trade.closePrice || ''),
    entryDate: String(trade.entryDate || ''),
    closeDate: String(trade.closeDate || ''),
    quantity,
    pnl,
    commission,
    timeInPosition,
    createdAt: trade.createdAt ? new Date(trade.createdAt) : new Date(),
    side: trade.side || '',
    entryId: trade.entryId || null,
    comment: trade.comment || null,
    groupId: trade.groupId || null,
    symbol: trade.symbol || null,
    entryTime: trade.entryTime ? new Date(trade.entryTime) : null,
    exitTime: trade.exitTime ? new Date(trade.exitTime) : null,
    closeReason: trade.closeReason || null,
    stopLoss: trade.stopLoss || null,
    takeProfit: trade.takeProfit || null,
    tags: Array.isArray(trade.tags) ? trade.tags : [],
    marketBias: trade.marketBias || null,
    modelId: trade.modelId || null,
    selectedRules: trade.selectedRules || null,
    outcome: trade.outcome || null,
    ruleBroken: typeof trade.ruleBroken === 'boolean' ? trade.ruleBroken : null,
    newsDay: typeof trade.newsDay === 'boolean' ? trade.newsDay : null,
    selectedNews: trade.selectedNews || null,
    newsTraded: typeof trade.newsTraded === 'boolean' ? trade.newsTraded : null,
    biasTimeframe: trade.biasTimeframe || null,
    narrativeTimeframe: trade.narrativeTimeframe || null,
    entryTimeframe: trade.entryTimeframe || null,
    structureTimeframe: trade.structureTimeframe || null,
    orderType: trade.orderType || null,
    chartLinks: trade.chartLinks || null,
    cardPreviewImage: trade.cardPreviewImage || null,
    imageOne: trade.imageOne || null,
    imageTwo: trade.imageTwo || null,
    imageThree: trade.imageThree || null,
    imageFour: trade.imageFour || null,
    imageFive: trade.imageFive || null,
    imageSix: trade.imageSix || null,
  })

  return normalized
}

export function computeTradeImportProgress(totalItems: number, processedItems: number): number {
  if (totalItems <= 0) return 100
  const pct = Math.floor((processedItems / totalItems) * 100)
  return Math.max(1, Math.min(100, pct))
}
