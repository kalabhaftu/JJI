import Link from 'next/link'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders a single slotted child without React.Children.only errors', () => {
    const markup = renderToStaticMarkup(
      <Button asChild>
        <Link href="/cookies">Read policy</Link>
      </Button>
    )

    expect(markup).toContain('href="/cookies"')
    expect(markup).toContain('Read policy')
  })
})
