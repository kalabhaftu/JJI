import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const proxySource = readFileSync(
  join(process.cwd(), 'proxy.ts'),
  'utf8',
)

describe('proxy security boundary', () => {
  it('uses a nonce without allowing inline production scripts', () => {
    expect(proxySource).toContain("'nonce-${nonce}'")
    expect(proxySource).not.toMatch(/script-src[^\n]*unsafe-inline/)
  })

  it('refreshes Supabase auth before forwarding API traffic', () => {
    const apiGuard = proxySource.indexOf('if (isApiRoute)')
    const serverClient = proxySource.indexOf('createServerClient(')
    const claims = proxySource.indexOf('supabase.auth.getClaims()')
    expect(serverClient).toBeGreaterThan(-1)
    expect(claims).toBeGreaterThan(serverClient)
    expect(apiGuard).toBeGreaterThan(claims)
    expect(proxySource).toContain("requestHeaders.set('cookie', request.cookies.toString())")
  })

  it('rewrites the docs subdomain into the docs route without a browser redirect', () => {
    expect(proxySource).toContain("import { DEMO_HOST, DOCS_HOST, normalizeHostname } from '@/lib/public-surface-routing'")
    expect(proxySource).toContain("url.pathname === '/' ? '/docs' : `/docs${url.pathname}`")
    expect(proxySource).toContain('NextResponse.rewrite')
    expect(proxySource).not.toContain('docs.justjournalit.site/redirect')
  })
})
