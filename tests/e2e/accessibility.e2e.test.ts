import {
  DEMO_PROP_FIRM_ACCOUNT_ID,
  DEFAULT_VIEWPORT,
  MOBILE_VIEWPORT,
  NOT_FOUND_PATH,
  SHARED_REPORT_SLUG,
  describeScenario,
  expect,
  expectNoCriticalOrSerious,
  hasAuthStorageState,
  navigateRefusingProduction,
  runAxeScan,
  test,
  type AccentPack,
  type RouteMetadata,
  type ThemePreference,
} from './fixtures'

interface A11yCase {
  metadata: RouteMetadata
  path: string
}

const UNAUTHENTICATED_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000'

function case_(
  routeFamily: string,
  path: string,
  state: 'public' | 'demo' | 'authenticated' = 'public',
  viewport: { width: number; height: number } = DEFAULT_VIEWPORT,
  theme: ThemePreference = 'dark',
  accentPack: AccentPack = 'classic',
): A11yCase {
  return { metadata: describeScenario(routeFamily, state, viewport, theme, accentPack), path }
}

const a11yCases: A11yCase[] = [
  case_('home', '/'),
  case_('home-light', '/', 'public', MOBILE_VIEWPORT, 'light', 'violet'),
  case_('login', '/login'),
  case_('login-light', '/login', 'public', MOBILE_VIEWPORT, 'light'),
  case_('subscribe-status', '/subscribe/status'),
  case_('docs', '/docs'),
  case_('shared-report', `/reports/shared/${SHARED_REPORT_SLUG}`),
  case_('not-found', NOT_FOUND_PATH, 'public', MOBILE_VIEWPORT),

  case_('demo-dashboard', '/demo', 'demo'),
  case_('demo-reports', '/demo/reports', 'demo'),
  case_('demo-table', '/demo/table', 'demo'),
  case_('demo-accounts', '/demo/accounts', 'demo'),
  case_('demo-journal', '/demo/journal', 'demo'),
  case_('demo-ai', '/demo/ai', 'demo'),
  case_('demo-playbook', '/demo/playbook', 'demo'),
  case_('demo-backtesting', '/demo/backtesting', 'demo'),
  case_('demo-goals', '/demo/goals', 'demo'),
  case_('demo-data', '/demo/data', 'demo'),
  case_('demo-prop-firm-account', `/demo/prop-firm/accounts/${DEMO_PROP_FIRM_ACCOUNT_ID}`, 'demo'),

  case_('dashboard', '/dashboard', 'authenticated'),
  case_('dashboard-journal', '/dashboard/journal', 'authenticated'),
  case_('dashboard-reports', '/dashboard/reports', 'authenticated'),
  case_('dashboard-table', '/dashboard/table', 'authenticated'),
  case_('dashboard-trades-new', '/dashboard/trades/new', 'authenticated'),
  case_('dashboard-accounts', '/dashboard/accounts', 'authenticated'),
  case_('dashboard-import', '/dashboard/import', 'authenticated'),
  case_('dashboard-data', '/dashboard/data', 'authenticated'),
  case_('dashboard-ai', '/dashboard/ai', 'authenticated'),
  case_('dashboard-playbook', '/dashboard/playbook', 'authenticated'),
  case_('dashboard-backtesting', '/dashboard/backtesting', 'authenticated'),
  case_('dashboard-goals', '/dashboard/goals', 'authenticated'),
  case_('dashboard-settings', '/dashboard/settings', 'authenticated'),
  case_(
    'dashboard-prop-firm-account',
    `/dashboard/prop-firm/accounts/${UNAUTHENTICATED_ACCOUNT_ID}`,
    'authenticated',
  ),
]

for (const axeCase of a11yCases) {
  const { routeFamily, state, viewport, theme, accentPack } = axeCase.metadata

  test(`axe scan: ${routeFamily} [${state}/${theme}/${accentPack}/${viewport.width}px]`, async (
    { page, authenticatedPage },
    testInfo,
  ) => {
    test.skip(
      state === 'authenticated' && !hasAuthStorageState(),
      'explicit PLAYWRIGHT_AUTH_STORAGE_STATE file required for authenticated axe scans',
    )

    await testInfo.attach('scenario-metadata', {
      body: JSON.stringify(axeCase.metadata, null, 2),
      contentType: 'application/json',
    })

    const targetPage = state === 'authenticated' ? authenticatedPage : page
    if (viewport.width !== DEFAULT_VIEWPORT.width || viewport.height !== DEFAULT_VIEWPORT.height) {
      await targetPage.setViewportSize({ width: viewport.width, height: viewport.height })
    }
    await targetPage.emulateMedia({ colorScheme: theme === 'light' ? 'light' : 'dark' })

    await navigateRefusingProduction(targetPage, axeCase.path)
    await expect(targetPage.locator('body')).toBeVisible()

    const summary = await runAxeScan(targetPage, { routeFamily })

    await testInfo.attach('axe-summary', {
      body: JSON.stringify(summary.counts, null, 2),
      contentType: 'application/json',
    })

    expectNoCriticalOrSerious(summary)
  })
}