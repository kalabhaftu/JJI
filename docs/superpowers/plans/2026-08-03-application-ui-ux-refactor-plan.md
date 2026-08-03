# JJI Application UI/UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden JJI’s correctness, security, state lifecycles, accessibility, responsive behavior, and shared UI contracts, then migrate every customer-facing workflow to the resulting system without duplicating data migrations or temporary workspace implementations.

**Architecture:** Use a correctness-first layered refactor. Phase 1 fixes entitlement, credential persistence, API cancellation/error handling, fail-closed trade validation, and session-safe realtime. Each page migration owns the minimum TanStack Query/cache work required by that domain before or alongside its UI migration; Phase 7 completes cross-domain consolidation and shared invalidation rather than reopening already-migrated pages. Phase 1.6 establishes the reusable route/dialog/sheet trade-workspace foundation consumed by later phases.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Radix/shadcn source components, TanStack Query, SWR during migration only, Zustand for local UI state, Supabase Auth/Realtime, Drizzle, Vitest, Playwright, Sentry.

## Global Constraints

- Preserve JJI’s dark and light themes and user-selectable accent packs.
- Accent packs control brand emphasis only; profit/loss, long/short, bullish/bearish, warning, destructive, permission, error, disabled, and focus semantics remain stable.
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

- [ ] **Step 1: Run the existing focused UI and architecture checks**

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

- [ ] **Step 2: Inventory controlled route references**

Run:

```bash
rg -n --glob '*.{ts,tsx,md,mdx,json}' '/dashboard/prop-firm|/docs/donate|trades/new|notFound\(\)|redirect\(' app components lib hooks tests docs
```

Expected: populate `docs/releases/route-removal-inventory.md` with internal callers, docs, tests, rewrites, and current canonical replacements.

- [ ] **Step 3: Record baseline evidence**

Add command results, known missing credentials, and external-service limitations to `docs/releases/2026-08-ui-ux-refactor.md`.

- [ ] **Step 4: Run focused baseline tests**

Run:

```bash
bun run test -- --run tests/ui tests/components/button.test.tsx tests/security/demo-isolation.test.ts
```

Expected: baseline results are recorded before implementation changes.

- [ ] **Step 5: Commit baseline documentation**

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

- [ ] **Step 1: Enumerate exact routes and boundaries**

Use the approved Section 5.10 matrix and verify against:

```bash
rg --files app | rg '/(page|loading|error|global-error|not-found)\.tsx$'
```

- [ ] **Step 2: Assign shared behavior evidence**

For genuinely shared controls, reference one component test plus the route-family consumers. Do not create duplicate test files solely for each route.

- [ ] **Step 3: Record N/A states with technical reasons**

Examples: a static legal page has no background refresh; a route with no authenticated mutation has no permission-denied mutation state. Each N/A entry must name the concise technical reason and cite existing implementation evidence, route metadata, a shared contract, or a test. Add a new test only when non-applicability is behavioral and could regress.

- [ ] **Step 4: Commit the ledger**

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

- [ ] **Step 1: Write tests proving user and demo scopes produce distinct keys.**
- [ ] **Step 2: Run the focused tests.**

```bash
bun run test -- --run tests/unit/query-keys.test.ts tests/architecture/query-ownership.test.ts
```

Expected RED: the query-key module and ownership registry do not exist.

- [ ] **Step 3: Implement only the scope/key/ownership contracts; do not migrate a domain yet.**
- [ ] **Step 4: Run the same command.**

Expected GREEN: all query-key and ownership contract tests pass.

- [ ] **Step 5: Commit.**

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

- [ ] **Step 1: Write failing capability tests**

Cover active/trialing, free/expired/unpaid, unavailable/permission-denied, missing DTO, and “never constant true.”

- [ ] **Step 2: Run focused tests**

```bash
bun run test -- --run tests/security/entitlement-capabilities.test.ts tests/security/auth-flow-contracts.test.ts
```

Expected: FAIL because current `isPlusUser()` returns `true`.

- [ ] **Step 3: Implement DTO derivation and consumer migration**

Derive the client capability only from server bootstrap data. Treat malformed/missing data as denied and leave endpoint authorization unchanged.

- [ ] **Step 4: Verify**

```bash
bun run test -- --run tests/security/entitlement-capabilities.test.ts tests/security/auth-flow-contracts.test.ts
bun run type-check
bunx eslint context/data-provider.tsx context/data-provider/types.ts server/init-bootstrap.ts lib/services/subscription-guard-service.ts
```

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write storage safety tests**

Assert persisted payloads contain neither token, legacy persisted keys are removed, and logout clears provider state.

- [ ] **Step 2: Run tests to verify failure**

```bash
bun run test -- --run tests/security/tradovate-credential-storage.test.ts tests/unit/tradovate-sync-store.test.ts
```

Expected: FAIL because `partialize` currently includes access/refresh tokens.

- [ ] **Step 3: Remove token state and narrow cleanup**

Remove token fields and token methods. Remove only provider-specific legacy keys; do not call broad `sessionStorage.clear()`.

- [ ] **Step 4: Verify**

```bash
bun run test -- --run tests/security/tradovate-credential-storage.test.ts tests/unit/tradovate-sync-store.test.ts tests/security/storage-paths.test.ts
bun run type-check
```

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Add failing cancellation/error taxonomy tests**
- [ ] **Step 2: Run tests and observe current signal replacement/retry behavior**
- [ ] **Step 3: Compose caller and timeout signals; classify errors and restrict retries**
- [ ] **Step 4: Verify**

