import { readFile } from 'node:fs/promises'

const manifest = JSON.parse(
  await readFile('config/sentry-alerts.json', 'utf8'),
)
const required = new Set([
  'new-unhandled-page-error',
  'api-5xx-spike',
  'phase-evaluation-failure',
  'import-terminal-failure',
  'rate-limit-backend-failure',
  'cron-background-failure',
  'release-regression',
])

if (manifest.activationRequiresApproval !== true) {
  throw new Error('Sentry alert activation must require explicit approval')
}
for (const rule of manifest.rules ?? []) required.delete(rule.id)
if (required.size > 0) {
  throw new Error(`Missing Sentry alert definitions: ${[...required].join(', ')}`)
}
console.log('Sentry alert manifest check passed')
