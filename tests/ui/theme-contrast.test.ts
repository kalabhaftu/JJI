import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

type Hsl = [number, number, number]
type Palette = Record<string, Hsl>

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

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

function palette(declarations: string): Palette {
  return Object.fromEntries(
    [...declarations.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)]
      .map((match) => [
        match[1],
        [Number(match[2]), Number(match[3]), Number(match[4])] as Hsl,
      ]),
  )
}

function hslToRgb([hue, saturationValue, lightnessValue]: Hsl): Hsl {
  const saturation = saturationValue / 100
  const lightness = lightnessValue / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const second = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const offset = lightness - chroma / 2
  const channels = hue < 60
    ? [chroma, second, 0]
    : hue < 120
      ? [second, chroma, 0]
      : hue < 180
        ? [0, chroma, second]
        : hue < 240
          ? [0, second, chroma]
          : hue < 300
            ? [second, 0, chroma]
            : [chroma, 0, second]

  return channels.map((channel) => channel + offset) as Hsl
}

function luminance(color: Hsl): number {
  const [red, green, blue] = hslToRgb(color).map((channel) => (
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(foreground: Hsl, background: Hsl): number {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

const lightMarker = css.indexOf('LIGHT THEME')
const darkMarker = css.indexOf('DARK THEME')
const light = palette(block(':root', lightMarker))
const dark = { ...light, ...palette(block('.dark {', darkMarker)) }

const themes: Record<string, Palette> = {
  light,
  dark,
  'reports-light': {
    ...light,
    ...palette(block('.accent-reports {')),
  },
  'reports-dark': {
    ...dark,
    ...palette(block('.accent-reports {')),
    ...palette(block('.dark.accent-reports,')),
  },
  'violet-light': {
    ...light,
    ...palette(block('.accent-violet {')),
  },
  'violet-dark': {
    ...dark,
    ...palette(block('.accent-violet {')),
    ...palette(block('.dark.accent-violet,')),
  },
  'slate-light': {
    ...light,
    ...palette(block('.accent-slate {')),
    ...palette(block('.accent-slate:not(.dark) {')),
  },
  'slate-dark': {
    ...dark,
    ...palette(block('.accent-slate {')),
    ...palette(block('.dark.accent-slate,')),
  },
}

const pairs = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['muted-foreground', 'background'],
  ['primary-foreground', 'primary'],
  ['destructive-foreground', 'destructive'],
  ['success-foreground', 'success'],
  ['warning-foreground', 'warning'],
] as const

describe('theme contrast', () => {
  for (const [themeName, theme] of Object.entries(themes)) {
    it(`${themeName} keeps text pairs at WCAG AA contrast`, () => {
      for (const [foreground, background] of pairs) {
        expect(
          contrast(theme[foreground]!, theme[background]!),
          `${themeName}: ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it('keeps accent packs as explicit, contrast-safe visual themes', () => {
    const accentSelectors = [
      '.accent-reports {',
      '.dark.accent-reports,',
      '.accent-violet {',
      '.dark.accent-violet,',
      '.accent-slate {',
      '.dark.accent-slate,',
      '.accent-slate:not(.dark) {',
    ]

    for (const selector of accentSelectors) {
      expect(block(selector), `${selector} must declare a brand accent`).toContain('--primary:')
    }

    for (const selector of [
      '.accent-reports {',
      '.dark.accent-reports,',
      '.accent-violet {',
      '.dark.accent-violet,',
      '.accent-slate {',
      '.dark.accent-slate,',
    ]) {
      const declarations = block(selector)
      expect(declarations, `${selector} must declare a profit palette`).toContain('--success:')
      expect(declarations, `${selector} must declare a loss palette`).toContain('--destructive:')
      expect(declarations, `${selector} must declare profit chart colors`).toContain('--chart-profit:')
      expect(declarations, `${selector} must declare loss chart colors`).toContain('--chart-loss:')
    }
  })
})
