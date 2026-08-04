# Phase 1 Security Batch Report

Date: 2026-08-03
Branch: `refactor/jji-ui-ux`

## Files Changed

- `context/data-provider.tsx`
- `context/data-provider/types.ts`
- `context/auth-provider.tsx`
- `context/tradovate-sync-context.tsx`
- `server/init-bootstrap.ts`
- `lib/services/subscription-guard-service.ts`
- `store/tradovate-sync-store.ts`
- `lib/api/client.ts`
- `lib/api/signals.ts`
- `lib/utils/fetch-with-error.ts`
- `lib/validation/phase-validation.ts`
- `app/dashboard/components/import/manual-trade-entry/manual-trade-form.tsx`
- Focused security, unit, and integration tests under `tests/security`, `tests/unit`, and `tests/integration`

## TDD Evidence

The focused tests were created before production changes and run RED:

```text
bun run test -- --run tests/security/entitlement-capabilities.test.ts
FAIL: deriveEntitlementCapability is not a function (7 failed)

bun run test -- --run tests/security/tradovate-credential-storage.test.ts
FAIL: persistedTradovateState and clearTradovateLegacyStorage are not functions (plus test setup failure)

bun run test -- --run tests/unit/fetch-with-error.test.ts tests/security/api-client-retry-policy.test.ts
FAIL: missing lib/api/signals and isRetryAllowed

bun run test -- --run tests/unit/phase-validation-state-machine.test.ts
FAIL: missing lib/validation/phase-validation
```

The final focused suite ran GREEN with 12 test files and 58 tests passing.

## Implementation

- Added a typed server-derived entitlement capability. Missing and malformed bootstrap entitlement data denies access presentation. `isPlusUser()` now derives from the capability and does not authorize server requests.
- Removed Tradovate access and refresh token state and token methods from the Zustand store. Persistence contains only session metadata. Legacy cleanup removes only provider-specific session keys; unrelated storage is not cleared.
- Added caller/timeout abort composition, cancellation versus timeout classification, request ID preservation, HTTP error taxonomy, offline classification, and safe-read-only retry policy. Unsafe mutations are not retried by default.
- Added phase validation classification and changed manual trade save to fail closed for all non-valid responses and transport failures. Entered data remains in the form, an inline retry action is shown, and duplicate submission is guarded by both UI state and an in-flight ref.

## Verification

Focused RED commands and outcomes are listed above.

Focused GREEN command:

```bash
bun run test -- --run tests/security/entitlement-capabilities.test.ts tests/security/auth-flow-contracts.test.ts tests/security/tradovate-credential-storage.test.ts tests/unit/tradovate-sync-store.test.ts tests/security/storage-paths.test.ts tests/unit/api-client.test.ts tests/unit/fetch-with-error.test.ts tests/security/api-client-retry-policy.test.ts tests/unit/phase-validation-state-machine.test.ts tests/security/phase-validation-fail-closed.test.ts tests/integration/api-v1-trades.test.ts tests/integration/csv-import.test.ts
```

Result: 12 files passed, 58 tests passed.

Type check:

```bash
bun run type-check
```

Result: passed with exit code 0.

Focused ESLint:

```bash
bunx eslint context/data-provider.tsx context/data-provider/types.ts context/auth-provider.tsx context/tradovate-sync-context.tsx server/init-bootstrap.ts lib/services/subscription-guard-service.ts store/tradovate-sync-store.ts lib/api/client.ts lib/api/signals.ts lib/utils/fetch-with-error.ts lib/validation/phase-validation.ts app/dashboard/components/import/manual-trade-entry/manual-trade-form.tsx tests/security/entitlement-capabilities.test.ts tests/security/tradovate-credential-storage.test.ts tests/security/api-client-retry-policy.test.ts tests/unit/fetch-with-error.test.ts tests/unit/phase-validation-state-machine.test.ts tests/security/phase-validation-fail-closed.test.ts tests/unit/tradovate-sync-store.test.ts
```

Result: no errors; one existing-style warning remains for the unnecessary `locale` dependency in `context/data-provider.tsx:532`.

Related suites included: auth-flow contracts, storage paths, API client, API trades, and CSV/import contracts. No unrelated full-suite status is claimed.

## Remaining Concerns

- The repository still contains unrelated broad `sessionStorage.clear()` calls in `lib/cache/persistent-cache.ts`, `app/dashboard/settings/page.tsx`, `app/subscribe/subscribe-client.tsx`, and `app/dashboard/components/navbar.tsx`. They were not changed because the requested batch was specifically Tradovate credential cleanup and the task prohibited broad storage clearing.
- The existing `Synchronization` server integration may expose provider synchronization metadata such as token expiry to client consumers; direct provider credentials remain server-owned, but a separate API response audit may be appropriate in a later scoped task.
- The focused ESLint warning is non-blocking but should be cleaned up in the owning data-provider task.
- Full repository tests, full lint, and production build were not run; no unrelated full-suite status is claimed.

