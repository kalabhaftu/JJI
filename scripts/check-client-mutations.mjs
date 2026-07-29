import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'

const roots = ['app', 'components', 'context', 'hooks', 'store']
const allowedProtocolModules = new Set([
  '@/server/auth',
  '@/app/actions/get-market-data',
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

function resolveImport(importer, specifier) {
  const base = specifier.startsWith('@/')
    ? resolve(process.cwd(), specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(importer), specifier)
      : null
  if (!base) return null

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

const allFiles = []
for (const root of [...roots, 'server']) {
  allFiles.push(...await walk(root))
}
const serverActionFiles = new Set()
for (const file of allFiles) {
  const source = await readFile(file, 'utf8')
  if (/^\s*['"]use server['"]/.test(source)) {
    serverActionFiles.add(resolve(file))
  }
}

const violations = []
for (const root of roots) {
  for (const file of await walk(root)) {
    const source = await readFile(file, 'utf8')
    if (!/^\s*['"]use client['"]/.test(source)) continue

    const imports = source.matchAll(
      /(?:from\s+|import\(\s*)['"]([^'"]+)['"]/g,
    )
    for (const match of imports) {
      const specifier = match[1]
      const statementStart = source.lastIndexOf('import', match.index)
      const statement = source.slice(statementStart, match.index)
      if (/^import\s+type\b/.test(statement.trimStart())) continue

      const resolvedImport = resolveImport(file, specifier)
      const importsServerModule = specifier.startsWith('@/server/')
      const importsServerAction = resolvedImport
        ? serverActionFiles.has(resolvedImport)
        : false
      if (
        (importsServerModule || importsServerAction)
        && !allowedProtocolModules.has(specifier)
      ) {
        violations.push(`${relative(process.cwd(), file)} -> ${specifier}`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Client modules must mutate through classified API routes:')
  for (const violation of violations.sort()) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log('Client mutation boundary check passed')
}
