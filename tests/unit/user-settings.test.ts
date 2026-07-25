import { describe, expect, it } from 'vitest'

import { pickSettingsPatch } from '@/lib/user-settings'

describe('user settings patching', () => {
  it('does not reset AI settings when the field is omitted as undefined', () => {
    const patch = pickSettingsPatch({
      firstName: 'Slim',
      lastName: 'Shady',
      autoAdjustAccountDate: true,
      aiSettings: undefined,
    })

    expect(patch).toEqual({
      autoAdjustAccountDate: true,
    })
  })

  it('normalizes AI settings when they are explicitly provided', () => {
    const patch = pickSettingsPatch({
      aiSettings: {
        autoGenerateInsights: true,
      },
    })

    expect(patch.aiSettings).toEqual({
      autoGenerateInsights: true,
      includeAiInsightsInNotifications: false,
      dataProcessingConsentAt: null,
      dataProcessingConsentVersion: null,
    })
  })
})
