import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BRAND } from '@/lib/constants/brand'

const CANONICAL_ORIGIN = 'https://justjournalit.vercel.app'
const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('canonical production origin', () => {
  it('uses the JJI Vercel origin as the application source of truth', () => {
    expect(BRAND.siteUrl).toBe(CANONICAL_ORIGIN)
    expect(readFileSync(join(process.cwd(), 'lib/security/origins.ts'), 'utf8'))
      .toContain(CANONICAL_ORIGIN)
  })

  it('does not reintroduce the invalid DeltaLytix domain in tracked configuration', () => {
    const files = [
      '.env.example',
      'README.md',
      'next.config.js',
      'vercel.json',
      'lib/constants/brand.ts',
      'lib/security/origins.ts',
    ]
    const configuration = files
      .map((file) => readFileSync(join(process.cwd(), file), 'utf8'))
      .join('\n')

    expect(configuration).not.toMatch(/deltalytix|eu\.cc/i)
  })

  it('does not allow environment drift to change the hosted production origin', async () => {
    process.env.VERCEL_ENV = 'production'
    process.env.APP_BASE_URL = 'https://wrong.example'
    vi.resetModules()

    const { getAllowedOrigins } = await import('@/lib/security/origins')
    expect(getAllowedOrigins()).toEqual(['https://justjournalit.vercel.app'])
  })
})
