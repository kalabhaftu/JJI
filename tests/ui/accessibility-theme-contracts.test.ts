import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const globals = source('app/globals.css')
const aiPrompt = source('components/ui/ai-prompt-input.tsx')
const aiSidebar = source('app/dashboard/ai/components/workspace-sidebar.tsx')
const aiComposer = source('app/dashboard/ai/components/context-composer.tsx')
const widgetGrid = source('app/dashboard/components/widget-grid.tsx')

describe('accessibility and theme source contracts', () => {
  it('keeps keyboard focus, reduced-motion, contrast, zoom, and touch safeguards', () => {
    expect(globals).toContain('@media (prefers-reduced-motion: reduce)')
    expect(globals).toContain('@media (prefers-contrast: high)')
    expect(globals).toContain('-webkit-text-size-adjust: 100%')
    expect(globals).toMatch(/\.touch-target-compact\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?min-width:\s*44px;/)
    expect(globals).toContain('env(safe-area-inset-bottom)')
    expect(aiPrompt).toContain('focus-visible:ring-2')
  })

  it('keeps hierarchy tokens in both base themes and every accent selector', () => {
    for (const token of [
      '--background:',
      '--foreground:',
      '--heading-text:',
      '--card:',
      '--surface-raised:',
      '--surface-subtle:',
      '--border-strong:',
      '--muted-foreground:',
    ]) {
      expect(globals.match(new RegExp(token, 'g'))?.length, token).toBeGreaterThanOrEqual(2)
    }

    for (const selector of [
      '.accent-reports',
      '.dark.accent-reports',
      '.accent-violet',
      '.dark.accent-violet',
      '.accent-slate',
      '.dark.accent-slate',
    ]) {
      expect(globals).toContain(selector)
    }
  })

  it('labels the AI composer and exposes a complete tab/tabpanel relationship', () => {
    expect(aiPrompt).toContain('aria-label="AI prompt"')
    expect(aiComposer).toContain('aria-label="Analysis period"')
    expect(aiSidebar).toContain('role="tablist"')
    expect(aiSidebar).toContain('role="tab"')
    expect(aiSidebar).toContain('aria-controls={`workspace-panel-${tab.id}`}')
    expect(aiSidebar).toContain('role="tabpanel"')
    expect(aiSidebar).toContain('aria-labelledby={`workspace-tab-${activeTab}`}')
  })

  it('labels destructive widget controls and keeps mobile widgets lazy and bounded', () => {
    expect(widgetGrid.match(/aria-label=\{`Remove \$\{widget\.type\} widget`\}/g)).toHaveLength(3)
    expect(widgetGrid).toContain('new IntersectionObserver(')
    expect(widgetGrid).toContain("rootMargin: '200px'")
    expect(widgetGrid).toContain('getMobileWidgetHeight(widget.type, isChart, config.previewHeight)')
  })
})
