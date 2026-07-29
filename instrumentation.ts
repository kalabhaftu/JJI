import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = (
  ...args: Parameters<typeof Sentry.captureRequestError>
) => {
  const request = args[1] as {
    headers?: Headers | Record<string, string | string[] | undefined>
  }
  const requestIdValue = request?.headers instanceof Headers
    ? request.headers.get('x-request-id') ?? undefined
    : request?.headers?.['x-request-id']
  const requestId = Array.isArray(requestIdValue)
    ? requestIdValue[0]
    : requestIdValue

  return Sentry.withScope((scope) => {
    if (requestId) scope.setTag('requestId', requestId)
    return Sentry.captureRequestError(...args)
  })
}
