import { describe, expect, it, vi } from 'vitest'

import { fetchTrustedExportImage, isTrustedExportMediaUrl } from '@/lib/security/export-media'

const SUPABASE_URL = 'https://project.supabase.co'

describe('export media boundary', () => {
  it('allows only HTTPS objects from the configured Supabase Storage origin', () => {
    expect(isTrustedExportMediaUrl(
      'https://project.supabase.co/storage/v1/object/sign/trade-images/user/trade.png?token=redacted',
      SUPABASE_URL
    )).toBe(true)
    expect(isTrustedExportMediaUrl('http://169.254.169.254/latest/meta-data', SUPABASE_URL)).toBe(false)
    expect(isTrustedExportMediaUrl('https://attacker.example/image.png', SUPABASE_URL)).toBe(false)
    expect(isTrustedExportMediaUrl('https://project.supabase.co/auth/v1/settings', SUPABASE_URL)).toBe(false)
  })

  it('rejects non-image responses', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', {
      headers: { 'content-type': 'application/json' },
    }))

    await expect(fetchTrustedExportImage(
      'https://project.supabase.co/storage/v1/object/public/trade-images/file',
      SUPABASE_URL,
      fetcher
    )).resolves.toBeNull()
  })
})
