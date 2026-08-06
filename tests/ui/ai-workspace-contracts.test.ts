import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const workspace = source('app/dashboard/ai/page.tsx')
const workspaceData = source('app/dashboard/ai/hooks/use-ai-workspace-data.ts')
const workspaceImplementation = `${workspace}\n${workspaceData}`

describe('AI workspace feature contracts', () => {
  it('retains every user-visible conversation and insight action', () => {
    for (const handler of [
      'handleStartChat',
      'handleChatSelect',
      'handleRenameChat',
      'handleTogglePin',
      'handleToggleArchive',
      'handleRequestDelete',
      'handleConfirmDelete',
      'handleSaveInsight',
      'handleDeleteInsight',
      'setWeeklyAIReviews',
      'handleAcceptAiConsent',
    ]) {
      expect(workspaceImplementation, handler).toContain(handler)
    }
  })

  it('retains streaming, explicit source selection, consent, and error handling', () => {
    expect(workspace).toContain('selectedSources')
    expect(workspace).toContain('aiConsentGranted')
    expect(workspace).toContain('streamingText')
    expect(workspaceImplementation).toContain('paywallError')
    expect(workspaceImplementation).toContain('toast.error')
    expect(workspaceImplementation).not.toContain('mock AI')
    expect(workspaceImplementation).not.toContain('fake response')
  })

  it('keeps the complete owned API surface used by the workspace', () => {
    for (const route of [
      'app/api/v1/ai/chats/route.ts',
      'app/api/v1/ai/chats/[chatId]/route.ts',
      'app/api/v1/ai/chats/[chatId]/messages/route.ts',
      'app/api/v1/ai/insights/route.ts',
      'app/api/v1/ai/insights/[insightId]/route.ts',
      'app/api/v1/ai/mappings/route.ts',
      'app/api/v1/ai/format-trades/route.ts',
    ]) {
      expect(() => source(route), route).not.toThrow()
    }
  })
})
