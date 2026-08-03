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
  queryKeyFactory: string
  invalidationEvents: readonly string[]
  mutationOwner: string
}

const ownership = (
  domain: ServerStateDomain,
  queryKeyFactory: string,
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
  'prop-firm': ownership('prop-firm', 'queryKeys.propFirm', 'prop-firm mutations'),
  goals: ownership('goals', 'queryKeys.goals', 'goal mutations'),
  settings: ownership('settings', 'queryKeys.settings', 'settings mutations'),
}
