import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('canonical trade entry route contracts', () => {
  it('leaves no broken dashboard route literal in app or components', () => {
    const hits = execFileSync('bash', ['-lc', 'rg --line-number "/dashboard/n" app components || true'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)

    expect(hits).toEqual([])
  })

  it('removes the obsolete account-specific trade entry route', () => {
    expect(() => statSync('app/dashboard/prop-firm/accounts/[id]/trades/new')).toThrow()
  })

  it('keeps the canonical trade entry route files', () => {
    for (const file of [
      'app/dashboard/trades/new/page.tsx',
      'app/dashboard/trades/new/trade-entry-page-client.tsx',
      'app/dashboard/trades/new/trade-entry-draft.ts',
    ]) {
      expect(readFileSync(file, 'utf8').length, file).toBeGreaterThan(0)
    }
  })

  it('wires route context validation into the canonical page client', () => {
    const source = readFileSync('app/dashboard/trades/new/trade-entry-page-client.tsx', 'utf8')

    expect(source).toContain('queryKeys.propFirmAccount')
    expect(source).toContain('isScopeReady')
    expect(source).toContain('Account not found or inaccessible')
  })
})
