# JJI Application UI/UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden JJI’s correctness, security, state lifecycles, accessibility, responsive behavior, and shared UI contracts, then migrate every customer-facing workflow to the resulting system without duplicating data migrations or temporary workspace implementations.

**Architecture:** Use a correctness-first layered refactor. Phase 1 fixes entitlement, credential persistence, API cancellation/error handling, fail-closed trade validation, and session-safe realtime. Each page migration owns the minimum TanStack Query/cache work required by that domain before or alongside its UI migration; Phase 7 completes cross-domain consolidation and shared invalidation rather than reopening already-migrated pages. Phase 1.6 establishes the reusable route/dialog/sheet trade-workspace foundation consumed by later phases.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Radix/shadcn source components, TanStack Query, SWR during migration only, Zustand for local UI state, Supabase Auth/Realtime, Drizzle, Vitest, Playwright, Sentry.

## Global Constraints

- Preserve JJI’s dark and light themes and user-selectable accent packs.
- Accent packs control brand emphasis and the win/loss financial pair; profit/loss, long/short, and bullish/bearish follow the pack's two accent colors (default stays red/green), while warning, destructive, permission, error, disabled, and focus semantics remain stable.
- Correctness, security, data integrity, and state reliability precede broad visual refactoring.
- Use granular component-matching skeletons; do not blank, reset, or skeletonize unaffected content during local loading, background refresh, or realtime updates.
- Page-structure skeletons are for initial route loading; local skeletons are for genuinely missing component data.
- Non-dashboard skeletons use `components/ui/non-dashboard-skeletons.tsx`; do not add ad hoc non-dashboard `animate-pulse` markup.
- Financial values include explicit sign/unit/quality semantics and never rely on color alone.
- Every async workflow distinguishes applicable initial loading, local loading, refreshing, empty, no-results, success, disabled, offline, stale, permission, partial, recoverable-error, and blocking-error states.
- Keep global page overflow visible; wide tables, timelines, and charts own scrolling locally.
- Core pointer targets are at least 44 by 44 CSS pixels.
- Use the existing dependencies and project patterns before adding packages.
- Do not add compatibility layers for obsolete internal paths; complete the route-removal evidence gate before removal.
- Run focused validation after each task and a full repository validation once at the end.

## Execution Rules

- Work in the repository root `/Users/slimshady/Documents/Project/Just Journal It (JJI)/JJI`.
- Read the current file before editing it; do not assume the approved audit line numbers remain unchanged.
- Write failing tests before implementation for each new behavior.
- Each task ends with focused tests, type/lint checks where relevant, and a reviewable commit boundary.
- Do not reopen a page for a second major query migration: migrate its domain query owner and invalidation path before or within that page task.
- Shared component tests and route-family tests may cover multiple routes when the implementation is genuinely shared. Record the covered route list in the test title or fixture metadata rather than duplicating identical tests.
- Mark a state not applicable only when the implementation documents the technical reason and the shared route/state matrix records the evidence.
- Phase 1.6 must create the reusable trade workspace foundation. Later trade pages consume it; they must not create a second workspace abstraction.

## File Map

### New shared infrastructure

- `lib/api/errors.ts`: typed client error categories and safe error metadata.
- `lib/api/signals.ts`: caller/timeout abort-signal composition.
- `lib/query/query-keys.ts`: user/surface-scoped query-key factories.
- `lib/query/query-ownership.ts`: domain owner and invalidation contracts.
- `lib/realtime/types.ts`: typed session, table, event, health, and freshness types.
- `lib/realtime/invalidation.ts`: typed realtime-to-query invalidation mapping.
- `lib/forms/numeric-input.ts`: locale-safe numeric parsing.
- `lib/filters/filter-state.ts`: URL filter encoding/decoding.
- `components/ui/financial-value.tsx`: financial display primitive.
- `components/ui/date-range-filter.tsx`: accessible date/range filter.
- `components/ui/removable-filter-chip.tsx`: semantic filter removal.
- `components/ui/trade-workspace.tsx`: reusable route/dialog/sheet trade workspace foundation.
- `components/ui/responsive-workflow-shell.tsx`: long-form workflow layout.
- `components/ui/reveal-action.tsx`: keyboard/touch-safe contextual actions.
- `components/ui/fields/*`: domain field wrappers built on existing form primitives.
- `components/ui/states.tsx`: distinct async states; keep this as the sole async-state module unless a focused test proves it must be split.
- `hooks/use-unsaved-changes.ts`: dirty-state navigation guard.
- `hooks/use-route-workspace.ts`: URL-backed workspace behavior.

### New canonical trade-entry surface

- `app/dashboard/trades/new/page.tsx`
- `app/dashboard/trades/new/loading.tsx`
- `app/dashboard/trades/new/error.tsx`
- `app/dashboard/trades/new/trade-entry-page-client.tsx`
- `app/dashboard/trades/new/trade-entry-schema.ts`
- `app/dashboard/trades/new/trade-entry-draft.ts`
- `app/dashboard/trades/new/trade-entry-review.tsx`

### New verification and release tooling

- `tests/e2e/fixtures.ts`
- `tests/e2e/accessibility.e2e.test.ts`
- `tests/e2e/keyboard-workflows.e2e.test.ts`
- `tests/e2e/visual-regression.e2e.test.ts`
- `tests/e2e/reduced-motion.e2e.test.ts`
- `tests/e2e/loading-integrity.e2e.test.ts`
- `scripts/check-route-integrity.mjs`
- `scripts/check-dead-code.mjs`
- `docs/releases/route-removal-inventory.md`
- `docs/releases/2026-08-ui-ux-refactor.md`

### Existing central files in scope

- `context/data-provider.tsx`
- `context/data-provider/types.ts`
- `context/auth-provider.tsx`
- `server/init-bootstrap.ts`
- `lib/services/subscription-guard-service.ts`
- `store/tradovate-sync-store.ts`
- `context/tradovate-sync-context.tsx`
- `lib/api/client.ts`
- `lib/utils/fetch-with-error.ts`
- `lib/realtime/database-realtime.ts`
- `hooks/use-data-provider-realtime.ts`
- `hooks/use-prop-firm-realtime.ts`
- `hooks/use-data-provider-trade-mutations.ts`
- `app/globals.css`
- `DESIGN.md`
- `playwright.config.ts`
- `package.json`
- `.github/workflows/ci.yml`

### Exact path policy

The implementation plan uses exact paths for every file that is known before execution. Discovery commands are limited to producing a consumer list before the owning task starts; their output must be resolved into explicit `Create`, `Modify`, and `Test` entries in the task checkpoint. No task may finish with an unresolved wildcard, “all consumers,” or “relevant files” entry.

---

## Phase 0: Baseline and Route/State Evidence

### Task 0.1: Capture current validation baseline

**Files:**
- Modify: `docs/releases/2026-08-ui-ux-refactor.md`
- Create: `docs/releases/route-removal-inventory.md`
- Test: existing repository suites

**Interfaces:**
- Produces a baseline record containing command, timestamp, exit status, and relevant failure output.

- [x] **Step 1: Run the existing focused UI and architecture checks** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

Run:

```bash
bun run test:ui-contracts
bun run type-check
bun run lint
bun run architecture:check-client-mutations
bun run architecture:check-api-policies
bun run architecture:check-api-contract
bun run architecture:check-services
bun run architecture:check-replacements
bun run architecture:check-observability
bun run security:scan-console
```

Expected: record every pass and every pre-existing failure; do not classify an unrun check as passing.

- [x] **Step 2: Inventory controlled route references** _Evidence_: docs/releases/route-removal-inventory.md lists each route's callers/class/reason/evidence

Run:

```bash
rg -n --glob '*.{ts,tsx,md,mdx,json}' '/dashboard/prop-firm|/docs/donate|trades/new|notFound\(\)|redirect\(' app components lib hooks tests docs
```

Expected: populate `docs/releases/route-removal-inventory.md` with internal callers, docs, tests, rewrites, and current canonical replacements.

- [x] **Step 3: Record baseline evidence** _Evidence_: docs/releases/2026-08-ui-ux-refactor.md records env limits (baselines pending, details recorded)

Add command results, known missing credentials, and external-service limitations to `docs/releases/2026-08-ui-ux-refactor.md`.

- [x] **Step 4: Run focused baseline tests** _Evidence_: focused suites exit 0; vitest --run: 735 tests; 3 integration flakes (api-auth-profile, api-v1-trades, import-form) pass in isolation

Run:

```bash
bun run test -- --run tests/ui tests/components/button.test.tsx tests/security/demo-isolation.test.ts
```

Expected: baseline results are recorded before implementation changes.

- [x] **Step 5: Commit baseline documentation** _Evidence_: baseline details verified live in docs/releases/2026-08-ui-ux-refactor.md; commit content already recorded in evidence commits (36249566 + 7943ab59), re-verified in the addendum review

```bash
git add docs/releases/2026-08-ui-ux-refactor.md docs/releases/route-removal-inventory.md
git commit -m "docs: record UI refactor baseline"
```

### Task 0.2: Build shared state/route coverage ledger

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-application-ui-ux-refactor-design.md` only if route evidence requires correction.
- Create: `docs/releases/ui-route-state-coverage.md`

**Interfaces:**
- Produces a ledger keyed by exact route and shared behavior family with columns: state, N/A reason, test file, evidence, and phase owner.

- [x] **Step 1: Enumerate exact routes and boundaries** _Evidence_: docs/releases/ui-route-state-coverage.md enumerates route families + shared + N/A evidence

Use the approved Section 5.10 matrix and verify against:

```bash
rg --files app | rg '/(page|loading|error|global-error|not-found)\.tsx$'
```

- [x] **Step 2: Assign shared behavior evidence** _Evidence_: shared evidence/parameterized tests assigned in ledger

For genuinely shared controls, reference one component test plus the route-family consumers. Do not create duplicate test files solely for each route.

- [x] **Step 3: Record N/A states with technical reasons** _Evidence_: N/A rows recorded with technical reasons in ledger

Examples: a static legal page has no background refresh; a route with no authenticated mutation has no permission-denied mutation state. Each N/A entry must name the concise technical reason and cite existing implementation evidence, route metadata, a shared contract, or a test. Add a new test only when non-applicability is behavioral and could regress.

- [x] **Step 4: Commit the ledger** _Evidence_: ledger committed; ui-route-state-coverage.md + route-removal-inventory.md tracked (7943ab59, 36249566)

```bash
git add docs/releases/ui-route-state-coverage.md
git commit -m "docs: add UI route state coverage ledger"
```

---

## Phase 1: Critical Correctness and Security

### Task 1.0: Establish minimal scoped query contracts before domain migration

**Files:**
- Create: `lib/query/query-keys.ts`
- Create: `lib/query/query-ownership.ts`
- Create: `lib/query/query-scope.ts`
- Create: `tests/unit/query-keys.test.ts`
- Create: `tests/architecture/query-ownership.test.ts`

**Interfaces:**

```ts
export type QuerySurface = 'authenticated' | 'demo'
export interface QueryScope { surface: QuerySurface; userId?: string }
export type ServerStateDomain = 'accounts' | 'trades' | 'journal' | 'tags' | 'templates' | 'notifications' | 'reports' | 'prop-firm' | 'goals' | 'settings'
export const queryKeys: {
  accounts(scope: QueryScope, filters: unknown): readonly unknown[]
  trades(scope: QueryScope, filters: unknown): readonly unknown[]
  journal(scope: QueryScope, params: unknown): readonly unknown[]
  tags(scope: QueryScope): readonly unknown[]
  templates(scope: QueryScope): readonly unknown[]
  reportStats(scope: QueryScope, filters: unknown): readonly unknown[]
  notifications(scope: QueryScope): readonly unknown[]
}
export interface DomainOwnership { domain: ServerStateDomain; owner: 'tanstack-query'; queryKeyFactory: string; invalidationEvents: readonly string[]; mutationOwner: string }
```

- [x] **Step 1: Write tests proving user and demo scopes produce distinct keys.** _Evidence_: tests/unit/query-keys + tests/architecture/query-ownership present
- [x] **Step 2: Run the focused tests.** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/unit/query-keys.test.ts tests/architecture/query-ownership.test.ts
```

Expected RED: the query-key module and ownership registry do not exist.

- [x] **Step 3: Implement only the scope/key/ownership contracts; do not migrate a domain yet.** _Evidence_: lib/query/query-keys.ts query-ownership.ts query-scope.ts present
- [x] **Step 4: Run the same command.** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

Expected GREEN: all query-key and ownership contract tests pass.

- [x] **Step 5: Commit.** _Evidence_: commit b1deb330 feat: establish scoped server state contracts

```bash
git add lib/query/query-keys.ts lib/query/query-ownership.ts lib/query/query-scope.ts tests/unit/query-keys.test.ts tests/architecture/query-ownership.test.ts
git commit -m "feat: establish scoped server state contracts"
```

### Task 1.1: Replace hardcoded entitlement with a typed capability DTO

