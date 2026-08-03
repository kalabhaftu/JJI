import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()
const updateTrades = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('action=edit&tradeId=trade-1'),
}))
vi.mock('@/context/data-provider', () => ({
  useData: () => ({ formattedTrades: [{ id: 'trade-1', instrument: 'ES' }], updateTrades }),
}))
vi.mock('@/lib/trading/trade-formatting', () => ({ ensureExtendedTrade: (trade: unknown) => trade }))
vi.mock('@/app/dashboard/components/tables/trade-edit-panel', () => ({
  TradeEditPanel: ({ onSave, onClose }: { onSave(data: unknown): Promise<void>; onClose(): void }) => (
    <button onClick={async () => { await onSave({ comment: 'Updated' }); onClose() }}>Save Changes</button>
  ),
}))
vi.mock('@/app/dashboard/components/tables/trade-detail-panel', () => ({ TradeDetailPanel: () => null }))

import { GlobalTradeController } from '@/app/dashboard/components/global-trade-controller'

afterEach(() => {
  document.body.innerHTML = ''
  replace.mockReset()
  updateTrades.mockReset()
})

describe('GlobalTradeController', () => {
  it('lets the edit panel perform the single close after a save', async () => {
    const root = createRoot(document.body.appendChild(document.createElement('div')))
    await act(async () => root.render(<GlobalTradeController />))
    await act(async () => document.querySelector('button')?.click())
    expect(updateTrades).toHaveBeenCalledOnce()
    expect(replace).toHaveBeenCalledOnce()
    await act(async () => root.unmount())
  })
})
