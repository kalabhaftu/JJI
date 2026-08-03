import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/table',
  useSearchParams: () => new URLSearchParams('page=2'),
  useRouter: () => ({ push, replace }),
}))

import { useRouteWorkspace, type RouteWorkspaceController } from '@/hooks/use-route-workspace'

describe('useRouteWorkspace', () => {
  beforeEach(() => { push.mockReset(); replace.mockReset() })

  it('captures the current location when opening and returns to it when closing', async () => {
    let controller: RouteWorkspaceController | undefined
    const root = createRoot(document.createElement('div'))
    function Probe() { controller = useRouteWorkspace(); return null }
    await act(async () => root.render(<Probe />))
    await act(async () => controller?.openWorkspace('/dashboard/table?view=edit&tradeId=1'))
    expect(push).toHaveBeenCalledWith('/dashboard/table?view=edit&tradeId=1', { scroll: false })
    expect(controller?.open).toBe(true)
    expect(controller?.returnTo).toBe('/dashboard/table?page=2')
    await act(async () => controller?.closeWorkspace())
    expect(replace).toHaveBeenCalledWith('/dashboard/table?page=2', { scroll: false })
    expect(controller?.open).toBe(false)
    await act(async () => root.unmount())
  })
})