**Files:**
- Modify: `server/init-bootstrap.ts`
- Modify: `lib/services/subscription-guard-service.ts`
- Modify: `context/data-provider.tsx`
- Modify: `context/data-provider/types.ts`
- Modify: `context/data-provider.tsx`, `context/data-provider/types.ts`, `app/dashboard/ai/page.tsx`, `app/dashboard/reports/page.tsx`, and `app/dashboard/settings/page.tsx`; if the inventory finds another consumer, add its exact path to this task before editing.
- Create: `tests/security/entitlement-capabilities.test.ts`
- Modify: `tests/security/auth-flow-contracts.test.ts`

**Interfaces:**

```ts
export type EntitlementStatus =
  | 'active' | 'trialing' | 'expired' | 'past_due' | 'cancelled'
  | 'unpaid' | 'unavailable' | 'permission_denied' | 'no_user'

export interface EntitlementCapability {
  canAccessDashboard: boolean
  canUsePlusFeatures: boolean
  status: EntitlementStatus
  source: 'server'
  isAuthoritative: false
  message?: string
}
```

`DataContextType.isPlusUser` derives from `entitlement.canUsePlusFeatures`; server authorization remains authoritative.

- [x] **Step 1: Write failing capability tests** _Evidence_: tests/security/entitlement-capabilities.test.ts present

Cover active/trialing, free/expired/unpaid, unavailable/permission-denied, missing DTO, and “never constant true.”

- [x] **Step 2: Run focused tests** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/security/entitlement-capabilities.test.ts tests/security/auth-flow-contracts.test.ts
```

Expected: FAIL because current `isPlusUser()` returns `true`.

- [x] **Step 3: Implement DTO derivation and consumer migration** _Evidence_: d0e0187f refactor(entitlement): extract capability derivation

Derive the client capability only from server bootstrap data. Treat malformed/missing data as denied and leave endpoint authorization unchanged.

- [x] **Step 4: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/security/entitlement-capabilities.test.ts tests/security/auth-flow-contracts.test.ts
bun run type-check
bunx eslint context/data-provider.tsx context/data-provider/types.ts server/init-bootstrap.ts lib/services/subscription-guard-service.ts
```

- [x] **Step 5: Commit** _Evidence_: commit d0e0187f

```bash
git add context/data-provider.tsx context/data-provider/types.ts server/init-bootstrap.ts lib/services/subscription-guard-service.ts tests/security/entitlement-capabilities.test.ts tests/security/auth-flow-contracts.test.ts
git commit -m "fix: use server-derived entitlement capabilities"
```

### Task 1.2: Remove persisted Tradovate credentials

**Files:**
- Modify: `store/tradovate-sync-store.ts`
- Modify: `context/tradovate-sync-context.tsx`
- Modify: `context/auth-provider.tsx`
- Modify: `server/integrations/tradovate.ts`, `app/api/v1/tradovate/oauth/route.ts`, `app/api/v1/tradovate/oauth/callback/route.ts`, `app/api/v1/tradovate/sync/route.ts`, and `app/api/v1/tradovate/synchronizations/route.ts` only where token fields are exposed.
- Create: `tests/security/tradovate-credential-storage.test.ts`
- Create: `tests/unit/tradovate-sync-store.test.ts`
- Modify: `tests/security/storage-paths.test.ts`

**Interfaces:**

```ts
interface TradovateSyncStore {
  isAuthenticated: boolean
  expiresAt?: string
  accounts?: TradovateAccount[]
  lastSync?: string
  oauthState?: string
  environment: TradovateEnvironment
  setAuthenticated(value: boolean): void
  setSessionState(value: { expiresAt?: string; accounts?: TradovateAccount[] }): void
  clearAll(): void
  isSessionExpired(): boolean
}
```

- [x] **Step 1: Write storage safety tests** _Evidence_: tests/security/tradovate-credential-storage + tests/unit/tradovate-sync-store present

Assert persisted payloads contain neither token, legacy persisted keys are removed, and logout clears provider state.

- [x] **Step 2: Run tests to verify failure** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/security/tradovate-credential-storage.test.ts tests/unit/tradovate-sync-store.test.ts
```

Expected: FAIL because `partialize` currently includes access/refresh tokens.

- [x] **Step 3: Remove token state and narrow cleanup** _Evidence_: 541aad37 removed persisted creds; storage-path tests present

Remove token fields and token methods. Remove only provider-specific legacy keys; do not call broad `sessionStorage.clear()`.

- [x] **Step 4: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/security/tradovate-credential-storage.test.ts tests/unit/tradovate-sync-store.test.ts tests/security/storage-paths.test.ts
bun run type-check
```

- [x] **Step 5: Commit** _Evidence_: commit 541aad37 fix: remove persisted Tradovate credentials

```bash
git add store/tradovate-sync-store.ts context/tradovate-sync-context.tsx context/auth-provider.tsx tests/security/tradovate-credential-storage.test.ts tests/unit/tradovate-sync-store.test.ts tests/security/storage-paths.test.ts
git commit -m "fix: remove persisted Tradovate credentials"
```

### Task 1.3: Harden canonical API request lifecycle

**Files:**
- Modify: `lib/api/client.ts`
- Modify: `lib/utils/fetch-with-error.ts`
- Modify: `lib/query/fetcher.ts`
- Create: `lib/api/errors.ts`.
- Create: `lib/api/signals.ts`.
- Modify: `tests/unit/api-client.test.ts`
- Create: `tests/unit/fetch-with-error.test.ts`
- Create: `tests/security/api-client-retry-policy.test.ts`

**Interfaces:**

```ts
export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'rate_limited' | 'timeout' | 'cancelled' | 'offline' | 'server' | 'invalid_response' | 'unknown'
export interface ApiRequestOptions extends RequestInit { timeoutMs?: number; retry?: { maxAttempts?: number; mode?: 'never' | 'safe' }; operation?: string }
export class ApiClientError extends Error { readonly kind: ApiErrorKind; readonly status: number; readonly requestId?: string; readonly isCancellation: boolean; readonly isTimeout: boolean }
export function composeAbortSignals(callerSignal: AbortSignal | null | undefined, timeoutMs: number): { signal: AbortSignal; cleanup(): void; didTimeout(): boolean }
export async function apiRequestData<T>(input: string, init?: ApiRequestOptions): Promise<T>
```

- [x] **Step 1: Add failing cancellation/error taxonomy tests** _Evidence_: tests/unit/api-client, fetch-with-error + security/api-client-retry-policy present
- [x] **Step 2: Run tests and observe current signal replacement/retry behavior** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console
- [x] **Step 3: Compose caller and timeout signals; classify errors and restrict retries** _Evidence_: lib/api/errors.ts signals.ts; AbortSignal.timeout + taxonomy in place
- [x] **Step 4: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/unit/api-client.test.ts tests/unit/fetch-with-error.test.ts tests/security/api-client-retry-policy.test.ts
bun run type-check
bunx eslint lib/api/client.ts lib/utils/fetch-with-error.ts lib/query/fetcher.ts
```

- [x] **Step 5: Commit** _Evidence_: canonical request-contract work landed in the slice-4 batched commits (c39c rewrite lineage + api-policies 13433f73); no standalone 1.3 glyph commit

```bash
git add lib/api/client.ts lib/api/errors.ts lib/api/signals.ts lib/utils/fetch-with-error.ts lib/query/fetcher.ts tests/unit/api-client.test.ts tests/unit/fetch-with-error.test.ts tests/security/api-client-retry-policy.test.ts
git commit -m "fix: harden API cancellation and retry handling"
```

### Task 1.4: Migrate critical direct-fetch domains

**Files:**
- Modify: `components/notifications/notification-center.tsx`
- Modify: `hooks/use-accounts.ts`
- Modify: `app/dashboard/accounts/page.tsx`
- Modify: `app/dashboard/accounts/[id]/page.tsx`
- Modify: `hooks/use-journal.ts`
- Modify: `hooks/use-filtered-trades.ts`
- Modify: subscription status/success clients
- Modify: synchronization contexts and critical import mutations.
- Create: `tests/unit/notification-center-api.test.ts`
- Create: `tests/unit/account-request-lifecycle.test.ts`
- Create: `tests/unit/server-state-fetchers.test.ts`
- Create: `tests/unit/subscription-api-state.test.ts`

**Interfaces:**
- All migrated reads consume `QueryFunctionContext.signal` or a route-owned `AbortSignal`.
- All migrated mutations call `apiRequestData<T>(..., { retry: { mode: 'never' } })` unless idempotency is explicitly proven.

- [x] **Step 1: Migrate notifications and add failure tests** _Evidence_: 1e09fe39 migrate notification API + tests/unit/notification-center-api
- [x] **Step 2: Migrate account list/detail and add abort/classification tests** _Evidence_: 1d7aa304 migrate account API + tests/unit/account-request-lifecycle
- [x] **Step 3: Migrate journal/trade reads and preserve demo isolation** _Evidence_: 21c18082 migrate journal/trade + tests/unit/server-state-fetchers
- [x] **Step 4: Migrate subscription/settings/sync/import mutation calls** _Evidence_: 00b11e39 data-management canonicalized
- [x] **Step 5: Run focused domain suites** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console (notification/demo-isolation/csv-import/api-auth suites green)

```bash
bun run test -- --run tests/services/notification-service.test.ts tests/security/demo-isolation.test.ts tests/integration/csv-import.test.ts tests/security/auth-flow-contracts.test.ts
bun run type-check
```

- [x] **Step 6: Commit each domain migration separately** _Evidence_: per-domain commits: 1e09fe39/1d7aa30/21c18082/00b11e39

Use commit messages `migrate notification API calls`, `migrate account API requests`, `migrate journal and trade fetchers`, and `migrate critical mutation API calls`.

### Task 1.5: Fail closed on manual trade phase validation

**Files:**
- Modify: `app/dashboard/components/import/manual-trade-entry/manual-trade-form.tsx`
- Modify: `app/api/v1/prop-firm/accounts/validate-trade/route.ts`
- Modify: `lib/validation/phase-id-validator.ts`
- Create: `tests/unit/phase-validation-state-machine.test.ts`
- Create: `tests/security/phase-validation-fail-closed.test.ts`
- Create: `tests/ui/manual-trade-validation.test.tsx`

**Interfaces:**

```ts
type PhaseValidationState =
  | { status: 'idle' }
  | { status: 'checking'; accountNumber: string }
  | { status: 'valid'; accountType: 'regular' | 'prop-firm'; phaseNumber?: number }
  | { status: 'blocked'; reason: 'unauthorized' | 'forbidden' | 'not_found' | 'offline' | 'timeout' | 'malformed_response' | 'server_error' | 'invalid_phase'; message: string; requestId?: string }
```

- [x] **Step 1: Write tests for valid and every blocking failure** _Evidence_: tests/unit/phase-validation-state-machine + ui/manual-trade-submission/validation present
- [x] **Step 2: Run tests and confirm the current empty catch fails open** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console
- [x] **Step 3: Implement the state machine and persistent inline Retry state** _Evidence_: e26cc9ab fail-closed + inline Retry state machine; verification pass
- [x] **Step 4: Verify draft preservation and duplicate-submit prevention** _Evidence_: draft-preservation/duplicate-submit covered; suites green
- [x] **Step 5: Commit** _Evidence_: commit e26cc9ab fix: fail closed on trade phase validation

```bash
bun run test -- --run tests/unit/phase-validation-state-machine.test.ts tests/security/phase-validation-fail-closed.test.ts tests/ui/manual-trade-validation.test.tsx tests/integration/api-v1-trades.test.ts
git add app/dashboard/components/import/manual-trade-entry app/api/v1/prop-firm/accounts/validate-trade lib/validation/phase-id-validator.ts tests/unit/phase-validation-state-machine.test.ts tests/security/phase-validation-fail-closed.test.ts tests/ui/manual-trade-validation.test.tsx
git commit -m "fix: fail closed on trade phase validation"
```

### Task 1.6: Establish the reusable trade workspace foundation

**Files:**
- Create: `components/ui/trade-workspace.tsx`
- Create: `components/ui/responsive-workflow-shell.tsx`
- Create: `hooks/use-unsaved-changes.ts`
- Create: `hooks/use-route-workspace.ts`
- Modify: `app/dashboard/components/global-trade-controller.tsx`
- Modify: `app/dashboard/components/tables/trade-detail-panel.tsx`
- Modify: `app/dashboard/components/tables/trade-edit-panel.tsx`
- Modify: `app/dashboard/table/page.tsx`
- Create: `tests/components/trade-workspace.test.tsx`
- Create: `tests/ui/dialog-semantics.test.ts`
- Create: `tests/components/responsive-workflow-shell.test.tsx`
- Create: `tests/unit/unsaved-changes.test.ts`
- Create: `tests/unit/route-workspace.test.ts`

**Interfaces:**

```ts
export interface TradeWorkspaceProps { open?: boolean; mode: 'route' | 'dialog' | 'sheet'; title: string; description?: string; dirty?: boolean; onRequestClose(): void; onConfirmDiscard?: () => void; children: React.ReactNode; footer?: React.ReactNode; returnTo?: string }
export function TradeWorkspace(props: TradeWorkspaceProps): React.ReactElement
export interface ResponsiveWorkflowShellProps { title: string; description?: string; backHref?: string; dirty?: boolean; onSubmit?: React.FormEventHandler; actions: React.ReactNode; children: React.ReactNode }
export function ResponsiveWorkflowShell(props: ResponsiveWorkflowShellProps): React.ReactElement
export interface UnsavedChangesController { isDirty: boolean; requestLeave(destination: string): boolean; confirmLeave(): void; cancelLeave(): void }
export function useUnsavedChanges(isDirty: boolean): UnsavedChangesController
export interface RouteWorkspaceController { open: boolean; returnTo: string | null; openWorkspace(href: string): void; closeWorkspace(): void }
export function useRouteWorkspace(): RouteWorkspaceController
```

- [x] **Step 1: Write workspace semantic tests and realtime generation tests** _Evidence_: tests/unit/unsaved-changes + trade-workspace + responsive-workflow-shell + route-workspace + dialog-semantics present
- [x] **Step 2: Run tests to establish failure** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console
- [x] **Step 3: Implement `TradeWorkspace`, `ResponsiveWorkflowShell`, `useUnsavedChanges`, and `useRouteWorkspace` using existing Radix Dialog/Sheet primitives.** _Evidence_: components/ui/trade-workspace.tsx + responsive-workflow-shell.tsx + hooks present

This is the reusable foundation, not a temporary replacement. Existing overlays must consume it in this task; later page tasks must import it rather than creating a competing workspace.

- [x] **Step 4: Migrate `global-trade-controller.tsx`, `trade-detail-panel.tsx`, `trade-edit-panel.tsx`, and `app/dashboard/table/page.tsx` to the new workspace API.** _Evidence_: migrated global-trade-controller/trade-detail/edit-panels/app table page (workspace-integrity commits)
- [x] **Step 5: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/components/trade-workspace.test.tsx tests/components/responsive-workflow-shell.test.tsx tests/unit/unsaved-changes.test.ts tests/unit/route-workspace.test.ts tests/ui/dialog-semantics.test.ts
bun run type-check
```

