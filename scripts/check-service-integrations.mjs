import { readFile } from 'node:fs/promises'

const requirements = [
  {
    file: 'lib/cache/client.ts',
    patterns: [
      ['Upstash Redis SDK', /@upstash\/redis/],
      ['configuration validation', /isRedisConfigured/],
    ],
  },
  {
    file: 'lib/rate-limiter.ts',
    patterns: [
      ['Upstash SDK', /@upstash\/ratelimit/],
      ['bounded timeout', /UPSTASH_TIMEOUT_MS/],
      ['timeout fail-closed conversion', /isUpstashTimeout/],
      ['backend telemetry', /rate-limit-backend/],
    ],
  },
  {
    file: 'lib/inngest/client.ts',
    patterns: [
      ['typed event schemas', /EventSchemas/],
      ['shared event contract', /JjiInngestEvents/],
    ],
  },
  {
    file: 'lib/email.ts',
    patterns: [
      ['Resend SDK', /from 'resend'/],
      ['idempotency keys', /idempotencyKey/],
      ['canonical failure reporting', /reportError/],
    ],
  },
  {
    file: 'app/api/inngest/route.ts',
    patterns: [
      ['Inngest serving', /serve\(/],
      ['terminal failure reporter', /reportInngestFunctionFailure/],
    ],
  },
  {
    file: 'lib/inngest/functions/process-import-job.ts',
    patterns: [
      ['durable steps', /step\.run/],
      ['traced child events', /step\.sendEvent/],
      ['request correlation', /requestId/],
    ],
  },
  {
    file: 'lib/observability/report-error.ts',
    patterns: [
      ['Sentry SDK', /@sentry\/nextjs/],
      ['privacy scrubber', /scrubSentryContext/],
      ['single capture path', /Sentry\.captureException/],
    ],
  },
]

const failures = []
for (const requirement of requirements) {
  const source = await readFile(requirement.file, 'utf8')
  for (const [name, pattern] of requirement.patterns) {
    if (!pattern.test(source)) failures.push(`${requirement.file}: missing ${name}`)
  }
}

if (failures.length > 0) {
  console.error('Required production service integrations are incomplete:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Service integration source check passed')
}
