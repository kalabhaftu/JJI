import { formatCurrency } from '@/lib/utils'

function formatMoney(value: number | null | undefined) {
  return formatCurrency(Number(value || 0))
}

export function formatPercent(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(1)}%`
}

export function formatInteger(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
}

export function getObjectiveTone(remaining: number) {
  return remaining <= 0 ? 'short' : 'long'
}
