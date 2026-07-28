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
const lazyMobileWidget = source('app/dashboard/components/lazy-mobile-widget.tsx')
const layout = source('app/layout.tsx')
const dialog = source('components/ui/dialog.tsx')
const notifications = source('components/notifications/notification-item.tsx')
const dropzone = source('components/ui/file-dropzone.tsx')
const offlineIndicator = source('components/offline-indicator.tsx')
const dataManagement = source('app/dashboard/data/components/data-management/data-management-card.tsx')
const navbar = source('app/dashboard/components/navbar.tsx')

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
    expect(lazyMobileWidget).toContain('new IntersectionObserver(')
    expect(lazyMobileWidget).toContain("rootMargin: '200px'")
    expect(widgetGrid).toContain('getMobileWidgetHeight(widget.type, isChart, config.previewHeight)')
  })

  it('keeps navigation, status changes, and errors available to assistive technology', () => {
    expect(layout).toContain('href="#main-content"')
    expect(offlineIndicator).toContain('aria-live="polite"')
    expect(dropzone).toContain('aria-live="assertive"')
    expect(dropzone).toContain('role="alert"')
    expect(source('app/error.tsx')).toContain('aria-live="assertive"')
  })

  it('separates notification actions and requires explicit dialog descriptions', () => {
    expect(notifications).toContain('<article')
    expect(notifications).not.toContain('role={isActionable')
    expect(notifications).not.toContain('tabIndex={isActionable')
    expect(notifications).toContain('aria-label="Delete notification"')
    expect(dialog).not.toContain('Dialog content')
    expect(navbar).toContain('<DialogDescription>Choose which trading accounts apply to the current view.</DialogDescription>')
    expect(navbar).toContain('<DialogDescription>Refine the data shown on the current page.</DialogDescription>')
  })

  it('uses the complete destructive pattern for selected account deletion', () => {
    expect(dataManagement).toContain('Delete selected accounts')
    expect(dataManagement).toContain('This action cannot be undone.')
    expect(dataManagement).toContain('bg-destructive text-destructive-foreground')
    expect(dataManagement).toContain('<AlertDialogCancel>Cancel</AlertDialogCancel>')
  })

  it('keeps the operational type floor at 12px', () => {
    const tailwindConfig = source('tailwind.config.ts')
    expect(tailwindConfig).not.toContain("'xxs': ['0.625rem'")
    expect(tailwindConfig).not.toContain("'xxxs': ['0.5rem'")
    expect(tailwindConfig).not.toContain("'nano': ['0.375rem'")
    for (const token of ['6', '7', '8', '9', '10', '11']) {
      expect(globals).toContain(`.text-\\[${token}px\\]`)
    }
  })
})
