import type { QueryScope } from './query-scope'

export const queryKeys = {
  accounts: (scope: QueryScope, filters: unknown) => ['accounts', scope, filters] as const,
  account: (scope: QueryScope, accountId: string) => ['accounts', scope, 'detail', accountId] as const,
  trades: (scope: QueryScope, filters: unknown) => ['trades', scope, filters] as const,
  journal: (scope: QueryScope, params: unknown) => ['journal', scope, params] as const,
  tags: (scope: QueryScope) => ['tags', scope] as const,
  templates: (scope: QueryScope) => ['templates', scope] as const,
  reportStats: (scope: QueryScope, filters: unknown) => ['reports', 'stats', scope, filters] as const,
  notifications: (scope: QueryScope) => ['notifications', scope] as const,
  propFirmAccounts: (scope: QueryScope) => ['prop-firm', 'accounts', scope] as const,
  propFirmAccount: (scope: QueryScope, accountId: string) => ['prop-firm', 'accounts', scope, accountId] as const,
  propFirmTrades: (scope: QueryScope, accountId: string, filters: unknown) =>
    ['prop-firm', 'trades', scope, accountId, filters] as const,
  payouts: (scope: QueryScope, filters: unknown) => ['prop-firm', 'payouts', scope, filters] as const,
  payout: (scope: QueryScope, payoutId: string) => ['prop-firm', 'payouts', scope, 'detail', payoutId] as const,
  settings: (scope: QueryScope) => ['settings', scope] as const,
  goals: (scope: QueryScope) => ['goals', scope] as const,
  playbook: (scope: QueryScope) => ['playbook', scope] as const,
  backtests: (scope: QueryScope) => ['backtests', scope] as const,
  synchronizations: (scope: QueryScope) => ['synchronizations', scope] as const,
}

export const queryKeyPrefixes = {
  accounts: (scope: QueryScope) => ['accounts', scope] as const,
  trades: (scope: QueryScope) => ['trades', scope] as const,
  journal: (scope: QueryScope) => ['journal', scope] as const,
  tags: (scope: QueryScope) => ['tags', scope] as const,
  templates: (scope: QueryScope) => ['templates', scope] as const,
  reports: (scope: QueryScope) => ['reports', 'stats', scope] as const,
  notifications: (scope: QueryScope) => ['notifications', scope] as const,
  propFirmAccounts: (scope: QueryScope) => ['prop-firm', 'accounts', scope] as const,
  propFirmTrades: (scope: QueryScope) => ['prop-firm', 'trades', scope] as const,
  payouts: (scope: QueryScope) => ['prop-firm', 'payouts', scope] as const,
  settings: (scope: QueryScope) => ['settings', scope] as const,
  goals: (scope: QueryScope) => ['goals', scope] as const,
  playbook: (scope: QueryScope) => ['playbook', scope] as const,
  backtests: (scope: QueryScope) => ['backtests', scope] as const,
  synchronizations: (scope: QueryScope) => ['synchronizations', scope] as const,
}
