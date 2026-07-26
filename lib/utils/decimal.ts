export function convertDecimal<T>(value: T): T | string {
  if (value && typeof value === 'object' && 'toString' in value) {
    return (value as any).toString()
  }
  return value
}

export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0
  }
  
  if (typeof value === 'number') {
    return value
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
  }
  
  if (typeof value === 'object' && 'toString' in value) {
    const parsed = parseFloat((value as any).toString())
    return isNaN(parsed) ? 0 : parsed
  }
  
  return 0
}

function convertTradeDecimals<T extends Record<string, unknown>>(trade: T): T {
  return {
    ...trade,
    entryPrice: convertDecimal(trade.entryPrice),
    closePrice: convertDecimal(trade.closePrice),
    stopLoss: convertDecimal(trade.stopLoss),
    takeProfit: convertDecimal(trade.takeProfit),
  }
}

function convertTradesDecimals<T extends Record<string, unknown>>(trades: T[]): T[] {
  return trades.map(convertTradeDecimals)
}

function safeAdd(a: unknown, b: unknown): number {
  return decimalToNumber(a) + decimalToNumber(b)
}

function safeSubtract(a: unknown, b: unknown): number {
  return decimalToNumber(a) - decimalToNumber(b)
}

function formatDecimal(value: unknown, decimals: number = 2): string {
  const num = decimalToNumber(value)
  return num.toFixed(decimals)
}

