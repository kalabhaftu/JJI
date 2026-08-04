import { describe, expect, it } from 'vitest'

import {
  classifyPhaseValidationResponse,
  isPhaseValidationAllowed,
  phaseValidationReducer,
  type PhaseValidationState,
} from '@/lib/validation/phase-validation'

describe('phase validation state machine', () => {
  it('accepts only a well-formed successful response', () => {
    expect(classifyPhaseValidationResponse(200, { success: true, data: { accountType: 'regular' } })).toEqual({ status: 'valid', accountType: 'regular' })
    expect(classifyPhaseValidationResponse(200, { success: true })).toMatchObject({ status: 'blocked', reason: 'malformed_response' })
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [408, 'timeout'],
    [422, 'invalid_phase'],
    [429, 'server_error'],
    [500, 'server_error'],
    [0, 'offline'],
  ] as const)('blocks status %s with reason %s', (status, reason) => {
    expect(classifyPhaseValidationResponse(status, {})).toMatchObject({ status: 'blocked', reason })
  })

  it('uses the exact blocked messages', () => {
    expect(classifyPhaseValidationResponse(422, {})).toEqual({
      status: 'blocked',
      reason: 'invalid_phase',
      message: 'The selected account phase is not active.',
    })
    expect(classifyPhaseValidationResponse(429, {})).toEqual({
      status: 'blocked',
      reason: 'server_error',
      message: 'Account validation is temporarily busy. Retry before saving.',
    })
    expect(classifyPhaseValidationResponse(404, {})).toEqual({
      status: 'blocked',
      reason: 'not_found',
      message: 'The selected account could not be found.',
    })
  })

  it('attaches requestId from the payload to blocked results', () => {
    expect(classifyPhaseValidationResponse(404, { requestId: 'req-123' })).toMatchObject({
      status: 'blocked',
      reason: 'not_found',
      requestId: 'req-123',
    })
  })

  it('does not attach requestId when absent', () => {
    expect(classifyPhaseValidationResponse(404, {})).not.toHaveProperty('requestId')
  })

  describe('phaseValidationReducer', () => {
    it('moves idle -> checking on check', () => {
      expect(phaseValidationReducer({ status: 'idle' }, { type: 'check', accountNumber: 'acct-1' }))
        .toEqual({ status: 'checking', accountNumber: 'acct-1' })
    })

    it('moves blocked -> checking on recheck', () => {
      const blocked: PhaseValidationState = { status: 'blocked', reason: 'server_error', message: 'boom' }
      expect(phaseValidationReducer(blocked, { type: 'check', accountNumber: 'acct-1' }))
        .toEqual({ status: 'checking', accountNumber: 'acct-1' })
    })

    it('settles to a valid state', () => {
      const result = { status: 'valid', accountType: 'regular' } as const
      expect(phaseValidationReducer({ status: 'checking', accountNumber: 'acct-1' }, { type: 'settle', result }))
        .toEqual(result)
    })

    it('settles to a blocked state', () => {
      const result = { status: 'blocked', reason: 'not_found', message: 'The selected account could not be found.' } as const
      expect(phaseValidationReducer({ status: 'checking', accountNumber: 'acct-1' }, { type: 'settle', result }))
        .toEqual(result)
    })

    it('ignores unknown actions', () => {
      const state: PhaseValidationState = { status: 'checking', accountNumber: 'acct-1' }
      expect(phaseValidationReducer(state, { type: 'unknown' } as never)).toBe(state)
    })
  })

  describe('isPhaseValidationAllowed', () => {
    it('is true only for the valid state', () => {
      expect(isPhaseValidationAllowed({ status: 'valid', accountType: 'regular' })).toBe(true)
      expect(isPhaseValidationAllowed({ status: 'valid', accountType: 'prop-firm', phaseNumber: 2 })).toBe(true)
    })

    it('is false for idle and checking', () => {
      expect(isPhaseValidationAllowed({ status: 'idle' })).toBe(false)
      expect(isPhaseValidationAllowed({ status: 'checking', accountNumber: 'acct-1' })).toBe(false)
    })

    it.each([
      'unauthorized',
      'forbidden',
      'not_found',
      'offline',
      'timeout',
      'malformed_response',
      'server_error',
      'invalid_phase',
    ] as const)('is false for blocked reason %s', (reason) => {
      const state: PhaseValidationState = { status: 'blocked', reason, message: 'x' }
      expect(isPhaseValidationAllowed(state)).toBe(false)
    })
  })
})
