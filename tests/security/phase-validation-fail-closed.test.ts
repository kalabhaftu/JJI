import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiRequestData } = vi.hoisted(() => ({ apiRequestData: vi.fn() }))

vi.mock('@/lib/api/client', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api/client')>()
  return { ...mod, apiRequestData }
})

import { ApiClientError, type ApiErrorKind } from '@/lib/api/client'
import { isPhaseValidationAllowed, runPhaseValidation } from '@/lib/validation/phase-validation'

const ALL_KINDS: ApiErrorKind[] = [
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'rate_limited',
  'timeout',
  'cancelled',
  'offline',
  'server',
  'invalid_response',
  'unknown',
]

function apiError(kind: ApiErrorKind, status = 500, requestId?: string): ApiClientError {
  return new ApiClientError({ message: `${kind} failed`, status, kind, requestId })
}

describe('runPhaseValidation fails closed', () => {
  beforeEach(() => apiRequestData.mockReset())

  it('issues the canonical validate request', async () => {
    apiRequestData.mockResolvedValue({ accountType: 'regular' })

    await runPhaseValidation('acct-1')

    expect(apiRequestData).toHaveBeenCalledWith('/api/v1/prop-firm/accounts/validate-trade', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountNumber: 'acct-1' }),
      retry: { mode: 'never' },
      operation: 'validate-manual-trade-phase',
    }))
  })

  it.each(ALL_KINDS)('returns a blocked state (never valid, never throws) for ApiClientError kind %s', async (kind) => {
    apiRequestData.mockRejectedValueOnce(apiError(kind))

    const state = await runPhaseValidation('acct-1')

    expect(state.status).toBe('blocked')
    expect(isPhaseValidationAllowed(state)).toBe(false)
  })

  it('maps validation + 422 to invalid_phase', async () => {
    apiRequestData.mockRejectedValueOnce(apiError('validation', 422))

    const state = await runPhaseValidation('acct-1')

    expect(state).toEqual({
      status: 'blocked',
      reason: 'invalid_phase',
      message: 'The selected account phase is not active.',
    })
    expect(isPhaseValidationAllowed(state)).toBe(false)
  })

  it('maps validation + non-422 to malformed_response', async () => {
    apiRequestData.mockRejectedValueOnce(apiError('validation', 400))

    const state = await runPhaseValidation('acct-1')

    expect(state).toMatchObject({ status: 'blocked', reason: 'malformed_response' })
  })

  it('maps rate_limited to server_error', async () => {
    apiRequestData.mockRejectedValueOnce(apiError('rate_limited', 429))

    const state = await runPhaseValidation('acct-1')

    expect(state).toMatchObject({ status: 'blocked', reason: 'server_error' })
  })

  it('maps server, conflict, cancelled, invalid_response, unknown to server_error', async () => {
    for (const kind of ['server', 'conflict', 'cancelled', 'invalid_response', 'unknown'] as ApiErrorKind[]) {
      apiRequestData.mockRejectedValueOnce(apiError(kind))

      const state = await runPhaseValidation('acct-1')

      expect(state.status).toBe('blocked')
      expect(state.reason).toBe('server_error')
    }
  })

  it('attaches requestId from the ApiClientError', async () => {
    apiRequestData.mockRejectedValueOnce(apiError('server', 500, 'req-xyz'))

    const state = await runPhaseValidation('acct-1')

    expect(state).toMatchObject({ status: 'blocked', reason: 'server_error', requestId: 'req-xyz' })
  })

  it('blocks on non-ApiClientError throws without propagating', async () => {
    apiRequestData.mockRejectedValueOnce(new Error('boom'))

    const state = await runPhaseValidation('acct-1')

    expect(state).toMatchObject({ status: 'blocked', reason: 'server_error' })
    expect(isPhaseValidationAllowed(state)).toBe(false)
  })

  it('returns valid for a well-formed response', async () => {
    apiRequestData.mockResolvedValueOnce({ accountType: 'prop-firm', phaseNumber: 3 })

    const state = await runPhaseValidation('acct-1')

    expect(state).toEqual({ status: 'valid', accountType: 'prop-firm', phaseNumber: 3 })
    expect(isPhaseValidationAllowed(state)).toBe(true)
  })

  it('blocks with malformed_response for a 200 response without an accountType', async () => {
    apiRequestData.mockResolvedValueOnce({})

    const state = await runPhaseValidation('acct-1')

    expect(state).toMatchObject({ status: 'blocked', reason: 'malformed_response' })
    expect(isPhaseValidationAllowed(state)).toBe(false)
  })
})
