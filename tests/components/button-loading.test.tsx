import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'

describe('Button loading state', () => {
  it('keeps the outcome label available while pending', () => {
    const markup = renderToStaticMarkup(<Button loading loadingText="Saving account">Save account</Button>)
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('Saving account')
    expect(markup).toContain('Save account')
  })
})
