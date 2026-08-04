import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Progress } from '@/components/ui/progress'

describe('Progress', () => {
  it('forwards the semantic value to the progress root', () => {
    const markup = renderToStaticMarkup(<Progress value={42} aria-label="Import progress" />)
    expect(markup).toContain('aria-valuenow="42"')
    expect(markup).toContain('aria-label="Import progress"')
    expect(markup).toContain('--progress-val:-58%')
  })

  it('preserves zero as a determinate value', () => {
    const markup = renderToStaticMarkup(<Progress value={0} aria-label="Import progress" />)
    expect(markup).toContain('aria-valuenow="0"')
    expect(markup).toContain('--progress-val:-100%')
  })

  it('scales against custom and invalid maxima without invalid CSS', () => {
    expect(renderToStaticMarkup(<Progress value={50} max={200} />)).toContain('--progress-val:-75%')
    const markup = renderToStaticMarkup(<Progress value={50} max={0} />)
    expect(markup).toContain('aria-valuemax="100"')
    expect(markup).not.toContain('NaN')
  })
})
