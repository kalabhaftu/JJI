import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RemovableFilterChip } from '@/components/ui/removable-filter-chip'

const roots: Array<ReturnType<typeof createRoot>> = []

afterEach(async () => {
  await act(async () => roots.splice(0).forEach((root) => root.unmount()))
  document.body.innerHTML = ''
})

describe('RemovableFilterChip', () => {
  it('exposes and invokes a named removal control', async () => {
    const root = createRoot(document.body.appendChild(document.createElement('div')))
    roots.push(root)
    const onRemove = vi.fn()
    await act(async () => root.render(<RemovableFilterChip label="Instrument" value="ES" onRemove={onRemove} />))

    const button = document.querySelector('button')
    expect(button).toHaveAccessibleName('Remove Instrument: ES filter')
    await act(async () => button?.click())
    expect(onRemove).toHaveBeenCalledOnce()
  })
})
