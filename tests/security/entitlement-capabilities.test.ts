import { describe, expect, it } from 'vitest'

import { deriveEntitlementCapability } from '@/lib/services/subscription-guard-service'

describe('server-derived entitlement capabilities', () => {
  it.each(['active', 'trialing'])('allows Plus presentation for %s', (status) => {
    expect(deriveEntitlementCapability({ hasAccess: true, status })).toMatchObject({
      canAccessDashboard: true,
      canUsePlusFeatures: true,
      status,
      source: 'server',
      isAuthoritative: false,
    })
  })

  it.each(['free', 'expired', 'unpaid', 'permission_denied'])('denies Plus presentation for %s', (status) => {
    expect(deriveEntitlementCapability({ hasAccess: false, status })).toMatchObject({
      canAccessDashboard: false,
      canUsePlusFeatures: false,
      status: status === 'free' ? 'unavailable' : status,
    })
  })

  it('denies missing or malformed server data', () => {
    expect(deriveEntitlementCapability(null).canUsePlusFeatures).toBe(false)
    expect(deriveEntitlementCapability({ hasAccess: true, status: 'not-a-status' }).canUsePlusFeatures).toBe(false)
  })
})
