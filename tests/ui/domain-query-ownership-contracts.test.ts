import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { queryKeys, queryKeyPrefixes } from '@/lib/query/query-keys'
import type { QueryScope } from '@/lib/query/query-scope'

const authenticatedScope: QueryScope = { surface: 'authenticated', userId: 'user-1' }
const demoScope: QueryScope = { surface: 'demo' }

const OWNED_TREES = [
  'app/dashboard/playbook',
  'app/dashboard/backtesting',
  'app/dashboard/ai',
]

function collectSources(root: string): string[] {
  const absolute = resolve(process.cwd(), root)
  const files: string[] = []
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        visit(full)
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        files.push(readFileSync(full, 'utf8'))
      }
    }
  }
  visit(absolute)
  return files
}

function hasRawFetch(source: string): boolean {
  return /(?:^|[^.\w])fetch\(/.test(source)
}

describe('phase-5 domain query ownership', () => {
  it('removes raw fetch and SWR from every file in the playbook, backtesting, and AI trees', () => {
    for (const root of OWNED_TREES) {
      const sources = collectSources(root)
      expect(sources.length, root).toBeGreaterThan(0)
      for (const source of sources) {
        expect(hasRawFetch(source), `${root} contains a raw fetch(`).toBe(false)
        expect(source, `${root} still imports SWR`).not.toMatch(/from ['"]swr['"]/)
        expect(source, `${root} uses axios`).not.toMatch(/from ['"]axios['"]/)
      }
    }
  })

  it('routes playbook data through the react-query owner', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/dashboard/playbook/page.tsx'), 'utf8')
    expect(page).toContain('useTradingModels')
    expect(page).toContain('queryKeyPrefixes.playbook')
    expect(page).toContain('apiRequest')
    expect(page).toContain('useQueryClient')
  })

  it('routes backtesting data through the use-backtests owner', () => {
    const hook = readFileSync(resolve(process.cwd(), 'app/dashboard/backtesting/hooks/use-backtests.ts'), 'utf8')
    const client = readFileSync(resolve(process.cwd(), 'app/dashboard/backtesting/components/backtesting-client.tsx'), 'utf8')
    expect(hook).toContain('queryKeys.backtests')
    expect(hook).toContain('apiRequest')
    expect(hook).toContain('apiRequestData')
    expect(client).toContain('useBacktests')
  })

  it('routes AI server data through the use-ai-workspace-data owner and keeps conversations local', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/dashboard/ai/page.tsx'), 'utf8')
    const hook = readFileSync(resolve(process.cwd(), 'app/dashboard/ai/hooks/use-ai-workspace-data.ts'), 'utf8')
    expect(page).toContain('useAiWorkspaceData')
    expect(page).toContain('useState<ChatMessage[]>([])')
    expect(page).toContain('updateChats')
    expect(page).toContain('updateInsights')
    expect(page).toContain('saveConsent')
    expect(hook).toContain('queryKeys.aiChats')
    expect(hook).toContain('queryKeys.aiInsights')
    expect(hook).toContain('queryKeys.aiReviews')
    expect(hook).toContain('queryKeys.aiProfile')
    expect(hook).toContain('AI_DATA_CONSENT_VERSION')
  })

  it('keeps playbook, backtesting, and AI query keys scope-scoped and prefix-invalidatable', () => {
    expect(queryKeys.playbook(authenticatedScope)).not.toEqual(queryKeys.playbook(demoScope))
    expect(queryKeys.playbookModels(authenticatedScope, { accounts: ['a'] })).not.toEqual(
      queryKeys.playbookModels(demoScope, { accounts: ['a'] }),
    )
    expect(queryKeys.backtests(authenticatedScope)).not.toEqual(queryKeys.backtests(demoScope))
    expect(queryKeys.aiChats(authenticatedScope)).not.toEqual(queryKeys.aiChats(demoScope))
    expect(queryKeys.aiInsights(authenticatedScope)).not.toEqual(queryKeys.aiInsights(demoScope))
    expect(queryKeys.aiReviews(authenticatedScope)).not.toEqual(queryKeys.aiReviews(demoScope))
    expect(queryKeys.aiProfile(authenticatedScope)).not.toEqual(queryKeys.aiProfile(demoScope))

    for (const key of [
      queryKeys.playbook(authenticatedScope),
      queryKeys.backtests(authenticatedScope),
      queryKeys.aiChats(authenticatedScope),
      queryKeys.aiInsights(authenticatedScope),
      queryKeys.aiReviews(authenticatedScope),
      queryKeys.aiProfile(authenticatedScope),
    ]) {
      expect(key).toContain(authenticatedScope)
    }

    expect(queryKeys.playbookModels(authenticatedScope, { accounts: ['a'] }).slice(0, 2)).toEqual(['playbook', authenticatedScope])
    expect(queryKeys.playbook(authenticatedScope).slice(0, queryKeyPrefixes.playbook(authenticatedScope).length)).toEqual(
      queryKeyPrefixes.playbook(authenticatedScope),
    )
    expect(queryKeys.backtests(authenticatedScope).slice(0, queryKeyPrefixes.backtests(authenticatedScope).length)).toEqual(
      queryKeyPrefixes.backtests(authenticatedScope),
    )
  })
})