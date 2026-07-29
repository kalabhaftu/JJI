# Observability

Unexpected failures enter through `reportError(error, context)`. Pino records
the structured operational event; Sentry capture is an explicit separate
decision. Expected validation, authorization, not-found, conflict, cancellation,
and framework control-flow errors are filtered centrally.

Safe context keys are request ID, route, surface, operation, job ID, release,
environment, and internal entity IDs. Never attach cookies, authorization
headers, request bodies, emails, journal text, trade payloads, uploaded media,
provider credentials, or raw import data. The Sentry `beforeSend` scrubber
removes request data, cookies, query strings, headers, PII fields, sensitive
extras, contexts, and breadcrumb data.

Every application request receives a validated or generated `x-request-id`.
Search the same value in the response header/body, Pino event, Sentry tags, and
durable audit record.

## Provider verification

Provider work requires `SENTRY_AUTH_TOKEN`, the target organization, and
project. It is intentionally separate from local implementation and must not
activate production alerts without approval.

Configure native alerts using existing Sentry notification destinations:

- new unhandled page errors;
- API 5xx rate spike;
- `surface:phase-evaluation` failures;
- terminal import failures;
- `operation:rate-limit-backend`;
- cron/background-job failures;
- release regressions.

The reviewable source manifest is `config/sentry-alerts.json`. It intentionally
contains no destination identifiers or credentials and declares
`activationRequiresApproval: true`. CI verifies that every required alert class
remains represented. Applying the manifest to a live Sentry project remains a
provider operation requiring explicit approval.

Verify source maps and release association, grouping, request-ID search, privacy
scrubbing, then one controlled notification. Controlled failures must run from
an authenticated non-production environment or a local test harness; do not add
a public crash endpoint.

The local-only harness is `bun run observability:verify-local -- <surface>`.
It refuses production targets and requires `JJI_CONTROLLED_FAILURES=1`.
Supported surfaces are `client`, `server`, `phase-evaluation`, and `import`.
