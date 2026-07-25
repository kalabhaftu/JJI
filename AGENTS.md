# JJI repository instructions

## Start here

This file is the repository map for coding agents. Keep it concise. Put durable detail in `docs/`.

Read the relevant files before changing code:

- `README.md` — product, stack, commands, release flow
- `docs/index.md` — documentation map
- `docs/architecture.md` — runtime boundaries and data flow
- `docs/database.md` — Drizzle, Supabase, migrations, RLS, Storage
- `docs/operations.md` — deployments, services, verification, rollback
- `SECURITY.md` — reporting and security invariants
- `CONTRIBUTING.md` — change and review expectations

## Canonical facts

- Product name: JJI — Just Journal It
- Production URL: `https://justjournalit.vercel.app`
- Staging branch: `preview`
- Production branch: `main`
- Runtime: Node.js 24
- Package manager: npm
- Web framework: Next.js App Router
- Database: Supabase Postgres
- ORM: Drizzle
- Cache and rate limits: Upstash Redis
- Durable jobs: Inngest
- Monitoring: Sentry

Do not reintroduce DeltaLytix, Zella, or old product names in user-visible code.

## Commands

Use the repository scripts:

```bash
npm ci
npm run type-check
npm run lint
npm test -- --run
npm run test:ui-contracts
npm audit --audit-level=low
npm run security:scan-console
npm run build
npx drizzle-kit check
```

Run focused tests during development. Run the full gate before push or deployment.

## Code boundaries

- Keep browser code out of `server/`.
- Keep privileged credentials and service-role clients server-only.
- API mutations must authenticate, resolve the internal user, validate input, and include ownership in the database predicate.
- Do not trust IDs, paths, URLs, role names, or metadata received from the browser.
- Preserve demo isolation. Demo routes must not read or mutate production data.
- Reuse shared button, card, surface, navigation, skeleton, and theme primitives.
- Preserve one mobile bottom navigation per app shell and no marketing footer inside app shells.
- Preserve the deterministic UI contracts in `tests/ui/`.

## Database

- Drizzle schema lives in `lib/db/schema/`.
- Production migrations live in `supabase/migrations/`.
- Never use `drizzle-kit push` or `npm run db:push` against production.
- Create migrations with the repository Supabase workflow, review SQL, and commit the file.
- Rehearse migrations on staging with representative schema and data.
- Back up production before destructive, locking, or data-rewriting migrations.
- Run Supabase security and performance advisors after schema or policy changes.
- Verify migration history, schema shape, indexes, RLS, grants, and policies after apply.
- Do not remove indexes based only on an unused-index advisor. Require production workload evidence.

## Supabase security

- Enable RLS on exposed tables.
- Browser writes stay revoked unless a reviewed feature explicitly requires them.
- Realtime `SELECT` policies must include owner predicates.
- Never authorize from user-editable metadata.
- Never expose the service-role key to browser code.
- Storage writes use an authenticated owner prefix or service-role upload.
- Private-bucket conversion requires signed-URL support and a compatibility migration.

## Redis and rate limits

- Use the shared client in `lib/cache/client.ts`.
- Use lowercase colon-separated keys from the central key registry.
- Every cache write needs a finite TTL unless permanence is intentional and documented.
- Invalidate affected keys after mutations.
- Avoid `KEYS`; use explicit keys, tracked sets, or bounded `SCAN`.
- Sensitive production limits fail closed when Upstash is unavailable.
- Do not log Redis credentials, tokens, raw user data, or full cache values.

## Inngest

- Register every production function in `app/api/inngest/route.ts`.
- Keep function IDs stable.
- Use `step.run` for retriable side effects.
- Scheduled integrity work must have an explicit cron trigger.
- Event-triggered work needs deterministic payloads and idempotent database writes.
- Production requires signing and event keys.

## Sentry

- Scrub PII and secrets before capture.
- Do not enable session replay without an explicit privacy review.
- Upload server source maps during deployment; do not publish browser source maps.
- Associate events with environment and release.
- Fix unresolved production issues before release when reproducible and in scope.

## Git and release

- Preserve unrelated user changes.
- Use Conventional Commit messages.
- Update `CHANGELOG.md` for user-visible behavior.
- Push `preview` first.
- Do not merge `preview` into `main` until local gates, staging migrations, production service checks, deployment, and rollback evidence pass.
- After merging, verify the remote commit, production deployment, health endpoints, and clean worktree.

## Documentation

Update the source-of-truth document when architecture, operations, database workflow, required environment, or release behavior changes. Keep `AGENTS.md` as a map, not an encyclopedia.
