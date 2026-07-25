const { spawn } = require('child_process')
const path = require('path')

const isWindows = process.platform === 'win32'
const isWindowsSafeModeDisabled = process.env.NEXT_DISABLE_WINDOWS_WASM_FALLBACK === '1'
const nextArgs = process.argv.slice(2)
const useWindowsSafeMode = isWindows && !isWindowsSafeModeDisabled

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || '1',
  // Keep a running dev server isolated from `next build` and bundle analysis.
  // Sharing .next lets either process replace the other's manifests and chunks.
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-dev',
}

if (!env.NODE_OPTIONS) {
  env.NODE_OPTIONS = '--max-old-space-size=4096'
}

if (useWindowsSafeMode) {
  console.log(
    '[dev] Starting Next.js in Windows-safe local mode. This keeps local startup reliable on machines with native SWC policy restrictions and does not change production builds.'
  )
}

const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next')
const child = spawn(process.execPath, [nextBin, 'dev', ...nextArgs], {
  stdio: 'inherit',
  env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error('[dev] Failed to start Next.js:', error)
  process.exit(1)
})
