import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const files = []
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path)
    else if (/\.(ts|tsx|js|jsx)$/.test(path)) files.push(path)
  }
}
for (const directory of ['app', 'components', 'lib', 'hooks']) walk(join(root, directory))

const failures = []
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  if (/TODO:\s*(implement|placeholder)|throw new Error\(['"]Not implemented/i.test(source)) failures.push(relative(root, file))
}
if (failures.length) {
  console.error(`Unresolved implementation placeholders:\n${failures.join('\n')}`)
  process.exit(1)
}
console.log(`Dead-code placeholder scan passed (${files.length} source files scanned)`)
