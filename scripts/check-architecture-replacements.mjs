import { access, readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

const requiredPaths = [
  'server/accounts/lifecycle.ts',
  'server/accounts/payouts.ts',
  'server/accounts/cache.ts',
  'server/accounts/notifications.ts',
  'server/accounts/phase-progression.ts',
  'server/accounts/prop-firm-lifecycle.ts',
  'server/accounts/funded-decision.ts',
  'server/trades/read.ts',
  'server/trades/save.ts',
  'server/trades/mutations.ts',
  'server/import-jobs/preparation.ts',
  'server/import-jobs/execution.ts',
  'server/import-jobs/lifecycle.ts',
  'server/import-jobs/processor.ts',
  'server/import-jobs/serialization.ts',
  'server/import-jobs/state.ts',
  'server/trade-import-jobs/lifecycle.ts',
  'server/trade-import-jobs/execution.ts',
  'server/trade-import-jobs/normalization.ts',
  'server/trade-import-jobs/types.ts',
  'lib/dashboard/analytics/common.ts',
  'lib/dashboard/analytics/curves.ts',
  'lib/dashboard/analytics/overview.ts',
  'lib/dashboard/analytics/strategy.ts',
  'lib/dashboard/analytics/behavior.ts',
  'server/ai/journal-analysis/preparation.ts',
  'server/ai/journal-analysis/prompt.ts',
  'server/ai/journal-analysis/provider.ts',
  'server/ai/journal-analysis/fallback.ts',
  'lib/tours/persistence.ts',
  'lib/tours/sample-csv.ts',
  'hooks/use-tour-interactions.ts',
  'hooks/use-rithmic-synchronization.ts',
  'lib/rithmic/message-handler.ts',
  'app/dashboard/settings/components/settings-dialogs.tsx',
  'app/dashboard/settings/components/settings-preferences-section.tsx',
  'app/dashboard/settings/components/settings-profile-section.tsx',
  'server/dashboard-templates-domain.ts',
  'server/weekly-review-domain.ts',
  'server/integrations/dxfeed.ts',
  'server/integrations/tradovate.ts',
  'app/api/v1/thor/store/route.ts',
  'app/api/v1/dashboard/templates/route.ts',
  'app/api/v1/weekly-journal/route.ts',
]

const removedImports = [
  '@/server/accounts',
  '@/server/database',
  '@/server/dashboard-templates',
  '@/server/notifications',
  '@/server/thor',
  '@/server/trades',
  '@/server/user-data',
  '@/server/weekly-review',
]

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (['.ts', '.tsx'].includes(extname(entry.name))) files.push(path)
  }
  return files
}

const failures = []
for (const path of requiredPaths) {
  await access(path).catch(() => failures.push(`missing replacement: ${path}`))
}

for (const root of ['app', 'components', 'context', 'hooks', 'lib', 'server', 'store']) {
  for (const file of await walk(root)) {
    const source = await readFile(file, 'utf8')
    for (const specifier of removedImports) {
      const exactImport = new RegExp(`['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)
      if (exactImport.test(source)) {
        failures.push(`${file}: imports removed module ${specifier}`)
      }
    }
  }
}

const utils = await readFile('lib/utils.ts', 'utf8')
if (!/export function cn/.test(utils) || utils.split('\n').length > 20) {
  failures.push('lib/utils.ts must remain the focused class-name helper')
}

const tradeImportFacade = await readFile('server/trade-import-jobs.ts', 'utf8')
if (tradeImportFacade.split('\n').length > 10) {
  failures.push('server/trade-import-jobs.ts must remain a compatibility export facade')
}

const archiveImportFacade = await readFile('server/import-jobs.ts', 'utf8')
if (archiveImportFacade.split('\n').length > 10) {
  failures.push('server/import-jobs.ts must remain a compatibility export facade')
}

const analyticsFacade = await readFile('lib/dashboard/analytics-calculations.ts', 'utf8')
if (analyticsFacade.split('\n').length > 10) {
  failures.push('lib/dashboard/analytics-calculations.ts must remain an analytics export facade')
}

const journalAnalysisOrchestrator = await readFile('server/ai/journal-analysis.ts', 'utf8')
if (journalAnalysisOrchestrator.split('\n').length > 100) {
  failures.push('server/ai/journal-analysis.ts must remain a thin analysis orchestrator')
}

const tourContext = await readFile('context/tour-context.tsx', 'utf8')
if (tourContext.split('\n').length > 360) {
  failures.push('context/tour-context.tsx must remain focused on tour state orchestration')
}

const rithmicContext = await readFile('context/rithmic-sync-context.tsx', 'utf8')
if (rithmicContext.split('\n').length > 350) {
  failures.push('context/rithmic-sync-context.tsx must remain focused on connection state and composition')
}

const settingsPage = await readFile('app/dashboard/settings/page.tsx', 'utf8')
if (settingsPage.split('\n').length > 750) {
  failures.push('app/dashboard/settings/page.tsx must remain focused on settings data orchestration')
}

if (failures.length > 0) {
  console.error('Architecture replacement check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Architecture replacement source check passed')
}
