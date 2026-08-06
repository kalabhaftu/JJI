#!/usr/bin/env node
// Unresolved placeholder / dead-code scanner (Phase 8, Task 8.1).
//
// Scans app, components, lib, hooks, and scripts for placeholder strings that
// have not been resolved, while allowing fully documented fixtures.
//
// Documented allowlist (fixtures are legitimate by design):
//   lib/geo.ts                     PLACEHOLDER_VALUES — sentinel geographic value fixture.
//   lib/supabase.ts                [YOUR_PROJECT_REF] — Supabase setup template marker.
//   app/demo/components/demo-network-interceptor.tsx  — "Not implemented in demo mode" demo fixture (501).
//   scripts/check-dead-code.mjs    — self-referential marker inside this scanner's own patterns.
//
// Bare TODO:/FIXME:/NOTE: editor notes are NOT unresolved placeholders and are
// allowed; only markers that request implement/placeholder work are flagged.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const sourceRoots = ['app', 'components', 'lib', 'hooks', 'scripts']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

const allowlistedFiles = new Set([
  'lib/geo.ts', // PLACEHOLDER_VALUES sentinel fixture
  'lib/supabase.ts', // [YOUR_PROJECT_REF] setup template
  'app/demo/components/demo-network-interceptor.tsx', // demo-mode 501 fixture
  'scripts/check-dead-code.mjs', // self-referential pattern source
])

const placeholderPatterns = [
  /\bNot implemented\b/i,
  /\bNotImplemented\b/,
  /TODO:\s*(?:implement|placeholder)\b/i,
  /FIXME:\s*(?:implement|placeholder)\b/i,
  /@TODO\s*(?:implement|placeholder)\b/i,
  /\bPLACEHOLDER\b(?!_VALUES\b)/,
  /\bYOUR_[A-Z_]{2,}\b/,
  /\bLorem ipsum\b/i,
  /<<<<<<<|>>>>>>>/,
  /\bTBD(?::|\.|$)/,
]

function walk(directory, files) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if ([...extensions].some((extension) => path.endsWith(extension))) files.push(path)
  }
}

const files = []
sourceRoots.forEach((directory) => walk(join(root, directory), files))

const failures = []
for (const file of files) {
  const rel = relative(root, file)
  if (allowlistedFiles.has(rel)) continue
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    for (const pattern of placeholderPatterns) {
      if (pattern.test(line)) {
        failures.push(`${rel}:${index + 1}: unresolved placeholder ${pattern}`)
        break
      }
    }
  }
}

if (failures.length) {
  console.error('Dead-code placeholder scan failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log(`Dead-code placeholder scan passed (${files.length} files scanned; allowlist: ${allowlistedFiles.size} documented fixtures)`)
