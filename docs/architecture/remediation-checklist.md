# Production architecture remediation checklist

Status date: 2026-08-01

Branch: `preview`

Execution policy: local code only; no push, deployment, remote migration, or provider mutation.

Legend:

- `[x]` implementation is present in the worktree and passed a focused source or syntax guard.
- `[ ]` requires more implementation, a repaired dependency installation, provider access, or deployment approval.
- Production/provider work stays unchecked until verified against the real service.

## 1. Baseline and safety

- [x] Confirm the `JJI` checkout, `preview` branch, Bun package manager, and repository instructions.
- [x] Record the preserved replay-file SHA-256 before architecture edits.
- [x] Keep `app/dashboard/components/trade-replay/trade-replayer.tsx` unchanged.
- [x] Inventory phase callers, mutation actions, route policies, direct Sentry captures, migrations, and monolith consumers.
- [x] Record a bundle-analyzer baseline in `docs/architecture/bundle-baseline.json`.
- [x] Inventory four Drizzle-journaled and twenty imperative Supabase migrations without rewriting history.
- [x] Record pre-existing dependency/build/test failures for the final validation gate.
- [ ] Repair the local dependency installation and establish a clean full-build baseline.
- [ ] Create a remote database migration-list snapshot after database access is approved.

## 2. Error reporting and Sentry

- [x] Add canonical `reportError(error, context)`.
- [x] Normalize non-Error thrown values.
- [x] Sanitize messages, tags, and structured extras.
- [x] Separate Pino logging from the Sentry capture decision.
- [x] Centralize expected-error classification.
- [x] Prevent duplicate capture of the same Error instance.
- [x] Remove direct application `Sentry.captureException` calls outside the canonical reporter.
- [x] Remove the legacy error-logger adapter so callers report the original error and request context.
- [x] Repair root and global error experiences with safe production messages.
- [x] Add reusable accessible application and segment error presentations.
- [x] Add inherited boundaries for dashboard, docs, reports, and subscribe surfaces.
- [x] Route React boundaries and client mutation/fetch failures through the reporter.
- [x] Keep official server `onRequestError` capture and add request correlation.
- [x] Add sanitized context to phase, import, cron, API, and background-job failures.
- [x] Add privacy-scrubber coverage for cookies, authorization, tokens, email, body, journal, trade, and upload values.
- [x] Document safe non-production verification.
- [x] Add a guarded local verification harness for client, server, phase, and import failures.
- [x] Add and validate a versioned Sentry alert manifest for all seven required alert classes.
- [ ] Verify the live Sentry project, releases, source maps, grouping, and request-ID search.
- [ ] Activate and verify Sentry-native alerts for new page errors from the reviewed manifest.
- [ ] Activate and verify Sentry-native alerts for API 5xx spikes from the reviewed manifest.
- [ ] Activate and verify Sentry-native alerts for phase failures from the reviewed manifest.
- [ ] Activate and verify Sentry-native alerts for import failures from the reviewed manifest.
- [ ] Activate and verify Sentry-native alerts for limiter backend failures from the reviewed manifest.
- [ ] Activate and verify Sentry-native alerts for cron/background failures from the reviewed manifest.
- [ ] Activate and verify Sentry-native release-regression alerts from the reviewed manifest.
- [ ] Trigger one controlled provider notification after explicit approval.

## 3. Request correlation

- [x] Validate safe incoming request IDs and generate replacements for invalid values.
- [x] Attach `x-request-id` at the middleware boundary.
- [x] Return request IDs from standardized JSON helpers.
- [x] Preserve request IDs on redirects, rewrites, streams, files, auth, webhooks, and cron responses without changing protocol bodies.
- [x] Propagate request IDs through logger/Sentry context.
- [x] Propagate request IDs through account, trade, payout, audit, phase, and import operations.
- [x] Propagate request IDs through Inngest phase and import events.
- [x] Propagate request IDs through daily-anchor and storage-cleanup Inngest events.
- [x] Bind job, phase, cleanup, and anchor payloads to shared Inngest event schemas.
- [x] Add route and operation tags without private request payloads.
- [ ] Verify one deployed response through logs, Sentry, and its durable audit row.

## 4. Phase evaluation engine