```bash
bun run test -- --run tests/unit/api-client.test.ts tests/unit/fetch-with-error.test.ts tests/security/api-client-retry-policy.test.ts
bun run type-check
bunx eslint lib/api/client.ts lib/utils/fetch-with-error.ts lib/query/fetcher.ts
```

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Migrate notifications and add failure tests**
- [ ] **Step 2: Migrate account list/detail and add abort/classification tests**
- [ ] **Step 3: Migrate journal/trade reads and preserve demo isolation**
- [ ] **Step 4: Migrate subscription/settings/sync/import mutation calls**
- [ ] **Step 5: Run focused domain suites**

```bash
bun run test -- --run tests/services/notification-service.test.ts tests/security/demo-isolation.test.ts tests/integration/csv-import.test.ts tests/security/auth-flow-contracts.test.ts
bun run type-check
```

- [ ] **Step 6: Commit each domain migration separately**

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

- [ ] **Step 1: Write tests for valid and every blocking failure**
- [ ] **Step 2: Run tests and confirm the current empty catch fails open**
- [ ] **Step 3: Implement the state machine and persistent inline Retry state**
- [ ] **Step 4: Verify draft preservation and duplicate-submit prevention**
- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write workspace semantic tests and realtime generation tests**
- [ ] **Step 2: Run tests to establish failure**
- [ ] **Step 3: Implement `TradeWorkspace`, `ResponsiveWorkflowShell`, `useUnsavedChanges`, and `useRouteWorkspace` using existing Radix Dialog/Sheet primitives.**

This is the reusable foundation, not a temporary replacement. Existing overlays must consume it in this task; later page tasks must import it rather than creating a competing workspace.

- [ ] **Step 4: Migrate `global-trade-controller.tsx`, `trade-detail-panel.tsx`, `trade-edit-panel.tsx`, and `app/dashboard/table/page.tsx` to the new workspace API.**
- [ ] **Step 5: Verify**

```bash
bun run test -- --run tests/components/trade-workspace.test.tsx tests/components/responsive-workflow-shell.test.tsx tests/unit/unsaved-changes.test.ts tests/unit/route-workspace.test.ts tests/ui/dialog-semantics.test.ts
bun run type-check
```

- [ ] **Step 7: Commit**

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

- [ ] **Step 1: Test reconnect exhaustion, visibility, offline suppression, and stop conditions**
- [ ] **Step 2: Implement bounded visibility-aware degraded refresh**
- [ ] **Step 3: Preserve previous content and expose freshness age/status**
- [ ] **Step 4: Verify**

```bash
bun run test -- --run tests/unit/realtime-degraded-mode.test.ts tests/ui/freshness-state-contract.test.tsx tests/ui/polling-contracts.test.ts
```

- [ ] **Step 5: Commit**

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

- [ ] **Step 1:** Write tests proving an old async connection cannot install after user/session replacement and UPDATE consumers read `change.event`.
- [ ] **Step 2:** Run tests.

```bash
bun run test -- --run tests/unit/database-realtime-generation.test.ts tests/unit/database-realtime-events.test.ts
```

Expected RED: stale channels can install and the account consumer checks `eventType`.

- [ ] **Step 3:** Add generation checks, reconnect cleanup, typed event normalization, and remove the `eventType` cast.
- [ ] **Step 4:** Run the same command.

Expected GREEN: all generation and event tests pass.

- [ ] **Step 5:** Commit `fix: make realtime session generation safe`.

### Task 1.6b: Fix realtime refresh coalescing and stale account responses

**Files:**
- Modify: `hooks/use-data-provider-realtime.ts`
- Modify: `hooks/use-prop-firm-realtime.ts`
- Modify: `app/dashboard/accounts/[id]/page.tsx`
- Modify: `app/dashboard/prop-firm/accounts/[id]/page.tsx`
- Create: `tests/unit/realtime-refresh-coalescing.test.ts`
- Create: `tests/unit/realtime-timer-cleanup.test.ts`
- Create: `tests/unit/stale-response-guards.test.ts`

- [ ] **Step 1:** Write tests for current-ref timer cleanup, one follow-up refresh during bursts, route-change abort, stale-response suppression, and preserving prior data during refresh failure.
- [ ] **Step 2:** Run tests.

Expected RED: timers survive unmount, events are dropped while busy, and old account responses can update state.

- [ ] **Step 3:** Implement current-ref cleanup, pending-refresh coalescing, request sequence guards, and in-context error classification.
- [ ] **Step 4:** Verify.

```bash
bun run test -- --run tests/unit/realtime-refresh-coalescing.test.ts tests/unit/realtime-timer-cleanup.test.ts tests/unit/stale-response-guards.test.ts
```

Expected GREEN: all race and cleanup tests pass.

- [ ] **Step 5:** Commit `fix: prevent stale realtime and account updates`.

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

- [ ] **Step 1: Write semantic value and non-null fallback tests**
- [ ] **Step 2: Implement root value forwarding and page skeleton**
- [ ] **Step 3: Verify**

```bash
bun run test -- --run tests/components/progress-semantics.test.tsx tests/ui/dashboard-route-contracts.test.ts tests/dashboard/mobile-widget-layout.test.ts
```

- [ ] **Step 4: Commit**

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
- Stable financial tokens: `--financial-profit`, `--financial-loss`, `--financial-long`, `--financial-short`, `--financial-bullish`, `--financial-bearish`, `--financial-neutral`.

