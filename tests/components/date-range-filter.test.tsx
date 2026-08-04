import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DateRangeFilter, getDatePresetRange } from '@/components/ui/date-range-filter'

const roots: Array<ReturnType<typeof createRoot>> = []

afterEach(async () => {
  await act(async () => roots.splice(0).forEach((root) => root.unmount()))
  document.body.innerHTML = ''
})

describe('DateRangeFilter', () => {
  it('defines immediate preset values and has no contradictory Apply action', async () => {
    const now = new Date(2026, 6, 15)
    expect(getDatePresetRange('7d', now)).toEqual({ from: new Date(2026, 6, 9), to: now })
    expect(getDatePresetRange('all', now)).toBeUndefined()

    const root = createRoot(document.body.appendChild(document.createElement('div')))
    roots.push(root)
    await act(async () => root.render(<DateRangeFilter value={undefined} onChange={vi.fn()} now={now} />))
    expect(document.querySelector('[aria-label="Date range: All time"]')).not.toBeNull()
    expect(Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Apply')).toBe(false)
  })
})