- [x] Characterize no-trade behavior.
- [x] Characterize commission-adjusted net P/L.
- [x] Characterize UTC day boundaries.
- [x] Characterize historical daily drawdown.
- [x] Characterize static drawdown.
- [x] Characterize trailing drawdown.
- [x] Characterize exact thresholds.
- [x] Characterize non-breaching recovery.
- [x] Characterize minimum-day progress.
- [x] Characterize profit-target progress.
- [x] Characterize failure-first simultaneous target/breach behavior.
- [x] Characterize existing and missing daily-start anchors.
- [x] Characterize safe anchor-creation fallback.
- [x] Characterize repeated deterministic evaluation.
- [x] Characterize notification failure without changing the decision.
- [x] Use fixed clocks and explicit UTC semantics.
- [x] Extract pure anchor, drawdown, breach, progress, and evaluation modules.
- [x] Keep the engine as thin orchestration.
- [x] Replace no-op logging and silent unexpected catches.
- [x] Keep calculations free of persistence and notifications.
- [x] Preserve precision, comparison operators, and external result shapes.
- [x] Make phase service the authoritative persistence path.
- [x] Keep transition and breach persistence transactional and idempotent.
- [x] Dispatch notifications only after durable state.
- [x] Report notification failures without rolling back trading decisions.
- [x] Add structured operational evaluation, transition, breach, fallback, and failure events.
- [ ] Run phase integration tests against a staged Postgres database.

## 5. API and browser mutation architecture

- [x] Add typed success and error envelopes.
- [x] Add helpers for validation, auth, forbidden, not-found, conflict, limiter, and unexpected errors.
- [x] Make HTTP status authoritative.
- [x] Prevent raw internal Error serialization.
- [x] Preserve status, cache headers, rate-limit headers, and cookies in migrated route families.
- [x] Migrate account, trade, import, tag, goal, notification, settings, donation, provider-sync, dashboard, journal, report, subscription, payment-core, and AI chat/insight families.
- [x] Update in-repository clients alongside each migrated family.
- [x] Preserve protocol bodies for webhooks, redirects, files, exports, streams, health, auth callbacks, cron, and Inngest.
- [x] Document the breaking v1 envelope.
- [x] Migrate AI chat, message-error, insight, and journal-analysis routes while preserving the text-stream success protocol.
- [x] Preserve AI format and mapping text streams as explicit protocol exemptions while standardizing reporting and request IDs.
- [x] Migrate prop-firm account lifecycle, phase-advance, and transition routes to the envelope.
- [x] Migrate backtesting, trading-model, and weekly-review routes to the envelope.
- [x] Add a source contract guard covering every v1 route and the eight reviewed protocol exemptions.
- [ ] Add contract coverage for every migrated route family after dependencies are repaired.
- [x] Inventory browser-triggered mutation Server Actions.
- [x] Move account, trade, payout, provider, template, notification-setting, onboarding, and funded-decision mutations behind classified APIs.
- [x] Extract explicit-actor domain operations.
- [x] Keep API routes calling domain operations rather than Server Actions.
- [x] Preserve optimistic state, invalidation, toasts, redirects, and loading behavior in migrated clients.
- [x] Delete obsolete mutation actions.
- [x] Add a source guard preventing client imports of server mutation modules.
- [x] Keep API handlers off Server Action facades and import server-only domain modules directly.

## 6. Rate-limit hardening

- [x] Add centralized route classification and policy selection.
- [x] Move every ordinary API route off direct limiter calls and through the route-policy registry.
- [x] Require every mutation route to contain a limiter or trusted-protocol classification.
- [x] Classify sensitive, authenticated-read, public-read, auth, AI, import, payment, upload, feedback, admin, and signed/trusted traffic.
- [x] Fail closed for sensitive production mutations when Redis is unavailable.
- [x] Allow only reviewed reads to fail open with high-severity telemetry.
- [x] Preserve signed webhook and trusted cron handling.
- [x] Remove `ALLOW_IN_MEMORY_RATE_LIMITS_IN_PRODUCTION`.
- [x] Remove misleading in-memory fallback behavior.
- [x] Return stable limiter error codes and request IDs.
- [x] Cover limiter success, rejection, timeout, failure, fail-closed, fail-open read, and trusted-exemption decisions in focused tests.
- [x] Add CI route-policy enforcement.
- [x] Cover function and `export const` mutations and reject new direct route-level limiter calls.
- [x] Emit rate-backend failure and sustained fail-open telemetry.
- [x] Apply an explicit Upstash SDK timeout and map timeouts through the reviewed fail-open/fail-closed policy.
- [x] Enforce source-level Redis, Upstash, Inngest, Resend, and Sentry integration requirements.
- [x] Sanitize provider/cache fallback warnings before ordinary log emission.
- [ ] Configure the corresponding Sentry provider alert.