- [ ] **Step 1: Write token invariance and contrast tests across light/dark and all accent packs**
- [ ] **Step 2: Run tests to observe current accent overrides**
- [ ] **Step 3: Move accent-pack overrides to brand roles only**
- [ ] **Step 4: Update semantic consumers and rewrite `DESIGN.md` to match actual tokens**
- [ ] **Step 5: Verify**

```bash
bun run test -- --run tests/ui/theme-token-contracts.test.ts tests/ui/theme-contrast.test.ts tests/ui/accessibility-theme-contracts.test.ts tests/ui/financial-semantics.test.ts
```

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Write registry tests for authenticated/demo/docs paths, nested active matching, and `/docs/donate`**
- [ ] **Step 2: Implement registry and migrate consumers**
- [ ] **Step 3: Verify no consumer owns duplicate canonical path logic**
- [ ] **Step 4: Commit**

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

- [ ] **Step 1: Write field naming/error/focus and numeric parsing tests**
- [ ] **Step 2: Implement focused wrappers, not one universal field component**
- [ ] **Step 3: Verify**

```bash
bun run test -- --run tests/components/field-primitives.test.tsx tests/components/form-accessibility.test.tsx tests/unit/numeric-input.test.ts tests/ui/semantic-controls.test.ts
```

- [ ] **Step 4: Commit**

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

- [ ] **Step 1: Test each state with last-data preservation rules**
- [ ] **Step 2: Implement shared state rendering and granular skeleton usage**
- [ ] **Step 3: Run skeleton guardrail check**

```bash
rg --line-number "animate-pulse" app/dashboard components | rg -v "components/ui/skeleton.tsx|components/ui/dashboard-skeleton.tsx|app/dashboard/components/charts|widget-registry-lazy"
```

- [ ] **Step 4: Verify**

```bash
bun run test -- --run tests/components/async-states.test.tsx tests/components/skeleton-contracts.test.tsx tests/ui/loading-state-contracts.test.ts
```

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write formatting, semantic state, calendar keyboard, filter URL, and progress tests**
- [ ] **Step 2: Implement primitives and migrate shared filters**
- [ ] **Step 3: Choose one filter model per surface and remove contradictory Apply behavior**
- [ ] **Step 4: Verify**

```bash
bun run test -- --run tests/components/financial-value.test.tsx tests/unit/financial-formatting.test.ts tests/components/date-range-filter.test.tsx tests/components/calendar-accessibility.test.tsx tests/components/progress-semantics.test.tsx tests/components/removable-filter-chip.test.tsx
```

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Test focus, coarse pointer, hover, and icon naming behavior**
- [ ] **Step 2: Implement CSS/component behavior without transparent focused controls**
- [ ] **Step 3: Migrate confirmed hover-only action consumers**
- [ ] **Step 4: Verify**

```bash
bun run test -- --run tests/components/reveal-action.test.tsx tests/components/responsive-workflow-shell.test.tsx tests/ui/semantic-controls.test.ts
```

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write route-state and draft persistence tests**
- [ ] **Step 2: Write form validation/review/focus tests**
- [ ] **Step 3: Add route files and load the existing domain form through shared field primitives**
- [ ] **Step 4: Add account/phase context validation and reuse Phase 1.5 state machine**
- [ ] **Step 5: Add review/save/success/return-to-origin behavior**
- [ ] **Step 6: Make Quick Add, empty states, command palette, and relevant account/table actions resolve to this route**
- [ ] **Step 7: Verify desktop/mobile/browser-back/draft/duplicate-submit behavior**

```bash
bun run test -- --run tests/components/trade-entry-draft.test.ts tests/components/trade-entry-form.test.tsx tests/integration/manual-trade-validation.test.ts tests/integration/api-v1-trades.test.ts
bun run type-check
```

- [ ] **Step 8: Commit**

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

- [ ] **Step 1: Add account query owner and tests**
- [ ] **Step 2: Migrate live account forms/detail to field/workflow primitives**
- [ ] **Step 3: Add prop-firm query owner and migrate account/rule forms**
- [ ] **Step 4: Migrate payout queries/forms with explicit financial states**
- [ ] **Step 5: Verify keyboard/mobile/error preservation and shared route-family states**

```bash
bun run test -- --run tests/components/account-form.test.tsx tests/components/prop-firm-form.test.tsx tests/components/payout-form.test.tsx tests/prop-firm tests/ui/account-deletion-contracts.test.ts
bun run type-check
```

- [ ] **Step 6: Commit**

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

- [ ] **Step 1: Add persistent OTP error/focus/resend tests and implementation**
- [ ] **Step 2: Migrate settings section-local saves and responsive tab orientation**
- [ ] **Step 3: Migrate feedback/import/upload loading, partial, offline, and recovery states**
- [ ] **Step 4: Verify**

```bash
bun run test -- --run tests/components/auth-form.test.tsx tests/components/otp-recovery.test.tsx tests/components/settings-form.test.tsx tests/components/import-form.test.tsx tests/security/auth-flow-contracts.test.ts tests/security/import-job-state.test.ts tests/integration/csv-import.test.ts
```

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write variant/loading/disabled-reason tests**
- [ ] **Step 2: Migrate existing variants to explicit semantics without an indefinite compatibility alias**
- [ ] **Step 3: Replace vague labels with outcomes**
- [ ] **Step 4: Verify**

