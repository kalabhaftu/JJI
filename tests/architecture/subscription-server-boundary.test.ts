import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('subscription server boundary', () => {
  it('keeps the dashboard guard off the subscription mutation barrel', () => {
    const source = readFileSync(join(process.cwd(), 'lib/services/subscription/access.ts'), 'utf8')
    expect(source).not.toContain("from '@/lib/services/subscription/checks'")
  })

  it('keeps client entitlement derivation free of server database imports', () => {
    const provider = readFileSync(join(process.cwd(), 'context/data-provider.tsx'), 'utf8')
    expect(provider).toContain("from '@/lib/services/entitlement-capability'")
    expect(provider).not.toContain("from '@/lib/services/subscription-guard-service'")
  })
})
