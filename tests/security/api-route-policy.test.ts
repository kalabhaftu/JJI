import { describe, expect, it } from 'vitest'

import { classifyApiRoute } from '@/lib/api/route-policy'

describe('API route policy registry', () => {
  it('classifies sensitive and trusted route families', () => {
    expect(classifyApiRoute('/api/v1/trades/123', 'DELETE')).toBe('sensitive')
    expect(classifyApiRoute('/api/v1/ai/chats', 'POST')).toBe('ai')
    expect(classifyApiRoute('/api/v1/data/import/jobs', 'POST')).toBe('import')
    expect(classifyApiRoute('/api/v1/payments/create-invoice', 'POST')).toBe('payment')
    expect(classifyApiRoute('/api/cron/maintenance', 'GET')).toBe('trusted-signed')
    expect(classifyApiRoute('/api/v1/payments/webhook', 'POST')).toBe('trusted-signed')
  })

  it('defaults mutations to sensitive and reads to a bounded read policy', () => {
    expect(classifyApiRoute('/api/v1/new-resource', 'POST')).toBe('sensitive')
    expect(classifyApiRoute('/api/v1/new-resource', 'GET')).toBe('authenticated-read')
    expect(classifyApiRoute('/api/v1/reports/shared/slug', 'GET')).toBe('public-read')
  })
})
