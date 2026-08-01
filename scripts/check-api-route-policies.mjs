import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

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

const mutations = /export\s+(?:(?:async\s+)?function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/
const classified = /applyApiRoutePolicy/
const violations = []

for (const file of await walk('app/api')) {
  const source = await readFile(file, 'utf8')
  const trustedProtocol = file.includes('app/api/cron/')
    || file.endsWith('app/api/v1/payments/webhook/route.ts')
    || file.endsWith('app/api/v1/thor/store/route.ts')
  if (mutations.test(source) && !trustedProtocol && !classified.test(source)) {
    violations.push(relative(process.cwd(), file))
  }
  if (/applyRateLimit\s*\(/.test(source)) {
    violations.push(`${relative(process.cwd(), file)} uses direct applyRateLimit instead of the route-policy registry`)
  }
}

if (violations.length > 0) {
  console.error('Mutation routes without a rate-limit/trusted-endpoint classification:')
  for (const violation of violations.sort()) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log('API route policy check passed')
}
