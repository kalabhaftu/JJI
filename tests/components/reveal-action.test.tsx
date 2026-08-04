import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { RevealAction } from '@/components/ui/reveal-action'

describe('RevealAction', () => {
  it('is focusable and visible without hover on coarse pointers', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(async () => root.render(<RevealAction aria-label="Trade actions">Actions</RevealAction>))
    const button = container.querySelector('button')
    expect(button?.className).toContain('focus-visible:opacity-100')
    expect(button?.className).toContain('[@media(pointer:coarse)]:opacity-100')
    await act(async () => root.unmount())
  })
})
