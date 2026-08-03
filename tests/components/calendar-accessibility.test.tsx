import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CustomDateRangePicker } from '@/components/ui/custom-date-range-picker'

describe('calendar accessibility', () => {
  it('uses react-day-picker grid and named day controls', () => {
    const markup = renderToStaticMarkup(<CustomDateRangePicker defaultMonth={new Date(2026, 6, 1)} />)

    expect(markup).toContain('role="grid"')
    expect(markup).toContain('aria-label="July 2026"')
    expect(markup).toMatch(/aria-label="Wednesday, July 15th, 2026"/)
  })
})
