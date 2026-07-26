import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

describe('semantic control contracts', () => {
  const result = JSON.parse(execFileSync('node', ['scripts/check-semantic-controls.mjs'], {
    encoding: 'utf8',
  })) as {
    unnamedIconControls: string[]
    clickableNonControls: string[]
  }

  it('names every icon-only Button and Toggle', () => {
    expect(result.unnamedIconControls).toEqual([])
  })

  it('does not attach click behavior to non-control containers', () => {
    expect(result.clickableNonControls).toEqual([])
  })
})