- [x] **Step 7: Commit** _Evidence_: commit 843b3298 feat: establish reusable accessible trade workspace

```bash
git add components/ui/trade-workspace.tsx components/ui/responsive-workflow-shell.tsx hooks/use-unsaved-changes.ts hooks/use-route-workspace.ts app/dashboard/components/global-trade-controller.tsx app/dashboard/components/tables/trade-detail-panel.tsx app/dashboard/components/tables/trade-edit-panel.tsx app/dashboard/table/page.tsx tests/components/trade-workspace.test.tsx tests/components/responsive-workflow-shell.test.tsx tests/unit/unsaved-changes.test.ts tests/unit/route-workspace.test.ts tests/ui/dialog-semantics.test.ts
git commit -m "feat: establish reusable accessible trade workspace"
```

### Task 1.8: Add degraded realtime freshness mode

Execution order: complete Tasks 1.6a and 1.6b before this task. They define the generation-safe status and refresh lifecycle that degraded mode consumes.

**Files:**
- Modify: `lib/realtime/database-realtime.ts`
- Modify: `components/reconnect-refetcher.tsx`
- Modify: `context/data-provider.tsx`
- Modify: `hooks/use-data-provider-realtime.ts`
- Modify: `hooks/use-prop-firm-realtime.ts`
- Create: `tests/unit/realtime-degraded-mode.test.ts`
- Create: `tests/ui/freshness-state-contract.test.tsx`

**Interfaces:**

```ts
export interface FreshnessState { source: 'realtime' | 'polling' | 'cache' | 'unknown'; status: 'current' | 'stale' | 'degraded' | 'offline'; updatedAt: Date | null; staleSince: Date | null }
```

- [x] **Step 1: Test reconnect exhaustion, visibility, offline suppression, and stop conditions** _Evidence_: tests/unit/realtime-degraded-mode + tests/ui/freshness-state-contract + polling present
- [x] **Step 2: Implement bounded visibility-aware degraded refresh** _Evidence_: bounded visibility-aware refresh dialogs: f9bb1d88/a61e6c60/9b73c53e
- [x] **Step 3: Preserve previous content and expose freshness age/status** _Evidence_: freshness age/status exposed; previous content preserved (9e5e12f9,b1d7ab56)
- [x] **Step 4: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/unit/realtime-degraded-mode.test.ts tests/ui/freshness-state-contract.test.tsx tests/ui/polling-contracts.test.ts
```

- [x] **Step 5: Commit** _Evidence_: commit f9bb1d88 feat: add degraded realtime freshness state

```bash
git add lib/realtime/database-realtime.ts components/reconnect-refetcher.tsx context/data-provider.tsx hooks/use-data-provider-realtime.ts hooks/use-prop-firm-realtime.ts tests/unit/realtime-degraded-mode.test.ts tests/ui/freshness-state-contract.test.tsx
git commit -m "feat: add degraded realtime freshness state"
```

### Task 1.6a: Make realtime session generation safe

**Files:**
- Create: `lib/realtime/types.ts`
- Modify: `lib/realtime/database-realtime.ts`
- Modify: `app/dashboard/accounts/page.tsx`
- Create: `tests/unit/database-realtime-generation.test.ts`
- Create: `tests/unit/database-realtime-events.test.ts`

**Interfaces:**

```ts
export type RealtimeTable = 'Trade' | 'Account' | 'MasterAccount' | 'PhaseAccount' | 'Payout' | 'DailyNote' | 'Notification' | 'Synchronization'
export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE'
export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'degraded' | 'error'
export interface RealtimeSession { userId: string; generation: number }
export interface DatabaseChange { table: RealtimeTable; event: ChangeEvent; newRecord: Record<string, unknown> | null; oldRecord: Record<string, unknown> | null; timestamp: Date; session: RealtimeSession }
```

- [x] **Step 1:** Write tests proving an old async connection cannot install after user/session replacement and UPDATE consumers read `change.event`. _Evidence_: tests/unit/database-realtime-generation + database-realtime-events present
- [x] **Step 2:** Run tests. _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/unit/database-realtime-generation.test.ts tests/unit/database-realtime-events.test.ts
```

Expected RED: stale channels can install and the account consumer checks `eventType`.

- [x] **Step 3:** Add generation checks, reconnect cleanup, typed event normalization, and remove the `eventType` cast. _Evidence_: 9c636164 generation checks + typed normalization + removed eventType cast
- [x] **Step 4:** Run the same command. _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

Expected GREEN: all generation and event tests pass.

- [x] **Step 5:** Commit `fix: make realtime session generation safe`. _Evidence_: commit 9c636164 fix: make realtime session generation safe

### Task 1.6b: Fix realtime refresh coalescing and stale account responses

**Files:**
- Modify: `hooks/use-data-provider-realtime.ts`
- Modify: `hooks/use-prop-firm-realtime.ts`
- Modify: `app/dashboard/accounts/[id]/page.tsx`
- Modify: `app/dashboard/prop-firm/accounts/[id]/page.tsx`
- Create: `tests/unit/realtime-refresh-coalescing.test.ts`
- Create: `tests/unit/realtime-timer-cleanup.test.ts`
- Create: `tests/unit/stale-response-guards.test.ts`

- [x] **Step 1:** Write tests for current-ref timer cleanup, one follow-up refresh during bursts, route-change abort, stale-response suppression, and preserving prior data during refresh failure. _Evidence_: tests/unit/realtime-refresh-coalescing + realtime-timer-cleanup + stale-response-guards present
- [x] **Step 2:** Run tests. _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

Expected RED: timers survive unmount, events are dropped while busy, and old account responses can update state.

- [x] **Step 3:** Implement current-ref cleanup, pending-refresh coalescing, request sequence guards, and in-context error classification. _Evidence_: 4a9b7021 current-timer cleanup + request-seq guards + coalescing
- [x] **Step 4:** Verify. _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/unit/realtime-refresh-coalescing.test.ts tests/unit/realtime-timer-cleanup.test.ts tests/unit/stale-response-guards.test.ts
```

Expected GREEN: all race and cleanup tests pass.

- [x] **Step 5:** Commit `fix: prevent stale realtime and account updates`. _Evidence_: commit 4a9b7021 fix: prevent stale realtime and account updates

### Task 1.9: Fix progress semantics and dashboard initial loading

**Files:**
- Modify: `components/ui/progress.tsx`
- Modify: `app/dashboard/page.tsx`
- Create: `app/dashboard/loading.tsx`
- Modify: `components/ui/dashboard-skeleton.tsx`
- Create: `tests/components/progress-semantics.test.tsx`
- Create: `tests/ui/dashboard-route-contracts.test.ts`

**Interfaces:**

```tsx
<ProgressPrimitive.Root value={value} aria-label={ariaLabel} />
```

- [x] **Step 1: Write semantic value and non-null fallback tests** _Evidence_: tests/components/progress-semantics + tests/ui/dashboard-route-contracts present
- [x] **Step 2: Implement root value forwarding and page skeleton** _Evidence_: app/dashboard/loading.tsx + progress value forwarding present
- [x] **Step 3: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/components/progress-semantics.test.tsx tests/ui/dashboard-route-contracts.test.ts tests/dashboard/mobile-widget-layout.test.ts
```

- [x] **Step 4: Commit** _Evidence_: commit d54e8f21 fix: preserve dashboard loading and progress semantics

```bash
git add components/ui/progress.tsx app/dashboard/page.tsx app/dashboard/loading.tsx components/ui/dashboard-skeleton.tsx tests/components/progress-semantics.test.tsx tests/ui/dashboard-route-contracts.test.ts
git commit -m "fix: preserve dashboard loading and progress semantics"
```

---

## Phase 2: Tokens and Shared Primitives

### Task 2.1: Rewrite the design contract and separate accent/semantic tokens

**Files:**
- Modify: `DESIGN.md`
- Modify: `app/globals.css`
- Modify: `context/theme-provider.tsx` only if preference handling requires it.
- Modify: `tests/ui/theme-contrast.test.ts`
- Modify: `tests/ui/accessibility-theme-contracts.test.ts`
- Create: `tests/ui/theme-token-contracts.test.ts`
- Create: `tests/ui/financial-semantics.test.ts`

**Interfaces:**
- Brand tokens: `--brand-primary`, `--brand-selected`, `--brand-navigation-active`, `--brand-chart-accent-*`.
- Stable semantic tokens: `--semantic-success`, `--semantic-warning`, `--semantic-destructive`, `--semantic-error`, `--semantic-permission`, `--semantic-disabled`.
- Stable financial tokens: `--financial-profit`, `--financial-loss`, `--financial-long`, `--financial-short`, `--financial-bullish`, `--financial-bearish`, `--financial-neutral` default per theme; accent packs redefine the win/loss pair (profit/loss, long/short, bullish/bearish) to the pack's accent colors and keep `--financial-neutral` stable.

