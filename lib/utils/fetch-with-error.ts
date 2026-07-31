import logger from '@/lib/logger';
import * as Sentry from '@sentry/nextjs'

import { 
  API_TIMEOUT, 
  MAX_RETRY_ATTEMPTS, 
  RETRY_BASE_DELAY, 
  RETRY_MULTIPLIER 
} from '@/lib/constants'

interface FetchError {
  message: string
  code: string
  status?: number
  isTimeout?: boolean
  isNetworkError?: boolean
  isRetryable?: boolean
  originalError?: unknown
}

export interface FetchOptions extends RequestInit {
  timeout?: number
  retries?: number
  shouldRetry?: boolean
  retryCondition?: (error: FetchError, attempt: number) => boolean
}

export interface FetchResult<T> {
  data: T | null
  error: FetchError | null
  status: number
  ok: boolean
}

function createFetchError(
  message: string,
  code: string,
  options: Partial<FetchError> = {}
): FetchError {
  return {
    message,
    code,
    isRetryable: false,
    ...options
  }
}

function isRetryableError(status: number): boolean {
  // Retry on server errors (5xx) and specific client errors
  return status >= 500 || status === 408 || status === 429
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRetryDelay(attempt: number): number {
  return RETRY_BASE_DELAY * Math.pow(RETRY_MULTIPLIER, attempt - 1)
}

export async function fetchWithError<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeout = API_TIMEOUT,
    retries = MAX_RETRY_ATTEMPTS,
    shouldRetry = true,
    retryCondition,
    ...fetchOptions
  } = options

  let lastError: FetchError | null = null
  let attempt = 0

  while (attempt <= (shouldRetry ? retries : 0)) {
    attempt++
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        }
      })

      clearTimeout(timeoutId)

      let data: T | null = null
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        try {
          data = await response.json()
        } catch (error) {
          Sentry.captureException(error, { extra: { route: 'lib/utils/fetch-with-error', phase: 'parseJSON' } })
          data = null
        }
      }

      if (!response.ok) {
        const error = createFetchError(
          (data as any)?.error || (data as any)?.message || `Request failed with status ${response.status}`,
          'FETCH_ERROR',
          {
            status: response.status,
            isRetryable: isRetryableError(response.status)
          }
        )

        const shouldRetryThis = retryCondition 
          ? retryCondition(error, attempt)
          : (shouldRetry && error.isRetryable && attempt <= retries)

        if (shouldRetryThis) {
          lastError = error
          await sleep(getRetryDelay(attempt))
          continue
        }

        return {
          data: null,
          error,
          status: response.status,
          ok: false
        }
      }

      return {
        data,
        error: null,
        status: response.status,
        ok: true
      }

    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error && err.name === 'AbortError') {
        const error = createFetchError(
          'Request timed out',
          'TIMEOUT',
          { isTimeout: true, isRetryable: true }
        )

        if (shouldRetry && attempt <= retries) {
          lastError = error
          await sleep(getRetryDelay(attempt))
          continue
        }

        return {
          data: null,
          error,
          status: 408,
          ok: false
        }
      }

      const error = createFetchError(
        err instanceof Error ? err.message : 'Network error',
        'NETWORK_ERROR',
        { 
          isNetworkError: true, 
          isRetryable: true,
          originalError: err
        }
      )

      if (shouldRetry && attempt <= retries) {
        lastError = error
        await sleep(getRetryDelay(attempt))
        continue
      }

      return {
        data: null,
        error,
        status: 0,
        ok: false
      }
    }
  }

  return {
    data: null,
    error: lastError || createFetchError('Request failed after retries', 'MAX_RETRIES'),
    status: lastError?.status || 0,
    ok: false
  }
}

async function fetchOrThrow<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const result = await fetchWithError<T>(url, options)
  
  if (result.error) {
    throw result.error
  }
  
  return result.data as T
}

export function handleFetchError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const fetchError = error as FetchError
    
    if (fetchError.isTimeout) {
      return 'Request timed out. Please try again.'
    }
    
    if (fetchError.isNetworkError) {
      return 'Network error. Please check your connection.'
    }
    
    if (fetchError.status === 401) {
      return 'Please sign in to continue.'
    }
    
    if (fetchError.status === 403) {
      return 'You do not have permission to perform this action.'
    }
    
    if (fetchError.status === 404) {
      return 'The requested resource was not found.'
    }
    
    if (fetchError.status && fetchError.status >= 500) {
      return 'Server error. Please try again later.'
    }
    
    return fetchError.message
  }
  
  return 'An unexpected error occurred. Please try again.'
}

function isFetchError(error: unknown): error is FetchError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  )
}