```bash
bun run test -- --run tests/components/button.test.tsx tests/components/button-hierarchy.test.tsx tests/components/button-loading.test.tsx
```

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: Write failing semantic-control assertions for filter removal and focus visibility**
- [ ] **Step 2: Replace clickable SVGs with semantic buttons/chips**
- [ ] **Step 3: Migrate hover-only actions to `RevealAction` or always-visible actions**
- [ ] **Step 4: Verify keyboard/touch behavior**

```bash
bun run test -- --run tests/ui/semantic-controls.test.ts tests/components/reveal-action.test.tsx tests/components/removable-filter-chip.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/data/components/data-management/trade-table.tsx app/dashboard/accounts app/dashboard/journal app/dashboard/backtesting app/dashboard/components/import components/template-selector.tsx tests/ui/semantic-controls.test.ts
git commit -m "fix: make contextual controls semantic and touch safe"
```

### Task 4.3: Standardize destructive and bulk actions

**Files:**
- Modify: `components/ui/states.tsx`, existing alert-dialog/confirmation consumers, trade table bulk deletion, account/data deletion, payout/phase actions.
- Modify: `tests/ui/account-deletion-contracts.test.ts`
- Create only one shared destructive-action contract test if existing coverage cannot prove all shared consumers.

- [ ] **Step 1: Inventory destructive triggers and consequences**
- [ ] **Step 2: Ensure named confirmation, explicit Cancel, pending state, and recovery**
- [ ] **Step 3: Verify bulk trade deletion and account/data deletion**

```bash
bun run test -- --run tests/ui/account-deletion-contracts.test.ts tests/ui/semantic-controls.test.ts
```

- [ ] **Step 4: Commit**

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

- [ ] **Step 1:** Write dashboard initial/local/refresh/partial tests.
- [ ] **Step 2:** Migrate minimum widget query ownership and invalidation.
- [ ] **Step 3:** Implement page and widget states.
- [ ] **Step 4:** Verify with Vitest and focused Playwright.
- [ ] **Step 5:** Commit `refactor: migrate dashboard overview states`.

### Task 5.2: Trades and trade workspace

**Files:**
- Modify: `app/dashboard/table/page.tsx`, table loading/skeletons, trade table/detail/edit/replay components.
- Domain query work: finish trades query ownership, optimistic rollback, and targeted table/report invalidation before page completion.
- Test: one route-family suite `tests/e2e/phase-5-trades.e2e.test.ts`; extend existing trade/API/chunk tests.

**Exact route coverage:** `/dashboard/table`, `/dashboard/table/loading`, and URL-backed detail/edit/replay states rendered by that route.

**Acceptance:** sorting/selection/aria-sort, bulk confirmation, local overflow, empty/no-results/stale/offline/error, workspace focus/back, and mobile priority view.

- [ ] **Step 1:** Write table/workspace tests.
- [ ] **Step 2:** Complete trades query owner and targeted invalidation.
- [ ] **Step 3:** Implement table and workspace states.
- [ ] **Step 4:** Verify.
- [ ] **Step 5:** Commit `refactor: migrate trades workflow`.

### Task 5.3: Reports and filters

**Files:**
- Modify: `app/dashboard/reports/**`, report filters/navigation/charts/statements/sharing.
- Domain query work: migrate report stats query ownership and preserve server aggregate contract.
- Test: one `tests/e2e/phase-5-reports.e2e.test.ts` plus shared chart/filter contracts.

**Exact route coverage:** `/dashboard/reports`, `/dashboard/reports/loading`.

**Acceptance:** scope visible, URL/browser filter state, chart units/legends/text equivalent, partial/stale/offline/error, share visibility/expiry/revocation, mobile.

- [ ] **Step 1:** Write report/filter/chart state tests.
- [ ] **Step 2:** Migrate report query owner alongside page.
- [ ] **Step 3:** Implement and verify.
- [ ] **Step 4:** Commit `refactor: migrate reports and filter workflow`.

### Task 5.4: Journal

**Files:**
- Modify: `app/dashboard/journal/**`, `hooks/use-journal.ts`, journal components.
- Domain query work: migrate journal query/mutation owner before removing SWR usage for this page.
- Test: one `tests/e2e/phase-5-journal.e2e.test.ts` plus shared journal state/keyboard contracts.

**Exact route coverage:** `/dashboard/journal`, `/dashboard/journal/loading`.

**Acceptance:** note loading/saving/autosave/offline/error, draft preservation, trade-card actions, empty/no-results, refresh preservation, mobile/keyboard.

- [ ] **Step 1:** Write state and keyboard tests.
- [ ] **Step 2:** Migrate journal query owner.
- [ ] **Step 3:** Implement and verify.
- [ ] **Step 4:** Commit `refactor: migrate journal workflow`.

### Task 5.5: Live accounts

**Files:**
- Modify: `app/dashboard/accounts/**`, account dialogs/components, `hooks/use-accounts.ts`, account detail hooks.
- Domain query work: accounts query owner, account-detail cancellation, freshness, and targeted invalidation before page completion.
- Test: one account route-family e2e suite plus existing critical journeys.

**Exact route coverage:** `/dashboard/accounts`, `/dashboard/accounts/loading`, `/dashboard/accounts/[id]`, `/dashboard/accounts/[id]/loading`.

**Acceptance:** create/edit/delete, transient vs 404/403, stale response protection, realtime refresh preservation, mobile forms, keyboard.

