import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const protocolExemptions = new Set([
  'app/api/v1/ai/format-trades/route.ts',
  'app/api/v1/ai/mappings/route.ts',
  'app/api/v1/data/export/route.ts',
  'app/api/v1/market-data/route.ts',
  'app/api/v1/payments/redirect/route.ts',
  'app/api/v1/payments/webhook/route.ts',
  'app/api/v1/payments/whop-webhook/route.ts',
  'app/api/v1/thor/store/route.ts',
  'app/api/v1/user/data/backup/route.ts',
])

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path))
    else if (entry.name === 'route.ts') files.push(path)
  }
  return files
}

const violations = []
for (const file of await walk('app/api/v1')) {
  const normalized = relative(process.cwd(), file)
  const source = await readFile(file, 'utf8')
  const canonical = /createSuccessResponse|createErrorResponse|withCanonicalApiResponse/.test(source)
  if (!canonical && !protocolExemptions.has(normalized)) {
    violations.push(normalized)
  }
}

if (violations.length > 0) {
  console.error('v1 JSON routes without the canonical response contract:')
  for (const violation of violations.sort()) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log(`API response contract check passed (${protocolExemptions.size} protocol exemptions)`)
}
