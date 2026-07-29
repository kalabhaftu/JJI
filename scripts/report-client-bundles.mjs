import { readFile } from 'node:fs/promises'

const reportPath = process.argv[2] ?? '.next-analyze/analyze/client.html'
const html = await readFile(reportPath, 'utf8')
const chartPrefix = 'window.chartData = '
const chartStart = html.indexOf(chartPrefix)
const chartEnd = html.indexOf(';\n      window.entrypoints', chartStart)
if (chartStart < 0 || chartEnd < 0) {
  throw new Error(`Bundle analyzer data was not found in ${reportPath}`)
}

const assets = JSON.parse(
  html.slice(chartStart + chartPrefix.length, chartEnd),
)
const routes = [
  'app/dashboard/page',
  'app/dashboard/journal/page',
  'app/dashboard/reports/page',
  'app/dashboard/prop-firm/accounts/page',
  'app/dashboard/prop-firm/accounts/[id]/page',
  'app/dashboard/accounts/page',
  'app/dashboard/backtesting/page',
]

const result = routes.map((route) => {
  const initialAssets = assets.filter(
    (asset) => asset.isAsset && asset.isInitialByEntrypoint?.[route],
  )
  return {
    route,
    assetCount: initialAssets.length,
    parsedBytes: initialAssets.reduce((sum, asset) => sum + asset.parsedSize, 0),
    gzipBytes: initialAssets.reduce((sum, asset) => sum + asset.gzipSize, 0),
  }
})

console.log(JSON.stringify(result, null, 2))
