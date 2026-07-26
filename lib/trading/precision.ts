import { decimalToNumber } from '@/lib/utils/decimal'

export const getDecimalPlaces = (instrument: string, price: number | unknown): number => {
  const instrumentUpper = instrument?.toUpperCase?.() ?? ''
  const numericPrice = typeof price === 'number' ? price : decimalToNumber(price)
  
  if (instrumentUpper.includes('JPY')) return 3
  if (
    instrumentUpper.includes('USD') ||
    instrumentUpper.includes('EUR') ||
    instrumentUpper.includes('GBP') ||
    instrumentUpper.includes('AUD') ||
    instrumentUpper.includes('CAD') ||
    instrumentUpper.includes('CHF') ||
    instrumentUpper.includes('NZD')
  ) {
    return 4
  }

  if (instrumentUpper.includes('XAU')) return 2
  if (instrumentUpper.includes('XAG')) return 3
  if (
    instrumentUpper.includes('US') ||
    instrumentUpper.includes('SPX') ||
    instrumentUpper.includes('NAS') ||
    instrumentUpper.includes('DOW') ||
    instrumentUpper.includes('GER') ||
    instrumentUpper.includes('DAX')
  ) {
    return numericPrice > 1000 ? 1 : 2
  }

  const absPrice = Math.abs(numericPrice)
  if (absPrice === 0) return 2
  if (absPrice < 0.0001) return 8
  if (absPrice < 0.01) return 6
  if (absPrice < 1) return 4
  if (absPrice < 10) return 3
  
  return 2
}

export const formatTradePrice = (price: number | unknown, instrument: string): string => {
  if (price === null || price === undefined || price === '') return '--'
  
  const numericPrice = typeof price === 'number' ? price : decimalToNumber(price)
  const decimals = getDecimalPlaces(instrument, numericPrice)
  
  return numericPrice.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
