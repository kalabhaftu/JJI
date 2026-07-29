import { describe, expect, it, vi } from 'vitest'

import { dispatchPhaseRiskAlerts } from '@/lib/services/phase-notifications'

describe('phase evaluation notifications', () => {
  it('reports notification failures without changing the evaluation outcome', async () => {
    const report = vi.fn()
    const result = await dispatchPhaseRiskAlerts([
      {
        userId: 'user-1',
        phaseAccountId: 'phase-1',
        riskType: 'daily_loss',
        currentPercentage: 80,
        metadata: {
          accountName: 'Challenge',
          currentBalance: 48_000,
          limit: 2_500,
          used: 2_000,
        },
      },
    ], {
      requestId: 'req-test',
      createAlert: vi.fn(async () => ({
        success: false,
        error: 'provider unavailable',
      })) as never,
      report,
    })

    expect(result).toEqual({ sent: 0, failed: 1 })
    expect(report).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: 'dispatch-risk-alert',
        entityId: 'phase-1',
        requestId: 'req-test',
      }),
    )
  })
})
