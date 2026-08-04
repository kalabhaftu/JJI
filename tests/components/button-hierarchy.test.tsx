import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Button, buttonVariants } from '@/components/ui/button'

describe('Button hierarchy', () => {
  it('exposes explicit action semantics', () => {
    for (const variant of ['primary', 'secondary', 'tertiary', 'destructive', 'link', 'icon-only', 'toolbar', 'table-row'] as const) {
      expect(buttonVariants({ variant })).toContain('inline-flex')
    }
  })

  it('communicates a disabled reason', () => {
    const markup = renderToStaticMarkup(<Button disabled disabledReason="Select a trade first">Delete trades</Button>)
    expect(markup).toContain('aria-describedby=')
    expect(markup).toContain('Select a trade first')
  })
})
