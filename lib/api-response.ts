import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  createRequestId,
  normalizeRequestId,
  REQUEST_ID_HEADER,
} from '@/lib/observability/request-id'

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T | null
  message?: string
  meta?: Record<string, unknown>
  requestId: string
}

export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

export interface ApiErrorResponse {
  success: false
  error: ApiErrorBody
  requestId: string
}

export type ApiResponse<T = unknown> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse

async function getResponseRequestId(explicitRequestId?: string): Promise<string> {
  const normalizedExplicit = normalizeRequestId(explicitRequestId)
  if (normalizedExplicit) return normalizedExplicit

  try {
    const requestHeaders = await headers()
    return normalizeRequestId(requestHeaders.get(REQUEST_ID_HEADER))
      ?? createRequestId()
  } catch {
    return createRequestId()
  }
}

function responseHeaders(
  requestId: string,
  additionalHeaders?: HeadersInit,
): Headers {
  const result = new Headers(additionalHeaders)
  result.set(REQUEST_ID_HEADER, requestId)
  return result
}

export async function createSuccessResponse<T>(
  data?: T,
  message?: string,
  meta?: Record<string, unknown>,
  requestId?: string,
  init?: Omit<ResponseInit, 'status'> & { status?: number },
): Promise<NextResponse<ApiSuccessResponse<T>>> {
  const resolvedRequestId = await getResponseRequestId(requestId)
  return NextResponse.json(
    {
      success: true,
      data: data ?? null,
      ...(message ? { message } : {}),
      ...(meta ? { meta } : {}),
      requestId: resolvedRequestId,
    },
    {
      ...init,
      status: init?.status ?? 200,
      headers: responseHeaders(resolvedRequestId, init?.headers),
    },
  )
}

export async function createErrorResponse(
  message: string,
  status = 500,
  details?: unknown,
  code = 'SERVER_ERROR',
  requestId?: string,
  init?: Omit<ResponseInit, 'status'>,
): Promise<NextResponse<ApiErrorResponse>> {
  const resolvedRequestId = await getResponseRequestId(requestId)
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      requestId: resolvedRequestId,
    },
    {
      ...init,
      status,
      headers: responseHeaders(resolvedRequestId, init?.headers),
    },
  )
}

export const ErrorResponses = {
  unauthorized: (requestId?: string) => createErrorResponse(
    'Unauthorized',
    401,
    undefined,
    'UNAUTHORIZED',
    requestId,
  ),
  forbidden: (requestId?: string) => createErrorResponse(
    'Forbidden',
    403,
    undefined,
    'FORBIDDEN',
    requestId,
  ),
  notFound: (resource = 'Resource', requestId?: string) => createErrorResponse(
    `${resource} not found`,
    404,
    undefined,
    'NOT_FOUND',
    requestId,
  ),
  badRequest: (details?: unknown, requestId?: string) => createErrorResponse(
    'Bad request',
    400,
    details,
    'BAD_REQUEST',
    requestId,
  ),
  validation: (details: unknown, requestId?: string) => createErrorResponse(
    'Validation failed',
    400,
    details,
    'VALIDATION_ERROR',
    requestId,
  ),
  serverError: (requestId?: string) => createErrorResponse(
    'Internal server error',
    500,
    undefined,
    'SERVER_ERROR',
    requestId,
  ),
  conflict: (message: string, requestId?: string) => createErrorResponse(
    message,
    409,
    undefined,
    'CONFLICT',
    requestId,
  ),
  rateLimited: (
    requestId: string,
    retryAfterSeconds: number,
    headers?: HeadersInit,
  ) => createErrorResponse(
    'Too many requests',
    429,
    { retryAfterSeconds },
    'RATE_LIMIT_EXCEEDED',
    requestId,
    { headers },
  ),
  rateLimitUnavailable: (requestId: string) => createErrorResponse(
    'Service temporarily unavailable',
    503,
    { retryable: true },
    'RATE_LIMIT_BACKEND_UNAVAILABLE',
    requestId,
  ),
}
