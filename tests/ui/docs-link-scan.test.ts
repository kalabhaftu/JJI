import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function walkFiles(directory: string, matcher: RegExp, acc: string[]) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) walkFiles(path, matcher, acc)
    else if (matcher.test(path)) acc.push(path)
  }
  return acc
}

const sourceFiles = walkFiles(join(root, 'app'), /\.(ts|tsx)$/, [])
walkFiles(join(root, 'components'), /\.(ts|tsx)$/, sourceFiles)
walkFiles(join(root, 'lib'), /\.(ts|tsx)$/, sourceFiles)

const docsFiles = walkFiles(join(root, 'docs'), /\.(md|mdx)$/, [])

interface MarkdownLink { href: string; line: number }

function markdownLinks(file: string): MarkdownLink[] {
  const links: MarkdownLink[] = []
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) {
      const href = match[1].trim()
      if (href.startsWith('/') && !href.startsWith('//')) links.push({ href, line: index + 1 })
    }
  })
  return links
}

function routeExists(route: string): boolean {
  const pathname = route.split(/[?#]/)[0].replace(/\/+$/, '')
  const candidates = [
    join(root, 'app', pathname, 'page.tsx'),
    join(root, 'app', `${pathname}.tsx`),
    join(root, 'app', `${pathname}.js`),
  ]
  return candidates.some((candidate) => {
    try {
      return statSync(candidate).isFile()
    } catch {
      return false
    }
  })
}

describe('documentation and canonical route links', () => {
  it('ships no internal references to the obsolete docs donate path', () => {
    const obsoleteReferences = sourceFiles.flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n')
      return lines
        .map((line, index) => line.includes('/docs/donate') ? `${relative(root, file)}:${index + 1}` : null)
        .filter(Boolean)
    })

    expect(obsoleteReferences).toEqual([])
  })

  it('rejects /docs/donate markdown links in docs (migrated to /donate)', () => {
    const obsoleteLinks: string[] = []
    for (const file of docsFiles) {
      for (const { href, line } of markdownLinks(file)) {
        if (href.startsWith('/docs/donate')) {
          obsoleteLinks.push(`${relative(root, file)}:${line}: ${href} must be /donate`)
        }
      }
    }

    expect(obsoleteLinks).toEqual([])
  })

  it('resolves every /dashboard/* markdown link in docs to an existing app/dashboard route', () => {
    const brokenLinks: string[] = []
    for (const file of docsFiles) {
      for (const { href, line } of markdownLinks(file)) {
        if (href.startsWith('/dashboard/') && !routeExists(href)) {
          brokenLinks.push(`${relative(root, file)}:${line}: ${href} has no matching app/dashboard route`)
        }
      }
    }

    expect(brokenLinks).toEqual([])
  })

  it('keeps the canonical trade-entry route present', () => {
    expect(readFileSync(join(root, 'app/dashboard/trades/new/page.tsx'), 'utf8')).toContain('TradeEntryPageClient')
  })
})
