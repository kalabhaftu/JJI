import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const roots = ['app', 'components', 'context', 'hooks', 'lib', 'server']
const allowedDirectErrorLoggers = new Set([
  'app/dashboard/components/trade-replay/trade-replayer.tsx',
  'lib/observability/report-error.ts',
  'server/integrations/tradovate.ts',
])

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
for (const root of roots) {
  for (const file of await walk(root)) {
    const source = await readFile(file, 'utf8')
    const executableSource = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    if (
      !allowedDirectErrorLoggers.has(file)
      && /(?:logger|console)\.error\s*\(/.test(executableSource)
    ) {
      failures.push(`${file}: unexpected failures must use reportError`)
    }
    if (
      file !== 'lib/observability/report-error.ts'
      && /Sentry\.captureException\s*\(/.test(executableSource)
    ) {
      failures.push(`${file}: direct Sentry capture bypasses reportError`)
    }
  }
}

const tradovate = await readFile('server/integrations/tradovate.ts', 'utf8')
if (!/error:\s*\([^)]*\)\s*=>\s*\{[\s\S]*?reportError\(/.test(tradovate)) {
  failures.push('server/integrations/tradovate.ts: local error logger must delegate to reportError')
}

if (failures.length > 0) {
  console.error('Observability path check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Observability path check passed')
}
