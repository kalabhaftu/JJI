import { NextRequest } from 'next/server'
import { applyApiRoutePolicy } from '@/lib/api/route-policy'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { extractIP } from '@/server/geolocation'
import { shouldIgnoreError } from '@/lib/observability/error-policy'
import { createSuccessResponse, ErrorResponses } from '@/lib/api-response'
import { reportError } from '@/lib/observability/report-error'

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated: max depth]'
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 1000) {
      return value.slice(0, 1000) + '... [truncated]'
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1))
  }

  const sensitiveKeys = /password|token|secret|key|authorization|auth|cookie|card|cvv|ssn|credential/i
  const sanitized: Record<string, unknown> = {}
  let count = 0
  
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (count >= 50) {
      sanitized['_moreKeys'] = 'truncated: too many keys'
      break
    }
    if (sensitiveKeys.test(k)) {
      sanitized[k] = '[REDACTED]'
    } else {
      sanitized[k] = sanitizeMetadata(v, depth + 1)
    }
    count++
  }

  return sanitized
}

export async function POST(req: NextRequest) {
  const rl = await applyApiRoutePolicy(req, 'error-report')
  if (rl) return rl

  try {
    const body = await req.json()

    if (!body.message || typeof body.message !== 'string') {
      return ErrorResponses.validation({ fields: ['message'] })
    }

    if (shouldIgnoreError(body.message, body.metadata)) {
      return createSuccessResponse(null)
    }

    const ip = extractIP(req.headers)
    const identity = await getResolvedUserIdentitySafe()
    const source = (body.source === 'SERVER' || body.source === 'API') ? body.source : 'CLIENT'

    const message = String(body.message).slice(0, 2000)
    const error = new Error(message)
    const requestId = req.headers.get('x-request-id')
    reportError(error, {
      surface: source === 'CLIENT'
        ? 'client'
        : source === 'API'
          ? 'api'
          : 'server',
      operation: 'reported-client-failure',
      level: body.level === 'WARNING' ? 'warning' : 'error',
      ...(body.url ? { route: String(body.url).slice(0, 500) } : {}),
      ...(identity?.internalUserId ? { userId: identity.internalUserId } : {}),
      ...(requestId ? { requestId } : {}),
      tags: { source },
      extra: {
        ipAddress: ip,
        metadata: sanitizeMetadata(body.metadata),
      },
    })

    return createSuccessResponse(null)
  } catch (error) {
    const requestId = req.headers.get('x-request-id')
    reportError(error, {
      surface: 'api',
      operation: 'receive-error-report',
      route: '/api/v1/errors',
      ...(requestId ? { requestId } : {}),
    })
    return ErrorResponses.serverError()
  }
}
