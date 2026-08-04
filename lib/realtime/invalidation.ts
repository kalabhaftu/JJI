import type { QueryClient } from '@tanstack/react-query'

import { queryKeyPrefixes } from '@/lib/query/query-keys'
import type { QueryScope } from '@/lib/query/query-scope'

import type { ChangeEvent, DatabaseChange, RealtimeTable } from './types'

export type InvalidationMode = 'patch' | 'invalidate' | 'refresh-bootstrap'

export interface RealtimeInvalidationMap {
  table: RealtimeTable
  events: readonly ChangeEvent[]
  mode: InvalidationMode
  queryKeys(change: DatabaseChange, scope: QueryScope): readonly (readonly unknown[])[]
}

const ALL_EVENTS: readonly ChangeEvent[] = ['INSERT', 'UPDATE', 'DELETE']

export const realtimeInvalidationMaps: readonly RealtimeInvalidationMap[] = [
  {
    table: 'Trade',
    events: ALL_EVENTS,
    mode: 'invalidate',
    queryKeys: (_change, scope) => [
      queryKeyPrefixes.trades(scope),
      queryKeyPrefixes.reports(scope),
      queryKeyPrefixes.journal(scope),
    ],
  },
  {
    table: 'Account',
    events: ALL_EVENTS,
    mode: 'invalidate',
    queryKeys: (_change, scope) => [queryKeyPrefixes.accounts(scope)],
  },
  {
    table: 'MasterAccount',
    events: ALL_EVENTS,
    mode: 'invalidate',
    queryKeys: (_change, scope) => [
      queryKeyPrefixes.propFirmAccounts(scope),
      queryKeyPrefixes.accounts(scope),
    ],
  },
  {
    table: 'PhaseAccount',
    events: ALL_EVENTS,
    mode: 'invalidate',
    queryKeys: (_change, scope) => [
      queryKeyPrefixes.propFirmAccounts(scope),
      queryKeyPrefixes.propFirmTrades(scope),
    ],
  },
  {
    table: 'Payout',
    events: ALL_EVENTS,
    mode: 'invalidate',
    queryKeys: (_change, scope) => [
      queryKeyPrefixes.payouts(scope),
      queryKeyPrefixes.propFirmAccounts(scope),
    ],
  },
  {
    table: 'DailyNote',
    events: ALL_EVENTS,
    mode: 'invalidate',
    queryKeys: (_change, scope) => [queryKeyPrefixes.journal(scope)],
  },
  {
    table: 'Notification',
    events: ALL_EVENTS,
    mode: 'invalidate',
    queryKeys: (_change, scope) => [queryKeyPrefixes.notifications(scope)],
  },
  {
    table: 'Synchronization',
    events: ALL_EVENTS,
    mode: 'refresh-bootstrap',
    queryKeys: (_change, scope) => [
      queryKeyPrefixes.synchronizations(scope),
      queryKeyPrefixes.accounts(scope),
    ],
  },
]

const mapsByTable = new Map<RealtimeTable, RealtimeInvalidationMap>(
  realtimeInvalidationMaps.map((entry) => [entry.table, entry]),
)

export function getRealtimeInvalidationMap(table: RealtimeTable): RealtimeInvalidationMap | undefined {
  return mapsByTable.get(table)
}

export function resolveInvalidationKeys(
  change: DatabaseChange,
  scope: QueryScope,
): readonly (readonly unknown[])[] {
  if (scope.surface === 'authenticated' && change.session.userId !== scope.userId) return []

  const entry = mapsByTable.get(change.table)
  if (!entry || !entry.events.includes(change.event)) return []

  return entry.queryKeys(change, scope)
}

export async function invalidateQueriesForRealtimeChange(
  queryClient: QueryClient,
  change: DatabaseChange,
  scope: QueryScope,
): Promise<void> {
  const keys = resolveInvalidationKeys(change, scope)
  if (keys.length === 0) return

  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey: queryKey as unknown[] })),
  )
}
