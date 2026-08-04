import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FinancialValue } from '@/components/ui/financial-value'

describe('FinancialValue', () => {
  it('exposes sign, unit, quality, and stable financial semantics', () => {
    const markup = renderToStaticMarkup(
      <FinancialValue kind="pnl" value={1250} explicitSign quality="estimated" />,
    )

    expect(markup).toContain('+$1,250.00')
    expect(markup).toContain('financial-profit')
    expect(markup).toContain('Estimated')
  })

  it('renders unavailable values without implying zero', () => {
    const markup = renderToStaticMarkup(<FinancialValue kind="currency" value={null} />)
    expect(markup).toContain('Unavailable')
    expect(markup).not.toContain('$0.00')
  })

  it('uses neutral semantics for non-finite or unavailable values', () => {
    for (const props of [
      { value: Number.NaN },
      { value: 1250, quality: 'unavailable' as const },
    ]) {
      const markup = renderToStaticMarkup(<FinancialValue kind="pnl" {...props} />)
      expect(markup).toContain('financial-neutral')
      expect(markup).not.toContain('financial-profit')
      expect(markup).not.toContain('financial-loss')
    }
  })
})
