import type { TradeEntryFormValues } from './trade-entry-schema'

export interface TradeEntryRouteState { origin?: string; accountId?: string; propFirmAccountId?: string; phaseId?: string; draftId?: string; returnTo?: string }
export interface TradeEntryDraft { version: 1; userId: string; draftId: string; updatedAt: number; origin?: string; accountId?: string; propFirmAccountId?: string; phaseId?: string; values: Partial<TradeEntryFormValues> }

const key = (userId: string, draftId: string) => `jji:trade-entry-draft:${encodeURIComponent(userId)}:${encodeURIComponent(draftId)}`
const fields = ['origin', 'accountId', 'propFirmAccountId', 'phaseId', 'draftId', 'returnTo'] as const

function isSafeReturnTo(value: string): boolean {
  return value === '/dashboard' || value.startsWith('/dashboard/') || value.startsWith('/dashboard?')
}

export function parseTradeEntryRouteState(searchParams: URLSearchParams): TradeEntryRouteState {
  return Object.fromEntries(fields.flatMap((field) => {
    const value = searchParams.get(field)
    if (!value || (field === 'returnTo' && !isSafeReturnTo(value))) return []
    return [[field, value]]
  })) as TradeEntryRouteState
}

export function buildTradeEntryHref(state: TradeEntryRouteState = {}): string {
  const params = new URLSearchParams()
  fields.forEach((field) => {
    const value = state[field]
    if (value && (field !== 'returnTo' || isSafeReturnTo(value))) params.set(field, value)
  })
  const query = params.toString()
  return `/dashboard/trades/new${query ? `?${query}` : ''}`
}

export function loadTradeEntryDraft(userId: string, draftId = 'default'): TradeEntryDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(userId, draftId)) ?? 'null') as TradeEntryDraft | null
    return value?.version === 1 && value.userId === userId && value.draftId === draftId && typeof value.values === 'object' ? value : null
  } catch { return null }
}

export function saveTradeEntryDraft(draft: TradeEntryDraft): void { localStorage.setItem(key(draft.userId, draft.draftId), JSON.stringify(draft)) }
export function clearTradeEntryDraft(userId: string, draftId: string): void { localStorage.removeItem(key(userId, draftId)) }
