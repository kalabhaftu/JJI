const fs = require('node:fs')
const path = require('node:path')

const ROOTS = ['app', 'components', 'context', 'hooks', 'lib', 'server']
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])
const UNSAFE_CONSOLE_CALL = /\bconsole\.(log|debug|trace)\s*\(/

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(target)
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [target] : []
  })
}

const findings = ROOTS
  .filter((root) => fs.existsSync(root))
  .flatMap(collectFiles)
  .flatMap((file) => fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((line, index) => ({ file, line: index + 1, source: line.trim() }))
    .filter(({ source }) => UNSAFE_CONSOLE_CALL.test(source)))

if (findings.length > 0) {
  console.error('Unsafe console output found in production source:')
  findings.forEach(({ file, line, source }) => console.error(`${file}:${line} ${source}`))
  process.exit(1)
}

process.stdout.write('Production console scan passed.\n')
