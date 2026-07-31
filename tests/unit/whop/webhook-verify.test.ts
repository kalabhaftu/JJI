import { describe, it, expect, vi } from 'vitest'
import { verifyWhopWebhookSignature } from '@/lib/services/whop/webhook-verify'
import { WHOP_CONFIG } from '@/lib/services/whop/client'
import { createHmac } from 'crypto'

// Mock the WHOP_CONFIG since it reads from process.env on load
vi.mock('@/lib/services/whop/client', () => ({
  WHOP_CONFIG: {
    webhookSecret: 'test_secret_key',
  },
}))

describe('Whop Webhook Verification', () => {
  it('should return true for a valid signature', () => {
    const rawBody = '{"id":"evt_123","type":"membership.activated"}'
    
    // Generate valid signature using the test secret
    const signature = createHmac('sha256', 'test_secret_key')
      .update(rawBody, 'utf8')
      .digest('base64')
      
    const header = `v1,${signature}`
    
    expect(verifyWhopWebhookSignature(rawBody, header)).toBe(true)
  })

  it('should return false for an invalid signature', () => {
    const rawBody = '{"id":"evt_123","type":"membership.activated"}'
    const header = 'v1,invalid_signature_base64='
    
    expect(verifyWhopWebhookSignature(rawBody, header)).toBe(false)
  })

  it('should return false if header is missing', () => {
    const rawBody = '{"id":"evt_123"}'
    expect(verifyWhopWebhookSignature(rawBody, null)).toBe(false)
    expect(verifyWhopWebhookSignature(rawBody, undefined)).toBe(false)
    expect(verifyWhopWebhookSignature(rawBody, '')).toBe(false)
  })

  it('should return false for unsupported version', () => {
    const rawBody = '{"id":"evt_123"}'
    const signature = createHmac('sha256', 'test_secret_key')
      .update(rawBody, 'utf8')
      .digest('base64')
      
    const header = `v2,${signature}` // Unsupported version
    
    expect(verifyWhopWebhookSignature(rawBody, header)).toBe(false)
  })

  it('should return false if body was modified after signature generation', () => {
    const originalBody = '{"id":"evt_123","type":"membership.activated"}'
    const modifiedBody = '{"id":"evt_123","type":"membership.deactivated"}'
    
    const signature = createHmac('sha256', 'test_secret_key')
      .update(originalBody, 'utf8')
      .digest('base64')
      
    const header = `v1,${signature}`
    
    expect(verifyWhopWebhookSignature(modifiedBody, header)).toBe(false)
  })
})
