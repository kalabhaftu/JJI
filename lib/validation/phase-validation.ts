export type PhaseValidationResult =
  | { status: 'valid'; accountType: 'regular' | 'prop-firm'; phaseNumber?: number }
  | { status: 'blocked'; reason: 'unauthorized' | 'forbidden' | 'not_found' | 'offline' | 'timeout' | 'malformed_response' | 'server_error' | 'invalid_phase'; message: string }

export function classifyPhaseValidationResponse(status: number, payload: unknown): PhaseValidationResult {
  if (status === 0) return { status: 'blocked', reason: 'offline', message: 'Unable to validate the account while offline.' }
  if (status === 408) return { status: 'blocked', reason: 'timeout', message: 'Account validation timed out. Retry before saving.' }
  if (status === 401) return { status: 'blocked', reason: 'unauthorized', message: 'Please sign in again before saving.' }
  if (status === 403) return { status: 'blocked', reason: 'forbidden', message: 'This account is not currently eligible for trade entry.' }
  if (status === 404) return { status: 'blocked', reason: 'not_found', message: 'The selected account could not be found.' }
  if (status >= 500) return { status: 'blocked', reason: 'server_error', message: 'Account validation failed on the server. Retry before saving.' }

  if (status === 200 && typeof payload === 'object' && payload !== null) {
    const body = payload as { success?: unknown; data?: { accountType?: unknown; phaseNumber?: unknown } }
    if (body.success === true && (body.data?.accountType === 'regular' || body.data?.accountType === 'prop-firm')) {
      return { status: 'valid', accountType: body.data.accountType, ...(typeof body.data.phaseNumber === 'number' ? { phaseNumber: body.data.phaseNumber } : {}) }
    }
  }
  return { status: 'blocked', reason: 'malformed_response', message: 'Account validation returned an invalid response. Retry before saving.' }
}
