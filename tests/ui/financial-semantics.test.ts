import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

const FINANCIAL_ROLES = ['profit', 'loss', 'long', 'short', 'bullish', 'bearish', 'neutral'] as const

function block(selector: string, from = 0): string {
  const selectorStart = css.indexOf(selector, from)
  if (selectorStart < 0) throw new Error(`Missing selector: ${selector}`)
  const open = css.indexOf('{', selectorStart)
  let depth = 0

  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    if (css[index] === '}') depth -= 1
    if (depth === 0) return css.slice(open + 1, index)
  }

  throw new Error(`Unclosed selector: ${selector}`)
}

function financialTokens(declarations: string): Record<string, [number, number, number]> {
  return Object.fromEntries(
    [...declarations.matchAll(/--financial-([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)]
      .map((match) => [
        match[1],
        [Number(match[2]), Number(match[3]), Number(match[4])] as [number, number, number],
      ]),
  )
}

const definitions = [...css.matchAll(/--financial-profit:\s*[\d.]+/g)].map(match => match.index ?? -1)
const [lightAt, darkAt] = definitions
const light = financialTokens(block(':root', css.lastIndexOf(':root', lightAt)))
const dark = financialTokens(block('.dark', css.lastIndexOf('.dark', darkAt)))

describe('financial token invariance', () => {
  it('defines every financial role in both light and dark themes', () => {
    for (const role of FINANCIAL_ROLES) {
      expect(light[role], `light --financial-${role}`).toBeDefined()
      expect(dark[role], `dark --financial-${role}`).toBeDefined()
    }
  })

  it('maps every financial role to a Tailwind color variable', () => {
    for (const role of FINANCIAL_ROLES) {
      expect(css, `--color-financial-${role}`).toContain(`--color-financial-${role}: hsl(var(--financial-${role}))`)
    }
  })

  it('keeps paired roles visually distinct in both themes', () => {
    for (const theme of [light, dark]) {
      expect(theme.profit).not.toEqual(theme.loss)
      expect(theme.long).not.toEqual(theme.short)
      expect(theme.bullish).not.toEqual(theme.bearish)
      expect(theme.neutral).not.toEqual(theme.profit)
      expect(theme.neutral).not.toEqual(theme.loss)
    }
  })

  it('keeps long/profit and short/loss in the same hue family per theme', () => {
    for (const theme of [light, dark]) {
      expect(Math.abs(theme.profit[0] - theme.long[0])).toBeLessThanOrEqual(25)
      expect(Math.abs(theme.short[0] - theme.loss[0])).toBeLessThanOrEqual(25)
    }
  })

  it('keeps bullish green and bearish non-green in both themes', () => {
    for (const theme of [light, dark]) {
      expect(theme.bullish[0]).toBeGreaterThanOrEqual(60)
      expect(theme.bullish[0]).toBeLessThanOrEqual(180)
      expect(theme.bearish[0] >= 330 || theme.bearish[0] < 60).toBe(true)
    }
  })
})
