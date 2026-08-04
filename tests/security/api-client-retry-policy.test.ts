import { describe, expect, it } from 'vitest'

import { isRetryAllowed } from '@/lib/api/client'

describe('API retry policy', () => {
  it('allows retries only for safe reads by default', () => {
    expect(isRetryAllowed('GET', 'safe')).toBe(true)
    expect(isRetryAllowed('POST', 'safe')).toBe(false)
    expect(isRetryAllowed('DELETE', 'safe')).toBe(false)
    expect(isRetryAllowed('POST', 'never')).toBe(false)
  })
})
