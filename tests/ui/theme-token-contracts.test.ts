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

  it('lets accent packs drive the win/loss financial pair while keeping system semantics stable', () => {
    for (const selector of ['.accent-reports', '.accent-violet', '.accent-slate']) {
      const start = globals.indexOf(selector)
      const end = globals.indexOf('}', start)
      const declarations = globals.slice(start, end)
      expect(declarations, `${selector} must define chart win/loss`).toContain('--chart-profit:')
      expect(declarations, `${selector} must define chart win/loss`).toContain('--chart-loss:')
      expect(declarations, `${selector} must define financial win/loss`).toContain('--financial-profit:')
      expect(declarations, `${selector} must define financial win/loss`).toContain('--financial-loss:')
      const profitMatch = declarations.match(/--financial-profit:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/)
      const lossMatch = declarations.match(/--financial-loss:\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/)
      expect(profitMatch?.slice(1), `${selector} win/loss pair must stay distinct`).not.toEqual(lossMatch?.slice(1))
      expect(declarations).not.toMatch(/--(success|destructive|warning|semantic-)/)
    }
  })
})
