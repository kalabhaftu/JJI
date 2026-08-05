import { isValidElement } from 'react'
import { Suspense } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/dashboard/dashboard-client', () => ({
  DashboardClient: () => null,
}))

import Home from '@/app/dashboard/page'
import DashboardLoading from '@/app/dashboard/loading'
import { DashboardClient } from '@/app/dashboard/dashboard-client'

describe('dashboard route contracts', () => {
  it('wraps DashboardClient in Suspense with a non-blank fallback', () => {
    const tree = Home() as React.ReactElement<{
      fallback: React.ReactNode
      children?: React.ReactNode
    }>

    expect(tree.type).toBe(Suspense)
    expect(tree.props.fallback).not.toBeNull()
    expect(isValidElement(tree.props.fallback)).toBe(true)
    expect(tree.props.children).not.toBeNull()
    expect((tree.props.children as React.ReactElement)?.type).toBe(DashboardClient)
  })

  it('renders the template-aware skeleton as the Suspense fallback', () => {
    const tree = Home() as React.ReactElement<{ fallback: React.ReactNode }>
    const markup = renderToStaticMarkup(tree.props.fallback as React.ReactElement)

    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-label="Loading dashboard"')
    expect(markup).toContain('animate-pulse')
  })

  it('renders the route loading boundary with status semantics', () => {
    const markup = renderToStaticMarkup(<DashboardLoading />)

    expect(markup).toContain('role="status"')
    expect(markup).toContain('aria-label="Loading dashboard"')
    expect(markup).toContain('animate-pulse')
  })
})
