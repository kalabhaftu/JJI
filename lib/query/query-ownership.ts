import type { queryKeys } from './query-keys'

export type ServerStateDomain =
  | 'accounts'
  | 'trades'
  | 'journal'
  | 'tags'
  | 'templates'
  | 'notifications'
  | 'reports'
  | 'prop-firm'
  | 'goals'
  | 'settings'

export interface DomainOwnership {
  domain: ServerStateDomain
  owner: 'tanstack-query'
  queryKeyFactory: `queryKeys.${keyof typeof queryKeys}` | 'not-established'
  invalidationEvents: readonly string[]
  mutationOwner: string
}

const ownership = (
  domain: ServerStateDomain,
  queryKeyFactory: DomainOwnership['queryKeyFactory'],
  mutationOwner: string,
): DomainOwnership => ({
  domain,
  owner: 'tanstack-query',
  queryKeyFactory,
  invalidationEvents: [`${domain}:mutated`],
  mutationOwner,
})

export const domainOwnership: Record<ServerStateDomain, DomainOwnership> = {
  accounts: ownership('accounts', 'queryKeys.accounts', 'account mutations'),
  trades: ownership('trades', 'queryKeys.trades', 'trade mutations'),
  journal: ownership('journal', 'queryKeys.journal', 'journal mutations'),
  tags: ownership('tags', 'queryKeys.tags', 'tag mutations'),
  templates: ownership('templates', 'queryKeys.templates', 'template mutations'),
  notifications: ownership('notifications', 'queryKeys.notifications', 'notification mutations'),
  reports: ownership('reports', 'queryKeys.reportStats', 'report mutations'),
  'prop-firm': ownership('prop-firm', 'not-established', 'prop-firm mutations'),
  goals: ownership('goals', 'not-established', 'goal mutations'),
  settings: ownership('settings', 'not-established', 'settings mutations'),
}
