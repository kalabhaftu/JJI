import type { TourId, TourStep } from '@/lib/tours/types'

const routeStep = (
  id: string,
  title: string,
  content: string,
  route: string,
  targetSelector?: string,
): TourStep => ({
  id,
  title,
  content,
  route,
  ...(targetSelector ? { targetSelector } : {}),
  placement: targetSelector ? 'bottom' : 'center',
  completion: { type: 'route', key: route },
})

const actionStep = (
  id: string,
  title: string,
  content: string,
  route: string,
  targetSelector: string,
  eventKey: string,
): TourStep => ({
  id,
  title,
  content,
  route,
  targetSelector,
  placement: 'bottom',
  completion: { type: 'event', key: eventKey },
})

export const TOURS: Record<TourId, TourStep[]> = {
  onboarding: [
    {
      id: 'welcome',
      title: 'Welcome to JJI',
      content: 'Set up your workspace, bring in your trades, and review the decisions behind your performance.',
      route: '/dashboard',
      placement: 'center',
    },
    routeStep('overview', 'Overview', 'Your Overview brings performance, risk, and recent activity into one working view.', '/dashboard', '[data-tour="widget-canvas"]'),
    routeStep('accounts', 'Accounts', 'Manage live portfolios and prop-firm phases from Accounts.', '/dashboard/accounts', '[data-tour="add-account-btn"]'),
    actionStep('import', 'Import trades', 'Import history from a broker or CSV. JJI keeps the original workflow visible while you work.', '/dashboard', '[data-tour="import-nav-btn"]', 'import.opened'),
    {
      id: 'finish',
      title: 'You are ready',
      content: 'Choose a section from the getting-started checklist whenever you want a deeper walkthrough.',
      route: '/dashboard',
      placement: 'center',
    },
  ],
  overview: [
    routeStep('overview-start', 'Your Overview', 'Use this page as your daily starting point for performance and risk.', '/dashboard', '[data-tour="widget-canvas"]'),
    actionStep('overview-accounts', 'Filter by account', 'Select one or more trading accounts to focus the dashboard.', '/dashboard', '[data-tour="navbar-accounts-btn"]', 'account-filter.changed'),
    actionStep('overview-quick-add', 'Log one trade', 'Quick Add is useful when you need to record a trade without opening the full importer.', '/dashboard', '[data-tour="quick-add-btn"]', 'trade.quick-add.opened'),
    {
      ...actionStep('overview-theme', 'Set your working view', 'Choose a theme that stays comfortable during long review sessions.', '/dashboard', '[data-tour="theme-switcher-btn"]', 'theme.changed'),
      desktopOnly: true,
    },
  ],
  dashboard: [],
  accounts: [
    routeStep('accounts-start', 'Accounts', 'Keep each portfolio separate so its results and risk stay meaningful.', '/dashboard/accounts'),
    actionStep('accounts-create', 'Create a portfolio', 'Use New Account for personal trading or a prop-firm challenge.', '/dashboard/accounts', '[data-tour="add-account-btn"]', 'account.create.started'),
    actionStep('accounts-choose', 'Choose the account type', 'Pick Live Account for personal trading, or Prop Firm for a funded challenge.', '/dashboard/accounts', '[data-tour="create-live-item"], [data-tour="create-prop-item"]', 'account.create.form.opened'),
    {
      id: 'accounts-name',
      title: 'Name the account',
      content: 'Give the account a recognizable name in the form.',
      route: '/dashboard/accounts',
      targetSelector: '[data-tour="account-name-input"]',
      placement: 'bottom',
      completion: { type: 'value', key: '[data-tour="account-name-input"]' },
    },
    {
      id: 'accounts-broker',
      title: 'Pick your broker',
      content: 'Select the broker or prop firm from the dropdown.',
      route: '/dashboard/accounts',
      targetSelector: '[data-tour="account-broker-select"]',
      placement: 'bottom',
      completion: { type: 'selector', key: '[data-tour="account-broker-select"]' },
    },
    {
      id: 'accounts-save',
      title: 'Create the account',
      content: 'Fill in the remaining details, then save. The tour continues as soon as the account is created.',
      route: '/dashboard/accounts',
      targetSelector: '[data-tour="create-account-submit"]',
      placement: 'bottom',
      completion: { type: 'event', key: 'account.created' },
    },
    actionStep('accounts-import', 'Import from here', 'Import Trades is available from the shared navigation when you are ready.', '/dashboard/accounts', '[data-tour="import-nav-btn"]', 'import.opened'),
    routeStep('accounts-review', 'Review account health', 'Account cards show balance, trade count, and the state of each portfolio.', '/dashboard/accounts', '[data-tour="account-card"]'),
  ],
  trades: [
    routeStep('trades-start', 'Trades', 'Trades is your detailed ledger for execution review.', '/dashboard/table', '[data-tour="sidebar-table"]'),
    routeStep('trades-row', 'Read the ledger', 'Start with instrument, result, and holding time before opening the full detail view.', '/dashboard/table', '[data-tour="trade-row-first"]'),
    actionStep('trades-detail', 'Open trade details', 'Inspect execution, tags, strategy rules, and context on a single trade.', '/dashboard/table', '[data-tour="view-trade-btn"]', 'trade.detail.opened'),
    actionStep('trades-close', 'Return to the ledger', 'Close the detail panel when you are ready to continue reviewing.', '/dashboard/table', '[data-tour="close-trade-detail"]', 'trade.detail.closed'),
  ],
  journal: [
    routeStep('journal-start', 'Journal', 'Journal groups trading decisions by day so you can review context, not just outcomes.', '/dashboard/journal', '[data-tour="sidebar-journal"]'),
    actionStep('journal-cards', 'Review daily cards', 'Cards give you a quick view of each trading day and its notes.', '/dashboard/journal', '[data-tour="journal-view-cards-btn"]', 'journal.view.cards'),
    actionStep('journal-calendar', 'Use the calendar', 'Switch to the calendar when you want to spot patterns across time.', '/dashboard/journal', '[data-tour="journal-view-calendar-btn"]', 'journal.view.calendar'),
  ],
  reports: [
    routeStep('reports-start', 'Reports', 'Reports turns your history into performance, risk, and session evidence.', '/dashboard/reports'),
    actionStep('reports-accounts', 'Compare account views', 'Use the account report view when you want to compare challenge and live-account evidence.', '/dashboard/reports', '[data-tour="reports-tab-propfirm"]', 'reports.tab.propfirm'),
    actionStep('reports-spreadsheet', 'Inspect the details', 'Use the spreadsheet view when you need row-level evidence.', '/dashboard/reports', '[data-tour="reports-tab-spreadsheet"]', 'reports.tab.spreadsheet'),
    actionStep('reports-statement', 'Read the statement', 'The statement brings the headline metrics and distribution together.', '/dashboard/reports', '[data-tour="reports-tab-statement"]', 'reports.tab.statement'),
  ],
  analytics: [],
  playbook: [
    routeStep('playbook-start', 'Playbook', 'Store the models and rules you want to review against real trades.', '/dashboard/playbook'),
    routeStep('playbook-filter', 'Find a model', 'Filter the playbook by account or trading model when reviewing a setup.', '/dashboard/playbook'),
    routeStep('playbook-review', 'Keep the link to trades', 'A playbook entry becomes useful when it is connected to the trades it describes.', '/dashboard/playbook'),
  ],
  backtesting: [
    routeStep('backtesting-start', 'Backtesting', 'Test a rule set against historical data before treating it as evidence.', '/dashboard/backtesting'),
    routeStep('backtesting-results', 'Read results carefully', 'Use the result set to compare assumptions, drawdown, and consistency.', '/dashboard/backtesting'),
  ],
  goals: [
    routeStep('goals-start', 'Goals', 'Set measurable review targets for the habits and outcomes you want to improve.', '/dashboard/goals'),
    routeStep('goals-progress', 'Track progress', 'Goals stay useful when progress is checked against your actual trade history.', '/dashboard/goals'),
  ],
  assistant: [
    routeStep('assistant-start', 'Assistant', 'Ask questions against the JJI data you explicitly choose to share with the assistant.', '/dashboard/ai'),
    routeStep('assistant-sources', 'Choose evidence', 'Select the sources that should inform the answer before sending a prompt.', '/dashboard/ai'),
    routeStep('assistant-review', 'Save useful findings', 'Keep durable insights in your workspace when an answer is worth revisiting.', '/dashboard/ai'),
  ],
  data: [
    routeStep('data-start', 'Data', 'Export, manage, and understand the data stored in your workspace.', '/dashboard/data'),
    routeStep('data-actions', 'Choose a data action', 'Use the Data area when you need a controlled export or cleanup task.', '/dashboard/data'),
  ],
  settings: [
    routeStep('settings-start', 'Settings', 'Settings keeps profile, preferences, connections, security, and help together.', '/dashboard/settings'),
    actionStep('settings-preferences', 'Tune preferences', 'Set the choices that make daily review comfortable and consistent.', '/dashboard/settings', '[data-tour="settings-tab-preferences"]', 'settings.tab.preferences'),
    actionStep('settings-integrations', 'Manage connections', 'Review broker and webhook connections from Integrations, and sign-in providers from Connections.', '/dashboard/settings', '[data-tour="settings-tab-integrations"]', 'settings.tab.integrations'),
    actionStep('settings-help', 'Find the tour checklist', 'Return to Help whenever you want to restart or choose another section tour.', '/dashboard/settings', '[data-tour="settings-tab-help"]', 'settings.tab.help'),
  ],
}
