

export interface PnLCalculationParams {
  entryPrice: string | number
  closePrice: string | number
  quantity: number
  side: 'LONG' | 'SHORT'
  commission?: number
}


export function calculatePnL({
  entryPrice,
  closePrice,
  quantity,
  side,
  commission = 0
}: PnLCalculationParams): number {
  const entry = typeof entryPrice === 'string' ? parseFloat(entryPrice) : entryPrice
  const close = typeof closePrice === 'string' ? parseFloat(closePrice) : closePrice
  
  let pnl = 0
  if (side === 'LONG') {
    pnl = (close - entry) * quantity - commission
  } else if (side === 'SHORT') {
    pnl = (entry - close) * quantity - commission
  }
  
  return pnl
}


export function calculateDuration(
  entryDate: string,
  entryTime: string,
  closeDate: string,
  closeTime: string
): string {
  try {
    const entryDateTime = new Date(`${entryDate}T${entryTime}`)
    const closeDateTime = new Date(`${closeDate}T${closeTime}`)
    
    const diffMs = closeDateTime.getTime() - entryDateTime.getTime()
    if (diffMs <= 0) return ''
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  } catch (error) {
    return ''
  }
}


