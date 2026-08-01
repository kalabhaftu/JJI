# Production architecture remediation checklist

Status date: 2026-08-01

Branch: `preview`

Execution policy: production remediation authorized; remote changes still require
the documented migration, provider, branch-reconciliation, and verification gates.

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
- [x] Inventory four Drizzle-journaled entries and nineteen timestamped Supabase migrations without rewriting history.
- [x] Record pre-existing dependency/build/test failures for the final validation gate.
- [x] Repair the local dependency installation and synchronize the Bun lockfile.
- [x] Establish a clean full-build baseline after the recorded repository TypeScript backlog is repaired.
- [x] Create a remote database migration-list snapshot and reconcile it without rewriting history.

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
- [x] Inspect the live `kalab-ze/javascript-nextjs` project and inventory every unresolved issue group before remediation.
- [x] Store the authorized Sentry admin token in macOS Keychain for reusable CLI access without persisting it in the repository or shell history.
- [x] Verify the live Sentry project, current Git-SHA release association, and successful source-map artifact upload.
- [ ] Verify grouping and request-ID search on a fresh controlled event from the current release.
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
- [x] Verify a deployed Preview redirect and standardized API error both return valid `x-request-id` correlation.
- [x] Reject spoofed inbound identity headers at the middleware boundary and replace them only after Supabase verification.
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
- [x] Add a source contract guard covering every v1 route and the nine reviewed protocol exemptions.
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
- [x] Apply and verify the additive audit migration against the linked database after explicit approval.

## 11. Migration workflow

- [x] Keep `supabase/migrations` as the production source of truth.
- [x] Inventory Drizzle-journaled and imperative migrations without history repair.
- [x] Disable misleading `drizzle-kit push/generate` deployment scripts.
- [x] Document the supported Supabase migration workflow.
- [x] Update Drizzle schema beside the pending Supabase migration.
- [x] Add migration naming, order, schema-alignment, and untracked-file checks.
- [x] Add CI migration consistency enforcement.
- [x] Pass the local read-only migration consistency guard.
- [x] Run linked migration-list and remote dry-run verification.
- [ ] Rehearse the migration against staging.
- [ ] Run database advisors after staging application.
- [x] Confirm WAL-G backup support; record that an independent local dump was unavailable without Docker or `pg_dump`.
- [x] Apply and verify both reviewed additive migrations after explicit production approval.
- [x] Apply and verify the missing `Trade.isMissedTrade` runtime column used by Drizzle-wide trade selections.
- [x] Apply and verify the `UserSettings.updatedAt` database default required by reset and purge operations.

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
- [x] Repair the dependency installation.
- [x] Run the repository type-check and confirm no errors remain in the new Whop modules, routes, jobs, schema, or deletion integration.
- [x] Repair the recorded non-Whop TypeScript backlog so the repository-wide type-check exits cleanly.
- [x] Deploy the current remediation commit to Preview and pass focused protocol, redirect, request-ID, and identity-spoofing probes through Vercel's authenticated CLI.
- [ ] Run lint once.
- [ ] Run the full unit/integration suite once.
- [x] Run the production build once.
- [ ] Run migration dry-run and advisor checks once.
- [ ] Run secret/security scans once.
- [ ] Run final bundle analysis once.
- [ ] Run authenticated representative browser verification once.
- [ ] Run controlled Sentry client/server/phase/import failures once.
- [ ] Verify end-to-end request correlation and privacy once.

## 15. Whop billing and main-branch reconciliation