- [ ] **Step 1:** Write account state/form tests.
- [ ] **Step 2:** Complete account query ownership.
- [ ] **Step 3:** Implement and verify.
- [ ] **Step 4:** Commit `refactor: migrate live account workflow`.

### Task 5.6: Prop-firm accounts, trades, settings, and payouts

**Files:**
- Modify: every exact prop-firm page/loading file listed in Section 5.10 of the approved specification, plus `app/dashboard/prop-firm/accounts/[id]/components/trade-row.tsx`, `metric-card.tsx`, `history-tab.tsx`, account loading skeletons, and global payout loading skeletons. Resolve these paths into the route-state ledger before editing.
- Domain query work: prop-firm account/trade/payout query owners, realtime mappings, and mutation invalidation before page completion.
- Test: one `tests/e2e/phase-5-prop-firm.e2e.test.ts` plus shared prop-firm contracts; do not create one duplicate suite per nested route.

**Exact route coverage:** `/dashboard/prop-firm`, `/dashboard/prop-firm/accounts`, `/dashboard/prop-firm/accounts/[id]`, its loading boundary, account trades and loading, account-specific trade entry and loading, account settings and loading, account payouts and loading, payout request and loading, global payouts and loading, and global payout detail and loading.

**Acceptance:** route disposition, phase/rule semantics, trade validation/draft retention, settings save/error, payout states, permissions, realtime, mobile/keyboard.

- [ ] **Step 1:** Update controlled consumers and record prop-firm alias evidence in `docs/releases/route-removal-inventory.md`; Task 8.1 exclusively owns gate completion, approval classification, and actual route removal.
- [ ] **Step 2:** Write shared prop-firm route/state tests.
- [ ] **Step 3:** Migrate query ownership and implement pages.
- [ ] **Step 4:** Verify all nested routes using the shared fixture matrix.
- [ ] **Step 5:** Commit `refactor: migrate prop firm workflows`.

### Task 5.7: Import and data management

**Files:**
- Modify: `app/dashboard/import/page.tsx`, `app/dashboard/data/**`, import/upload/export components.
- Domain query work: import job/export status owner and invalidation; preserve local upload state.
- Test: one `tests/e2e/phase-5-import-data.e2e.test.ts` plus import/export/progress contracts.

**Exact route coverage:** `/dashboard/import`, `/dashboard/data`, `/dashboard/data/loading`.

**Acceptance:** validation, determinate progress, imported/duplicate/skipped/failed counts, queued/processing/ready/expired/failed export, offline/retry, local loading.

- [ ] **Step 1:** Write import state tests.
- [ ] **Step 2:** Migrate import/export status ownership.
- [ ] **Step 3:** Implement and verify.
- [ ] **Step 4:** Commit `refactor: migrate import and data workflows`.

### Task 5.8: Playbook

**Files:** `app/dashboard/playbook/**`, playbook query/mutation hooks.
- Domain query work: migrate playbook/model query owner before page completion.
- Test: one route-family e2e suite and shared state/action contracts.

**Exact route coverage:** `/dashboard/playbook`, `/dashboard/playbook/loading`. Test file: `tests/e2e/phase-5-playbook.e2e.test.ts`.

**Acceptance:** first-use empty, no-results, stale/offline/permission/error, create/edit/delete, metric definitions, mobile/focus.

- [ ] **Step 1:** Write tests.
- [ ] **Step 2:** Migrate query owner and implement.
- [ ] **Step 3:** Verify and commit `refactor: migrate playbook workflow`.

### Task 5.9: Goals

**Files:** `app/dashboard/goals/**`, goal query/mutation hooks.
- Domain query work: migrate goals query owner alongside page.
- Test: one route-family e2e suite and progress/state contracts.

**Exact route coverage:** `/dashboard/goals`, `/dashboard/goals/loading`. Test file: `tests/e2e/phase-5-goals.e2e.test.ts`.

**Acceptance:** CRUD, progress semantics, empty/no-results/success/disabled/offline/stale/permission/partial/blocking error, mobile/keyboard.

- [ ] **Step 1:** Write tests.
- [ ] **Step 2:** Migrate query owner and implement.
- [ ] **Step 3:** Verify and commit `refactor: migrate goals workflow`.

### Task 5.10: Backtesting

**Files:** `app/dashboard/backtesting/**`, backtesting query/mutation hooks.
- Domain query work: migrate backtesting job/result owner with cancellation and retry semantics.
- Test: one route-family e2e suite plus form/state contracts.

**Exact route coverage:** `/dashboard/backtesting`, `/dashboard/backtesting/loading`. Test file: `tests/e2e/phase-5-backtesting.e2e.test.ts`.

**Acceptance:** validation, queued/running/progress/result, cancellation/retry, previous-result preservation, empty/error/offline/permission, mobile.

- [ ] **Step 1:** Write tests.
- [ ] **Step 2:** Migrate query owner and implement.
- [ ] **Step 3:** Verify and commit `refactor: migrate backtesting workflow`.

### Task 5.11: AI workspace

**Files:** `app/dashboard/ai/**`, AI service/client hooks.
- Domain query work: keep conversation state local to the workspace, migrate server metadata/review data to one owner, and preserve consent boundary.
- Test: one AI route-family e2e suite plus existing AI consent/workspace contracts.

**Exact route coverage:** `/dashboard/ai`. Test file: `tests/e2e/phase-5-ai.e2e.test.ts`.

**Acceptance:** consent, streaming/generating/cancelled/rate-limited/unavailable/error, stable messages, mobile/keyboard.

