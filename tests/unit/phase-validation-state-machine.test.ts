import { describe, expect, it } from 'vitest'

import { classifyPhaseValidationResponse } from '@/lib/validation/phase-validation'

describe('phase validation state machine', () => {
  it('accepts only a well-formed successful response', () => {
    expect(classifyPhaseValidationResponse(200, { success: true, data: { accountType: 'regular' } })).toEqual({ status: 'valid', accountType: 'regular' })
    expect(classifyPhaseValidationResponse(200, { success: true })).toMatchObject({ status: 'blocked', reason: 'malformed_response' })
  })

  it.each([
    [403, 'forbidden'], [404, 'not_found'], [408, 'timeout'], [500, 'server_error'], [0, 'offline'],
  ] as const)('blocks status %s', (status, reason) => {
    expect(classifyPhaseValidationResponse(status, {})).toMatchObject({ status: 'blocked', reason })
  })
})
