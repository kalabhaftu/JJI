import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const reportPath = process.argv[2] ?? '.next-analyze/diagnostics/route-bundle-stats.json'
const stats = JSON.parse(await readFile(reportPath, 'utf8'))
const routes = [
  '/dashboard',
  '/dashboard/journal',
  '/dashboard/reports',
  '/dashboard/prop-firm/accounts',
  '/dashboard/prop-firm/accounts/[id]',
  '/dashboard/accounts',
  '/dashboard/backtesting',
]

const result = []
for (const route of routes) {
  const entry = stats.find((candidate) => candidate.route === route)
  if (!entry) {
    result.push({ route, status: 'missing' })
    continue
  }

  const assets = await Promise.all(
    entry.firstLoadChunkPaths.map(async (assetPath) => {
      const contents = await readFile(assetPath)
      return {
        parsedBytes: contents.byteLength,
        gzipBytes: gzipSync(contents).byteLength,
      }
    }),
  )

  result.push({
    route,
    assetCount: assets.length,
    parsedBytes: assets.reduce((sum, asset) => sum + asset.parsedBytes, 0),
    gzipBytes: assets.reduce((sum, asset) => sum + asset.gzipBytes, 0),
    firstLoadUncompressedJsBytes: entry.firstLoadUncompressedJsBytes,
  })
}

console.log(JSON.stringify(result, null, 2))