- [ ] **Step 1:** Write state tests.
- [ ] **Step 2:** Migrate only server metadata ownership required by the page.
- [ ] **Step 3:** Implement and verify.
- [ ] **Step 4:** Commit `refactor: migrate AI workspace states`.

### Task 5.12: Settings

**Files:** `app/dashboard/settings/**`, settings hooks and panels.
- Domain query work: migrate settings/preferences mutation owner needed by each section before completion.
- Test: one settings e2e suite plus tabs/state contracts.

**Exact route coverage:** `/dashboard/settings`, `/dashboard/settings/loading`. Test file: `tests/e2e/phase-5-settings.e2e.test.ts`.

**Acceptance:** responsive orientation, section-local save, unsaved/autosave, integration states, destructive actions, stale/offline/permission/error, mobile/keyboard.

- [ ] **Step 1:** Write tests.
- [ ] **Step 2:** Migrate settings owner and implement.
- [ ] **Step 3:** Verify and commit `refactor: migrate settings workflow`.

### Task 5.13: Authentication and subscription

**Files:** login/app-launch/subscribe route clients and boundaries, auth form.
- Domain query work: use canonical API lifecycle from Phase 1; do not introduce a second status polling owner.
- Test: one auth/subscription e2e suite and shared contracts.

**Exact route coverage:** `/login`, `/app-launch`, `/subscribe`, `/subscribe/loading`, `/subscribe/error`, `/subscribe/status`, `/subscribe/success`, `/subscribe/cancelled`. Test file: `tests/e2e/phase-5-auth-subscription.e2e.test.ts`.

**Acceptance:** OTP persistent error/focus/resend, subscription verification/delay/timeout/retry/cancel/success/blocking error, mobile/keyboard.

- [ ] **Step 1:** Write tests.
- [ ] **Step 2:** Implement and verify.
- [ ] **Step 3:** Commit `refactor: migrate authentication and subscription states`.

### Task 5.14: Public, legal, support, documentation, and global boundaries

**Files:** all public/docs/global boundary routes in the approved matrix, shared public/docs shells, docs navigation.
- Domain query work: only migrate actual forms/search state; static pages remain server/static and do not receive manufactured async states.
- Test: one public/docs/boundaries e2e suite and shared route/link/metadata contracts.

**Exact route coverage:** all exact public and docs routes in Sections 5.1 and 5.6 of the approved spec, plus `app/global-error.tsx`, `app/not-found.tsx`, `app/[...not-found]/page.tsx`, dashboard/docs/subscribe/reports error boundaries. Test file: `tests/e2e/phase-5-public-docs-boundaries.e2e.test.ts` with parameterized route fixtures.

**Acceptance:** shared shell, docs link correctness, search navigation, metadata, error/404 retry/back/home, public form states, mobile/keyboard.

- [ ] **Step 1:** Write route/link/boundary tests.
- [ ] **Step 2:** Consolidate privacy onto public shell and fix docs donation path.
- [ ] **Step 3:** Verify the catch-all boundary is covered by the route ledger; the actual removal is owned exclusively by Task 8.1 after the route-removal evidence gate.
- [ ] **Step 4:** Verify every exact docs path via shared parameterized test data.
- [ ] **Step 5:** Commit `refactor: unify public docs and boundary surfaces`.

### Task 5.15: Shared reports

**Files:** `app/reports/shared/[slug]/**`, shared report client, new local loading/error boundaries.
- Domain query work: validate snapshot and view-count mutation through canonical API handling; no authenticated query cache.
- Test: one shared-report e2e suite plus snapshot/state contracts.

**Exact route coverage:** `/reports/shared/[slug]`, `/reports/error`, and new shared-report-local loading/error boundaries. Test file: `tests/e2e/phase-5-shared-report.e2e.test.ts`.

**Acceptance:** valid/expired/revoked/malformed/unavailable/loading/error, typed snapshot, view-count outcome, mobile/keyboard/visual.

- [ ] **Step 1:** Write snapshot and state tests.
- [ ] **Step 2:** Implement local boundaries and typed state.
- [ ] **Step 3:** Verify and commit `refactor: harden shared report states`.

### Task 5.16: Demo routes

**Files:** every exact `/demo` route wrapper listed in Section 5.5 of the approved specification, `app/demo/layout.tsx`, `lib/public-surface-routing.ts`, `hooks/use-public-surface-routing.ts`, and `lib/demo/mock-data.ts`.
- Domain query work: ensure each migrated domain key includes demo surface and no production API call is reached.
- Test: one parameterized demo route-family e2e suite plus existing demo isolation tests.

**Exact route coverage:** every exact route listed in Section 5.5 of the approved spec. Test file: `tests/e2e/phase-5-demo.e2e.test.ts`.

**Acceptance:** no production escape, fixture states, unsupported-action copy, cache isolation, mobile/keyboard.

- [ ] **Step 1:** Write parameterized route tests for all demo routes.
- [ ] **Step 2:** Fix remaining direct production links/interceptors.
- [ ] **Step 3:** Verify and commit `refactor: complete demo surface migration`.

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

- [ ] **Step 1:** Add direct dependency only after checking package manifest and lockfile.
- [ ] **Step 2:** Create fixtures that refuse production hosts and skip authenticated cases without explicit storage state.
- [ ] **Step 3:** Add one axe test per selected route family, parameterized where implementation is shared.
- [ ] **Step 4:** Add keyboard tests for login, trade entry, filters/calendar, workspace, account form, payout, and deletion.
- [ ] **Step 5:** Verify public/demo tests locally.

