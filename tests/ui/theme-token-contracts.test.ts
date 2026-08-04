import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const globals = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

describe('semantic theme token contract', () => {
  it('defines stable semantic and financial roles independently from brand roles', () => {
    for (const token of [
      '--brand-primary:',
      '--brand-selected:',
      '--brand-navigation-active:',
      '--semantic-success:',
      '--semantic-warning:',
      '--semantic-destructive:',
      '--semantic-error:',
      '--semantic-permission:',
      '--semantic-disabled:',
      '--financial-profit:',
      '--financial-loss:',
      '--financial-long:',
      '--financial-short:',
      '--financial-bullish:',
      '--financial-bearish:',
      '--financial-neutral:',
    ]) {
      expect(globals, token).toContain(token)
    }
  })

  it('does not let accent packs override financial or semantic roles', () => {
    for (const selector of ['.accent-reports', '.accent-violet', '.accent-slate']) {
      const start = globals.indexOf(selector)
      const end = globals.indexOf('}', start)
      const declarations = globals.slice(start, end)
      expect(declarations).not.toMatch(/--(success|destructive|warning|chart-profit|chart-loss|financial-|semantic-)/)
    }
  })
})