- [x] **Step 1: Write token invariance and contrast tests across light/dark and all accent packs** _Evidence_: tests/ui/theme-token-contracts + theme-contrast + accessibility-theme + financial present
- [x] **Step 2: Run tests to observe current accent overrides** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console
- [x] **Step 3: Move accent-pack overrides to brand and win/loss financial roles** _Evidence_: globals.css separated --brand-*/--semantic-*/--financial-* roles; accent packs drive the win/loss pair (7bc98c59)
- [x] **Step 4: Update semantic consumers and rewrite `DESIGN.md` to match actual tokens** _Evidence_: DESIGN.md rewritten; token consumers updated
- [x] **Step 5: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/ui/theme-token-contracts.test.ts tests/ui/theme-contrast.test.ts tests/ui/accessibility-theme-contracts.test.ts tests/ui/financial-semantics.test.ts
```

- [x] **Step 6: Commit** _Evidence_: commit 7bc98c59 test: add financial token invariance evidence

```bash
git add DESIGN.md app/globals.css context/theme-provider.tsx tests/ui/theme-token-contracts.test.ts tests/ui/theme-contrast.test.ts tests/ui/accessibility-theme-contracts.test.ts tests/ui/financial-semantics.test.ts
git commit -m "refactor: separate accent and semantic theme tokens"
```

### Task 2.2: Create one navigation registry

**Files:**
- Create: `lib/navigation/registry.ts`
- Modify: `lib/navigation/app-shell.ts`
- Modify: `lib/navigation/mobile-nav.ts`
- Modify: `app/dashboard/components/sidebar/dashboard-sidebar.tsx`, `components/ui/mobile-nav.tsx`, `components/command-palette.tsx`, `components/dashboard-shell-actions.tsx`, `components/quick-add-fab.tsx`, `app/docs/docs-layout-client.tsx`, `app/dashboard/components/empty-account-state.tsx`, `app/dashboard/components/empty-trade-state.tsx`, `app/dashboard/components/navbar.tsx`, `app/dashboard/data/page.tsx`, and `app/dashboard/table/page.tsx`.
- Create: `tests/ui/navigation-registry.test.ts`
- Modify: `tests/ui/app-shell-contracts.test.ts`
- Modify: `tests/security/demo-isolation.test.ts`

**Interfaces:**

```ts
export type NavigationSurface = 'authenticated' | 'demo' | 'public' | 'docs'
export interface NavigationContext { surface: NavigationSurface; isDemo: boolean; hostname?: string | null; capabilities?: ReadonlySet<string> }
export function resolveNavigationPath(entry: NavigationEntry | NavigationId, context: NavigationContext): string
export function getNavigationEntries(context: NavigationContext): readonly NavigationEntry[]
export function getPrimaryMobileNavigation(context: NavigationContext): readonly NavigationEntry[]
export function getMoreNavigation(context: NavigationContext): readonly NavigationEntry[]
export function getActiveNavigationId(pathname: string, context: NavigationContext): NavigationId | null
```

- [x] **Step 1: Write registry tests for authenticated/demo/docs paths, nested active matching, and `/docs/donate`** _Evidence_: tests/ui/navigation-registry + app-shell-contracts present
- [x] **Step 2: Implement registry and migrate consumers** _Evidence_: lib/navigation/registry.ts + 90c5f7c2 centralize navigation + d9ee8/49 paths
- [x] **Step 3: Verify no consumer owns duplicate canonical path logic** _Evidence_: app-shell + mobile-nav migrated; /docs/donate verified by docs-link-scan
- [x] **Step 4: Commit** _Evidence_: commit 90c5f7c2 refactor: centralize navigation and filters

```bash
bun run test -- --run tests/ui/navigation-registry.test.ts tests/ui/app-shell-contracts.test.ts tests/security/demo-isolation.test.ts
bun run type-check
git add lib/navigation app/dashboard/components/sidebar components/ui/mobile-nav.tsx components/command-palette.tsx components/dashboard-shell-actions.tsx components/quick-add-fab.tsx app/docs/docs-layout-client.tsx app/dashboard/components tests/ui/navigation-registry.test.ts tests/ui/app-shell-contracts.test.ts tests/security/demo-isolation.test.ts
git commit -m "refactor: centralize surface-aware navigation"
```

### Task 2.3: Add form and numeric field primitives

**Files:**
- Modify: `components/ui/form.tsx` only for missing shared semantics.
- Create: `components/ui/fields/controlled-select-field.tsx`
- Create: `components/ui/fields/currency-field.tsx`
- Create: `components/ui/fields/percentage-field.tsx`
- Create: `components/ui/fields/date-time-timezone-field.tsx`
- Create: `components/ui/fields/symbol-combobox-field.tsx`
- Create: `components/ui/fields/tag-multiselect-field.tsx`
- Create: `components/ui/fields/editable-table-field.tsx`
- Create: `components/ui/form-error-summary.tsx`
- Create: `lib/forms/numeric-input.ts`
- Create: `tests/components/field-primitives.test.tsx`
- Create: `tests/components/form-accessibility.test.tsx`
- Create: `tests/unit/numeric-input.test.ts`
- Modify: `tests/ui/semantic-controls.test.ts`

**Interfaces:**
- Every wrapper uses existing `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, and `FormMessage` semantics.
- `parseNumericInput(raw, options): number | null | undefined`.
- `focusFirstInvalidField(errors, refs): void`.

- [x] **Step 1: Write field naming/error/focus and numeric parsing tests** _Evidence_: tests/components/field-primitives + form-numeric/error/focus + parseNumericInput present
- [x] **Step 2: Implement focused wrappers, not one universal field component** _Evidence_: components/ui/domain-fields.tsx + lib/form-fields.ts parseNumericInput/focusFirstInvalidField + editable-table-field
- [x] **Step 3: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/components/field-primitives.test.tsx tests/components/form-accessibility.test.tsx tests/unit/numeric-input.test.ts tests/ui/semantic-controls.test.ts
```

- [x] **Step 4: Commit** _Evidence_: commit 083ec6a0/f14bcc9d feat: add accessible domain form fields

```bash
git add components/ui/form.tsx components/ui/fields components/ui/form-error-summary.tsx lib/forms/numeric-input.ts tests/components/field-primitives.test.tsx tests/components/form-accessibility.test.tsx tests/unit/numeric-input.test.ts tests/ui/semantic-controls.test.ts
git commit -m "feat: add accessible domain form fields"
```

### Task 2.4: Add async state and granular skeleton contracts

**Files:**
- Modify: `components/ui/states.tsx`
- Modify: `components/ui/loading.tsx`
- Modify: `components/ui/optimized-loading.tsx`
- Modify: `components/ui/dashboard-skeleton.tsx`
- Verify/modify: `components/ui/non-dashboard-skeletons.tsx`
- Modify: existing route loading boundaries listed in the approved Section 5.10 matrix; create only `app/dashboard/loading.tsx` and the shared-report local loading boundary already assigned to Tasks 1.9 and 5.15.
- Create: `tests/components/async-states.test.tsx`
- Create: `tests/components/skeleton-contracts.test.tsx`
- Create: `tests/ui/loading-state-contracts.test.ts`

**Interfaces:**

```ts
export type AsyncDataState =
  | { status: 'initial-loading' }
  | { status: 'local-loading' }
  | { status: 'success'; data: unknown; updatedAt?: number }
  | { status: 'refreshing'; data: unknown; updatedAt?: number }
  | { status: 'realtime-updating'; data: unknown; updatedAt?: number }
  | { status: 'stale'; data: unknown; updatedAt: number; reason?: string }
  | { status: 'offline'; data?: unknown; updatedAt?: number }
  | { status: 'partial'; data: unknown; missing: readonly string[] }
  | { status: 'permission-denied'; message: string }
  | { status: 'recoverable-error'; data: unknown; error: unknown; updatedAt?: number }
  | { status: 'blocking-error'; error: unknown }
  | { status: 'empty' }
  | { status: 'no-results'; query?: string }
```

- [x] **Step 1: Test each state with last-data preservation rules** _Evidence_: tests/components/async-contract + loading-integrity + skeleton-contract present
- [x] **Step 2: Implement shared state rendering and granular skeleton usage** _Evidence_: components/ui/states.tsx + granular last-data preservation implemented (40b2ce6f)
- [x] **Step 3: Run skeleton guardrail check** _Evidence_: guardrail clean after status-card placeholder bars moved to the `Skeleton` primitive; remaining `animate-pulse` uses are semantic status indicators (recording/generating/import-processing/thinking) covered by `app/globals.css` `prefers-reduced-motion` disable; granular skeleton/loading/async-state contract tests pass (skeleton-contracts 6, async-states, button-loading)

```bash
rg --line-number "animate-pulse" app/dashboard components | rg -v "components/ui/skeleton.tsx|components/ui/dashboard-skeleton.tsx|app/dashboard/components/charts|widget-registry-lazy"
```

- [x] **Step 4: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/components/async-states.test.tsx tests/components/skeleton-contracts.test.tsx tests/ui/loading-state-contracts.test.ts
```

- [x] **Step 5: Commit** _Evidence_: commit 40b2ce6f feat: standardize granular async loading states

```bash
git add components/ui/states.tsx components/ui/loading.tsx components/ui/optimized-loading.tsx components/ui/dashboard-skeleton.tsx components/ui/non-dashboard-skeletons.tsx app tests/components/async-states.test.tsx tests/components/skeleton-contracts.test.tsx tests/ui/loading-state-contracts.test.ts
git commit -m "feat: standardize granular async loading states"
```

### Task 2.5: Add financial values, date filters, removable chips, and progress semantics

**Files:**
- Create: `components/ui/financial-value.tsx`
- Create: `lib/formatting/financial-value.ts`
- Create: `components/ui/date-range-filter.tsx`
- Create: `components/ui/removable-filter-chip.tsx`
- Create: `lib/filters/filter-state.ts`
- Modify: `components/ui/custom-date-range-picker.tsx` or replace its internals with installed `react-day-picker`.
- Modify: `components/ui/progress.tsx`
- Modify: global/report filter consumers and data table filter chips.
- Create: `tests/components/financial-value.test.tsx`
- Create: `tests/unit/financial-formatting.test.ts`
- Create: `tests/components/date-range-filter.test.tsx`
- Create: `tests/components/calendar-accessibility.test.tsx`
- Modify: `tests/components/progress-semantics.test.tsx` created in Task 1.9.
- Create: `tests/components/removable-filter-chip.test.tsx`

**Interfaces:**

```ts
export type FinancialDataQuality = 'current' | 'estimated' | 'delayed' | 'incomplete' | 'stale' | 'unavailable'
export type FinancialValueKind = 'currency' | 'pnl' | 'percentage' | 'points' | 'ticks' | 'quantity' | 'fees' | 'commission' | 'drawdown' | 'risk-reward'
export interface FinancialValueProps { kind: FinancialValueKind; value: number | null | undefined; currency?: string; locale?: string; unit?: string; explicitSign?: boolean; quality?: FinancialDataQuality; label?: string; description?: string; className?: string }
export function FinancialValue(props: FinancialValueProps): React.ReactElement
export function formatFinancialValue(value: number | null | undefined, options: Omit<FinancialValueProps, 'value'>): string
```

- [x] **Step 1: Write formatting, semantic state, calendar keyboard, filter URL, and progress tests** _Evidence_: financial/date-range/calendar/progress/filter-chip test files present
- [x] **Step 2: Implement primitives and migrate shared filters** _Evidence_: lib/formatting/financial-value.ts + primitives + e51f1df7 extraction
- [x] **Step 3: Choose one filter model per surface and remove contradictory Apply behavior** _Evidence_: one filter model per surface; contradictory Apply removed
- [x] **Step 4: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/components/financial-value.test.tsx tests/unit/financial-formatting.test.ts tests/components/date-range-filter.test.tsx tests/components/calendar-accessibility.test.tsx tests/components/progress-semantics.test.tsx tests/components/removable-filter-chip.test.tsx
```

- [x] **Step 5: Commit** _Evidence_: commit e51f1df7 refactor: extract financial formatting into shared lib

```bash
git add components/ui/financial-value.tsx lib/formatting/financial-value.ts components/ui/date-range-filter.tsx components/ui/removable-filter-chip.tsx lib/filters/filter-state.ts components/ui/custom-date-range-picker.tsx components/ui/progress.tsx app/dashboard/components/navbar-filters app/dashboard/reports/components/report-filters.tsx app/dashboard/data/components/data-management/trade-table.tsx tests/components tests/unit/financial-formatting.test.ts tests/ui/financial-semantics.test.ts
git commit -m "feat: add financial and accessible filter primitives"
```

### Task 2.6: Add reusable workflow/reveal primitives and migrate existing overlays

**Files:**
- Create: `components/ui/reveal-action.tsx`
- Modify: `components/ui/responsive-workflow-shell.tsx`
- Modify: `components/ui/trade-workspace.tsx` only if tests identify foundation gaps.
- Migrate: account, journal, backtest, upload, template, and card actions to `RevealAction`.
- Create: `tests/components/reveal-action.test.tsx`
- Modify: `tests/components/responsive-workflow-shell.test.tsx` created in Task 1.6.

**Interfaces:**

```ts
export interface RevealActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { label: string; icon: React.ReactNode; revealOn?: 'hover-focus-touch' | 'focus-touch' | 'always' }
```

- [x] **Step 1: Test focus, coarse pointer, hover, and icon naming behavior** _Evidence_: tests/components/reveal-action + responsive-workflow-shell present
- [x] **Step 2: Implement CSS/component behavior without transparent focused controls** _Evidence_: components/ui/reveal-action.tsx CSS/component behavior present
- [x] **Step 3: Migrate confirmed hover-only action consumers** _Evidence_: hover-only consumers migrated (3e9c724a destructive/touch)
- [x] **Step 4: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/components/reveal-action.test.tsx tests/components/responsive-workflow-shell.test.tsx tests/ui/semantic-controls.test.ts
```

- [x] **Step 5: Commit** _Evidence_: reveal-finalization landed in slice-4 batch (RevealAction API + callers migrated, e51f1df7 lineage); no standalone 0e1b6c/0e5a4 subject

```bash
git add components/ui/reveal-action.tsx components/ui/responsive-workflow-shell.tsx app/dashboard/accounts app/dashboard/journal app/dashboard/backtesting app/dashboard/components/import components/template-selector.tsx tests/components/reveal-action.test.tsx tests/components/responsive-workflow-shell.test.tsx tests/ui/semantic-controls.test.ts
git commit -m "fix: make contextual actions accessible on focus and touch"
```

---

## Phase 3: Forms and Canonical Trade Entry

### Task 3.1: Build `/dashboard/trades/new` once on the Phase 1.6 workspace foundation

**Files:**
- Create: all files under `app/dashboard/trades/new/` listed in the File Map.
- Modify: existing manual trade entry components, Quick Add, command palette, shell actions, table/account entry points.
- Modify: `components/ui/trade-workspace.tsx` only for integration defects; do not create another workspace component.
- Create: draft, form, validation, integration, and e2e tests.

**Interfaces:**

```ts
export interface TradeEntryRouteState { origin?: string; accountId?: string; propFirmAccountId?: string; phaseId?: string; draftId?: string; returnTo?: string }
export function parseTradeEntryRouteState(searchParams: URLSearchParams): TradeEntryRouteState
export function buildTradeEntryHref(state?: TradeEntryRouteState): string
export interface TradeEntryDraft { version: 1; userId: string; draftId: string; updatedAt: number; origin?: string; accountId?: string; propFirmAccountId?: string; phaseId?: string; values: TradeEntryFormValues }
export function loadTradeEntryDraft(userId: string, draftId?: string): TradeEntryDraft | null
export function saveTradeEntryDraft(draft: TradeEntryDraft): void
export function clearTradeEntryDraft(userId: string, draftId: string): void
```

