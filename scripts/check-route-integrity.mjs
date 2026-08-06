#!/usr/bin/env node
// Route integrity and legacy-alias scanner (Phase 8, Task 8.1).
//
// Enforces the route-removal evidence gate WITHOUT performing removal:
// - the obsolete `/docs/donate` path is rejected in application source;
// - the canonical trade entry route `/dashboard/trades/new` must exist with consumers;
// - removed account/prop-firm-specific trade-entry aliases must stay absent;
// - dynamic path groups (`[id]`) used by trade scope stay present;
// - the `[...not-found]` catch-all is retained and must invoke `notFound()`.
//
// Non-approved legacy paths are REPORTED, never removed, and never fail the build:
// prop-firm redirect aliases and any remaining alias route require product
// approval plus external-consumer analytics evidence before removal.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const sourceRoots = ['app', 'components', 'context', 'hooks', 'lib', 'server', 'tests']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.mdx'])

// Test fixtures that intentionally name removed/obsolete paths as regression anchors.
const allowlistedFixtures = new Set([
  'tests/ui/canonical-trade-entry-contracts.test.ts', // asserts the account-specific trade-entry route is absent
  'tests/ui/docs-link-scan.test.ts', // asserts obsolete /docs/donate links are rejected
])

const obsoleteDocDonate = '/docs/donate'

const canonical = {
  page: 'app/dashboard/trades/new/page.tsx',
  draft: 'app/dashboard/trades/new/trade-entry-draft.ts',
  donatePage: 'app/donate/page.tsx',
}

// Trade-entry aliases that were removed; they must not reappear as routes or hrefs.
const removedAliasRoutes = [
  'app/dashboard/prop-firm/accounts/[id]/trades/new',
  'app/dashboard/accounts/[id]/trades/new',
]
const removedAliasHrefs = [
  '/dashboard/prop-firm/accounts/[id]/trades/new',
  '/dashboard/accounts/[id]/trades/new',
]

// Trade-entry consumers that must resolve through the canonical route.
const canonicalConsumers = [
  'components/quick-add-fab.tsx',
  'components/dashboard-shell-actions.tsx',
  'app/dashboard/components/navbar.tsx',
  'app/dashboard/components/empty-trade-state.tsx',
  'app/dashboard/prop-firm/accounts/[id]/trades/page.tsx',
]

const dynamicRouteGroups = [
  'app/dashboard/accounts/[id]/page.tsx',
  'app/dashboard/prop-firm/accounts/[id]/page.tsx',
  'app/dashboard/prop-firm/payouts/[id]/page.tsx',
]

const catchAllRoute = 'app/[...not-found]/page.tsx'

const failures = []
const reports = []

function walk(directory, files) {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if ([...extensions].some((extension) => path.endsWith(extension))) files.push(path)
  }
}

const files = []
sourceRoots.forEach((directory) => walk(join(root, directory), files))

for (const file of files) {
  const rel = relative(root, file)
  if (allowlistedFixtures.has(rel)) continue
  const source = readFileSync(file, 'utf8')

  if (source.includes(obsoleteDocDonate)) {
    failures.push(`${rel} references obsolete ${obsoleteDocDonate}; the canonical donation route is /donate`)
  }
  for (const href of removedAliasHrefs) {
    if (source.includes(href)) {
      failures.push(`${rel} references removed trade-entry alias ${href}; use /dashboard/trades/new instead`)
    }
  }
}

for (const alias of removedAliasRoutes) {
  if (existsSync(join(root, alias))) {
    reports.push(`${alias} still exists: account-specific trade-entry alias retained (pending approval; removal is the route-removal gate's exclusive step)`)
  }
}

for (const consumer of canonicalConsumers) {
  const path = join(root, consumer)
  if (!existsSync(path)) {
    failures.push(`Canonical trade-entry consumer ${consumer} is missing`)
  } else if (!readFileSync(path, 'utf8').includes('buildTradeEntryHref')) {
    failures.push(`${consumer} no longer resolves trade entry through the canonical route`)
  }
}

if (!existsSync(join(root, canonical.page)) || !readFileSync(join(root, canonical.page), 'utf8').includes('TradeEntryPageClient')) {
  failures.push(`Canonical trade-entry route ${canonical.page} is missing or not wired`)
}
if (!existsSync(join(root, canonical.draft)) || !readFileSync(join(root, canonical.draft), 'utf8').includes('buildTradeEntryHref')) {
  failures.push(`Canonical trade-entry draft module ${canonical.draft} is missing its href builder`)
}
if (!existsSync(join(root, canonical.donatePage))) {
  failures.push(`Canonical donation route ${canonical.donatePage} is missing (replacement for ${obsoleteDocDonate})`)
}

for (const group of dynamicRouteGroups) {
  if (!existsSync(join(root, group))) failures.push(`Dynamic path group route ${group} is missing`)
}

if (!existsSync(join(root, catchAllRoute))) {
  failures.push(`Catch-all route ${catchAllRoute} is missing`)
} else {
  const catchAllSource = readFileSync(join(root, catchAllRoute), 'utf8')
  if (!catchAllSource.includes('notFound()')) {
    failures.push(`${catchAllRoute} must invoke notFound() for 404 semantics`)
  }
  if (/^\s*return\s*\(/m.test(catchAllSource.split('notFound()')[1] ?? '')) {
    reports.push(`${catchAllRoute} renders unreachable markup after notFound(); markup is removable once approved`)
  }
}

// Prop-firm redirect aliases: retained pending approval, reported not removed.
// A redirect alias is a route page that immediately forwards to another route:
// a server `redirect(...)` or an unconditional mount-time `router.push(...)`.
const propFirmRoot = join(root, 'app/dashboard/prop-firm')
const propFirmFiles = []
walk(propFirmRoot, propFirmFiles)
for (const file of propFirmFiles) {
  const rel = relative(root, file)
  if (!/page\.(ts|tsx)$/.test(rel)) continue
  const source = readFileSync(file, 'utf8')
  const isServerAlias = /redirect\(\s*['"`]\/dashboard\//.test(source)
  const isMountAlias = /useEffect\(\s*\(\s*\)\s*=>\s*\{\s*router\.(?:push|replace)\(/.test(source)
  if (isServerAlias || isMountAlias) {
    reports.push(`${rel}: prop-firm redirect alias retained pending product approval (classification 'documented-external'; removal requires analytics evidence)`)
  }
}

for (const report of reports) console.log(`[report] ${report}`)
if (failures.length) {
  console.error('Route integrity check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Route integrity passed (${files.length} files scanned; canonical trade entry, dynamic groups, and catch-all verified; ${reports.length} pending-approval report(s))`)
