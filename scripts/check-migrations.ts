import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const migrationsDirectory = join(root, 'supabase', 'migrations')
const journalPath = join(migrationsDirectory, 'meta', '_journal.json')

const migrationFiles = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort()

const invalidNames = migrationFiles.filter((name) => (
  !/^(?:\d{14}|\d{4})_[a-z0-9_]+\.sql$/.test(name)
))
if (invalidNames.length > 0) {
  throw new Error(`Invalid migration names: ${invalidNames.join(', ')}`)
}

const versions = migrationFiles.map((name) => name.split('_', 1)[0])
const duplicateVersions = versions.filter(
  (version, index) => versions.indexOf(version) !== index,
)
if (duplicateVersions.length > 0) {
  throw new Error(
    `Duplicate migration versions: ${[...new Set(duplicateVersions)].join(', ')}`,
  )
}

if (!existsSync(journalPath)) {
  throw new Error('Drizzle journal is missing')
}

const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
  entries?: Array<{ tag?: string }>
}
const missingJournalFiles = (journal.entries ?? [])
  .map((entry) => entry.tag)
  .filter((tag): tag is string => Boolean(tag))
  .filter((tag) => !migrationFiles.includes(`${tag}.sql`))
if (missingJournalFiles.length > 0) {
  throw new Error(
    `Drizzle journal entries without SQL files: ${missingJournalFiles.join(', ')}`,
  )
}

const imperativeMigrations = migrationFiles.filter((name) => /^\d{14}_/.test(name))
const drizzleMigrations = migrationFiles.filter((name) => /^\d{4}_/.test(name))

function changedFiles(): string[] {
  try {
    const args = process.env.GITHUB_BASE_REF
      ? ['diff', '--name-only', `origin/${process.env.GITHUB_BASE_REF}...HEAD`]
      : ['diff', '--name-only', 'HEAD']
    const tracked = execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
    }).trim().split('\n').filter(Boolean)
    const untracked = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: root, encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean)
    return [...new Set([...tracked, ...untracked])]
  } catch {
    return []
  }
}

const changed = changedFiles()
const changedSchema = changed.some((name) => name.startsWith('lib/db/schema/'))
const changedMigration = changed.some((name) => (
  name.startsWith('supabase/migrations/') && name.endsWith('.sql')
))
if (changedSchema && !changedMigration) {
  throw new Error(
    'Drizzle schema changed without a matching Supabase migration',
  )
}

console.log(JSON.stringify({
  migrationSourceOfTruth: 'supabase/migrations',
  total: migrationFiles.length,
  imperative: imperativeMigrations.length,
  drizzleJournaled: drizzleMigrations.length,
  changedSchema,
  changedMigration,
}, null, 2))
