import { describe, expect, it } from 'vitest'

import { MAIN_APP_ORIGIN } from '@/lib/public-surface-routing'
import { resolveAuthOrigin } from '@/lib/security/auth-origin'

describe('auth callback origin', () => {
  it('pins production callbacks to the canonical app origin', () => {
    expect(resolveAuthOrigin({
      requestOrigin: 'https://justjournalit.vercel.app',
      vercel: '1',
      vercelEnv: 'production',
    })).toBe(MAIN_APP_ORIGIN)
  })

  it('pins production-surface requests to the canonical app origin', () => {
    expect(resolveAuthOrigin({
      requestOrigin: 'https://www.justjournalit.site',
      vercel: '0',
      vercelEnv: 'preview',
    })).toBe(MAIN_APP_ORIGIN)
  })

  it('keeps preview callbacks on the current Vercel preview host', () => {
    expect(resolveAuthOrigin({
      requestOrigin: 'https://just-journal-preview.vercel.app',
      vercel: '1',
      vercelEnv: 'preview',
    })).toBe('https://just-journal-preview.vercel.app')
  })

  it('does not trust an arbitrary origin as a hosted callback target', () => {
    expect(resolveAuthOrigin({
      requestOrigin: 'https://attacker.example',
      vercel: '1',
      vercelEnv: 'preview',
    })).toBeNull()
  })
})