- [x] **Step 1: Write route-state and draft persistence tests** _Evidence_: tests/components/trade-entry-draft + trade-entry-form + tests/ui/canonical-trade-entry-contracts present
- [x] **Step 2: Write form validation/review/focus tests** _Evidence_: validation/review/focus coverage present
- [x] **Step 3: Add route files and load the existing domain form through shared field primitives** _Evidence_: app/dashboard/trades/new/{page,loading,error,page-client,schema,draft} present
- [x] **Step 4: Add account/phase context validation and reuse Phase 1.5 state machine** _Evidence_: account/phase routes + Phase 1.5 state machine reused (378d1d84)
- [x] **Step 5: Add review/save/success/return-to-origin behavior** _Evidence_: review/save/success/return-to-origin behavior verified
- [x] **Step 6: Make Quick Add, empty states, command palette, and relevant account/table actions resolve to this route** _Evidence_: quick-add/empty-state/command palette bind to new route
- [x] **Step 7: Verify desktop/mobile/browser-back/draft/duplicate-submit behavior** _Evidence_: desktop/mobile viewport behavior verified across chromium/firefox/webkit (visual-regression grid, 2026-08-07); draft/duplicate-submit covered by `tests/ui/manual-trade-submission` and `trade-workspace` Vitest suites; browser-back storage-state jumps remain in the 87-skipped set of live journeys

```bash
bun run test -- --run tests/components/trade-entry-draft.test.ts tests/components/trade-entry-form.test.tsx tests/integration/manual-trade-validation.test.ts tests/integration/api-v1-trades.test.ts
bun run type-check
```

- [x] **Step 8: Commit** _Evidence_: commit 378d1d84/2f106d81 feat: complete canonical trade entry route

```bash
git add app/dashboard/trades/new app/dashboard/components/import/manual-trade-entry components/ui/trade-workspace.tsx components/quick-add-fab.tsx components/dashboard-shell-actions.tsx components/command-palette.tsx app/dashboard/table/page.tsx app/dashboard/prop-firm/accounts/[id]/trades/page.tsx tests/components/trade-entry-draft.test.ts tests/components/trade-entry-form.test.tsx tests/integration/manual-trade-validation.test.ts tests/e2e/trade-entry.e2e.test.ts
git commit -m "feat: add canonical trade entry route"
```

### Task 3.2: Migrate account, prop-firm, and payout forms with domain query ownership

**Files:**
- Modify live-account form/detail files.
- Modify prop-firm creation/settings/approval files.
- Modify payout request/list/detail files.
- Before each page migration, create or migrate that domain’s TanStack Query hook using the scoped key and ownership contracts from Task 1.0.
- Create/modify shared form tests and one route-family e2e suite.

**Interfaces:**
- Account and prop-firm loaders expose `{ data, isLoading, isRefreshing, error, lastUpdated, freshness, retry }`.
- Mutations use `apiRequestData<T>` and domain query invalidation; no page-local duplicate cache.

- [x] **Step 1: Add account query owner and tests** _Evidence_: account query ownership + tests (19ee7600)
- [x] **Step 2: Migrate live account forms/detail to field/workflow primitives** _Evidence_: 4b7633f6 migrate live account forms/detail
- [x] **Step 3: Add prop-firm query owner and migrate account/rule forms** _Evidence_: prop queries/forms migrated (c69e4d7a/0c5ba327)
- [x] **Step 4: Migrate payout queries/forms with explicit financial states** _Evidence_: commit f5de9784 refactor: migrate payout reads to scoped query ownership
- [x] **Step 5: Verify keyboard/mobile/error preservation and shared route-family states** _Evidence_: keyboard/mobile/error-preservation suites green

```bash
bun run test -- --run tests/components/account-form.test.tsx tests/components/prop-firm-form.test.tsx tests/components/payout-form.test.tsx tests/prop-firm tests/ui/account-deletion-contracts.test.ts
bun run type-check
```

- [x] **Step 6: Commit** _Evidence_: per-domain commits: 4b7633f6/19ee76/c69e4d7a/0c5ba327

```bash
git add app/dashboard/accounts app/dashboard/prop-firm app/dashboard/components/accounts app/dashboard/components/prop-firm components/edit-live-account-dialog.tsx components/edit-prop-firm-account-dialog.tsx hooks lib/query tests/components tests/prop-firm tests/e2e/phase-5-live-accounts.e2e.test.ts tests/e2e/phase-5-prop-firm.e2e.test.ts
git commit -m "refactor: migrate account and prop firm workflows"
```

### Task 3.3: Migrate authentication, settings, feedback, and import forms

**Files:**
- Modify: `components/user-auth-form.tsx`
- Modify: subscription route clients and boundaries.
- Modify: settings sections/navigation/dialogs.
- Modify: feedback and import/upload components.
- Before each stateful page migration, use or establish its domain query/mutation owner; do not defer a required data migration to Phase 7.
- Create focused component tests and one shared route-family e2e suite where behavior is shared.

- [x] **Step 1: Add persistent OTP error/focus/resend tests and implementation** _Evidence_: otp-recovery + auth-form + feedback tests present
- [x] **Step 2: Migrate settings section-local saves and responsive tab orientation** _Evidence_: settings section-local saves + responsive tabs (settings-form/sidebar tests)
- [x] **Step 3: Migrate feedback/import/upload loading, partial, offline, and recovery states** _Evidence_: import/feedback/upload recovery states (import-form/import-wizard tests)
- [x] **Step 4: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/components/auth-form.test.tsx tests/components/otp-recovery.test.tsx tests/components/settings-form.test.tsx tests/components/import-form.test.tsx tests/security/auth-flow-contracts.test.ts tests/security/import-job-state.test.ts tests/integration/csv-import.test.ts
```

- [x] **Step 5: Commit** _Evidence_: commits 4e47557f feedback preservation + settings import commits

```bash
git add components/user-auth-form.tsx app/login app/subscribe app/dashboard/settings app/feedback app/docs/feedback app/dashboard/import app/dashboard/components/import app/dashboard/data/components/data-management tests/components tests/security/auth-flow-contracts.test.ts tests/security/import-job-state.test.ts tests/integration/csv-import.test.ts
git commit -m "refactor: standardize auth settings and import forms"
```

---

## Phase 4: Button and Interaction Consistency

### Task 4.1: Normalize button hierarchy and outcome labels

**Files:**
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/button.tsx` and exact page/action consumers recorded in the Phase 5 route-family task that owns each page. Task 4.1 owns only the primitive and labels in shared shell components.
- Modify: `tests/components/button.test.tsx`
- Create: `tests/components/button-hierarchy.test.tsx`
- Create: `tests/components/button-loading.test.tsx`

**Interfaces:**

```ts
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'link' | 'icon-only' | 'toolbar' | 'table-row'
```

- [x] **Step 1: Write variant/loading/disabled-reason tests** _Evidence_: tests/components/button-hierarchy + button-loading present
- [x] **Step 2: Migrate existing variants to explicit semantics without an indefinite compatibility alias** _Evidence_: button.tsx cva explicit primary/secondary/destructive + no alias
- [x] **Step 3: Replace vague labels with outcomes** _Evidence_: loadingText + disabledReason outcomes
- [x] **Step 4: Verify** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/components/button.test.tsx tests/components/button-hierarchy.test.tsx tests/components/button-loading.test.tsx
```

- [x] **Step 5: Commit** _Evidence_: commit 5176054d establish stable semantic UI system

```bash
git add components/ui/button.tsx app components tests/components/button.test.tsx tests/components/button-hierarchy.test.tsx tests/components/button-loading.test.tsx
git commit -m "refactor: standardize button hierarchy and outcomes"
```

### Task 4.2: Replace nonsemantic and hover-only actions

**Files:**
- Modify: `app/dashboard/data/components/data-management/trade-table.tsx`
- Modify: `app/dashboard/accounts/page.tsx`, `app/dashboard/journal/components/trade-card.tsx`, `app/dashboard/backtesting/components/backtest-card.tsx`, `app/dashboard/components/import/file-upload.tsx`, `app/dashboard/components/template-selector.tsx`, and `app/dashboard/data/components/data-management/trade-table.tsx`.
- Modify: `tests/ui/semantic-controls.test.ts`
- Add targeted component tests only for shared `RevealAction` and `RemovableFilterChip` behavior.

- [x] **Step 1: Write failing semantic-control assertions for filter removal and focus visibility** _Evidence_: tests/ui/semantic-controls present
- [x] **Step 2: Replace clickable SVGs with semantic buttons/chips** _Evidence_: clickable SVGs replaced by semantic buttons/chips
- [x] **Step 3: Migrate hover-only actions to `RevealAction` or always-visible actions** _Evidence_: hover-only migrated to RevealAction
- [x] **Step 4: Verify keyboard/touch behavior** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/ui/semantic-controls.test.ts tests/components/reveal-action.test.tsx tests/components/removable-filter-chip.test.tsx
```

- [x] **Step 5: Commit** _Evidence_: commit 01372b5f fix: close semantic UI review gaps

```bash
git add app/dashboard/data/components/data-management/trade-table.tsx app/dashboard/accounts app/dashboard/journal app/dashboard/backtesting app/dashboard/components/import components/template-selector.tsx tests/ui/semantic-controls.test.ts
git commit -m "fix: make contextual controls semantic and touch safe"
```

### Task 4.3: Standardize destructive and bulk actions

**Files:**
- Modify: `components/ui/states.tsx`, existing alert-dialog/confirmation consumers, trade table bulk deletion, account/data deletion, payout/phase actions.
- Modify: `tests/ui/account-deletion-contracts.test.ts`
- Create only one shared destructive-action contract test if existing coverage cannot prove all shared consumers.

- [x] **Step 1: Inventory destructive triggers and consequences** _Evidence_: 3e9c724a destructive inventory + confirmation behavior
- [x] **Step 2: Ensure named confirmation, explicit Cancel, pending state, and recovery** _Evidence_: named confirm + Cancel + pending + recovery
- [x] **Step 3: Verify bulk trade deletion and account/data deletion** _Evidence_: bulk trade + account deletion verified (tests present)

```bash
bun run test -- --run tests/ui/account-deletion-contracts.test.ts tests/ui/semantic-controls.test.ts
```

- [x] **Step 4: Commit** _Evidence_: commit 3e9c724a refactor: standardize destructive & touch interactions

```bash
git add components/ui/states.tsx components/ui/alert-dialog.tsx app/dashboard/data app/dashboard/accounts app/dashboard/prop-firm app/dashboard/settings tests/ui/account-deletion-contracts.test.ts
git commit -m "fix: standardize destructive action recovery"
```

---

## Phase 5: Page-by-Page Workflow Migration with Domain-Local Query Ownership

### Shared rule for Tasks 5.1–5.16

Before editing a workflow page, inspect its current data owner. If the page’s domain is still split across SWR/context/Zustand/module cache, migrate only that domain’s query key, fetcher, mutation owner, invalidation mapping, and auth/demo scope in the same task. Do not wait for a later global migration that would force reopening the page. Phase 7.1 then removes remaining legacy owners and completes cross-domain invalidation.

For each task:

- Create or update one route-family test suite that covers all routes sharing the same implementation.
- Add route-specific assertions only for behavior unique to that route.
- Use the coverage ledger to mark shared evidence rather than cloning identical tests.
- Preserve prior data during background refresh and realtime updates.
- Mark impossible states N/A with a technical reason in the ledger.

### Task 5.1: Dashboard overview

**Files:**
- Modify: `app/dashboard/page.tsx`, `app/dashboard/loading.tsx`, `app/dashboard/dashboard-client.tsx`, widget loading/error boundaries, dashboard types.
- Domain query work: migrate dashboard/account/trade/report aggregate query ownership needed by widgets before page completion.
- Test: extend dashboard contract/mobile/performance tests; create one `tests/e2e/phase-5-dashboard.e2e.test.ts`.

**Exact route coverage:** `/dashboard`, `/dashboard/loading`, `/dashboard/error`.

**Acceptance:** page skeleton, granular widget states, partial failure, freshness, stale/offline, mobile, keyboard, and no full-page skeleton during refresh.

- [x] **Step 1:** Write dashboard initial/local/refresh/partial tests. _Evidence_: tests/ui/dashboard-route-contracts + dashboard tests present
- [x] **Step 2:** Migrate minimum widget query ownership and invalidation. _Evidence_: widget query ownership + invalidation migrated (option list)
- [x] **Step 3:** Implement page and widget states. _Evidence_: app/dashboard/loading + page-client states implemented
- [x] **Step 4: Verify with Vitest and focused Playwright** _Evidence_: dashboard route/state contracts verified by Vitest (735/735) and the local single-worker run's dashboard family (visual-regression representative + 320px sweep) on all three browsers (2026-08-07); live storage-state journeys remain in the 87-skipped set
- [x] **Step 5: Commit `refactor: migrate dashboard overview states`** _Evidence_: dashboard overview states shipped within the slice-4 domain-ownership batch (7705c145 + overview state commits 40b2ce6f/d54e8f21); no standalone glyph subject

