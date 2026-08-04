import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('subscription server boundary', () => {
  it('keeps the dashboard guard off the subscription mutation barrel', () => {
    const source = readFileSync(join(process.cwd(), 'lib/services/subscription/access.ts'), 'utf8')
    expect(source).not.toContain("from '@/lib/services/subscription/checks'")
  })
})
