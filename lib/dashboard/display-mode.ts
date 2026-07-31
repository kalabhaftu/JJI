import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import {
  calculateTradeRMultiple,
  hasValidTradeRMultipleData,
} from '@/lib/math/performance-metrics'

export type DashboardDisplayMode = 'dollars' | 'percentage' | 'privacy' | 'rMultiple'
export type DashboardMetricKind = 'money' | 'balance' | 'percent' | 'count' | 'rMultiple'

type TransformArgs = {
  value: number
  basis?: number
  mode: DashboardDisplayMode
  kind?: DashboardMetricKind
  rValue?: number | null
}

type FormatArgs = TransformArgs & {
  precision?: number
  compact?: boolean
  sensitive?: boolean
  emptyLabel?: string
}

export const DASHBOARD_DISPLAY_MODE_META: Record<
  DashboardDisplayMode,
  { label: string; description: string }
> = {
  dollars: {
    label: 'Dollars View',
    description: 'Displays trading data in dollar amounts.',
  },
  percentage: {
    label: 'Percentage View',
    description: 'Shows performance in percentage terms.',
  },
  privacy: {
    label: 'Privacy View',
    description: 'Masks sensitive balance and P&L values.',
  },
  rMultiple: {
    label: 'R-Multiple View',
    description: 'Displays trade-derived performance in R units.',
  },
}

export function maskSensitiveValue() {
  return '****'
}

function formatCompactCurrencyValue(value: number) {
  const absValue = Math.abs(value)
  if (absValue >= 1_000_000) {
    return `${value < 0 ? '-' : ''}$${formatNumber(absValue / 1_000_000, 2)}M`
  }
  if (absValue >= 100_000) {
    return `${value < 0 ? '-' : ''}$${formatNumber(absValue / 1_000, 2)}K`
  }
  return formatCurrency(value)
}

export function transformDisplayValue({
  value,
  basis = 0,
  mode,
  kind = 'money',
  rValue = null,
}: TransformArgs): number | null {
  if (kind === 'count' || kind === 'percent') {
    return value
  }

  if (mode === 'rMultiple') {
    if (kind === 'rMultiple') return value
    if (rValue === null || rValue === undefined || Number.isNaN(rValue)) return value // fallback to dollar
    return rValue
  }

  if (mode === 'percentage') {
    if (!basis) return 0
    if (kind === 'balance') {
      return ((value - basis) / basis) * 100
    }
    return (value / basis) * 100
  }

  return value
}

export function formatDisplayValue({
  value,
  basis = 0,
  mode,
  kind = 'money',
  rValue = null,
  precision = 2,
  compact = false,
  sensitive = true,
  emptyLabel = '--',
}: FormatArgs): string {
  if (mode === 'privacy' && sensitive) {
    return maskSensitiveValue()
  }

  const transformedValue = transformDisplayValue({
    value,
    basis,
    mode,
    kind,
    rValue,
  })

  if (transformedValue === null || transformedValue === undefined || Number.isNaN(transformedValue)) {
    return emptyLabel
  }

  if (mode === 'rMultiple' || kind === 'rMultiple') {
    return `${formatNumber(transformedValue, precision)}R`
  }

  if (mode === 'percentage' || kind === 'percent') {
    return formatPercent(transformedValue, precision)
  }

  if (kind === 'count') {
    return formatNumber(transformedValue, 0)
  }

  return compact ? formatCompactCurrencyValue(transformedValue) : formatCurrency(transformedValue, precision)
}

export function inferMetricKind(
  dataKey?: string | number,
  name?: string
): DashboardMetricKind {
  const haystack = `${String(dataKey || '')} ${String(name || '')}`.toLowerCase()

  if (haystack.includes('rate') || haystack.includes('percent') || haystack.includes('%')) {
    return 'percent'
  }

  if (haystack.includes('trade') || haystack.includes('count') || haystack.includes('total')) {
    return 'count'
  }

  if (haystack.includes('balance')) {
    return 'balance'
  }

  if (haystack.includes('rmultiple') || haystack.includes('r multiple') || haystack.endsWith(' r')) {
    return 'rMultiple'
  }

  return 'money'
}

export function getTradeRMultipleInfo(trade: any) {
  const hasData = hasValidTradeRMultipleData(trade)
  return {
    hasData,
    value: hasData ? calculateTradeRMultiple(trade) : null,
  }
}
