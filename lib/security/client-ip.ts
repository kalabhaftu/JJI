import { isIP } from 'node:net'


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

