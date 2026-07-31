import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SECURITY_CRITICAL_QUERY_FILES = [
  'server/trade-import-jobs.ts',
  'app/api/v1/prop-firm/accounts/validate-trade/route.ts',
  'app/dashboard/components/import/tradovate/sync/actions.ts',
  'app/api/v1/ai/chats/[chatId]/messages/route.ts',
]

describe('Drizzle predicate composition', () => {
  it.each(SECURITY_CRITICAL_QUERY_FILES)('%s never composes predicates with JavaScript &&', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')
    const unsafePredicate = /where:\s*\([^)]*\)\s*=>[^,\n]+\&\&[^,\n]+/

    expect(source).not.toMatch(unsafePredicate)
  })

  it('keeps AI account filters inside the user-owned base predicate', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/v1/ai/chats/[chatId]/messages/route.ts'), 'utf8')
    expect(source).not.toMatch(/return or\(\s*base,/)
    expect(source).toContain('eq(schema.MasterAccount.userId, userId)')
    expect(source).toContain("selectedSources.has('journals')")
  })
})
