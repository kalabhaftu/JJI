import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(path)
    return /\.(tsx|jsx)$/.test(entry.name) ? [path] : []
  })
}

describe('settings icon contract', () => {
  it('keeps every HugeiconsIcon at the shared two-pixel stroke weight', () => {
    const settingsRoot = join(process.cwd(), 'app/dashboard/settings')
    const iconUses = collectSourceFiles(settingsRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      return [...source.matchAll(/<HugeiconsIcon\b[\s\S]*?\/>/g)].map((match) => ({
        file,
        source: match[0],
      }))
    })

    expect(iconUses.length).toBeGreaterThan(0)
    for (const iconUse of iconUses) {
      expect(iconUse.source, iconUse.file).toMatch(/\bstrokeWidth=\{2\}/)
    }
  })
})
