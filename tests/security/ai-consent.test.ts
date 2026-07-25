import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      UserSettings: { findFirst },
    },
  },
}))

import { hasCurrentAiDataConsent } from '@/lib/services/ai-consent'
import { AI_DATA_CONSENT_VERSION } from '@/lib/user-settings'

describe('AI data processing consent', () => {
  beforeEach(() => findFirst.mockReset())

  it('fails closed when settings or consent metadata are absent', async () => {
    findFirst.mockResolvedValueOnce(null)
    expect(await hasCurrentAiDataConsent('user-1')).toBe(false)

    findFirst.mockResolvedValueOnce({
      aiSettings: { dataProcessingConsentAt: new Date().toISOString() },
    })
    expect(await hasCurrentAiDataConsent('user-1')).toBe(false)
  })

  it('requires the current disclosure version', async () => {
    findFirst.mockResolvedValueOnce({
      aiSettings: {
        dataProcessingConsentAt: new Date().toISOString(),
        dataProcessingConsentVersion: 'superseded',
      },
    })
    expect(await hasCurrentAiDataConsent('user-1')).toBe(false)
  })

  it('accepts a timestamp paired with the current disclosure version', async () => {
    findFirst.mockResolvedValueOnce({
      aiSettings: {
        dataProcessingConsentAt: new Date().toISOString(),
        dataProcessingConsentVersion: AI_DATA_CONSENT_VERSION,
      },
    })
    expect(await hasCurrentAiDataConsent('user-1')).toBe(true)
  })
})