- [x] Audit all twenty-three commits unique to `origin/main` and document each Whop behavior kept, replaced, or rejected.
- [x] Keep the `preview` architecture as the source tree; reject the broad main-branch revert.
- [x] Pin the current official `@whop/sdk` and synchronize `bun.lock`.
- [x] Add lazy, environment-separated Whop API configuration without import-time failures.
- [x] Create server-owned, payment-rate-limited checkout configurations with internal metadata, idempotency, and validated provider URLs.
- [x] Preserve NOWPayments crypto checkout alongside Whop card checkout.
- [x] Verify Standard Webhooks signatures against the untouched raw body using the official SDK.
- [x] Enforce a bounded webhook body and preserve its provider-controlled response protocol with `x-request-id`.
- [x] Persist only minimal event metadata and a SHA-256 payload hash; never persist raw billing payloads.
- [x] Make repeated event delivery idempotent without suppressing failed retries.
- [x] Enqueue verified events to Inngest and return a retryable provider response when enqueueing fails.
- [x] Add leased, retryable webhook processing and scheduled recovery for received, failed, stale queued, and expired-processing events.
- [x] Retrieve authoritative membership, payment, and refund state from Whop before persistence.
- [x] Map active, trialing, canceling, completed, past-due, canceled, expired, unresolved, and drafted states explicitly.
- [x] Resolve users only through trusted checkout metadata or an existing membership link; reject email fallback matching.
- [x] Transactionally synchronize local entitlements, durable membership state, payment records, and redacted audit events.
- [x] Preserve special free and promotional access when a Whop membership becomes terminal.
- [x] Send idempotent Resend welcome mail and application notifications only after durable state succeeds.
- [x] Add provider-neutral billing status and safe Whop subscription-management links to settings.
- [x] Preserve loading, toast, success-polling, and crypto fallback behavior in the subscription UI.
- [x] Queue immediate Whop cancellation after durable account deletion without rolling back correct local deletion state.
- [x] Route provider failures and manual-review events through the canonical scrubbed Sentry reporter.
- [x] Treat disputes and resolution-center cases as manual review; never automatically ban or revoke a user.
- [x] Add the Whop failure alert class to the reviewed Sentry manifest.
- [x] Restore the proven production-history `0004_add_ban_columns` marker, model its inert columns, and reject only the conflicting generated `0004_whop_integration` migration.
- [x] Add an additive timestamped Supabase migration with server-only RLS posture that upgrades and redacts the legacy Whop table.
- [x] Add Whop to service, API-policy, API-contract, migration, and alert source guards.
- [x] Pass the focused membership-status mapping test for all current provider states.
- [x] Document provider permissions, preview/production credential separation, verification, rollout, and rollback.
- [x] Verify linked Supabase migration history, dry-run the additive migration, apply it, and verify the resulting tables, RLS, trigger, and raw-payload redaction.
- [x] Configure environment-separated Whop sandbox credentials on JJI Preview and JJI Admin Preview.
- [ ] Verify Whop webhook subscriptions and Inngest function discovery on deployed Preview.
- [ ] Verify a sandbox checkout, duplicate webhook, forced retry, refund, cancellation, Resend delivery, and manual-review event.
- [ ] Inspect the resulting Sentry event for privacy, grouping, and request-ID search.
- [x] Commit the Whop implementation in focused Conventional Commits.
- [x] Join `origin/main` history with a tree-preserving merge without changing the remediated source tree.
- [x] Push and verify the current JJI and JJI Admin `preview` commits.
- [x] Fast-forward `main` after both Preview code deployments are green and safe protocol probes pass, with Production Whop checkout still disabled.
- [ ] Configure production Whop credentials, apply the reviewed migration, deploy, and perform one production-safe checkout verification.
- [x] Create local Conventional Commit checkpoints.
- [x] Confirm the final tree contains intended commits plus the preserved user work.
- [x] Record explicit approval for migration, Preview deployment, and eventual fast-forward production rollout.

## 16. Production performance and billing closeout