## 7. Account monolith

- [x] Remove the 1,544-line `server/accounts.ts` implementation.
- [x] Extract account lifecycle operations.
- [x] Extract account cache invalidation.
- [x] Extract payout operations.
- [x] Extract funded-decision coordination.
- [x] Extract trade save/link operations.
- [x] Extract trade update/delete operations with explicit actors.
- [x] Keep ownership predicates inside every operation.
- [x] Keep required audit writes in mutation transactions.
- [x] Preserve returned account and payout shapes during caller migration.
- [x] Move API handlers to direct domain imports.
- [x] Preserve cache keys and notification-after-commit timing.
- [x] Extract account notification coordination.
- [x] Extract one authoritative, transactional phase-progression operation.
- [x] Extract prop-firm account lifecycle with ownership, audit, and cache invalidation.
- [ ] Add database-backed characterization coverage for transaction rollback and notification timing.

## 8. Import monolith

- [x] Reduce `server/import-jobs.ts` to a public orchestration facade.
- [x] Extract ZIP validation and parsing.
- [x] Extract image discovery, upload, and linking.
- [x] Extract preparation orchestration.
- [x] Add an importer registry with entity-family handlers.
- [x] Extract lookup-map construction.
- [x] Extract leasing and worker-token state.
- [x] Extract progress, cancellation, and resume state.
- [x] Add authenticated resume APIs for archive and trade-import jobs.
- [x] Restore failed/cancelled archive imports from persisted progress without duplicating completed work.
- [x] Extract trade/backtest chunk execution.
- [x] Preserve chunking, progress calculation, object paths, payloads, and resumability.
- [x] Keep retry state transitions idempotent.
- [x] Separate record failures from terminal job failures.
- [x] Report terminal failures with sanitized job/request context.
- [x] Add state tests for leasing, cancellation, resume, and terminal transitions.
- [ ] Add staged storage/database tests for mixed ZIPs, image failures, retries, and repeated execution.

## 9. Utility monolith

- [x] Reduce `lib/utils.ts` to the class-name helper.
- [x] Extract the statistics engine.
- [x] Extract trade formatting.
- [x] Extract trade grouping.
- [x] Extract content cleaning.
- [x] Extract calendar/date helpers.
- [x] Replace application imports with cohesive direct modules.
- [x] Avoid server-only helpers in client modules.
- [x] Keep the replay file untouched.
- [x] Add focused statistics cases for empty data, commissions, break-even, drawdown, streaks, expectancy, profit factor, and calendar grouping.
- [ ] Run the focused statistics suite after dependencies are repaired.

## 10. Audit logging

- [x] Document `AuditLog` versus `ActivityLog`.
- [x] Add nullable `requestId`, `entityType`, and `source` audit columns in a Supabase migration.
- [x] Add operationally useful nullable request ID to activity records.
- [x] Add only request-correlation indexes.
- [x] Centralize audit creation and redaction.
- [x] Audit material account, payout, trade, phase, import, subscription, token, and deletion mutations.
- [x] Couple mandatory audit rows to mutation transactions.
- [x] Roll back material mutations when audit insertion fails.
- [x] Use bulk summary events for imports and trade batches.
- [x] Redact credentials, journal content, uploads, request bodies, and personal fields.
- [x] Add audit redaction, bulk-summary, request-correlation, and rollback-propagation tests.
- [x] Preserve a final deletion audit row with nullable user ownership and `ON DELETE SET NULL`.
- [x] Audit prop-firm creation, update, deletion, and phase advancement transactionally.
- [ ] Apply and verify the audit migration in staging.

## 11. Migration workflow

- [x] Keep `supabase/migrations` as the production source of truth.
- [x] Inventory Drizzle-journaled and imperative migrations without history repair.
- [x] Disable misleading `drizzle-kit push/generate` deployment scripts.
- [x] Document the supported Supabase migration workflow.
- [x] Update Drizzle schema beside the pending Supabase migration.
- [x] Add migration naming, order, schema-alignment, and untracked-file checks.
- [x] Add CI migration consistency enforcement.
- [x] Pass the local read-only migration consistency guard.
- [ ] Start local Supabase and run migration-list/dry-run verification.
- [ ] Rehearse the migration against staging.
- [ ] Run database advisors after staging application.
- [ ] Confirm a backup or restore point before production.
- [ ] Apply the migration to production only after explicit approval.

## 12. Measured bundles