```bash
bun run test:e2e -- --project=chromium tests/e2e/accessibility.e2e.test.ts tests/e2e/keyboard-workflows.e2e.test.ts
```

- [ ] **Step 6:** Commit `test: add runtime accessibility and keyboard coverage`.

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

- [ ] **Step 1:** Add parameterized viewport/theme/accent/state scenarios; do not duplicate identical tests for every route wrapper.
- [ ] **Step 2:** Add local overflow, touch-target, sticky-focus, dynamic viewport, and skeleton-preservation assertions.
- [ ] **Step 3:** Add reduced-motion assertions for focus, progress, announcements, and preserved content.
- [ ] **Step 3a:** Add a 200% zoom/text-scale scenario for each route family and verify main content, focused controls, and sticky actions remain visible.
- [ ] **Step 4:** Run tests without updating snapshots.

```bash
bun run test:e2e -- --project=chromium tests/e2e/visual-regression.e2e.test.ts tests/e2e/reduced-motion.e2e.test.ts tests/e2e/loading-integrity.e2e.test.ts
```

- [ ] **Step 5:** Review and update snapshots deliberately, separately from implementation.
- [ ] **Step 5a:** After Chromium is stable, run accessibility and keyboard-critical scenarios in Firefox and WebKit.

```bash
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 bun run test:e2e -- --project=firefox tests/e2e/accessibility.e2e.test.ts tests/e2e/keyboard-workflows.e2e.test.ts
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 bun run test:e2e -- --project=webkit tests/e2e/accessibility.e2e.test.ts tests/e2e/keyboard-workflows.e2e.test.ts
```

Expected GREEN: all supported public/demo scenarios pass; authenticated scenarios pass when explicit preview storage state and fixture IDs are supplied.
- [ ] **Step 6:** Commit `test: add responsive motion and loading verification`.

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

- [ ] **Step 1:** Inventory domains already migrated by page tasks and remaining legacy owners.
- [ ] **Step 2:** Add registry tests for user/demo separation and one owner per completed domain.
- [ ] **Step 3:** Migrate remaining domains without reopening completed page UI work; record one exact hook, one key factory, one mutation owner, one invalidation mapping, and the removed legacy owner for each domain.
- [ ] **Step 4:** Remove obsolete SWR/module-cache owners only after domain tests pass.
- [ ] **Step 5:** Verify.

```bash
bun run test -- --run tests/unit/query-keys.test.ts tests/security/query-cache-isolation.test.ts tests/architecture/query-ownership.test.ts tests/security/demo-isolation.test.ts
```

- [ ] **Step 6:** Commit one per remaining domain, e.g. `refactor: complete TanStack Query ownership`.

### Task 7.2: Auth-transition cache coordinator

**Files:**
- Modify: `context/auth-provider.tsx`, `lib/query/query-provider.tsx`, `context/tags-provider.tsx`, `context/template-provider.tsx`, `store/user-store.ts`, and `store/trades-store.ts`.
- Create: `tests/unit/auth-transition-cache-coordinator.test.ts`
- Create: `tests/security/user-switch-cache-isolation.test.ts`

**Interfaces:**

```ts
export interface AuthTransitionCacheCoordinator { beginTransition(nextUserId: string | null): void; clearPrivateQueryData(): Promise<void>; clearPrivateSWRData(): Promise<void>; clearPrivateModuleCaches(): void; clearProviderIntegrationState(): void; completeTransition(userId: string | null): void }
```

- [ ] **Step 1:** Test user A to user B, logout, demo/auth transitions, and scoped preferences.
- [ ] **Step 2:** Implement coordinator and invoke it for auth transitions.
- [ ] **Step 3:** Verify cache isolation.
- [ ] **Step 4:** Commit `fix: isolate private caches across auth transitions`.

### Task 7.3: Rollback-safe optimistic trade mutations

**Files:**
- Modify: `hooks/use-data-provider-trade-mutations.ts`, `hooks/use-filtered-trades.ts`, and `context/data-provider.tsx`.
- Create: `tests/unit/optimistic-trade-rollback.test.ts`
- Modify: `tests/integration/api-v1-trades.test.ts`

**Interfaces:**

```ts
export interface TradeMutationContext { snapshots: Array<{ queryKey: readonly unknown[]; data: unknown }> }
```

- [ ] **Step 1:** Test snapshot/rollback for filtered, calendar, widget, and report-derived data.
- [ ] **Step 2:** Implement cancel/snapshot/patch/rollback/reconcile/targeted-settle lifecycle.
- [ ] **Step 3:** Keep destructive/phase-sensitive operations pessimistic.
- [ ] **Step 4:** Verify and commit `fix: add rollback-safe trade mutations`.

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

- [ ] **Step 1:** Map Trade, Account, Notification, Synchronization, PhaseAccount, MasterAccount, and Payout events to only affected domains.
- [ ] **Step 2:** Test no broad invalidation and correct user/surface scope.
- [ ] **Step 3:** Implement and verify.
- [ ] **Step 4:** Commit `refactor: target realtime query invalidation`.

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

- [ ] **Step 1:** Verify aggregate formulas against existing calculation tests.
- [ ] **Step 2:** Add bounded aggregate endpoint contract tests.
- [ ] **Step 3:** Remove 100,000-row metrics transfer from client startup.
- [ ] **Step 4:** Verify partial aggregate failure and calculation scope display.
- [ ] **Step 5:** Commit `perf: move dashboard metrics to server aggregates`.

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

