import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const files: string[] = []

function walk(directory: string) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.(ts|tsx|md|mdx)$/.test(path)) files.push(path)
  }
}

walk(join(root, 'app'))
walk(join(root, 'components'))
walk(join(root, 'lib'))

describe('documentation and canonical route links', () => {
  it('does not ship internal links to the obsolete docs donate path', () => {
    const obsoleteReferences = files.flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n')
      return lines.map((line, index) => line.includes('/docs/donate') ? `${file}:${index + 1}` : null).filter(Boolean)
    })

    expect(obsoleteReferences).toEqual([])
  })

  it('keeps the canonical trade-entry route present', () => {
    expect(readFileSync(join(root, 'app/dashboard/trades/new/page.tsx'), 'utf8')).toContain('TradeEntryPageClient')
  })
})
