import { reportClientError } from '@/lib/observability/report-error'
import { composeAbortSignals } from '@/lib/api/signals'

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

  return status >= 500 || status === 408 || status === 429
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRetryDelay(attempt: number): number {
  return RETRY_BASE_DELAY * Math.pow(RETRY_MULTIPLIER, attempt - 1)
}

function reportFetchFailure(error: FetchError, url: string) {
  const reportable = new Error(error.message)
  Object.assign(reportable, {
    status: error.status,
    code: error.code,
  })
  reportClientError(reportable, {
    operation: 'fetch-request-failure',
    route: url,
    extra: {
      code: error.code,
      ...(error.status !== undefined ? { httpStatus: error.status } : {}),
      ...(error.isTimeout ? { timeout: true } : {}),
      ...(error.isNetworkError ? { network: true } : {}),
    },
  })
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
    

    const composed = composeAbortSignals(fetchOptions.signal, timeout)

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: composed.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        }
      })

      composed.cleanup()


      let data: T | null = null
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        try {
          data = await response.json()
        } catch (error) {
          reportClientError(error, {
            operation: 'parse-fetch-error-response',
            route: url,
            status: response.status,
          })

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


        const method = fetchOptions.method?.toUpperCase() ?? 'GET'
        const shouldRetryThis = retryCondition
          ? retryCondition(error, attempt) && method === 'GET'
          : (shouldRetry && error.isRetryable && method === 'GET' && attempt <= retries)

        if (shouldRetryThis) {
          lastError = error
          await sleep(getRetryDelay(attempt))
          continue
        }

        if (response.status === 429 || response.status >= 500) {
          reportFetchFailure(error, url)
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
      composed.cleanup()


      if (err instanceof Error && err.name === 'AbortError') {
        const callerCancelled = fetchOptions.signal?.aborted && !composed.didTimeout()
        const error = createFetchError(
          callerCancelled ? 'Request cancelled' : 'Request timed out',
          callerCancelled ? 'CANCELLED' : 'TIMEOUT',
          { isTimeout: !callerCancelled, isRetryable: false }
        )

        if (!callerCancelled && shouldRetry && fetchOptions.method?.toUpperCase() === 'GET' && attempt <= retries) {
          lastError = error
          await sleep(getRetryDelay(attempt))
          continue
        }

        if (!callerCancelled) reportFetchFailure(error, url)
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

      if (shouldRetry && fetchOptions.method?.toUpperCase() === 'GET' && attempt <= retries) {
        lastError = error
        await sleep(getRetryDelay(attempt))
        continue
      }

      reportFetchFailure(error, url)
      return {
        data: null,
        error,
        status: 0,
        ok: false
      }
    }
  }


  const exhaustedError = lastError || createFetchError('Request failed after retries', 'MAX_RETRIES')
  reportFetchFailure(exhaustedError, url)
  return {
    data: null,
    error: exhaustedError,
    status: exhaustedError.status || 0,
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
