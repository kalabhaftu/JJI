import { afterEach, describe, expect, it, vi } from 'vitest'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
  vi.resetModules()
})

function clearConfiguredOrigins() {
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.NEXT_PUBLIC_SITE_URL
  delete process.env.APP_BASE_URL
  delete process.env.NEXT_PUBLIC_ALLOWED_ORIGINS
  delete process.env.ALLOWED_ORIGINS
}

describe('origin security helpers', () => {
  it('allows the production JJI origin', async () => {
    process.env.NODE_ENV = 'production'
    clearConfiguredOrigins()
    const { isAllowedOrigin } = await import('@/lib/security/origins')

    expect(isAllowedOrigin('https://www.justjournalit.site')).toBe(true)
    expect(isAllowedOrigin('https://justjournalit.vercel.app')).toBe(true)
  })

  it('does not allow arbitrary production origins', async () => {
    process.env.NODE_ENV = 'production'
    clearConfiguredOrigins()
    const { getCorsHeaders, isAllowedOrigin } = await import('@/lib/security/origins')

    expect(isAllowedOrigin('https://evil.example')).toBe(false)
    expect(getCorsHeaders('https://evil.example')).toBeNull()
  })

  it('allows localhost only outside production', async () => {
    process.env.NODE_ENV = 'development'
    const { isAllowedOrigin } = await import('@/lib/security/origins')

    expect(isAllowedOrigin('http://localhost:3000')).toBe(true)
  })

  it('returns credentialed CORS headers only for allowlisted origins', async () => {
    process.env.NODE_ENV = 'production'
    clearConfiguredOrigins()
    const { getCorsHeaders } = await import('@/lib/security/origins')

    expect(getCorsHeaders('https://www.justjournalit.site')).toMatchObject({
      'Access-Control-Allow-Origin': 'https://www.justjournalit.site',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    })
  })
})
