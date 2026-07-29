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
  'server/import-jobs/state.ts',
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

if (failures.length > 0) {
  console.error('Architecture replacement check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Architecture replacement source check passed')
}
