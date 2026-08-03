import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/lib/query/query-keys'
import { domainOwnership } from '@/lib/query/query-ownership'
import type { ServerStateDomain } from '@/lib/query/query-ownership'

const domains: ServerStateDomain[] = [
  'accounts',
  'trades',
  'journal',
  'tags',
  'templates',
  'notifications',
  'reports',
  'prop-firm',
  'goals',
  'settings',
]

describe('server state ownership', () => {
  it('declares TanStack Query as the owner for every server-state domain', () => {
    for (const domain of domains) {
      const ownership = domainOwnership[domain]

      expect(ownership).toMatchObject({ domain, owner: 'tanstack-query' })
      const [, factoryName] = ownership.queryKeyFactory.split('.')

      if (ownership.queryKeyFactory === 'not-established') {
        expect(['prop-firm', 'goals', 'settings']).toContain(domain)
      } else {
        expect(factoryName && queryKeys[factoryName as keyof typeof queryKeys]).toEqual(expect.any(Function))
      }
      expect(ownership.mutationOwner).toBeTruthy()
      expect(ownership.invalidationEvents.length).toBeGreaterThan(0)
    }
  })
})
