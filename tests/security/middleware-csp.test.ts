import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const middlewareSource = readFileSync(
  join(process.cwd(), 'middleware.ts'),
  'utf8',
)

describe('middleware security boundary', () => {
  it('uses a nonce without allowing inline production scripts', () => {
    expect(middlewareSource).toContain("'nonce-${nonce}'")
    expect(middlewareSource).not.toMatch(/script-src[^\n]*unsafe-inline/)
  })

  it('does not perform a duplicate Supabase auth request for API traffic', () => {
    expect(middlewareSource).toContain('(?!api/|_next/static')
  })

  it('rewrites the docs subdomain into the docs route without a browser redirect', () => {
    expect(middlewareSource).toContain("import { DEMO_HOST, DOCS_HOST, normalizeHostname } from '@/lib/public-surface-routing'")
    expect(middlewareSource).toContain("url.pathname === '/' ? '/docs' : `/docs${url.pathname}`")
    expect(middlewareSource).toContain('NextResponse.rewrite')
    expect(middlewareSource).not.toContain('docs.justjournalit.site/redirect')
  })
})
