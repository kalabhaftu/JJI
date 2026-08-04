import { importTradesThroughApi } from '@/lib/api/trade-import-client'
import { classifyPhaseValidationResponse } from '@/lib/validation/phase-validation'

type SubmissionState<T> =
  | { status: 'idle' }
  | { status: 'submitting'; values: T }
  | { status: 'blocked'; values: T; message: string }
  | { status: 'success'; values: T; result: unknown }

export function createManualTradeSubmission<T>(options: {
  validate(values: T): Promise<{ status: number; payload: unknown }>
  buildImport(values: T): { accountId: string; trades: any[] }
  onStateChange?(state: SubmissionState<T>): void
}) {
  let state: SubmissionState<T> = { status: 'idle' }
  let inFlight = false

  const setState = (next: SubmissionState<T>) => {
    state = next
    options.onStateChange?.(next)
  }

  const submit = async (values: T) => {
    if (inFlight) return state
    inFlight = true
    setState({ status: 'submitting', values })
    try {
      let response: { status: number; payload: unknown }
      try {
        response = await options.validate(values)
      } catch {
        response = { status: 0, payload: null }
      }
      const validation = classifyPhaseValidationResponse(response.status, response.payload)
      if (validation.status === 'blocked') {
        setState({ status: 'blocked', values, message: validation.message })
        return state
      }
      const result = await importTradesThroughApi(options.buildImport(values))
      setState({ status: 'success', values, result })
      return state
    } finally {
      inFlight = false
    }
  }

  return {
    submit,
    retry: () => state.status === 'blocked' ? submit(state.values) : Promise.resolve(state),
    getState: () => state,
  }
}
