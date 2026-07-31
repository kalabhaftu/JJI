/**
 * Standardized API Response Types
 * Personal use app - consistent error/success responses
 */

import { NextResponse } from 'next/server'

export interface ApiSuccessResponse<T = any> {
  success: true
  data?: T
  message?: string
  meta?: Record<string, any>
}

export interface ApiErrorResponse {
  success: false
  error: string
  details?: string | Record<string, any>
  code?: string
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string,
  meta?: Record<string, any>
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
    ...(meta && { meta })
  })
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: string | Record<string, any>,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details && { details }),
      ...(code && { code })
    },
    { status }
  )
}

/**
 * Common error responses
 */
const ErrorResponses = {
  unauthorized: () => createErrorResponse('Unauthorized', 401, 'Please log in to access this resource', 'UNAUTHORIZED'),
  forbidden: () => createErrorResponse('Forbidden', 403, 'You do not have permission to access this resource', 'FORBIDDEN'),
  notFound: (resource: string = 'Resource') => createErrorResponse(`${resource} not found`, 404, undefined, 'NOT_FOUND'),
  badRequest: (details?: string) => createErrorResponse('Bad request', 400, details, 'BAD_REQUEST'),
  validation: (errors: any) => createErrorResponse('Validation failed', 400, errors, 'VALIDATION_ERROR'),
  serverError: (message: string = 'Internal server error') => createErrorResponse(message, 500, undefined, 'SERVER_ERROR'),
  conflict: (message: string) => createErrorResponse(message, 409, undefined, 'CONFLICT'),
}

