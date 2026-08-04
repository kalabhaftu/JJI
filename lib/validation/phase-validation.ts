import { apiRequestData, ApiClientError } from '@/lib/api/client'

export type PhaseValidationResult =
  | { status: 'valid'; accountType: 'regular' | 'prop-firm'; phaseNumber?: number }
  | { status: 'blocked'; reason: 'unauthorized' | 'forbidden' | 'not_found' | 'offline' | 'timeout' | 'malformed_response' | 'server_error' | 'invalid_phase'; message: string; requestId?: string }

export type PhaseValidationState =
  | { status: 'idle' }
  | { status: 'checking'; accountNumber: string }
  | { status: 'valid'; accountType: 'regular' | 'prop-firm'; phaseNumber?: number }
  | { status: 'blocked'; reason: 'unauthorized' | 'forbidden' | 'not_found' | 'offline' | 'timeout' | 'malformed_response' | 'server_error' | 'invalid_phase'; message: string; requestId?: string }

export type PhaseValidationSettledState = Extract<PhaseValidationState, { status: 'valid' | 'blocked' }>

export type PhaseValidationAction =
  | { type: 'check'; accountNumber: string }
  | { type: 'settle'; result: PhaseValidationSettledState }

const PHASE_VALIDATION_MESSAGES = {
  unauthorized: 'Please sign in again before saving.',
  forbidden: 'This account is not currently eligible for trade entry.',
  not_found: 'The selected account could not be found.',
  offline: 'Unable to validate the account while offline.',
  timeout: 'Account validation timed out. Retry before saving.',
  invalid_phase: 'The selected account phase is not active.',
  busy: 'Account validation is temporarily busy. Retry before saving.',
  server: 'Account validation failed on the server. Retry before saving.',
  malformed: 'Account validation returned an invalid response. Retry before saving.',
} as const

function extractRequestId(payload: unknown): string | undefined {
  if (typeof payload === 'object' && payload !== null) {
    const candidate = (payload as { requestId?: unknown }).requestId
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return undefined
}

export function classifyPhaseValidationResponse(status: number, payload: unknown): PhaseValidationResult {
  const requestId = extractRequestId(payload)
  const withRequestId = (result: Extract<PhaseValidationResult, { status: 'blocked' }>) =>
    requestId ? { ...result, requestId } : result

  if (status === 0) return withRequestId({ status: 'blocked', reason: 'offline', message: PHASE_VALIDATION_MESSAGES.offline })
  if (status === 408) return withRequestId({ status: 'blocked', reason: 'timeout', message: PHASE_VALIDATION_MESSAGES.timeout })
  if (status === 401) return withRequestId({ status: 'blocked', reason: 'unauthorized', message: PHASE_VALIDATION_MESSAGES.unauthorized })
  if (status === 403) return withRequestId({ status: 'blocked', reason: 'forbidden', message: PHASE_VALIDATION_MESSAGES.forbidden })
  if (status === 404) return withRequestId({ status: 'blocked', reason: 'not_found', message: PHASE_VALIDATION_MESSAGES.not_found })
  if (status === 422) return withRequestId({ status: 'blocked', reason: 'invalid_phase', message: PHASE_VALIDATION_MESSAGES.invalid_phase })
  if (status === 429) return withRequestId({ status: 'blocked', reason: 'server_error', message: PHASE_VALIDATION_MESSAGES.busy })
  if (status >= 500) return withRequestId({ status: 'blocked', reason: 'server_error', message: PHASE_VALIDATION_MESSAGES.server })

  if (status === 200 && typeof payload === 'object' && payload !== null) {
    const body = payload as { success?: unknown; data?: { accountType?: unknown; phaseNumber?: unknown } }
    if (body.success === true && (body.data?.accountType === 'regular' || body.data?.accountType === 'prop-firm')) {
      return { status: 'valid', accountType: body.data.accountType, ...(typeof body.data.phaseNumber === 'number' ? { phaseNumber: body.data.phaseNumber } : {}) }
    }
  }
  return withRequestId({ status: 'blocked', reason: 'malformed_response', message: PHASE_VALIDATION_MESSAGES.malformed })
}

export function phaseValidationReducer(state: PhaseValidationState, action: PhaseValidationAction): PhaseValidationState {
  switch (action.type) {
    case 'check':
      return { status: 'checking', accountNumber: action.accountNumber }
    case 'settle':
      return action.result
    default:
      return state
  }
}

export function isPhaseValidationAllowed(state: PhaseValidationState): state is Extract<PhaseValidationState, { status: 'valid' }> {
  return state.status === 'valid'
}

export async function runPhaseValidation(accountNumber: string): Promise<PhaseValidationSettledState> {
  try {
    const data = await apiRequestData<{ accountType?: 'regular' | 'prop-firm'; phaseNumber?: number }>(
      '/api/v1/prop-firm/accounts/validate-trade',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber }),
        retry: { mode: 'never' },
        operation: 'validate-manual-trade-phase',
      }
    )

    if (data.accountType === 'regular' || data.accountType === 'prop-firm') {
      return { status: 'valid', accountType: data.accountType, ...(typeof data.phaseNumber === 'number' ? { phaseNumber: data.phaseNumber } : {}) }
    }
    return { status: 'blocked', reason: 'malformed_response', message: PHASE_VALIDATION_MESSAGES.malformed }
  } catch (error) {
    if (error instanceof ApiClientError) {
      const requestId = error.requestId
      const withRequestId = (result: Extract<PhaseValidationState, { status: 'blocked' }>) =>
        requestId ? { ...result, requestId } : result

      switch (error.kind) {
        case 'unauthorized':
          return withRequestId({ status: 'blocked', reason: 'unauthorized', message: PHASE_VALIDATION_MESSAGES.unauthorized })
        case 'forbidden':
          return withRequestId({ status: 'blocked', reason: 'forbidden', message: PHASE_VALIDATION_MESSAGES.forbidden })
        case 'not_found':
          return withRequestId({ status: 'blocked', reason: 'not_found', message: PHASE_VALIDATION_MESSAGES.not_found })
        case 'offline':
          return withRequestId({ status: 'blocked', reason: 'offline', message: PHASE_VALIDATION_MESSAGES.offline })
        case 'timeout':
          return withRequestId({ status: 'blocked', reason: 'timeout', message: PHASE_VALIDATION_MESSAGES.timeout })
        case 'validation':
          if (error.status === 422) {
            return withRequestId({ status: 'blocked', reason: 'invalid_phase', message: PHASE_VALIDATION_MESSAGES.invalid_phase })
          }
          return withRequestId({ status: 'blocked', reason: 'malformed_response', message: PHASE_VALIDATION_MESSAGES.malformed })
        case 'rate_limited':
          return withRequestId({ status: 'blocked', reason: 'server_error', message: PHASE_VALIDATION_MESSAGES.busy })
        default:
          return withRequestId({ status: 'blocked', reason: 'server_error', message: PHASE_VALIDATION_MESSAGES.server })
      }
    }

    return { status: 'blocked', reason: 'server_error', message: PHASE_VALIDATION_MESSAGES.server }
  }
}
