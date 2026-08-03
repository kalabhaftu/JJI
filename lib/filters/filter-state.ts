import type { DateRange } from '@/components/ui/custom-date-range-picker'

export type SideFilter = 'all' | 'buy' | 'sell'
export type PnlFilter = 'all' | 'wins' | 'losses'

export interface FilterState {
  dateRange?: DateRange
  instruments: string[]
  accounts: string[]
  side: SideFilter
  pnl: PnlFilter
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(value: string | null): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return undefined
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : undefined
}

export function encodeFilterState(state: FilterState, current = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(current)
  for (const key of ['from', 'to', 'instrument', 'account', 'side', 'pnl']) params.delete(key)

  if (state.dateRange?.from && state.dateRange.to) {
    params.set('from', formatDate(state.dateRange.from))
    params.set('to', formatDate(state.dateRange.to))
  }
  state.instruments.forEach((value) => params.append('instrument', value))
  state.accounts.forEach((value) => params.append('account', value))
  if (state.side !== 'all') params.set('side', state.side)
  if (state.pnl !== 'all') params.set('pnl', state.pnl)
  return params
}

export function decodeFilterState(params: URLSearchParams | ReadonlyURLSearchParams): FilterState {
  const from = parseDate(params.get('from'))
  const to = parseDate(params.get('to'))
  const side = params.get('side')
  const pnl = params.get('pnl')

  return {
    ...(from && to ? { dateRange: { from, to } } : {}),
    instruments: params.getAll('instrument'),
    accounts: params.getAll('account'),
    side: side === 'buy' || side === 'sell' ? side : 'all',
    pnl: pnl === 'wins' || pnl === 'losses' ? pnl : 'all',
  }
}

interface ReadonlyURLSearchParams {
  get(name: string): string | null
  getAll(name: string): string[]
}
