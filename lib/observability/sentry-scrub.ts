const SENSITIVE_KEY = /(?:authorization|cookie|token|secret|password|passcode|prompt|journal|note|content|payload|body|csv|screenshot|image|attachment|email|ip(?:address)?|useragent|broker.*raw)/i
const EXPECTED_CONTROL_FLOW = [
  'NEXT_REDIRECT',
  'NEXT_HTTP_ERROR_FALLBACK;',
  'Invalid Refresh Token: Refresh Token Not Found',
  "Lock broken by another request with the 'steal' option.",
] as const

type SentryLikeEvent = {
  message?: string
  exception?: { values?: Array<{ value?: string }> }
}

export function shouldDropSentryEvent(
  event: SentryLikeEvent,
  originalException?: unknown,
) {
  const originalMessage =
    originalException instanceof Error
      ? originalException.message
      : typeof originalException === 'string'
        ? originalException
        : ''
  const messages = [
    event.message ?? '',
    originalMessage,
    ...(event.exception?.values?.map((value) => value.value ?? '') ?? []),
  ]

  return messages.some((message) =>
    EXPECTED_CONTROL_FLOW.some((expected) => message.includes(expected)),
  )
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Truncated]'
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubValue(item, depth + 1))
  if (!value || typeof value !== 'object') return value
  if (value instanceof Error) return { name: value.name, message: value.message }

  const scrubbed: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue
    scrubbed[key] = scrubValue(nestedValue, depth + 1)
  }
  return scrubbed
}

export function scrubSentryEvent<T extends {
  request?: { headers?: Record<string, unknown>; data?: unknown; cookies?: unknown; query_string?: unknown }
  user?: Record<string, unknown>
  extra?: Record<string, unknown>
  contexts?: Record<string, unknown>
  breadcrumbs?: Array<{ data?: Record<string, unknown> }>
}>(event: T): T {
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string
    event.request.headers = {}
  }
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {}
  }
  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>
  }
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as Record<string, unknown>
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) =>
      breadcrumb.data
        ? { ...breadcrumb, data: scrubValue(breadcrumb.data) as Record<string, unknown> }
        : breadcrumb,
    )
  }
  return event
}

export function scrubSentryContext(value: Record<string, unknown>) {
  return scrubValue(value) as Record<string, unknown>
}
