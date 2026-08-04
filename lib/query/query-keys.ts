import type { QueryScope } from './query-scope'

export const queryKeys = {
  accounts: (scope: QueryScope, filters: unknown) => ['accounts', scope, filters] as const,
  trades: (scope: QueryScope, filters: unknown) => ['trades', scope, filters] as const,
  journal: (scope: QueryScope, params: unknown) => ['journal', scope, params] as const,
  tags: (scope: QueryScope) => ['tags', scope] as const,
  templates: (scope: QueryScope) => ['templates', scope] as const,
  reportStats: (scope: QueryScope, filters: unknown) => ['reports', 'stats', scope, filters] as const,
  notifications: (scope: QueryScope) => ['notifications', scope] as const,
}
