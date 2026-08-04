import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('workspace dialog and sheet semantics', () => {
  const source = readFileSync('components/ui/trade-workspace.tsx', 'utf8')

  it('uses explicit Radix titles and descriptions for both overlay modes', () => {
    expect(source).toContain('<DialogTitle')
    expect(source).toContain('<DialogDescription')
    expect(source).toContain('<SheetTitle')
    expect(source).toContain('<SheetDescription')
  })

  it('routes all dismissal paths through the close request', () => {
    expect(source).toContain('onEscapeKeyDown={handleDismissEvent}')
    expect(source).toContain('onPointerDownOutside={handleDismissEvent}')
    expect(source).toContain('onInteractOutside={handleDismissEvent}')
  })
})
