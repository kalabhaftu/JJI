import type { TradeType } from '@/lib/db/schema/trades';

type Trade = TradeType;

export function generateTradeHash(trade: Partial<Trade>): string {
  const hashString = `${trade.userId || ''}-${trade.accountNumber || ''}-${trade.instrument || ''}-${trade.entryDate || ''}-${trade.closeDate || ''}-${trade.quantity || 0}-${trade.entryId || ''}-${trade.closeId || ''}-${trade.timeInPosition || 0}`
  return hashString
}


export function createTradeWithDefaults(input: Partial<Trade>): Trade {
  const now = new Date()
  return {
    id: input.id || generateTradeHash(input),
    accountNumber: input.accountNumber || "",
    quantity: input.quantity || 0,
    entryId: input.entryId || null,
    closeId: input.closeId || null,
    instrument: input.instrument || "",
    entryPrice: input.entryPrice || "0",
    closePrice: input.closePrice || "0",
    entryDate: input.entryDate || now.toISOString(),
    closeDate: input.closeDate || now.toISOString(),
    pnl: input.pnl || 0,
    commission: input.commission || 0,
    timeInPosition: input.timeInPosition || 0,
    side: input.side || "",
    comment: input.comment || "",
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    userId: input.userId || "",
    tags: input.tags || [],
    groupId: input.groupId || null,
    tradeIdentityKey: input.tradeIdentityKey || null,
    entryPriceValue: input.entryPriceValue !== undefined ? input.entryPriceValue : null,
    closePriceValue: input.closePriceValue !== undefined ? input.closePriceValue : null,
    cardPreviewImage: input.cardPreviewImage || null,
    cardPreviewTransform: input.cardPreviewTransform !== undefined ? input.cardPreviewTransform : null,
    imageOne: input.imageOne || null,
    imageTwo: input.imageTwo || null,
    imageThree: input.imageThree || null,
    imageFour: input.imageFour || null,
    imageFive: input.imageFive || null,
    imageSix: input.imageSix || null,
    accountId: input.accountId || null,
    phaseAccountId: input.phaseAccountId || null,
    symbol: input.symbol || null,
    entryTime: input.entryTime || null,
    exitTime: input.exitTime || null,
    closeReason: input.closeReason || null,
    stopLoss: input.stopLoss || null,
    stopLossValue: input.stopLossValue !== undefined ? input.stopLossValue : null,
    takeProfit: input.takeProfit || null,
    takeProfitValue: input.takeProfitValue !== undefined ? input.takeProfitValue : null,
    marketBias: input.marketBias || null,
    modelId: input.modelId || null,
  } as Trade
}

