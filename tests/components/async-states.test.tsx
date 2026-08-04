import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AsyncState, type AsyncDataState } from '@/components/ui/states'

describe('AsyncState', () => {
  it('preserves prior content during refresh', () => {
    const state: AsyncDataState<string> = { status: 'refreshing', data: 'Previous data' }
    const markup = renderToStaticMarkup(
      <AsyncState state={state} renderData={(data) => <span>{data}</span>} />,
    )

    expect(markup).toContain('Previous data')
    expect(markup).toContain('aria-busy="true"')
  })

  it('renders granular blocking and empty states', () => {
    expect(renderToStaticMarkup(<AsyncState state={{ status: 'initial-loading' }} />)).toContain('Loading')
    expect(renderToStaticMarkup(<AsyncState state={{ status: 'empty' }} empty={<span>No data</span>} />)).toContain('No data')
    expect(renderToStaticMarkup(<AsyncState state={{ status: 'permission-denied', message: 'No access' }} />)).toContain('No access')
  })
})
