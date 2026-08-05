export type FinancialDataQuality = 'current' | 'estimated' | 'delayed' | 'incomplete' | 'stale' | 'unavailable'
export type FinancialValueKind = 'currency' | 'pnl' | 'percentage' | 'points' | 'ticks' | 'quantity' | 'fees' | 'commission' | 'drawdown' | 'risk-reward'

export interface FinancialValueOptions {
  kind: FinancialValueKind
  currency?: string
  locale?: string
  unit?: string
  explicitSign?: boolean
}

export function formatFinancialValue(value: number | null | undefined, options: FinancialValueOptions): string {
  const { kind, currency = 'USD', locale = 'en-US', unit, explicitSign } = options
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable'

  const sign = explicitSign && value > 0 ? '+' : ''
  if (['currency', 'pnl', 'fees', 'commission', 'drawdown'].includes(kind)) {
    return `${sign}${new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
  }
  if (kind === 'percentage') return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}%`
  if (kind === 'risk-reward') return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}:1`
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value)}${unit ? ` ${unit}` : kind === 'points' ? ' pts' : kind === 'ticks' ? ' ticks' : ''}`
}
