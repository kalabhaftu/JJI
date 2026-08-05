import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

import { Skeleton } from '@/components/ui/skeleton'
import { DashboardLoadingSkeleton, TemplateAwareDashboardSkeleton } from '@/components/ui/dashboard-skeleton'
import { EmptyState } from '@/components/ui/states'
import SubscribeLoading from '@/app/subscribe/loading'

const roots: Array<ReturnType<typeof createRoot>> = []

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(root => root.unmount()))
  document.body.innerHTML = ''
})

async function render(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => root.render(element))
  return container
}

function skeletonElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.animate-pulse'))
}

function hasFixedHeight(element: HTMLElement) {
  const className = element.getAttribute('class') ?? ''
  return /(^|\s)(h-|min-h-|max-h-)/.test(className) || element.style.minHeight !== ''
}

describe('dashboard loading skeletons', () => {
  it('renders DashboardLoadingSkeleton as status-only divs with fixed-height skeletons and no text', async () => {
    const container = await render(<DashboardLoadingSkeleton />)
    const status = container.querySelector('[role="status"]')
    expect(status).toHaveAccessibleName('Loading dashboard')
    const nonDivs = Array.from(container.querySelectorAll('*')).filter(element => element.tagName !== 'DIV')
    expect(nonDivs).toHaveLength(0)
    const skeletons = skeletonElements(container)
    expect(skeletons.length).toBeGreaterThan(20)
    for (const skeleton of skeletons) {
      expect(hasFixedHeight(skeleton)).toBe(true)
    }
    expect(container.textContent?.trim()).toBe('')
  })

  it('renders every skeleton kind with fixed dimensions for a template-aware layout', async () => {
    const layout = [
      { i: 'kpi-0', type: 'accountBalancePnl', size: 'kpi', x: 0, y: 0, w: 1, h: 1 },
      { i: 'kpi-1', type: 'dayWinRate', size: 'kpi', x: 1, y: 0, w: 1, h: 1 },
      { i: 'cal', type: 'calendar', x: 2, y: 0, w: 2, h: 3 },
      { i: 'trades', type: 'recent-trades', x: 4, y: 0, w: 3, h: 2 },
      { i: 'widget', type: 'equityCurve', x: 7, y: 0, w: 3, h: 2 },
    ]
    const layouts = { wide: layout, narrow: layout, tablet: layout, mobile: layout }
    const container = await render(
      <TemplateAwareDashboardSkeleton layout={layout} layouts={layouts} />,
    )
    const skeletons = skeletonElements(container)
    expect(skeletons.length).toBeGreaterThan(20)
    for (const skeleton of skeletons) {
      expect(hasFixedHeight(skeleton)).toBe(true)
    }
  })
})

describe('granular skeleton building blocks', () => {
  it('merges fixed sizes onto the single pulse primitive', async () => {
    const container = await render(<Skeleton className="h-4 w-4 rounded-lg" />)
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toHaveClass('h-4', 'w-4', 'rounded-lg', 'bg-muted')
  })

  it('keeps skeleton.tsx as the only pulse source and respects reduced motion', () => {
    const source = readFileSync('components/ui/skeleton.tsx', 'utf8')
    expect(source.match(/animate-pulse/g)).toHaveLength(1)
    expect(source).toContain('motion-reduce:animate-none')
  })

  it('marks decorative icon blocks aria-hidden in shared async states', async () => {
    const container = await render(<EmptyState title="No data" />)
    const icon = container.querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('SubscribeLoading', () => {
  it('renders a complete multi-block skeleton without wrapper pulse', async () => {
    const container = await render(<SubscribeLoading />)
    const skeletons = skeletonElements(container)
    expect(skeletons.length).toBeGreaterThan(5)
    expect(container.querySelector('.max-w-md')).not.toBeNull()
    for (const skeleton of skeletons) {
      expect(hasFixedHeight(skeleton)).toBe(true)
    }
    const source = readFileSync('app/subscribe/loading.tsx', 'utf8')
    expect(source).not.toContain('animate-pulse')
  })
})
