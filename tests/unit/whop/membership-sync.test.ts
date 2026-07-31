import { describe, it, expect } from 'vitest'
import { mapWhopStatusToLocal } from '@/lib/services/whop/membership-sync'

describe('Whop Status Mapping', () => {
  it('should map active statuses to active', () => {
    expect(mapWhopStatusToLocal('active', false)).toBe('active')
    
    // Even if cancel at period end is true, it remains active until that date
    expect(mapWhopStatusToLocal('active', true)).toBe('active')
  })

  it('should map grace-period statuses to past_due', () => {
    expect(mapWhopStatusToLocal('past_due', false)).toBe('past_due')
    expect(mapWhopStatusToLocal('incomplete', false)).toBe('past_due')
  })

  it('should map terminal statuses to expired', () => {
    expect(mapWhopStatusToLocal('expired', false)).toBe('expired')
    expect(mapWhopStatusToLocal('canceled', false)).toBe('expired')
    expect(mapWhopStatusToLocal('cancelled', false)).toBe('expired')
    expect(mapWhopStatusToLocal('trialing', false)).toBe('expired')
  })

  it('should fallback unknown statuses to expired for safety', () => {
    expect(mapWhopStatusToLocal('unknown_weird_status', false)).toBe('expired')
  })
})
