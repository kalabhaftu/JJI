import { describe, expect, it } from 'vitest'

import { tradeUpdateSchema } from '@/lib/trades/update-schema'

describe('trade update schema', () => {
  it('accepts supported journal metadata', () => {
    expect(tradeUpdateSchema.safeParse({
      comment: 'Waited for confirmation',
      tags: ['discipline'],
      marketBias: 'BULLISH',
      ruleBroken: false,
    }).success).toBe(true)
  })

  it.each(['id', 'userId', 'accountId', 'phaseAccountId', 'tradeIdentityKey', 'createdAt'])(
    'rejects immutable or ownership field %s',
    (field) => {
      expect(tradeUpdateSchema.safeParse({ [field]: 'attacker-controlled' }).success).toBe(false)
    }
  )
})
