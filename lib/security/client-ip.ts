import { isIP } from 'node:net'

/**
 * Resolve the client address from proxy headers set by the deployment edge.
 * Production must remain behind the configured trusted proxy; direct origin
 * access would make forwarding headers caller-controlled.
 */
export function getClientIp(headers: Headers): string {
  const candidates = [
    headers.get('x-vercel-forwarded-for'),
    headers.get('cf-connecting-ip'),
    headers.get('x-forwarded-for')?.split(',')[0],
    headers.get('x-real-ip'),
  ]

  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (value && isIP(value)) return value
  }

  return 'unknown'
}
