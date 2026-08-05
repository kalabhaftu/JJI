import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/table',
  useSearchParams: () => ({ toString: () => 'tab=open', get: vi.fn() }),
  useRouter: () => ({ push: navigation.push, replace: navigation.replace, prefetch: navigation.prefetch }),
}))

import { useRouteWorkspace, type RouteWorkspaceController } from '@/hooks/use-route-workspace'

const roots: Array<ReturnType<typeof createRoot>> = []

beforeEach(() => {
  navigation.push.mockReset()
  navigation.replace.mockReset()
})

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(root => root.unmount()))
  document.body.innerHTML = ''
})

async function renderController(fallbackReturnTo?: string) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  let controller: RouteWorkspaceController | undefined
  function Probe() {
    controller = useRouteWorkspace(fallbackReturnTo)
    return null
  }
  await act(async () => root.render(createElement(Probe)))
  return () => controller as RouteWorkspaceController
}

describe('useRouteWorkspace', () => {
  it('starts closed with no return destination', async () => {
    const controller = await renderController()
    expect(controller().open).toBe(false)
    expect(controller().returnTo).toBeNull()
  })

  it('opens a workspace and records the current location as the return destination', async () => {
    const controller = await renderController()
    await act(async () => controller().openWorkspace('/dashboard/trades/abc'))
    expect(controller().open).toBe(true)
    expect(navigation.push).toHaveBeenCalledWith('/dashboard/trades/abc', { scroll: false })
    expect(controller().returnTo).toBe('/dashboard/table?tab=open')
  })

  it('closes and replaces the route with the recorded return destination', async () => {
    const controller = await renderController()
    await act(async () => controller().openWorkspace('/dashboard/trades/abc'))
    await act(async () => controller().closeWorkspace())
    expect(controller().open).toBe(false)
    expect(controller().returnTo).toBeNull()
    expect(navigation.replace).toHaveBeenCalledWith('/dashboard/table?tab=open', { scroll: false })
  })

  it('returns to the fallback destination when closing with no recorded location', async () => {
    const controller = await renderController('/dashboard/table')
    await act(async () => controller().closeWorkspace())
    expect(navigation.replace).toHaveBeenCalledWith('/dashboard/table', { scroll: false })
  })

  it('does not navigate when closing with no recorded or fallback destination', async () => {
    const controller = await renderController()
    await act(async () => controller().closeWorkspace())
    expect(navigation.replace).not.toHaveBeenCalled()
  })
})