- [ ] **Step 1:** Test route scanner against `/docs/donate`, prop-firm aliases, canonical trade route, and dynamic paths.
- [ ] **Step 2:** Implement route scanner and dead-code/placeholder scanner with allowlists for legitimate editor placeholders/fixtures.
- [ ] **Step 3:** Complete route-removal evidence gate.
- [ ] **Step 4:** Remove unreachable catch-all markup and only approved obsolete paths. This is the exclusive owner of actual catch-all, prop-firm alias, obsolete modal-entry, and account-specific trade-entry route removal.
- [ ] **Step 5:** Verify.

```bash
bun run architecture:check-routes
bun run architecture:check-dead-code
bun run test -- --run tests/ui/docs-link-scan.test.ts
```

- [ ] **Step 6:** Commit `chore: add route and dead-code integrity checks`.

### Task 8.2: CI and release documentation

**Files:**
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/releases/2026-08-ui-ux-refactor.md`
- Modify: `CHANGELOG.md`, `docs/index.md`, and `README.md` only when release instructions/routes change.

- [ ] **Step 1:** Add scripts for focused accessibility, keyboard, responsive, motion, loading, route, and dead-code checks.
- [ ] **Step 2:** Add CI route/dead-code checks to the existing build/test gate.
- [ ] **Step 3:** Add separate non-production Playwright job with artifact upload; skip authenticated checks when no explicit preview storage state exists.
- [ ] **Step 4:** Document breaking routes, credential reconnection, cache behavior, visual baseline, detector evidence, rollback, and support guidance.
- [ ] **Step 5:** Verify CI YAML and package scripts locally.
- [ ] **Step 6:** Commit `ci: add UI refactor verification gates`.

### Task 8.3: Full repository validation and one final Impeccable detector pass

**Files:**
- Modify: release evidence document only for results.
- Create: detector evidence artifact if the approved tool requires one.

- [ ] **Step 1: Run focused checks after final changed areas**

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

- [ ] **Step 2: Run Playwright on non-production targets**

```bash
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 bun run test:e2e -- --project=chromium
```

- [ ] **Step 3: Run staging-only checks when credentials exist**

Record authenticated critical journeys, Sentry controlled-error verification, request IDs, staging realtime, and provider sync. If unavailable, record the exact missing credential/access in the release document.

- [ ] **Step 4: Run the approved Impeccable detector exactly once**

Confirm the actual approved CLI/version before running it. Do not invent a package or global command. Run it over changed UI targets and classify every result as fixed, retained, false positive with reason, or deferred with release risk.

- [ ] **Step 5: Complete release evidence and phase report**

Record changed files, checks, failures, residual risks, migration concerns, and whether every phase acceptance criterion is met.

- [ ] **Step 6: Commit final evidence**

```bash
git add docs/releases/2026-08-ui-ux-refactor.md docs/releases/route-removal-inventory.md
git commit -m "docs: record UI refactor release evidence"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Phase 1 covers entitlement, credentials, API lifecycle, fail-closed validation, reusable workspace, realtime, freshness, progress, and dashboard loading.
- [ ] **Spec coverage:** Phase 2 covers semantic/accent tokens, navigation, fields, async states/skeleton guardrails, financial values, filters/calendar, progress, workflow shell, and reveal actions.
- [ ] **Spec coverage:** Phase 3 covers canonical trade route/drafts/review/back behavior and account/prop-firm/auth/settings/import forms.
- [ ] **Spec coverage:** Phase 4 covers button hierarchy, semantic controls, hover/touch behavior, and destructive actions.
- [ ] **Spec coverage:** Phase 5 covers every route family from Section 5.10 with shared evidence and domain-local query ownership before page completion.
- [ ] **Spec coverage:** Phase 6 covers runtime axe, keyboard, responsive, visual, reduced motion, loading integrity, CLS, and non-color financial semantics.
- [ ] **Spec coverage:** Phase 7 completes cross-domain query ownership, auth cache isolation, optimistic rollback, realtime invalidation, and server metrics.
- [ ] **Spec coverage:** Phase 8 covers route integrity, dead-code checks, CI, release notes, full validation, and one detector pass.
- [ ] **Clarification 1:** Page tasks migrate only the minimum domain query/cache ownership required before or alongside UI work; Phase 7 removes remaining legacy owners without reopening completed pages.
- [ ] **Clarification 2:** Phase 1.6 establishes and migrates existing overlays to the reusable `TradeWorkspace`; later phases consume it.
- [ ] **Clarification 3:** Route/state coverage uses parameterized shared evidence and N/A reasons rather than duplicate tests or manufactured states.
- [ ] **Placeholder scan:** Search the plan for unresolved placeholder language, deferred implementation instructions, vague cross-task references, and non-executable validation steps before execution.
- [ ] **Type consistency:** `QueryScope`, `RealtimeStatus`, `FreshnessState`, `TradeWorkspaceProps`, `ApiClientError`, `TradeEntryDraft`, and `FinancialValueProps` are used consistently across tasks.
- [ ] **Safety:** No implementation task asks for production credentials, broad storage clearing, compatibility aliases, or an unapproved detector command.

## Completion Criteria

The plan is complete when all tasks above are implemented or explicitly deferred with evidence, all route-family state coverage entries have tests or justified N/A records, no page is reopened for a second major domain migration, the reusable workspace is shared by all trade overlays/routes, and final repository/staging evidence is recorded.
