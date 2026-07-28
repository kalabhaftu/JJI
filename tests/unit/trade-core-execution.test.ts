import { describe, expect, it } from 'vitest'
import { buildSyntheticExecutionsFromTrade } from '@/lib/trade-core'

describe('synthetic execution identity', () => {
  it('keeps entry and exit broker identifiers on their matching executions', () => {
    const [entry, exit] = buildSyntheticExecutionsFromTrade({
      id: 'trade-1',
      userId: 'user-1',
      entryId: 'entry-1',
      closeId: 'exit-1',
      entryDate: '2026-07-28T10:00:00.000Z',
      closeDate: '2026-07-28T11:00:00.000Z',
      entryPrice: '100',
      closePrice: '110',
      quantity: 1,
      pnl: 10,
      commission: 0,
    })

    expect(entry.kind).toBe('ENTRY')
    expect(entry.brokerExecutionId).toBe('entry-1')
    expect(exit.kind).toBe('EXIT')
    expect(exit.brokerExecutionId).toBe('exit-1')
  })

  it('does not copy the entry identifier when the exit identifier is absent', () => {
    const [, exit] = buildSyntheticExecutionsFromTrade({
      id: 'trade-2',
      userId: 'user-1',
      entryId: 'entry-2',
      closeId: null,
      entryDate: '2026-07-28T10:00:00.000Z',
      closeDate: '2026-07-28T11:00:00.000Z',
      entryPrice: '100',
      closePrice: '110',
      quantity: 1,
      pnl: 10,
      commission: 0,
    })

    expect(exit.brokerExecutionId).toBeNull()
  })
})
