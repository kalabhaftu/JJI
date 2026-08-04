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
  | 'payouts'
  | 'goals'
  | 'settings'
  | 'playbook'
  | 'backtests'
  | 'synchronizations'

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
  'prop-firm': ownership('prop-firm', 'queryKeys.propFirmAccounts', 'usePropFirmQueries'),
  payouts: ownership('payouts', 'queryKeys.payouts', 'payout mutations'),
  goals: ownership('goals', 'queryKeys.goals', 'goal mutations'),
  settings: ownership('settings', 'queryKeys.settings', 'useSettingsQuery'),
  playbook: ownership('playbook', 'queryKeys.playbook', 'playbook mutations'),
  backtests: ownership('backtests', 'queryKeys.backtests', 'backtest mutations'),
  synchronizations: ownership('synchronizations', 'queryKeys.synchronizations', 'synchronization mutations'),
}