## Commit Hashes

- `0d269aea` `fix: harden phase 1 security and request handling`

The report-only commit hash is returned in the completion response because a commit cannot contain its own hash.

## Review Follow-up

Review findings were verified against `0d269aea` and corrected with focused TDD.

RED evidence:

```text
bun run test -- --run tests/security/tradovate-credential-migration.test.ts
FAIL: legacy hydration behavior was absent and the first test harness exposed invalid environment storage.

bun run test -- --run tests/security/fetch-with-error-retry-policy.test.ts
FAIL: POST 500/408/429 responses retried until the tests timed out.

bun run test -- --run tests/unit/api-error-contract.test.ts tests/unit/query-fetcher-contract.test.ts
FAIL: lib/api/errors.ts was absent and query fetchers still called fetchWithError.

bun run test -- --run tests/ui/manual-trade-validation.test.tsx
FAIL: behavioral workflow and inline recovery component did not exist.
```

GREEN verification:

```text
bun run test -- --run tests/security/tradovate-credential-migration.test.ts tests/security/fetch-with-error-retry-policy.test.ts tests/unit/api-error-contract.test.ts tests/unit/query-fetcher-contract.test.ts tests/ui/manual-trade-validation.test.tsx tests/unit/api-client.test.ts tests/unit/fetch-with-error.test.ts tests/security/api-client-retry-policy.test.ts tests/security/entitlement-capabilities.test.ts tests/security/auth-flow-contracts.test.ts tests/security/storage-paths.test.ts tests/unit/tradovate-sync-store.test.ts tests/unit/phase-validation-state-machine.test.ts tests/integration/api-v1-trades.test.ts tests/integration/csv-import.test.ts
Result: 15 files passed, 67 tests passed after removing the obsolete source-text phase test.

bun run type-check
Result: passed.

bunx eslint app/api/v1/prop-firm/accounts/validate-trade/route.ts app/dashboard/components/import/manual-trade-entry/manual-trade-form.tsx app/dashboard/components/import/manual-trade-entry/phase-validation-workflow.tsx store/tradovate-sync-store.ts lib/api/client.ts lib/api/errors.ts lib/api/signals.ts lib/utils/fetch-with-error.ts lib/query/fetcher.ts tests/security/tradovate-credential-migration.test.ts tests/security/fetch-with-error-retry-policy.test.ts tests/unit/api-error-contract.test.ts tests/unit/query-fetcher-contract.test.ts tests/ui/manual-trade-validation.test.tsx tests/unit/api-client.test.ts
Result: passed with no lint findings.

git diff --check
Result: passed.
```

The endpoint review confirmed the missing-phase-ID branch was unreachable because lookup required equality with `phaseId`; the dead branch was removed. Missing IDs remain excluded from selectable bootstrap accounts and an arbitrary account number correctly returns not found.

## Final Validation Follow-up

- Runtime inventory confirmed `manual-trade-form-card.tsx` is live through `config/platforms-card.tsx` and `import-trades-card.tsx`; `manual-trade-form.tsx` is also live through `config/platforms.tsx` and `import-button.tsx`. Neither was removed.
- Removed the disconnected `phase-validation-workflow.tsx` helper and its test-only component test.
- Added `manual-trade-submission.ts` beneath the live card workflow. Behavioral tests mock the real `importTradesThroughApi` module and prove offline, timeout, malformed, 403, and 5xx validation never import; Retry reuses preserved values and imports only after valid validation; duplicate submissions are ignored while validation is active.
- Added one shared inline retryable validation-error component consumed by both active manual-entry forms.

RED:

```text
bun run test -- --run tests/ui/manual-trade-submission.test.ts
FAIL: production manual-trade-submission module did not exist.
```

GREEN:

```text
bun run test -- --run tests/ui/manual-trade-submission.test.ts tests/unit/phase-validation-state-machine.test.ts tests/integration/api-v1-trades.test.ts tests/integration/csv-import.test.ts
Result: 4 files passed, 36 tests passed.

bunx eslint app/dashboard/components/import/manual-trade-entry/manual-trade-form.tsx app/dashboard/components/import/manual-trade-entry/manual-trade-form-card.tsx app/dashboard/components/import/manual-trade-entry/manual-trade-submission.ts app/dashboard/components/import/manual-trade-entry/manual-trade-validation-error.tsx tests/ui/manual-trade-submission.test.ts
Result: passed with no findings.

git diff --check
Result: passed.
```

`bun run type-check` was run and is blocked by unrelated concurrent Phase 2 changes in `components/ui/custom-date-range-picker.tsx` and `lib/navigation/registry.ts`. No validation-task type errors were reported, and those unrelated files were not modified by this task.