- [x] Query Vercel Speed Insights p75 LCP, FCP, TTFB, INP, and CLS by production route.
- [x] Query Speed Insights by host, environment, route, deployment, device, browser, country, and LCP attribution target.
- [x] Record metric sample counts and avoid treating sparse cross-deployment traffic as a current-release benchmark.
- [x] Confirm measured regressions on subscribe, dashboard, login, and journal interaction paths.
- [x] Remove unnecessary public-route Supabase authentication round-trips.
- [x] Parallelize dashboard bootstrap queries and cached shell settings.
- [x] Remove the duplicate dashboard role query during subscription gating.
- [x] Render subscription content immediately instead of a blank authentication gate.
- [x] Remove above-the-fold Framer Motion hydration gates from login, subscribe, and checkout-status surfaces.
- [x] Preserve dashboard widget dimensions while its route-local client bundle loads.
- [x] Debounce journal server search to reduce the measured interaction delay.
- [ ] Collect enough post-deploy Speed Insights traffic for a comparable p75 sample.
- [x] Lock Whop checkout email prefill to the authenticated JJI account.
- [x] Keep plan, price, entitlement metadata, and provider redirect construction server-owned against request editing.
- [x] Add self-service cancellation at period end without revoking the already-paid period.
- [x] Expose Whop billing history and payment-method management through the validated membership portal URL.
- [x] Publish the renewal, cancellation, dispute, and no-prorated-refund policy in subscription context and Terms.
- [x] Keep duplicate-charge, technical billing-error, and non-excludable legal exceptions.
- [x] Isolate sandbox and production membership lookups by provider environment.
- [x] Replace JJI Admin's legacy v2, fire-and-forget cancellation with the pinned official Whop SDK.
- [x] Make Admin sync, cancel, expire, extend, ban, delete, and approved-refund flows call Whop authoritatively.
- [x] Route legacy cancellation through Whop before local state and keep the local-only fallback limited to non-Whop billing.
- [x] Isolate legacy NOWPayments reconciliation and due-date maintenance from Whop records in both deployments.
- [x] Make Admin single-payment and user-wide synchronization provider-aware.
- [x] Keep ban/delete enforcement durable through the shared retryable cancellation inbox when Whop is unavailable.
- [x] Prevent failed Supabase Auth deletion from silently deleting the remaining database owner record.
- [x] Configure sandbox Whop only on both Preview deployments; keep Production card billing disabled pending real credentials.
- [x] Remove the unsafe rate-limit bypass environment variable from both applications.
- [x] Verify the configured sandbox plan is readable, recurring every 30 days, and resolves to the sandbox Whop host.
- [x] Verify the configured Upstash backend accepts a read-only connectivity check.
- [ ] Grant the sandbox key `company:basic:read` and `developer:manage_webhook`, then inspect the provider webhook registration; the current key cannot read that control plane.
- [ ] Verify sandbox checkout, locked email, billing portal, cancellation, admin termination, refund, webhook retry, Resend, and Sentry flow.
- [x] Fast-forward both repositories after green Preview code deployments and safe protocol probes, while keeping Production Whop disabled pending the sandbox transaction.

## 17. Additional monolith remediation

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

## 18. Reported runtime-failure closeout

- [x] Repair docs Server-to-Client serialization by passing rendered icon elements instead of component functions.
- [x] Keep `/sw.js` stable on docs/demo hosts and skip service-worker registration on public documentation/demo surfaces.
- [x] Make service-worker waiting-worker handling race-safe and classify optional registration failures as expected.
- [x] Stop disabled direct-sync providers from polling intentionally unavailable endpoints.
- [x] Remove the invalid duplicate daily phase-evaluation event while retaining the authoritative 15-minute Inngest schedule.
- [x] Preserve request identifiers, releases, and safe internal entity IDs through field-aware observability scrubbing.
- [x] Prevent custom context tags from overriding canonical Sentry operation, route, surface, request, release, or environment tags.
- [x] Verify the repaired Preview deployment serves `/docs` and `/sw.js` with HTTP 200.
- [x] Verify the same runtime contracts on the promoted Production deployment.
- [x] Resolve all twenty-two inventoried Sentry groups after Production is healthy and confirm the unresolved queue is empty; bind the one stale-client recurrence from release `ae24c46e` to the fixed release `d2467e49` so only a current-release regression reopens it.
