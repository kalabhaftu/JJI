'use client'

import { apiRequestData } from '@/lib/api/client'

export interface AccountRef {
  accountType: 'live' | 'prop-firm'
  accountId: string
}

export interface LiveAccountDetail {
  id: string
  number: string
  name?: string
  broker?: string
  displayName: string
  startingBalance: number
  currentEquity?: number
  status: string
  accountType: string
  tradeCount: number
  profitLoss?: number
  lastTradeDate?: string
  createdAt: string
}

function accountEndpoint({ accountType, accountId }: AccountRef): string {
  return accountType === 'prop-firm'
    ? `/api/v1/prop-firm/accounts/${accountId}`
    : `/api/v1/accounts/${accountId}`
}

export function fetchLiveAccountDetail(accountId: string, signal: AbortSignal): Promise<LiveAccountDetail> {
  return apiRequestData<LiveAccountDetail>(`/api/v1/accounts/${accountId}?t=${Date.now()}`, {
    signal,
    retry: { mode: 'safe' },
    cache: 'no-store',
    operation: 'load-account-detail',
  })
}

export function deleteAccountRequest({ accountType, accountId }: AccountRef): Promise<unknown> {
  return apiRequestData<unknown>(accountEndpoint({ accountType, accountId }), {
    method: 'DELETE',
    retry: { mode: 'never' },
    operation: 'delete-live-account',
  })
}

export function setAccountArchived({ accountType, accountId }: AccountRef, isArchived: boolean): Promise<unknown> {
  return apiRequestData<unknown>(accountEndpoint({ accountType, accountId }), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isArchived }),
    retry: { mode: 'never' },
    operation: isArchived ? 'restore-account' : 'archive-account',
  })
}
