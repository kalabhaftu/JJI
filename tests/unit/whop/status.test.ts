import { describe, expect, it } from 'vitest'

import { mapWhopStatusToLocal } from '@/lib/services/whop/status'

describe('Whop membership status mapping', () => {
  it.each(['active', 'trialing', 'completed', 'canceling'] as const)(
    'keeps access active for %s',
    (status) => expect(mapWhopStatusToLocal(status)).toBe('active'),
  )

  it('maps grace and terminal states without granting unknown access', () => {
    expect(mapWhopStatusToLocal('past_due')).toBe('past_due')
    expect(mapWhopStatusToLocal('canceled')).toBe('cancelled')
    expect(mapWhopStatusToLocal('expired')).toBe('expired')
    expect(mapWhopStatusToLocal('unresolved')).toBe('unpaid')
    expect(mapWhopStatusToLocal('drafted')).toBe('unpaid')
  })
})