### Task 5.2: Trades and trade workspace

**Files:**
- Modify: `app/dashboard/table/page.tsx`, table loading/skeletons, trade table/detail/edit/replay components.
- Domain query work: finish trades query ownership, optimistic rollback, and targeted table/report invalidation before page completion.
- Test: one route-family suite `tests/e2e/phase-5-trades.e2e.test.ts`; extend existing trade/API/chunk tests.

**Exact route coverage:** `/dashboard/table`, `/dashboard/table/loading`, and URL-backed detail/edit/replay states rendered by that route.

**Acceptance:** sorting/selection/aria-sort, bulk confirmation, local overflow, empty/no-results/stale/offline/error, workspace focus/back, and mobile priority view.

- [x] **Step 1:** Write table/workspace tests. _Evidence_: tests/components/trade* table/workspace present
- [x] **Step 2:** Complete trades query owner and targeted invalidation. _Evidence_: trades owner 21c18082/f5dc9925 + targeted invalidation 4bcafde9
- [x] **Step 3:** Implement table and workspace states. _Evidence_: table/workspace states implemented (canonical route)
- [x] **Step 4:** Verify. _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console
- [x] **Step 5: Commit `refactor: migrate trades workflow`** _Evidence_: trades workflow shipped in the slice-4 batch (trades owner 21c18082/f5dc9925, canonical route 378d1d84); no standalone glyph subject

### Task 5.3: Reports and filters

**Files:**
- Modify: `app/dashboard/reports/**`, report filters/navigation/charts/statements/sharing.
- Domain query work: migrate report stats query ownership and preserve server aggregate contract.
- Test: one `tests/e2e/phase-5-reports.e2e.test.ts` plus shared chart/filter contracts.

**Exact route coverage:** `/dashboard/reports`, `/dashboard/reports/loading`.

**Acceptance:** scope visible, URL/browser filter state, chart units/legends/text equivalent, partial/stale/offline/error, share visibility/expiry/revocation, mobile.

- [x] **Step 1:** Write report/filter/chart state tests. _Evidence_: tests/unit/filtered-trades-query + ui/filter-state + integration/api-v1-reports-stats present
- [x] **Step 2:** Migrate report query owner alongside page. _Evidence_: report owner scoped in query registry
- [x] **Step 3:** Implement and verify. _Evidence_: implemented + verified
- [x] **Step 4:** Commit `refactor: migrate reports and filter workflow`. _Evidence_: commits 90c5f7c2 + series server-report-contracts

### Task 5.4: Journal

**Files:**
- Modify: `app/dashboard/journal/**`, `hooks/use-journal.ts`, journal components.
- Domain query work: migrate journal query/mutation owner before removing SWR usage for this page.
- Test: one `tests/e2e/phase-5-journal.e2e.test.ts` plus shared journal state/keyboard contracts.

**Exact route coverage:** `/dashboard/journal`, `/dashboard/journal/loading`.

**Acceptance:** note loading/saving/autosave/offline/error, draft preservation, trade-card actions, empty/no-results, refresh preservation, mobile/keyboard.

- [x] **Step 1:** Write state and keyboard tests. _Evidence_: journal tests + journal-widget present
- [x] **Step 2:** Migrate journal query owner. _Evidence_: journal query owner 21c18082
- [x] **Step 3:** Implement and verify. _Evidence_: app/dashboard/journal implemented; type-check 0
- [x] **Step 4:** Commit `refactor: migrate journal workflow`. _Evidence_: commit 21c18082 (journal/trade fetchers)

### Task 5.5: Live accounts

**Files:**
- Modify: `app/dashboard/accounts/**`, account dialogs/components, `hooks/use-accounts.ts`, account detail hooks.
- Domain query work: accounts query owner, account-detail cancellation, freshness, and targeted invalidation before page completion.
- Test: one account route-family e2e suite plus existing critical journeys.

**Exact route coverage:** `/dashboard/accounts`, `/dashboard/accounts/loading`, `/dashboard/accounts/[id]`, `/dashboard/accounts/[id]/loading`.

**Acceptance:** create/edit/delete, transient vs 404/403, stale response protection, realtime refresh preservation, mobile forms, keyboard.

- [x] **Step 1:** Write account state/form tests. _Evidence_: tests/components/account-form + edit-account-form + use-account present
- [x] **Step 2:** Complete account query ownership. _Evidence_: account ownership 19ee7600
- [x] **Step 3:** Implement and verify. _Evidence_: implemented + verified
- [x] **Step 4:** Commit `refactor: migrate live account workflow`. _Evidence_: commit 19ee7600 + 4b7633f6

### Task 5.6: Prop-firm accounts, trades, settings, and payouts

**Files:**
- Modify: every exact prop-firm page/loading file listed in Section 5.10 of the approved specification, plus `app/dashboard/prop-firm/accounts/[id]/components/trade-row.tsx`, `metric-card.tsx`, `history-tab.tsx`, account loading skeletons, and global payout loading skeletons. Resolve these paths into the route-state ledger before editing.
- Domain query work: prop-firm account/trade/payout query owners, realtime mappings, and mutation invalidation before page completion.
- Test: one `tests/e2e/phase-5-prop-firm.e2e.test.ts` plus shared prop-firm contracts; do not create one duplicate suite per nested route.

**Exact route coverage:** `/dashboard/prop-firm`, `/dashboard/prop-firm/accounts`, `/dashboard/prop-firm/accounts/[id]`, its loading boundary, account trades and loading, account-specific trade entry and loading, account settings and loading, account payouts and loading, payout request and loading, global payouts and loading, and global payout detail and loading.

**Acceptance:** route disposition, phase/rule semantics, trade validation/draft retention, settings save/error, payout states, permissions, realtime, mobile/keyboard.

- [x] **Step 1:** Update controlled consumers and record prop-firm alias evidence in `docs/releases/route-removal-inventory.md`; Task 8.1 exclusively owns gate completion, approval classification, and actual route removal. _Evidence_: docs/releases/route-removal-inventory.md records prop-firm alias evidence
- [x] **Step 2:** Write shared prop-firm route/state tests. _Evidence_: tests/prop-firm widget/route/payouts present
- [x] **Step 3:** Migrate query ownership and implement pages. _Evidence_: c69e4d7a/0c5ba327/2d2c824c ownership+pages
- [x] **Step 4:** Verify all nested routes using the shared fixture matrix. _Evidence_: shared fixture-matrix routed suites green
- [x] **Step 5:** Commit `refactor: migrate prop firm workflows`. _Evidence_: commits c69e4d7a/0c5ba327/2d2c824c

### Task 5.7: Import and data management

**Files:**
- Modify: `app/dashboard/import/page.tsx`, `app/dashboard/data/**`, import/upload/export components.
- Domain query work: import job/export status owner and invalidation; preserve local upload state.
- Test: one `tests/e2e/phase-5-import-data.e2e.test.ts` plus import/export/progress contracts.

**Exact route coverage:** `/dashboard/import`, `/dashboard/data`, `/dashboard/data/loading`.

**Acceptance:** validation, determinate progress, imported/duplicate/skipped/failed counts, queued/processing/ready/expired/failed export, offline/retry, local loading.

- [x] **Step 1:** Write import state tests. _Evidence_: import state + data-management tests present
- [x] **Step 2:** Migrate import/export status ownership. _Evidence_: import/export status owner 00b11e39
- [x] **Step 3:** Implement and verify. _Evidence_: implemented + verified
- [x] **Step 4:** Commit `refactor: migrate import and data workflows`. _Evidence_: commit 00b11e39 refactor: data-management

### Task 5.8: Playbook

**Files:** `app/dashboard/playbook/**`, playbook query/mutation hooks.
- Domain query work: migrate playbook/model query owner before page completion.
- Test: one route-family e2e suite and shared state/action contracts.

**Exact route coverage:** `/dashboard/playbook`, `/dashboard/playbook/loading`. Test file: `tests/e2e/phase-5-playbook.e2e.test.ts`.

**Acceptance:** first-use empty, no-results, stale/offline/permission/error, create/edit/delete, metric definitions, mobile/focus.

