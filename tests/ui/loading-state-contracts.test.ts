import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ALLOWED_PULSE_FILES = [
  'components/notifications/notification-item.tsx',
  'app/dashboard/reports/components/performance-card.tsx',
  'app/dashboard/ai/components/conversation-view.tsx',
  'components/ui/ai-prompt-input.tsx',
  'components/billing/status-card.tsx',
]

const LOADING_BOUNDARIES = [
  'app/dashboard/accounts/loading.tsx',
  'app/dashboard/backtesting/loading.tsx',
  'app/dashboard/data/loading.tsx',
  'app/dashboard/goals/loading.tsx',
  'app/dashboard/journal/loading.tsx',
  'app/dashboard/playbook/loading.tsx',
  'app/dashboard/reports/loading.tsx',
  'app/dashboard/settings/loading.tsx',
  'app/dashboard/table/loading.tsx',
  'app/dashboard/loading.tsx',
  'app/subscribe/loading.tsx',
]

describe('loading state contracts', () => {
  it('keeps pulse classes out of every route loading boundary and resolves pulse via skeleton modules only', () => {
    for (const boundary of LOADING_BOUNDARIES) {
      const source = readFileSync(boundary, 'utf8')
      expect(source, boundary).not.toContain('animate-pulse')
      const importsSkeletonPrimitive = source.includes('@/components/ui/skeleton')
      const importsDashboardSkeleton = source.includes('@/components/ui/dashboard-skeleton')
      if (importsSkeletonPrimitive || importsDashboardSkeleton) continue
      const localSkeleton = source.match(/from '\.\/(components\/[^']+-page-skeleton)'/)
      expect(localSkeleton, boundary).not.toBeNull()
      const resolved = path.join(path.dirname(boundary), localSkeleton![1] + '.tsx')
      const pageSkeletonSource = readFileSync(resolved, 'utf8')
      expect(pageSkeletonSource).toContain('@/components/ui/skeleton')
    }
  })

  it('limits remaining animate-pulse usage to the documented status indicator files', () => {
    const output = execFileSync('bash', [
      '-lc',
      'rg --line-number "animate-pulse" app/dashboard components | rg -v "components/ui/skeleton.tsx|components/ui/dashboard-skeleton.tsx|app/dashboard/components/charts|widget-registry-lazy"',
    ], { encoding: 'utf8' })
    const hits = output.trim().split('\n').filter(Boolean)
    expect(hits.length).toBeGreaterThan(0)
    const files = [...new Set(hits.map(line => line.split(':')[0]))].sort()
    expect(files).toEqual([...ALLOWED_PULSE_FILES].sort())
  })

  it('keeps skeleton.tsx the single pulse source', () => {
    const source = readFileSync('components/ui/skeleton.tsx', 'utf8')
    expect(source.match(/animate-pulse/g)).toHaveLength(1)
    expect(source).toContain('motion-reduce:animate-none')
  })
})
