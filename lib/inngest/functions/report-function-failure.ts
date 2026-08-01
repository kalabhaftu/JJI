import { inngest } from '@/lib/inngest/client'
import { normalizeRequestId } from '@/lib/observability/request-id'
import { reportError } from '@/lib/observability/report-error'

function safeString(value: unknown, maxLength = 200): string | undefined {
  return typeof value === 'string' && value.length > 0
    ? value.slice(0, maxLength)
    : undefined
}

export const reportInngestFunctionFailure = inngest.createFunction(
  {
    id: 'report-inngest-function-failure',
    retries: 0,
    concurrency: { limit: 5 },
  },
  { event: 'inngest/function.failed' },
  async ({ event }) => {
    const data = event.data as Record<string, unknown>
    const originalEvent = data.event && typeof data.event === 'object'
      ? data.event as { data?: Record<string, unknown> }
      : undefined
    const failure = data.error && typeof data.error === 'object'
      ? data.error as { message?: unknown; name?: unknown }
      : undefined
    const requestId = normalizeRequestId(safeString(originalEvent?.data?.requestId))
      ?? normalizeRequestId(safeString(data.requestId))
    const functionId = safeString(data.function_id)
      ?? safeString(data.functionId)
      ?? 'unknown'
    const runId = safeString(data.run_id) ?? safeString(data.runId)
    const message = safeString(failure?.message, 500)
      ?? 'Inngest function failed after retries'
    const error = new Error(message)
    if (safeString(failure?.name)) error.name = safeString(failure?.name)!

    reportError(error, {
      surface: 'background-job',
      operation: 'inngest-function-failed',
      ...(requestId ? { requestId } : {}),
      tags: {
        functionId,
        ...(runId ? { runId } : {}),
      },
    })

    return { reported: true, functionId, runId: runId ?? null }
  },
)