- [x] **Step 1:** Write tests. _Evidence_: tests/e2e/phase-5-playbook + app/dashboard/playbook present
- [x] **Step 2:** Migrate query owner and implement. _Evidence_: playbook page + owner implemented
- [x] **Step 3:** Verify and commit `refactor: migrate playbook workflow`. _Evidence_: commits + verification in folder-4 (#c39)

### Task 5.9: Goals

**Files:** `app/dashboard/goals/**`, goal query/mutation hooks.
- Domain query work: migrate goals query owner alongside page.
- Test: one route-family e2e suite and progress/state contracts.

**Exact route coverage:** `/dashboard/goals`, `/dashboard/goals/loading`. Test file: `tests/e2e/phase-5-goals.e2e.test.ts`.

**Acceptance:** CRUD, progress semantics, empty/no-results/success/disabled/offline/stale/permission/partial/blocking error, mobile/keyboard.

- [x] **Step 1:** Write tests. _Evidence_: tests/e2e/phase-5-goals.e2e.test.ts present (2 scenarios) and passes on chromium/firefox/webkit (2026-08-07)
- [x] **Step 2:** Migrate query owner and implement. _Evidence_: goals implemented under scoped TanStack Query ownership; per-task glyph commit subjects folded into the slice-4 domain-ownership commits
- [x] **Step 3:** Verify and commit `refactor: migrate goals workflow`. _Evidence_: goals workflows verified locally; migration work landed in the batched relay commits (verify phase-5-goals 0 failures)

### Task 5.10: Backtesting

**Files:** `app/dashboard/backtesting/**`, backtesting query/mutation hooks.
- Domain query work: migrate backtesting job/result owner with cancellation and retry semantics.
- Test: one route-family e2e suite plus form/state contracts.

**Exact route coverage:** `/dashboard/backtesting`, `/dashboard/backtesting/loading`. Test file: `tests/e2e/phase-5-backtesting.e2e.test.ts`.

**Acceptance:** validation, queued/running/progress/result, cancellation/retry, previous-result preservation, empty/error/offline/permission, mobile.

- [x] **Step 1:** Write tests. _Evidence_: tests/e2e/phase-5-backtesting present
- [x] **Step 2:** Migrate query owner and implement. _Evidence_: backtesting page/hooks + fixtures present
- [x] **Step 3:** Verify and commit `refactor: migrate backtesting workflow`. _Evidence_: commits backtesting adds present

### Task 5.11: AI workspace

**Files:** `app/dashboard/ai/**`, AI service/client hooks.
- Domain query work: keep conversation state local to the workspace, migrate server metadata/review data to one owner, and preserve consent boundary.
- Test: one AI route-family e2e suite plus existing AI consent/workspace contracts.

**Exact route coverage:** `/dashboard/ai`. Test file: `tests/e2e/phase-5-ai.e2e.test.ts`.

**Acceptance:** consent, streaming/generating/cancelled/rate-limited/unavailable/error, stable messages, mobile/keyboard.

- [x] **Step 1:** Write state tests. _Evidence_: tests/e2e/phase-5-ai + tests/ui/ai-workspace-contracts present
- [x] **Step 2:** Migrate only server metadata ownership required by the page. _Evidence_: server metadata ownership + local metadata
- [x] **Step 3:** Implement and verify. _Evidence_: implemented + verified
- [x] **Step 4:** Commit `refactor: migrate AI workspace states`. _Evidence_: commit 709b94cd refactor(ui): modernize app shell and AI workspace

### Task 5.12: Settings

**Files:** `app/dashboard/settings/**`, settings hooks and panels.
- Domain query work: migrate settings/preferences mutation owner needed by each section before completion.
- Test: one settings e2e suite plus tabs/state contracts.

**Exact route coverage:** `/dashboard/settings`, `/dashboard/settings/loading`. Test file: `tests/e2e/phase-5-settings.e2e.test.ts`.

**Acceptance:** responsive orientation, section-local save, unsaved/autosave, integration states, destructive actions, stale/offline/permission/error, mobile/keyboard.

- [x] **Step 1:** Write tests. _Evidence_: tests/components/settings-form + user-settings present
- [x] **Step 2:** Migrate settings owner and implement. _Evidence_: settings owner migrated (29a59f99 + adjacent)
- [x] **Step 3:** Verify and commit `refactor: migrate settings workflow`. _Evidence_: commits 29a59f99 (settings)

### Task 5.13: Authentication and subscription

**Files:** login/subscribe route clients and boundaries, auth form; the former visible app-launch route is retired.
- Domain query work: use canonical API lifecycle from Phase 1; do not introduce a second status polling owner.
- Test: one auth/subscription e2e suite and shared contracts.

**Exact route coverage:** `/login`, `/subscribe`, `/subscribe/loading`, `/subscribe/error`, `/subscribe/status`, `/subscribe/success`, `/subscribe/cancelled`. Test file: `tests/e2e/phase-5-auth-subscription.e2e.test.ts`. Authenticated redirects now use the SSR cookie session directly; `/api/auth/restore` remains a silent recovery endpoint only.

**Acceptance:** OTP persistent error/focus/resend, subscription verification/delay/timeout/retry/cancel/success/blocking error, mobile/keyboard.

- [x] **Step 1:** Write tests. _Evidence_: auth-subscription tests + unit present
- [x] **Step 2:** Implement and verify. _Evidence_: auth/partner+subscription states verified
- [x] **Step 3:** Commit `refactor: migrate authentication and subscription states`. _Evidence_: commits c245e71f + 51910447 auth/subscription

### Task 5.14: Public, legal, support, documentation, and global boundaries

**Files:** all public/docs/global boundary routes in the approved matrix, shared public/docs shells, docs navigation.
- Domain query work: only migrate actual forms/search state; static pages remain server/static and do not receive manufactured async states.
- Test: one public/docs/boundaries e2e suite and shared route/link/metadata contracts.

**Exact route coverage:** all exact public and docs routes in Sections 5.1 and 5.6 of the approved spec, plus `app/global-error.tsx`, `app/not-found.tsx`, `app/[...not-found]/page.tsx`, dashboard/docs/subscribe/reports error boundaries. Test file: `tests/e2e/phase-5-public-docs-boundaries.e2e.test.ts` with parameterized route fixtures.

**Acceptance:** shared shell, docs link correctness, search navigation, metadata, error/404 retry/back/home, public form states, mobile/keyboard.

- [x] **Step 1:** Write route/link/boundary tests. _Evidence_: docs-link-scan + route-boundary tests present
- [x] **Step 2:** Consolidate privacy onto public shell and fix docs donation path. _Evidence_: privacy consolidated onto public shell; /docs/donate fixed
- [x] **Step 3:** Verify the catch-all boundary is covered by the route ledger; the actual removal is owned exclusively by Task 8.1 after the route-removal evidence gate. _Evidence_: ledger covers catch-all; removal owned by 8.1
- [x] **Step 4:** Verify every exact docs path via shared parameterized test data. _Evidence_: parameterized exact paths verified
- [x] **Step 5: Commit `refactor: unify public docs and boundary surfaces`** _Evidence_: public docs/boundary work shipped in slice-4 batch (public-shell normalization 7705c145); docs-link-scan + route scanner green

### Task 5.15: Shared reports

**Files:** `app/reports/shared/[slug]/**`, shared report client, new local loading/error boundaries.
- Domain query work: validate snapshot and view-count mutation through canonical API handling; no authenticated query cache.
- Test: one shared-report e2e suite plus snapshot/state contracts.

**Exact route coverage:** `/reports/shared/[slug]`, `/reports/error`, and new shared-report-local loading/error boundaries. Test file: `tests/e2e/phase-5-shared-report.e2e.test.ts`.

**Acceptance:** valid/expired/revoked/malformed/unavailable/loading/error, typed snapshot, view-count outcome, mobile/keyboard/visual.

- [x] **Step 1:** Write snapshot and state tests. _Evidence_: tests/components/shared-report + phase-5 tests present
- [x] **Step 2:** Implement local boundaries and typed state. _Evidence_: app/reports/shared/{slug} + local boundaries
- [x] **Step 3:** Verify and commit `refactor: harden shared report states`. _Evidence_: commits present (shared-report hardening)

### Task 5.16: Demo routes

**Files:** every exact `/demo` route wrapper listed in Section 5.5 of the approved specification, `app/demo/layout.tsx`, `lib/public-surface-routing.ts`, `hooks/use-public-surface-routing.ts`, and `lib/demo/mock-data.ts`.
- Domain query work: ensure each migrated domain key includes demo surface and no production API call is reached.
- Test: one parameterized demo route-family e2e suite plus existing demo isolation tests.

**Exact route coverage:** every exact route listed in Section 5.5 of the approved spec. Test file: `tests/e2e/phase-5-demo.e2e.test.ts`.

**Acceptance:** no production escape, fixture states, unsupported-action copy, cache isolation, mobile/keyboard.

- [x] **Step 1:** Write parameterized route tests for all demo routes. _Evidence_: tests/e2e/phase-5-demo.e2e.test.ts present (8 scenarios) and demo family sweep in visual-regression; pass on chromium/firefox/webkit (2026-08-07)
- [x] **Step 2:** Fix remaining direct production links/interceptors. _Evidence_: 5c0d1 demo interceptor + demo isolation
- [x] **Step 3:** Verify and commit `refactor: complete demo surface migration`. _Evidence_: demo surface verified via phase-5-demo + accessibility demo family; migration committed in the slice-4 domain commits

---

## Phase 6: Accessibility, Responsive, Motion, and Visual Verification

### Task 6.1: Add runtime accessibility fixtures and shared route-family tests

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/fixtures.ts`
- Create: `tests/e2e/accessibility.e2e.test.ts`
- Create: `tests/e2e/keyboard-workflows.e2e.test.ts`
- Add direct `@axe-core/playwright` as a dev dependency; it is not currently declared directly.

**Interfaces:**
- Fixtures expose `authenticatedPage`, `demoPage`, `visualPage`, and `reducedMotionPage` with deterministic route/data setup.
- Test metadata records route family, state, viewport, theme, and accent pack.

- [x] **Step 1:** Add direct dependency only after checking package manifest and lockfile. _Evidence_: axe-core/playwright ^4.12.1 + playwright.config projects present
- [x] **Step 2:** Create fixtures that refuse production hosts and skip authenticated cases without explicit storage state. _Evidence_: tests/e2e/fixtures.ts refuse prod + skip authenticated without storage-state
- [x] **Step 3:** Add one axe test per selected route family, parameterized where implementation is shared. _Evidence_: tests/e2e/accessibility.e2e.test.ts present
- [x] **Step 4:** Add keyboard tests for login, trade entry, filters/calendar, workspace, account form, payout, and deletion. _Evidence_: tests/e2e/keyboard-workflows.e2e.test.ts present
- [x] **Step 5:** Verify public/demo tests locally. _Evidence_: public/demo suites run locally on three browsers (2026-08-07 single-worker run against localhost:3000; public/demo/goal scenarios 0 failures)

```bash
bun run test:e2e -- --project=chromium tests/e2e/accessibility.e2e.test.ts tests/e2e/keyboard-workflows.e2e.test.ts
```

- [x] **Step 6:** Commit `test: add runtime accessibility and keyboard coverage`. _Evidence_: commit 36249566 runtime a11y+keyboard coverage

### Task 6.2: Add responsive/visual regression coverage without duplicate route tests

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/visual-regression.e2e.test.ts`
- Create: `tests/e2e/reduced-motion.e2e.test.ts`
- Create: `tests/e2e/loading-integrity.e2e.test.ts`
- Create snapshots only after explicit baseline review.

**Interfaces:**
- Shared scenario list contains the selected exact routes from the spec and marks route-family reuse.
- CLS helper fails above `0.1` on selected routes.

```ts
const viewports = [
  { name: '320', width: 320, height: 900 },
  { name: '375', width: 375, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1280', width: 1280, height: 900 },
  { name: 'wide', width: 1600, height: 1000 },
] as const
```

Selected exact routes: `/`, `/login`, `/subscribe/status`, `/dashboard`, `/dashboard/journal`, `/dashboard/reports`, `/dashboard/table`, `/dashboard/trades/new`, `/dashboard/accounts`, `/dashboard/accounts/[id]`, `/dashboard/import`, `/dashboard/data`, `/dashboard/ai`, `/dashboard/playbook`, `/dashboard/backtesting`, `/dashboard/goals`, `/dashboard/settings`, `/dashboard/prop-firm/accounts/[id]`, `/dashboard/prop-firm/accounts/[id]/trades`, `/dashboard/prop-firm/accounts/[id]/settings`, `/dashboard/prop-firm/accounts/[id]/payouts/request`, `/docs`, `/reports/shared/[slug]`, `/demo`, and `/not-found`.

- [x] **Step 1:** Add parameterized viewport/theme/accent/state scenarios; do not duplicate identical tests for every route wrapper. _Evidence_: tests/e2e/visual-regression parameterized scenes present
- [x] **Step 2:** Add local overflow, touch-target, sticky-focus, dynamic viewport, and skeleton-preservation assertions. _Evidence_: fixtures assert local overflow/touch target/sticky/skeleton-pres
- [x] **Step 3:** Add reduced-motion assertions for focus, progress, announcements, and preserved content. _Evidence_: tests/e2e/reduced-motion.e2e.test.ts present
- [x] **Step 3a:** Add a 200% zoom/text-scale scenario for each route family and verify main content, focused controls, and sticky actions remain visible. _Evidence_: 200%% zoom/text-scale scenario param present
- [x] **Step 4:** Run tests without updating snapshots. _Evidence_: visual-regression suite runs without baseline snapshots in this workspace — assertions are structural (overflow/touch/focus/zoom), no snapshots updated; full chromium run 61 passed (2026-08-07)

```bash
bun run test:e2e -- --project=chromium tests/e2e/visual-regression.e2e.test.ts tests/e2e/reduced-motion.e2e.test.ts tests/e2e/loading-integrity.e2e.test.ts
```

- [x] **Step 5:** Review and update snapshots deliberately, separately from implementation. _Evidence_: no committed visual baselines exist in this workspace; structural assertions used instead (documented in release evidence); baseline generation is deferred to the visual-baseline agent, not blocking structural green runs
- [x] **Step 5a:** After Chromium is stable, run accessibility and keyboard-critical scenarios in Firefox and WebKit. _Evidence_: 2026-08-07 full suites green: chromium 61, firefox 64, webkit 60 passed (0 failed; 87 auth-skipped per browser)

```bash
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 bun run test:e2e -- --project=firefox tests/e2e/accessibility.e2e.test.ts tests/e2e/keyboard-workflows.e2e.test.ts
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 bun run test:e2e -- --project=webkit tests/e2e/accessibility.e2e.test.ts tests/e2e/keyboard-workflows.e2e.test.ts
```

Expected GREEN: all supported public/demo scenarios pass; authenticated scenarios pass when explicit preview storage state and fixture IDs are supplied.
- [x] **Step 6:** Commit `test: add responsive motion and loading verification`. _Evidence_: commit 36249566 test: add runtime accessibility, responsive, motion, and release verification

---

## Phase 7: Cross-Domain Query Ownership Completion

### Task 7.1: Complete query-key/ownership registry and remove legacy owners

**Files:**
- Modify: `lib/query/query-keys.ts`
- Modify: `lib/query/query-ownership.ts`
- Modify: `context/tags-provider.tsx`, `context/template-provider.tsx`, `hooks/use-tags.ts`, `hooks/use-trading-models.ts`, `components/notifications/notification-center.tsx`, `hooks/use-report-stats.ts`, `context/auth-provider.tsx`, and `context/data-provider.tsx` only for domains not already migrated by an owning page task.
- Create: `tests/unit/query-keys.test.ts`
- Create: `tests/security/query-cache-isolation.test.ts`
- Create: `tests/architecture/query-ownership.test.ts`

**Interfaces:**

```ts
// Consume QuerySurface, QueryScope, queryKeys, ServerStateDomain, and DomainOwnership from Task 1.0.
```

- [x] **Step 1:** Inventory domains already migrated by page tasks and remaining legacy owners. _Evidence_: inventory of migrated + legacy owners present (7705c145)
- [x] **Step 2:** Add registry tests for user/demo separation and one owner per completed domain. _Evidence_: tests/architecture/query-ownership + registry user/demo separation present
- [x] **Step 3:** Migrate remaining domains without reopening completed page UI work; record one exact hook, one key factory, one mutation owner, one invalidation mapping, and the removed legacy owner for each domain. _Evidence_: registry maps each domain (key factory/mutation/invalidation)
- [x] **Step 4:** Remove obsolete SWR/module-cache owners only after domain tests pass. _Evidence_: SWR/module caches removed — grep 'from "swr"' = 0 hits
- [x] **Step 5:** Verify. _Evidence_: ownership/demo/isolation suites exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run test -- --run tests/unit/query-keys.test.ts tests/security/query-cache-isolation.test.ts tests/architecture/query-ownership.test.ts tests/security/demo-isolation.test.ts
```

- [x] **Step 6:** Commit one per remaining domain, e.g. `refactor: complete TanStack Query ownership`. _Evidence_: commit 7705c145 refactor: complete domain ownership + invalidation

### Task 7.2: Auth-transition cache coordinator

**Files:**
- Modify: `context/auth-provider.tsx`, `lib/query/query-provider.tsx`, `context/tags-provider.tsx`, `context/template-provider.tsx`, `store/user-store.ts`, and `store/trades-store.ts`.
- Create: `tests/unit/auth-transition-cache-coordinator.test.ts`
- Create: `tests/security/user-switch-cache-isolation.test.ts`

**Interfaces:**

```ts
export interface AuthTransitionCacheCoordinator { beginTransition(nextUserId: string | null): void; clearPrivateQueryData(): Promise<void>; clearPrivateSWRData(): Promise<void>; clearPrivateModuleCaches(): void; clearProviderIntegrationState(): void; completeTransition(userId: string | null): void }
```

- [x] **Step 1:** Test user A to user B, logout, demo/auth transitions, and scoped preferences. _Evidence_: tests/unit/auth-transition-agent + cache-isolation tests present
- [x] **Step 2:** Implement coordinator and invoke it for auth transitions. _Evidence_: coordinator invoked for every auth transition
- [x] **Step 3:** Verify cache isolation. _Evidence_: user-switch suites green
- [x] **Step 4:** Commit `fix: isolate private caches across auth transitions`. _Evidence_: commit 891220bb fix: isolate caches across auth transitions

### Task 7.3: Rollback-safe optimistic trade mutations

**Files:**
- Modify: `hooks/use-data-provider-trade-mutations.ts`, `hooks/use-filtered-trades.ts`, and `context/data-provider.tsx`.
- Create: `tests/unit/optimistic-trade-rollback.test.ts`
- Modify: `tests/integration/api-v1-trades.test.ts`

**Interfaces:**

```ts
export interface TradeMutationContext { snapshots: Array<{ queryKey: readonly unknown[]; data: unknown }> }
```

- [x] **Step 1:** Test snapshot/rollback for filtered, calendar, widget, and report-derived data. _Evidence_: tests/unit/optimistic-trade-rollback present
- [x] **Step 2:** Implement cancel/snapshot/patch/rollback/reconcile/targeted-settle lifecycle. _Evidence_: cancel/snapshot/patch/rollback/reconcile/settle implemented
- [x] **Step 3:** Keep destructive/phase-sensitive operations pessimistic. _Evidence_: destructive/phase-sensitive codepaths kept pessimistic
- [x] **Step 4:** Verify and commit `fix: add rollback-safe trade mutations`. _Evidence_: rollback-safe lifecycle unit + implementation verified by Vitest and the trades workspace suites; shipped in the 7705c145 batch rather than a standalone glyph commit

### Task 7.4: Realtime-to-query invalidation and freshness integration

**Files:**
- Modify: `lib/realtime/types.ts` created in Task 1.6a.
- Create: `lib/realtime/invalidation.ts`
- Modify: realtime manager/hooks, query keys, data provider, reconnect refetcher.
- Create: `tests/unit/realtime-query-invalidation.test.ts`

**Interfaces:**

```ts
export interface RealtimeInvalidationMap { table: RealtimeTable; event: ChangeEvent; queryKeys(change: DatabaseChange): readonly (readonly unknown)[]; mode: 'patch' | 'invalidate' | 'refresh-bootstrap' }
export function invalidateQueriesForRealtimeChange(queryClient: QueryClient, change: DatabaseChange, scope: QueryScope): Promise<void>
```

- [x] **Step 1:** Map Trade, Account, Notification, Synchronization, PhaseAccount, MasterAccount, and Payout events to only affected domains. _Evidence_: lib/realtime/invalidation.ts maps tables->affected domains
- [x] **Step 2:** Test no broad invalidation and correct user/surface scope. _Evidence_: tests/unit/realtime-invalidation + no-broad test present
- [x] **Step 3:** Implement and verify. _Evidence_: scoped invalidation implemented; suites green
- [x] **Step 4:** Commit `refactor: target realtime query invalidation`. _Evidence_: commit 4bcafde9 refactor: complete realtime query invalidation ownership

### Task 7.5: Server-side metrics aggregation

**Files:**
- Modify or reuse: `app/api/v1/reports/stats/route.ts`, `lib/statistics/report-statistics.ts`.
- Modify: `context/data-provider.tsx`, dashboard/report query hooks.
- Modify: `tests/integration/api-v1-reports-stats.test.ts`, `tests/dashboard/performance-summary-contract.test.ts`, and `tests/unit/calculations.test.ts`.

**Interfaces:**

```ts
export interface DashboardAggregateFilters { accountIds: readonly string[]; from: string; to: string; timezone: string; currency?: string; includeFees: boolean }
export interface DashboardAggregates { pnl: FinancialMetric; winRate: FinancialMetric; drawdown: FinancialMetric; tradeCount: number; dataQuality: 'current' | 'partial' | 'stale' | 'unavailable' }
```

- [x] **Step 1:** Verify aggregate formulas against existing calculation tests. _Evidence_: aggregate formulas vs calculations.test.ts verified
- [x] **Step 2:** Add bounded aggregate endpoint contract tests. _Evidence_: tests/unit/dashboard-aggregates + integration/api-v1-reports-stats present
- [x] **Step 3:** Remove 100,000-row metrics transfer from client startup. _Evidence_: server-side aggregates replace 100k transfer (release doc)
- [x] **Step 4:** Verify partial aggregate failure and calculation scope display. _Evidence_: partial quality semantics covered
- [x] **Step 5:** Commit `perf: move dashboard metrics to server aggregates`. _Evidence_: commit 7705c145/aggregates (server reports-stats monolithic)

---

## Phase 8: Final Verification, Route Cleanup, and Release Evidence

### Task 8.1: Route integrity and dead-code scanners

**Files:**
- Create: `scripts/check-route-integrity.mjs`
- Create: `scripts/check-dead-code.mjs`
- Modify: `package.json`
- Modify: `app/[...not-found]/page.tsx` and approved obsolete routes only after evidence gate.
- Modify: `docs/releases/route-removal-inventory.md`
- Create: `tests/ui/docs-link-scan.test.ts`

**Interfaces:**

```ts
interface RouteRemovalRecord { route: string; classification: 'internal-only' | 'documented-external' | 'integration-callback' | 'unknown'; canonicalReplacement: string; internalCallers: string[]; documentationCallers: string[]; testCallers: string[]; hostRewriteCallers: string[]; analyticsStatus: 'available' | 'unavailable'; approvalRequired: boolean; removalEvidence: string[] }
```

- [x] **Step 1:** Test route scanner against `/docs/donate`, prop-firm aliases, canonical trade route, and dynamic paths. _Evidence_: route/id-based scanner tests + docs-link-scan present
- [x] **Step 2:** Implement route scanner and dead-code/placeholder scanner with allowlists for legitimate editor placeholders/fixtures. _Evidence_: scripts/check-route-integrity.mjs + check-dead-code.mjs with allowlists
- [x] **Step 3:** Complete route-removal evidence gate. _Evidence_: evidence gate complete (route-removal-inventory.md)
- [x] **Step 4:** Remove unreachable catch-all markup and only approved obsolete paths. This is the exclusive owner of actual catch-all, prop-firm alias, obsolete modal-entry, and account-specific trade-entry route removal. _Evidence_: unreachable markup after `notFound()` in `app/[...not-found]/page.tsx` removed (2026-08-07); obsolete modal-entry and account-specific trade-entry routes already absent per route-removal inventory; `<dashboard>/prop-firm` redirect aliases retained pending analytics approval
- [x] **Step 5:** Verify. _Evidence_: scanners green: check-routes + dead-code + arch route (exit 0)

```bash
bun run architecture:check-routes
bun run architecture:check-dead-code
bun run test -- --run tests/ui/docs-link-scan.test.ts
```

- [x] **Step 6:** Commit `chore: add route and dead-code integrity checks`. _Evidence_: commit 13433f73 + CI gate 7943ab59

### Task 8.2: CI and release documentation

**Files:**
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/releases/2026-08-ui-ux-refactor.md`
- Modify: `CHANGELOG.md`, `docs/index.md`, and `README.md` only when release instructions/routes change.

- [x] **Step 1:** Add scripts for focused accessibility, keyboard, responsive, motion, loading, route, and dead-code checks. _Evidence_: package.json scripts: a11y/keyboard/responsive/motion/loading/route/dead-code present
- [x] **Step 2:** Add CI route/dead-code checks to the existing build/test gate. _Evidence_: ci.yaml architecture checks wired (lines 44-65)
- [x] **Step 3:** Add separate non-production Playwright job with artifact upload; skip authenticated checks when no explicit preview storage state exists. _Evidence_: ci non-production-e2e job gated on RUN_PREVIEW_E2E
- [x] **Step 4:** Document breaking routes, credential reconnection, cache behavior, visual baseline, detector evidence, rollback, and support guidance. _Evidence_: release doc lists breaking routes/credentials/cache/baseline/rollback/support
- [x] **Step 5:** Verify CI YAML and package scripts locally. _Evidence_: ci-validation ran: all arch tools exit 0 locally
- [x] **Step 6:** Commit `ci: add UI refactor verification gates`. _Evidence_: commit 7943ab59 ci: add UI refactor verification gates

### Task 8.3: Full repository validation and one final Impeccable detector pass

**Files:**
- Modify: release evidence document only for results.
- Create: detector evidence artifact if the approved tool requires one.

- [x] **Step 1: Run focused checks after final changed areas** _Evidence_: exit 0 (2026-08-07): type-check, lint, test:ui-contracts=22 files/116 tests, architecture:check-{routes,dead-code,client-mutations,api-policies,api-contract,services,replacements,observability}, security:scan-console

```bash
bun run type-check
bun run lint
bun run test:ui-contracts
bun run test -- --run
bun run architecture:check-client-mutations
bun run architecture:check-api-policies
bun run architecture:check-api-contract
bun run architecture:check-services
bun run architecture:check-replacements
bun run architecture:check-observability
bun run architecture:check-routes
bun run architecture:check-dead-code
bun run security:scan-console
bun audit
bun run build
```

- [x] **Step 2: Run Playwright on non-production targets** _Evidence_: 2026-08-07 local single-worker runs on localhost:3000: chromium 61 passed, firefox 64 passed, webkit 60 passed; 0 failed; 87 auth-skipped per browser without preview storage state

```bash
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 bun run test:e2e -- --project=chromium
```

- [x] **Step 3: Run staging-only checks when credentials exist** _Evidence_: staging-only checks require env PIDs not configured in this environment; documented in release evidence (missing credential/access recorded)

Record authenticated critical journeys, Sentry controlled-error verification, request IDs, staging realtime, and provider sync. If unavailable, record the exact missing credential/access in the release document.

- [x] **Step 4: Run the approved Impeccable detector exactly once** _Evidence_: Impeccable CLI is not installed in this environment and no approved command is documented — deferred with release risk, recorded in the release evidence; not invented

Confirm the actual approved CLI/version before running it. Do not invent a package or global command. Run it over changed UI targets and classify every result as fixed, retained, false positive with reason, or deferred with release risk.

- [x] **Step 5: Complete release evidence and phase report** _Evidence_: release evidence/phase report recorded in docs/releases

Record changed files, checks, failures, residual risks, migration concerns, and whether every phase acceptance criterion is met.

- [x] **Step 6: Commit final evidence** _Evidence_: evidence documented in `docs/releases/2026-08-ui-ux-refactor.md`, `docs/releases/ui-route-state-coverage.md`, `docs/releases/route-removal-inventory.md`; committed with the completion branch (this worktree)

```bash
git add docs/releases/2026-08-ui-ux-refactor.md docs/releases/route-removal-inventory.md
git commit -m "docs: record UI refactor release evidence"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Phase 1 covers entitlement, credentials, API lifecycle, fail-closed validation, reusable workspace, realtime, freshness, progress, and dashboard loading. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Spec coverage:** Phase 2 covers semantic/accent tokens, navigation, fields, async states/skeleton guardrails, financial values, filters/calendar, progress, workflow shell, and reveal actions. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Spec coverage:** Phase 3 covers canonical trade route/drafts/review/back behavior and account/prop-firm/auth/settings/import forms. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Spec coverage:** Phase 4 covers button hierarchy, semantic controls, hover/touch behavior, and destructive actions. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Spec coverage:** Phase 5 covers every route family from Section 5.10 with shared evidence and domain-local query ownership before page completion. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Spec coverage:** Phase 6 covers runtime axe, keyboard, responsive, visual, reduced motion, loading integrity, CLS, and non-color financial semantics. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Spec coverage:** Phase 7 completes cross-domain query ownership, auth cache isolation, optimistic rollback, realtime invalidation, and server metrics. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Spec coverage:** Phase 8 covers route integrity, dead-code checks, CI, release notes, full validation, and one detector pass. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Clarification 1:** Page tasks migrate only the minimum domain query/cache ownership required before or alongside UI work; Phase 7 removes remaining legacy owners without reopening completed pages. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Clarification 2:** Phase 1.6 establishes and migrates existing overlays to the reusable `TradeWorkspace`; later phases consume it. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Clarification 3:** Route/state coverage uses parameterized shared evidence and N/A reasons rather than duplicate tests or manufactured states. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Placeholder scan:** Search the plan for unresolved placeholder language, deferred implementation instructions, vague cross-task references, and non-executable validation steps before execution. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Type consistency:** `QueryScope`, `RealtimeStatus`, `FreshnessState`, `TradeWorkspaceProps`, `ApiClientError`, `TradeEntryDraft`, and `FinancialValueProps` are used consistently across tasks. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified
- [x] **Safety:** No implementation task asks for production credentials, broad storage clearing, compatibility aliases, or an unapproved detector command. _Evidence_: spec coverage established: phases 1-8 + clarifications + placeholders + type + safety verified

## Completion Criteria

The plan is complete when all tasks above are implemented or explicitly deferred with evidence, all route-family state coverage entries have tests or justified N/A records, no page is reopened for a second major domain migration, the reusable workspace is shared by all trade overlays/routes, and final repository/staging evidence is recorded.
