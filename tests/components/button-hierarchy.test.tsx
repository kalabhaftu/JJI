import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Button, buttonVariants } from '@/components/ui/button'

describe('Button hierarchy', () => {
  it('exposes explicit action semantics', () => {
    for (const variant of ['primary', 'secondary', 'tertiary', 'destructive', 'link', 'icon-only', 'toolbar', 'table-row'] as const) {
      expect(buttonVariants({ variant })).toContain('inline-flex')
    }
  })

  it('has no legacy variant aliases', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/ui/button.tsx'), 'utf8')
    expect(source).not.toMatch(/(^|\n)\s*(outline|ghost|nav):/)
    expect(source).not.toMatch(/variant: "default"/)
    expect(source).not.toContain('variant: default')
  })

  it('defaults to the primary variant', () => {
    const markup = renderToStaticMarkup(<Button>Save trade</Button>)
    expect(markup).toContain('bg-primary')
  })

  it('enforces 44px touch targets on coarse pointers', () => {
    for (const variant of ['primary', 'secondary', 'tertiary', 'destructive', 'link', 'icon-only', 'toolbar', 'table-row'] as const) {
      const classes = buttonVariants({ variant })
      expect(classes).toContain('[@media(pointer:coarse)]:min-h-11')
      expect(classes).toContain('[@media(pointer:coarse)]:min-w-11')
    }
  })

  it('communicates a disabled reason', () => {
    const markup = renderToStaticMarkup(<Button disabled disabledReason="Select a trade first">Delete trades</Button>)
    expect(markup).toContain('aria-describedby=')
    expect(markup).toContain('Select a trade first')
  })
})
