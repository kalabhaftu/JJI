import { describe, expect, it, vi } from 'vitest'

import {
  buildBulkAuditSummary,
  recordAuditEvent,
} from '@/lib/audit-logger'

describe('audit logging', () => {
  it('redacts private fields before insert', async () => {
    const values = vi.fn(async () => undefined)
    const executor = {
      insert: vi.fn(() => ({ values })),
    }

    await recordAuditEvent({
      userId: 'user-id',
      action: 'TRADE_UPDATED',
      entityType: 'Trade',
      entityId: 'trade-id',
      source: 'api',
      beforeData: {
        pnl: 12,
        email: 'private@example.com',
        nested: { token: 'private', quantity: 2 },
      },
    }, executor as never)

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      beforeData: { pnl: 12, nested: { quantity: 2 } },
    }))
  })

  it('builds one bounded bulk summary', () => {
    expect(buildBulkAuditSummary({
      created: 10,
      failed: 1,
      entityTypes: ['Trade', 'Account', 'Trade'],
    })).toEqual({
      created: 10,
      updated: 0,
      skipped: 0,
      failed: 1,
      entityTypes: ['Account', 'Trade'],
    })
  })

  it('propagates durable audit failures to the enclosing transaction', async () => {
    const auditFailure = new Error('audit unavailable')
    const executor = {
      insert: vi.fn(() => ({
        values: vi.fn(async () => {
          throw auditFailure
        }),
      })),
    }

    await expect(recordAuditEvent({
      userId: 'user-id',
      action: 'ACCOUNT_DELETED',
      entityType: 'Account',
      entityId: 'account-id',
      source: 'api',
      requestId: 'request-1234',
    }, executor as never)).rejects.toBe(auditFailure)
  })
})
