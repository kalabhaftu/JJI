import { NextRequest, NextResponse } from 'next/server'

import {
  createErrorResponse,
  createSuccessResponse,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'
import { normalizeRequestId, resolveRequestId } from '@/lib/observability/request-id'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function copyResponseHeaders(response: Response): Headers {
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  return headers
}

function successParts(payload: unknown): {
  data: unknown
  message?: string
  meta?: Record<string, unknown>
} {
  if (!isRecord(payload)) return { data: payload }

  const message = typeof payload.message === 'string' ? payload.message : undefined
  const explicitMeta = isRecord(payload.meta) ? payload.meta : {}
  const reserved = new Set([
    'success',
    'data',
    'message',
    'meta',
    'requestId',
  ])
  const extras = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !reserved.has(key)),
  )
  const hasData = Object.prototype.hasOwnProperty.call(payload, 'data')
  const meta = hasData
    ? { ...explicitMeta, ...extras }
    : explicitMeta
  const data = hasData ? payload.data : extras

  return {
    data: Object.keys(extras).length === 0 && !hasData ? null : data,
    ...(message ? { message } : {}),
    ...(Object.keys(meta).length > 0 ? { meta } : {}),
  }
}

function errorParts(payload: unknown, status: number): {
  message: string
  code: string
  details?: unknown
} {
  const record = isRecord(payload) ? payload : {}
  const nestedError = isRecord(record.error) ? record.error : {}
  const message = typeof nestedError.message === 'string'
    ? nestedError.message
    : typeof record.error === 'string'
      ? record.error
      : typeof record.message === 'string'
        ? record.message
        : status >= 500
          ? 'Internal server error'
          : 'Request failed'
  const code = typeof nestedError.code === 'string'
    ? nestedError.code
    : typeof record.code === 'string'
      ? record.code
      : status >= 500
        ? 'SERVER_ERROR'
        : 'REQUEST_FAILED'
  const details = status >= 500
    ? undefined
    : nestedError.details ?? record.details

  return {
    message,
    code,
    ...(details !== undefined ? { details } : {}),
  }
}

export function reportApiHandlerError(
  request: NextRequest,
  error: unknown,
  operation: string,
  context: {
    entityId?: string
    userId?: string
  } = {},
) {
  return reportError(error, {
    surface: 'api',
    operation,
    route: request.nextUrl.pathname,
    requestId: resolveRequestId(request.headers),
    ...context,
  })
}


export function withCanonicalApiResponse<TArgs extends unknown[]>(
  handler: (request: NextRequest, ...args: TArgs) => Promise<Response>,
) {
  return async (
    request: NextRequest,
    ...args: TArgs
  ): Promise<Response> => {
    const requestId = resolveRequestId(request.headers)
    const response = await handler(request, ...args)
    const contentType = response.headers.get('content-type') ?? ''

    if (!contentType.includes('application/json') || response.status === 204) {
      response.headers.set('x-request-id', requestId)
      return response
    }

    const payload = await response.clone().json().catch(() => null)
    if (
      isRecord(payload)
      && typeof payload.success === 'boolean'
      && typeof payload.requestId === 'string'
      && normalizeRequestId(payload.requestId)
    ) {
      response.headers.set('x-request-id', payload.requestId as string)
      return response as NextResponse<ApiSuccessResponse | ApiErrorResponse>
    }

    const headers = copyResponseHeaders(response)
    const responseRequestId = normalizeRequestId(
      response.headers.get('x-request-id'),
    ) ?? requestId

    if (response.ok && (!isRecord(payload) || payload.success !== false)) {
      const { data, message, meta } = successParts(payload)
      return createSuccessResponse(
        data,
        message,
        meta,
        responseRequestId,
        { status: response.status, headers },
      )
    }

    const errorStatus = response.ok ? 400 : response.status
    const { message, code, details } = errorParts(payload, errorStatus)
    return createErrorResponse(
      message,
      errorStatus,
      details,
      code,
      responseRequestId,
      { headers },
    )
  }
}

