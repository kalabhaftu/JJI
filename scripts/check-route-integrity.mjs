import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const sourceRoots = ['app', 'components', 'lib', 'hooks']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.mdx'])
const files = []

function walk(directory) {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path)
    else if ([...extensions].some((extension) => path.endsWith(extension))) files.push(path)
  }
}

sourceRoots.forEach((directory) => walk(join(root, directory)))
const failures = []
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  if (source.includes('/docs/donate')) failures.push(`${relative(root, file)} references obsolete /docs/donate`)
  if (source.includes('/dashboard/trades/new') && !existsSync(join(root, 'app/dashboard/trades/new/page.tsx'))) failures.push('Canonical trade-entry route is missing')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Route integrity passed (${files.length} source files scanned)`)
