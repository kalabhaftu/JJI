import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()
const migration = readFileSync(
  join(
    repositoryRoot,
    'supabase/migrations/20260722141000_server_only_rls.sql',
  ),
  'utf8',
)

function getSchemaTableNames(): string[] {
  const schemaDirectory = join(repositoryRoot, 'lib/db/schema')
  return readdirSync(schemaDirectory)
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) => {
      const source = readFileSync(join(schemaDirectory, file), 'utf8')
      return [...source.matchAll(/pgTable\('([^']+)'/g)].map(
        (match) => match[1] as string,
      )
    })
    .sort()
}

describe('server-only RLS migration', () => {
  it('covers every Drizzle table using its exact case-sensitive name', () => {
    const protectedTableBlock = migration.match(
      /protected_tables text\[\] := ARRAY\[([\s\S]*?)\];/,
    )?.[1]
    const protectedTables = [
      ...(protectedTableBlock ?? '').matchAll(/'([^']+)'/g),
    ]
      .map((match) => match[1] as string)
      .sort()

    expect(protectedTables).toEqual(getSchemaTableNames())
  })

  it('keeps browser writes revoked while preserving owner-scoped Realtime reads', () => {
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.%I FROM anon, authenticated',
    )

    for (const table of [
      'Trade',
      'Account',
      'MasterAccount',
      'PhaseAccount',
      'Payout',
      'DailyNote',
      'Notification',
    ]) {
      expect(migration).toContain(`public."${table}"`)
    }

    expect(migration).toContain('TO authenticated;')
    expect(migration).toContain('auth.uid()::text')
    expect(migration).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)/i)
  })
})