- [x] Record a before-change analyzer snapshot.
- [x] Identify static route-local Recharts and Framer Motion surfaces.
- [x] Lazy-load route-local chart widgets behind dimension-preserving skeletons.
- [x] Interaction-gate the weekly review editor so Recharts, Lexical, and image compression stay out of dashboard startup code.
- [x] Keep Lexical surfaces unchanged where already dynamically isolated.
- [x] Avoid blanket dynamic imports and shared-primitive chunk fragmentation.
- [x] Leave database pool `max: 1` unchanged without profiling evidence.
- [x] Avoid speculative `serverExternalPackages`.
- [ ] Repair dependencies and generate a comparable after-change analyzer snapshot.
- [ ] Confirm a measurable touched-route reduction.
- [ ] Reject or explain any touched initial chunk increase above 5 KiB or 3%.
- [ ] Perform keyboard, reduced-motion, mobile, layout-shift, and chart-accessibility verification.

## 13. Integration and E2E

- [x] Replace unauthenticated “not 404” checks with contract and request-ID assertions.
- [x] Add a production-URL refusal guard.
- [x] Add guarded authenticated Chromium coverage for dashboard, account mutation, and standardized API errors.
- [x] Keep browser coverage deterministic and narrow.
- [ ] Provision the dedicated non-production test account.
- [ ] Add authenticated trade create/update/delete coverage.
- [ ] Add authenticated journal workflow coverage.
- [ ] Add prop-firm evaluation and payout coverage.
- [ ] Add import upload/progress/completion/cancel/resume coverage.
- [ ] Add route-boundary recovery coverage.
- [ ] Run representative desktop/mobile Chromium verification.
- [ ] Run cross-browser smoke only at the final release gate.

## 14. Validation and rollout

- [x] Use only focused syntax/source guards during implementation.
- [x] Keep full validation to one final gate.
- [x] Inspect for direct Sentry captures, mutation-action imports, unclassified mutation routes, migration drift, whitespace errors, and replay-file changes.
- [x] Keep database, provider, alert, push, and deployment operations local/pending.
- [ ] Repair the dependency installation.
- [ ] Run type-check once.
- [ ] Run lint once.
- [ ] Run the full unit/integration suite once.
- [ ] Run the production build once.
- [ ] Run migration dry-run and advisor checks once.
- [ ] Run secret/security scans once.
- [ ] Run final bundle analysis once.
- [ ] Run authenticated representative browser verification once.
- [ ] Run controlled Sentry client/server/phase/import failures once.
- [ ] Verify end-to-end request correlation and privacy once.
- [x] Create local Conventional Commit checkpoints.
- [ ] Confirm the final tree contains intended commits plus the preserved user work.
- [ ] Push, migrate, deploy, activate alerts, or release only with explicit approval.

## 15. Additional monolith remediation

The 2026-07-29 follow-up scan was checked against the current source. The CSV parser remains
intentionally cohesive; every file below has more than one responsibility and stays tracked
until its old implementation is gone.

- [x] Replace the 857-line `server/auth.ts` with client, identity, provider, OTP, and user-provisioning modules.
- [x] Replace the 824-line subscription service with access, payments, promotions, checks, and notification modules.
- [x] Split dashboard analytics by curve, strategy, time/calendar, risk, and behavioral calculations.
- [x] Reduce the journal AI API route to request/auth/query orchestration.
- [x] Move journal-analysis prompt generation and rule fallback behind a server AI module.
- [x] Extract the deterministic journal-analysis fallback from provider orchestration.
- [x] Split the remaining journal AI server module into preparation, prompt, and provider modules.
- [x] Split settings profile/plan, preferences, integrations, and destructive-account UI into focused components.
- [x] Extract the settings help/tour section into a focused component.
- [x] Split the weekly modal data access, document serialization, metrics, charts, and journal UI.
- [x] Extract weekly-review API access and Lexical document serialization from the modal.
- [x] Move tour definitions, persistence, event handling, and CSV download out of the tour context.
- [x] Move all static tour definitions and public tour types out of the context.
- [x] Move Rithmic protocol handling and synchronization orchestration out of the context provider.
- [x] Extract the Rithmic credential contract and rate-limit response parser.
- [x] Split trade-import lifecycle, normalization, serialization, and chunk execution behind a two-line compatibility facade.
- [x] Finish reducing the archive-import facade without duplicate lifecycle paths.
- [x] Add a source guard preventing these compatibility entrypoints from regrowing.
